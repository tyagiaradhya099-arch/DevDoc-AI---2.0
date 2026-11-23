//Load Environment variables
require("dotenv").config({
    path: require("path").join(__dirname, ".env"),
});
const express = require("express");
const cors = require("cors");

const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);
const pool = require("./db");

const app = express();

const PORT= 5000;

app.use(express.json());

const allowedOrigins = [
    process.env.CLIENT_URL,
    "http://localhost:5173",
    "http://localhost:5174"
].filter(Boolean);

app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));

if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
}

app.use(session({
    store: new PgSession({
        pool,
        createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000
    }
}));

app.use("/api/auth", require("./routes/auth"));
function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({
            status: "error",
            message: "Authentication required."
        });
    }

    next();
}

const fs = require("fs");
const path = require("path");
const multer = require("multer");
const crypto = require("crypto");
const yauzl = require("yauzl");
const { Transform } = require("stream");
const { pipeline } = require("stream/promises");
const { indexProject } = require("./utils/projectIndexer");
const { retrieveRelevantChunks } = require("./utils/retrievalService");
const { generateAnswer } = require("./utils/generationService");
const { deleteProjectChunks } = require("./utils/vectorStore");

// Track projects currently being indexed.
const indexingProjects = new Set();

const PROJECTS_ROOT = path.join(__dirname, "user-projects");
fs.mkdirSync(PROJECTS_ROOT, {recursive: true});



//TEMPORARY UPLOAD DIRECTORY
const UPLOAD_TEMP = path.join(__dirname, "upload-temp");
fs.mkdirSync(UPLOAD_TEMP, { recursive: true });

const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, callback) => {
            callback(null, UPLOAD_TEMP);
        },

        filename: (req, file, callback) => {
            const randomName = crypto.randomBytes(16).toString("hex");
            callback(null, `${randomName}.zip`);
        },
    }),

    limits: {
        fileSize: 25 * 1024 * 1024, // Maximum 25 MB per upload
        files: 1,                  // Accept only one file per request
    },

    fileFilter: (req, file, callback) => {
        if (path.extname(file.originalname).toLowerCase() !== ".zip") {
            return callback(new Error("Only ZIP files are allowed."));
        }

        callback(null, true);
    },
});
const MAX_ZIP_ENTRIES = 5000;
const MAX_ENTRY_SIZE = 50 * 1024 * 1024; // 50 MB per entry
const MAX_TOTAL_SIZE = 200 * 1024 * 1024; // 200 MB total

//validation function(yauzl) that checks wheather a zip upload is safe or not

function validateZipArchive(zipPath) {
    return new Promise((resolve, reject) => {
        yauzl.open(
            zipPath,
            {
                lazyEntries: true,
                autoClose: true,
                validateEntrySizes: true,
                strictFileNames: false,
            },
            (error, zipFile) => {
                if (error) {
                    return reject(
                        new Error("The uploaded file is not a valid ZIP archive.")
                    );
                }

                let entryCount = 0;
                let totalSize = 0;
                let finished = false;

                const fail = (message) => {
                    if (finished) return;

                    finished = true;
                    zipFile.close();
                    reject(new Error(message));
                };

                zipFile.on("error", () => {
                    console.error("ZIP validation read error:", error);
                    fail("Unable to read the ZIP archive.");
                });

                zipFile.on("entry", (entry) => {
                    if (finished) return;

                    entryCount++;

                    const entryName = entry.fileName;
                    const normalizedName = entryName.replace(/\\/g, "/");
                    const segments = normalizedName.split("/");

                    // Reject unsafe paths.
                    if (
                        !entryName ||
                        entryName.includes("\0") ||
                        normalizedName.startsWith("/") ||
                        /^[a-zA-Z]:/.test(normalizedName) ||
                        segments.some(
                            (segment) => 
                             segment === "." ||
                             segment === ".." || 
                             segment.includes(":")
                        )
                    ) {
                        return fail("The ZIP contains an unsafe file path.");
                    }

                    // Limit the number of entries.
                    if (entryCount > MAX_ZIP_ENTRIES) {
                        return fail("The ZIP contains too many entries.");
                    }

                    // Check the declared uncompressed size.
                    if (
                        !Number.isSafeInteger(entry.uncompressedSize) ||
                        entry.uncompressedSize < 0 ||
                        entry.uncompressedSize > MAX_ENTRY_SIZE
                    ) {
                        return fail("A ZIP entry exceeds the allowed size.");
                    }

                    totalSize += entry.uncompressedSize;

                    if (totalSize > MAX_TOTAL_SIZE) {
                        return fail(
                            "The ZIP contents exceed the total allowed size."
                        );
                    }

                    // Inspect the next entry.
                    zipFile.readEntry();
                });

                zipFile.on("end", () => {
                    if (finished) return;

                    finished = true;

                    resolve({
                        entryCount,
                        totalSize,
                    });
                });

                zipFile.readEntry();
            }
        );
    });
}
// Extraction of ZIP from upload_temp -> user_project
async function extractZipArchive(zipPath, destinationPath) {
    const rootPath = path.resolve(destinationPath);

    await fs.promises.mkdir(rootPath, { recursive: true });

    return new Promise((resolve, reject) => {
        yauzl.open(
            zipPath,
            {
                lazyEntries: true,
                autoClose: true,
                validateEntrySizes: true,
                strictFileNames: false,
            },
            (openError, zipFile) => {
                if (openError) {
                    return reject(
                        new Error("Unable to open the ZIP archive.")
                    );
                }

                let entryCount = 0;
                let declaredTotal = 0;
                let writtenTotal = 0;
                let finished = false;

                const fail = (error) => {
                    if (finished) return;

                    finished = true;

                    try {
                        zipFile.close();
                    } catch {
                        // The archive may already be closed.
                    }

                    reject(error);
                };

                const processEntry = async (entry) => {
                    entryCount++;

                    if (entryCount > MAX_ZIP_ENTRIES) {
                        throw new Error("The ZIP contains too many entries.");
                    }

                    // Normalize paths from different operating systems.
                    const entryName = entry.fileName.replace(/\\/g, "/");
                    const segments = entryName.split("/");

                    // Reject unsafe paths.
                    if (
                        !entryName ||
                        entryName.includes("\0") ||
                        entryName.startsWith("/") ||
                        /^[a-zA-Z]:/.test(entryName) ||
                        segments.some(
                            (segment) =>
                                segment === "." ||
                                segment === ".." ||
                                segment.includes(":")
                        )
                    ) {
                        throw new Error("The ZIP contains an unsafe path.");
                    }

                    // Ensure the destination stays inside the project folder.
                    const outputPath = path.resolve(rootPath, entryName);
                    const relativePath = path.relative(rootPath, outputPath);

                    if (
                        relativePath === ".." ||
                        relativePath.startsWith(`..${path.sep}`) ||
                        path.isAbsolute(relativePath)
                    ) {
                        throw new Error(
                            "The ZIP contains a path outside the project."
                        );
                    }

                    // Reject symbolic links and other special file types.
                    const mode =
                        (entry.externalFileAttributes >>> 16) & 0xffff;
                    const fileType = mode & 0o170000;

                    if (
                        fileType === 0o120000 ||
                        (fileType !== 0 &&
                            fileType !== 0o100000 &&
                            fileType !== 0o040000)
                    ) {
                        throw new Error(
                            "The ZIP contains an unsupported file type."
                        );
                    }

                    // Enforce declared size limits again during extraction.
                    if (
                        !Number.isSafeInteger(entry.uncompressedSize) ||
                        entry.uncompressedSize < 0 ||
                        entry.uncompressedSize > MAX_ENTRY_SIZE
                    ) {
                        throw new Error(
                            "A ZIP entry exceeds the allowed size."
                        );
                    }

                    declaredTotal += entry.uncompressedSize;

                    if (declaredTotal > MAX_TOTAL_SIZE) {
                        throw new Error(
                            "The ZIP contents exceed the total size limit."
                        );
                    }

                    const isDirectory =
                        entryName.endsWith("/") || fileType === 0o040000;

                    if (isDirectory) {
                        await fs.promises.mkdir(outputPath, {
                            recursive: true,
                        });

                        return;
                    }

                    await fs.promises.mkdir(path.dirname(outputPath), {
                        recursive: true,
                    });

                    await new Promise((resolveWrite, rejectWrite) => {
                        zipFile.openReadStream(entry, (streamError, readStream) => {
                            if (streamError) {
                                return rejectWrite(streamError);
                            }

                            let entryBytes = 0;

                            const sizeLimiter = new Transform({
                                transform(chunk, encoding, callback) {
                                    entryBytes += chunk.length;
                                    writtenTotal += chunk.length;

                                    if (
                                        entryBytes > MAX_ENTRY_SIZE ||
                                        writtenTotal > MAX_TOTAL_SIZE
                                    ) {
                                        return callback(
                                            new Error(
                                                "The extracted data exceeds the size limit."
                                            )
                                        );
                                    }

                                    callback(null, chunk);
                                },
                            });

                            pipeline(
                                readStream,
                                sizeLimiter,
                                fs.createWriteStream(outputPath, {
                                    flags: "wx",
                                })
                            ).then(resolveWrite, rejectWrite);
                        });
                    });
                };

                zipFile.on("error", fail);

                zipFile.on("entry", (entry) => {
                    processEntry(entry)
                        .then(() => {
                            if (!finished) {
                                zipFile.readEntry();
                            }
                        })
                        .catch(fail);
                });

                zipFile.on("end", () => {
                    if (finished) return;

                    finished = true;

                    resolve({
                        entryCount,
                        totalBytes: writtenTotal,
                    });
                });

                zipFile.readEntry();
            }
        );
    });
}

function getFiles(directory) {
    const items = fs.readdirSync(directory, { withFileTypes: true });

    let files = [];

    for (const item of items) {

        // Exclude sensitive environment files.
        const name = item.name.toLowerCase();

        if (name === ".env" || name.startsWith(".env.")) {
            continue;
        }

        const fullPath = path.join(directory, item.name);

        if (item.isSymbolicLink()) {
            continue;
        }

        if (item.isDirectory()) {
            files = files.concat(getFiles(fullPath));
        }
        else if (item.isFile()) {
            files.push(fullPath);
        }
    }

    return files;
}


//handling projectfile listing errors
app.get("/api/files", requireAuth, async (req, res) => {
    try {
        const projectId = req.session.activeProjectId;

        if (!projectId) {
            return res.json({
                status: "success",
                files: [],
            });
        }

        const ownerId = req.session.userId;

        // Retrieve the user's active project.
        const result = await pool.query(
            `SELECT id, folder
             FROM projects
             WHERE id = $1 AND owner_id = $2`,
            [projectId, ownerId]
        );

        const project = result.rows[0];

        if (!project) {
            return res.status(404).json({
                status: "error",
                message: "Active project not found.",
            });
        }

        const userRoot = path.resolve(PROJECTS_ROOT, ownerId);
        const projectPath = path.resolve(userRoot, project.folder);

        if (!projectPath.startsWith(userRoot + path.sep)) {
            return res.status(403).json({
                status: "error",
                message: "Invalid project directory.",
            });
        }

        const stats = await fs.promises.lstat(projectPath);

        if (!stats.isDirectory() || stats.isSymbolicLink()) {
            return res.status(400).json({
                status: "error",
                message: "The active project path is not a valid directory.",
            });
        }

        const files = getFiles(projectPath).map(file =>
            path.relative(projectPath, file).replace(/\\/g, "/")
        );

        return res.json({
            status: "success",
            files,
        });

    } catch (error) {
        console.error("Error listing project files:", error);

        return res.status(
            error.code === "ENOENT" ? 404 : 500
        ).json({
            status: "error",
            message: "Unable to list project files.",
        });
    }
});
app.get("/api/file", requireAuth, async (req, res) => {
    try {
        const filePath = req.query.path;

        if (typeof filePath !== "string" || !filePath) {
            return res.status(400).json({
                status: "error",
                message: "A valid file path is required.",
            });
        }

        // Prevent access to environment files.
        const pathParts = filePath.split(/[\\/]/);

        if (
            pathParts.some(part => {
                const name = part.toLowerCase();
                return name === ".env" || name.startsWith(".env.");
            })
        ) {
            return res.status(403).json({
                status: "error",
                message: "Access to sensitive files is not allowed.",
            });
        }

        const projectId = req.session.activeProjectId;

        if (!projectId) {
            return res.status(409).json({
                status: "error",
                message: "No active project. Please upload a project first.",
            });
        }

        const ownerId = req.session.userId;

        // Verify project ownership.
        const result = await pool.query(
            `SELECT id, folder
             FROM projects
             WHERE id = $1 AND owner_id = $2`,
            [projectId, ownerId]
        );

        const project = result.rows[0];

        if (!project) {
            return res.status(404).json({
                status: "error",
                message: "Active project not found.",
            });
        }

        const userRoot = path.resolve(PROJECTS_ROOT, ownerId);
        const projectPath = path.resolve(userRoot, project.folder);

        if (!projectPath.startsWith(userRoot + path.sep)) {
            return res.status(403).json({
                status: "error",
                message: "Invalid project directory.",
            });
        }
        const projectStats = await fs.promises.lstat(projectPath);

        if (!projectStats.isDirectory() || projectStats.isSymbolicLink()) {
            return res.status(404).json({
                status: "error",
                message: "Project not found."
            });
        }

        // Resolve the actual project directory.
        const realProjectPath = await fs.promises.realpath(projectPath);

        // Resolve the requested file.
        const fullPath = path.resolve(realProjectPath, filePath);

        const relativePath = path.relative(
            realProjectPath,
            fullPath
        );

        if (
            relativePath === ".." ||
            relativePath.startsWith(`..${path.sep}`) ||
            path.isAbsolute(relativePath)
        ) {
            return res.status(403).json({
                status: "error",
                message: "Access outside the project directory is not allowed.",
            });
        }

        // Resolve symlinks and verify the final location.
        const realFilePath = await fs.promises.realpath(fullPath);

        const actualRelativePath = path.relative(
            realProjectPath,
            realFilePath
        );

        if (
            actualRelativePath === ".." ||
            actualRelativePath.startsWith(`..${path.sep}`) ||
            path.isAbsolute(actualRelativePath)
        ) {
            return res.status(403).json({
                status: "error",
                message: "Access outside the project directory is not allowed.",
            });
        }

        const stats = await fs.promises.stat(realFilePath);

        if (!stats.isFile()) {
            return res.status(400).json({
                status: "error",
                message: "The requested path is not a file.",
            });
        }

        const content = await fs.promises.readFile(
            realFilePath,
            "utf-8"
        );

        return res.json({
            status: "success",
            content,
        });

    } catch (error) {
        if (error.code === "ENOENT") {
            return res.status(404).json({
                status: "error",
                message: "File not found.",
            });
        }

        console.error("Error reading file:", error);

        return res.status(500).json({
            status: "error",
            message: "Unable to read the requested file.",
        });
    }
});
//backend can tell which project is currently active
app.get("/api/project", requireAuth, async (req, res) => {
    try {
        const projectId = req.session.activeProjectId;

        if (!projectId) {
            return res.json({
                status: "success",
                hasActiveProject: false,
                projectName: null,
            });
        }

        const result = await pool.query(
            `SELECT id, name
             FROM projects
             WHERE id = $1 AND owner_id = $2`,
            [projectId, req.session.userId]
        );

        const project = result.rows[0];

        if (!project) {
            req.session.activeProjectId = null;

            return res.json({
                status: "success",
                hasActiveProject: false,
                projectName: null,
            });
        }

        return res.json({
            status: "success",
            hasActiveProject: true,
            projectName: project.name,
        });

    } catch (error) {
        console.error("Failed to fetch active project:", error);

        return res.status(500).json({
            status: "error",
            message: "Unable to fetch active project.",
        });
    }
});
//RETRIEVE RELEVANT CODE CHUNKS FOR A USER QUESTION.
app.post("/api/retrieve", requireAuth, async (req, res) => {
    try {
        const { query, limit = 5 } = req.body || {};

        // Validate the question.
        if (typeof query !== "string" || !query.trim()) {
            return res.status(400).json({
                status: "error",
                message: "A valid question is required.",
            });
        }

        if (!Number.isInteger(limit) || limit < 1 || limit > 10) {
            return res.status(400).json({
                status: "error",
                message: "Limit must be a positive integer.",
            });
        }

        // Get the active project from the user's session.
        const projectId = req.session.activeProjectId;

        if (!projectId) {
            return res.status(400).json({
                status: "error",
                message: "No active project found.",
            });
        }

        // Verify that the project belongs to the authenticated user.
        const result = await pool.query(
            `SELECT id, indexing_status
             FROM projects
             WHERE id = $1 AND owner_id = $2`,
            [projectId, req.session.userId]
        );

        const project = result.rows[0];

        if (!project) {
            return res.status(404).json({
                status: "error",
                message: "Active project not found.",
            });
        }

        // Ensure the project has been indexed.
        if (project.indexing_status !== "indexed") {
            return res.status(409).json({
                status: "error",
                message: "Please index the project before asking questions.",
            });
        }

        // Retrieve relevant code chunks.
        const chunks = await retrieveRelevantChunks(
            query,
            project.id,
            { limit }
        );

        return res.json({
            status: "success",
            projectId: project.id,
            query,
            chunks,
        });

    } catch (error) {
        console.error("Code retrieval failed:", error);

        return res.status(500).json({
            status: "error",
            message: "Unable to retrieve relevant code.",
        });
    }
});
//COMPLETE RAG QUESTION-ANSWERING ENDPOINT.
app.post("/api/chat", requireAuth, async (req, res) => {
    try {
        const { query, limit = 5 } = req.body || {};

        // Validate the question.
        if (typeof query !== "string" || !query.trim()) {
            return res.status(400).json({
                status: "error",
                message: "A valid question is required.",
            });
        }

        if (!Number.isInteger(limit) || limit < 1 || limit > 10) {
            return res.status(400).json({
                status: "error",
                message: "Limit must be between 1 and 10.",
            });
        }

        // Get the active project from the user's session.
        const projectId = req.session.activeProjectId;

        if (!projectId) {
            return res.status(400).json({
                status: "error",
                message: "No active project found.",
            });
        }

        // Verify project ownership and indexing status.
        const result = await pool.query(
            `SELECT id, indexing_status
             FROM projects
             WHERE id = $1 AND owner_id = $2`,
            [projectId, req.session.userId]
        );

        const project = result.rows[0];

        if (!project) {
            return res.status(404).json({
                status: "error",
                message: "Active project not found.",
            });
        }

        if (project.indexing_status !== "indexed") {
            return res.status(409).json({
                status: "error",
                message: "Please index the project first.",
            });
        }

        // STEP 1: Retrieve relevant code.
        const chunks = await retrieveRelevantChunks(
            query,
            project.id,
            { limit }
        );

        // STEP 2: Generate an answer using retrieved code.
        const answer = await generateAnswer(query, chunks);

        // STEP 3: Return answer and sources.
        return res.json({
            status: "success",
            projectId: project.id,
            query,
            answer,
            sources: chunks.map((chunk) => ({
                filePath: chunk.filePath,
                startLine: chunk.startLine,
                endLine: chunk.endLine,
            })),
        });

    } 
    catch (error) {
    console.error("RAG response failed:", error);

    const errorStatus = Number(error.status || error.code);

    if (errorStatus === 503) {
        return res.status(503).json({
            status: "error",
            message: "DevDoc AI is temporarily unavailable due to high server demand. Please try again in a few minutes.",
            retryable: true,
        });
    }

    if (errorStatus === 429) {
        return res.status(429).json({
            status: "error",
            message: "DevDoc AI has reached its request limit. Please try again later.",
            retryable: true,
        });
    }

    return res.status(500).json({
        status: "error",
        message: "Unable to generate an answer. Please try again.",
        retryable: false,
    });
}
});
//API endpoint to retrive database
app.get("/api/projects", requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                id,
                name,
                created_at,
                indexing_status,
                indexed_chunk_count,
                indexed_file_count,
                indexed_at,
                indexing_error
            FROM projects
            WHERE owner_id = $1
            ORDER BY created_at DESC`,
            [req.session.userId]
        );

        const projectList = result.rows.map((project) => ({
            id: project.id,
            name: project.name,
            createdAt: project.created_at,
            isActive: project.id === req.session.activeProjectId,
            indexingStatus: project.indexing_status || "pending",
            indexedChunkCount: project.indexed_chunk_count || 0,
            indexedFileCount: project.indexed_file_count || 0,
            indexedAt: project.indexed_at || null,
            indexingError: project.indexing_error || null
        }));

        return res.json({
            status: "success",
            projects: projectList
        });

    } catch (error) {
        console.error("Failed to load project library:", error);

        return res.status(500).json({
            status: "error",
            message: "Unable to load the project library."
        });
    }
});
//
//START PROJECT INDEXING IN THE BACKGROUND - BACKGROUND INDEXING
async function runProjectIndexing(projectId, ownerId) {
    const indexingKey = `${ownerId}:${projectId}`;

    try {
        // Retrieve the project from PostgreSQL.
        const projectResult = await pool.query(
            `SELECT id, owner_id, folder
             FROM projects
             WHERE id = $1 AND owner_id = $2`,
            [projectId, ownerId]
        );

        const project = projectResult.rows[0];

        if (!project) {
            throw new Error("Project not found.");
        }

        // Run the complete RAG indexing pipeline.
        const result = await indexProject(project);

        // Update indexing information in PostgreSQL.
        await pool.query(
            `UPDATE projects
             SET indexing_status = $1,
                 indexed_chunk_count = $2,
                 indexed_file_count = $3,
                 indexed_at = NOW(),
                 indexing_error = NULL
             WHERE id = $4 AND owner_id = $5`,
            [
                result.status === "empty" ? "empty" : "indexed",
                result.summary.embeddedChunks || 0,
                result.summary.extractedFiles || 0,
                projectId,
                ownerId
            ]
        );

        console.log(
            `Project indexing completed: ${projectId}`
        );

    } catch (error) {
        console.error("Project indexing failed:", error);

        // Mark the project as failed in PostgreSQL.
        try {
            await pool.query(
                `UPDATE projects
                 SET indexing_status = 'failed',
                     indexing_error = $1
                 WHERE id = $2 AND owner_id = $3`,
                [error.message, projectId, ownerId]
            );

        } catch (statusError) {
            console.error(
                "Unable to update indexing status:",
                statusError
            );
        }

    } finally {
        // Allow future indexing requests.
        indexingProjects.delete(indexingKey);
    }
}

// API endpoint to start indexing.
app.post("/api/projects/:id/index", requireAuth, async (req, res) => {
    try {
        const projectId = req.params.id;
        const ownerId = req.session.userId;

        // Verify that this project belongs to the logged-in user.
        const projectResult = await pool.query(
            `SELECT id
             FROM projects
             WHERE id = $1 AND owner_id = $2`,
            [projectId, ownerId]
        );

        if (projectResult.rows.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Project not found.",
            });
        }

        const indexingKey = `${ownerId}:${projectId}`;

        // Prevent duplicate indexing requests.
        if (indexingProjects.has(indexingKey)) {
            return res.status(409).json({
                status: "error",
                message: "Project indexing is already in progress.",
            });
        }

        const updateResult = await pool.query(
            `UPDATE projects
             SET indexing_status = 'indexing',
                indexing_error = NULL
            WHERE id = $1
               AND owner_id = $2
               AND COALESCE(indexing_status, 'pending')
                   NOT IN ('indexing', 'deleting')
            RETURNING id`,
           [projectId, ownerId]
        );

        if (updateResult.rows.length === 0) {
           return res.status(409).json({
                status: "error",
                message: "Project is currently being indexed or deleted.",
            });
        }
        // Register the background task.
        indexingProjects.add(indexingKey);

        // Start indexing without waiting for completion.
        void runProjectIndexing(projectId, ownerId);

        return res.status(202).json({
            status: "accepted",
            message: "Project indexing has started.",
            projectId,
            indexingStatus: "indexing",
        });

    } catch (error) {
        console.error("Unable to start project indexing:", error);

        await pool.query(
            `UPDATE projects
             SET indexing_status = 'pending'
             WHERE id = $1
               AND owner_id = $2
               AND indexing_status = 'deleting'`,
            [projectId, ownerId]
        ).catch((statusError) => {
            console.error("Failed to restore project status:", statusError);
        });

        return res.status(500).json({
            status: "error",
            message: "Unable to start project indexing.",
        });
    }
});
//  RENAME A SAVED PROJECT

app.patch("/api/projects/:id/rename", requireAuth, async (req, res) => {
    try {
        const projectId = req.params.id;
        const requestedName = req.body?.name;

        // Validate the requested name.
        if (
            typeof requestedName !== "string" ||
            !requestedName.trim() ||
            requestedName.trim().length > 80
        ) {
            return res.status(400).json({
                status: "error",
                message: "Project name must contain 1–80 characters.",
            });
        }

        const newName = requestedName.trim();

        // Update only the authenticated user's project.
        const result = await pool.query(
            `UPDATE projects
             SET name = $1
             WHERE id = $2 AND owner_id = $3
             RETURNING id, name`,
            [newName, projectId, req.session.userId]
        );

        const project = result.rows[0];

        if (!project) {
            return res.status(404).json({
                status: "error",
                message: "Project not found in the library.",
            });
        }

        return res.json({
            status: "success",
            message: "Project renamed successfully.",
            projectId: project.id,
            projectName: project.name,
        });

    } catch (error) {
        console.error("Failed to rename project:", error);

        return res.status(500).json({
            status: "error",
            message: "Unable to rename the project.",
        });
    }
});
//
// ACTIVATE A SAVED PROJECT
app.post("/api/projects/:id/activate", requireAuth, async (req, res) => {
    try {
        const projectId = req.params.id;
        const ownerId = req.session.userId;

        // Find the project owned by the logged-in user.
        const result = await pool.query(
            `SELECT id, name, folder
             FROM projects
             WHERE id = $1 AND owner_id = $2`,
            [projectId, ownerId]
        );

        const project = result.rows[0];

        if (!project) {
            return res.status(404).json({
                status: "error",
                message: "Project not found in the library.",
            });
        }

        // Ensure the stored folder name is valid.
        if (
            typeof project.folder !== "string" ||
            !project.folder ||
            project.folder === "." ||
            project.folder === ".." ||
            path.basename(project.folder) !== project.folder
        ) {
            return res.status(400).json({
                status: "error",
                message: "Invalid project folder.",
            });
        }

        // Resolve the user's project directory safely.
        const userRoot = path.resolve(PROJECTS_ROOT, ownerId);
        const destinationPath = path.resolve(userRoot, project.folder);

        if (!destinationPath.startsWith(userRoot + path.sep)) {
            return res.status(403).json({
                status: "error",
                message: "Access outside the user's project library is not allowed.",
            });
        }

        // Verify that the project directory exists.
        const stats = await fs.promises.lstat(destinationPath);

        if (!stats.isDirectory() || stats.isSymbolicLink()) {
            return res.status(400).json({
                status: "error",
                message: "The selected project is not a valid directory.",
            });
        }

        // Set the active project for this user's session.
        req.session.activeProjectId = project.id;

        return res.json({
            status: "success",
            message: "Project activated successfully.",
            projectId: project.id,
            projectName: project.name,
            hasActiveProject: true,
        });

    } catch (error) {
        console.error("Failed to activate project:", error);

        return res.status(
            error.code === "ENOENT" ? 404 : 500
        ).json({
            status: "error",
            message: "Unable to activate the selected project.",
        });
    }
});
//
// DELETE A SAVED PROJECT
app.delete("/api/projects/:id", requireAuth, async (req, res) => {
    const projectId = req.params.id;
    const ownerId = req.session.userId;

    try {
        // 1. Find the project owned by the authenticated user.
        const result = await pool.query(
            `SELECT id, folder
             FROM projects
             WHERE id = $1 AND owner_id = $2`,
            [projectId, ownerId]
        );

        const project = result.rows[0];

        if (!project) {
            return res.status(404).json({
                status: "error",
                message: "Project not found in the library.",
            });
        }

        // 2. Check whether indexing is already running.
        const indexingKey = `${ownerId}:${projectId}`;

        if (indexingProjects.has(indexingKey)) {
            return res.status(409).json({
                status: "error",
                message: "Cannot delete a project while indexing is in progress.",
            });
        }

        // 3. Validate the stored folder name.
        if (
            typeof project.folder !== "string" ||
            !project.folder ||
            project.folder === "." ||
            project.folder === ".." ||
            path.basename(project.folder) !== project.folder
        ) {
            return res.status(400).json({
                status: "error",
                message: "Invalid project folder.",
            });
        }

        // 4. Resolve the folder inside this user's directory.
        const userRoot = path.resolve(PROJECTS_ROOT, ownerId);
        const destinationPath = path.resolve(userRoot, project.folder);

        if (!destinationPath.startsWith(userRoot + path.sep)) {
            return res.status(403).json({
                status: "error",
                message: "Invalid project location.",
            });
        }

        // 5. Check whether the project folder exists.
        let folderExists = false;

        try {
            const stats = await fs.promises.lstat(destinationPath);

            if (!stats.isDirectory() || stats.isSymbolicLink()) {
                return res.status(400).json({
                    status: "error",
                    message: "The project folder is invalid.",
                });
            }

            folderExists = true;

        } catch (folderError) {
            if (folderError.code !== "ENOENT") {
                throw folderError;
            }
        }

        // 6. Atomically claim the project for deletion.
        const claimResult = await pool.query(
            `UPDATE projects
             SET indexing_status = 'deleting'
             WHERE id = $1
               AND owner_id = $2
               AND COALESCE(indexing_status, 'pending')
                   NOT IN ('indexing', 'deleting')
             RETURNING id`,
            [projectId, ownerId]
        );

        if (claimResult.rows.length === 0) {
            return res.status(409).json({
                status: "error",
                message: "Project is currently being indexed or deleted.",
            });
        }

        // 7. Delete the project's vector data.
        await deleteProjectChunks(projectId);

        // 8. Delete the project folder if it exists.
        if (folderExists) {
            await fs.promises.rm(destinationPath, {
                recursive: true,
                force: false,
            });
        }

        // 9. Delete the PostgreSQL record.
        await pool.query(
            `DELETE FROM projects
             WHERE id = $1 AND owner_id = $2`,
            [projectId, ownerId]
        );

        // 10. Clear the active project from this user's session.
        if (req.session.activeProjectId === projectId) {
            req.session.activeProjectId = null;
        }

        return res.json({
            status: "success",
            message: "Project deleted successfully.",
            deletedProjectId: projectId,
            hasActiveProject: Boolean(req.session.activeProjectId),
        });

    } catch (error) {
        console.error("Failed to delete project:", error);

        // Mark the project as failed so deletion can be retried.
        await pool.query(
            `UPDATE projects
             SET indexing_status = 'failed',
                 indexing_error = $1
             WHERE id = $2
               AND owner_id = $3
               AND indexing_status = 'deleting'`,
            [
                `Deletion failed: ${error.message}`,
                projectId,
                ownerId
            ]
        ).catch((statusError) => {
            console.error("Failed to update project status:", statusError);
        });

        return res.status(500).json({
            status: "error",
            message: "Unable to delete the project.",
        });
    }
});

//
//upload endpoint
app.post("/api/upload", requireAuth, (req, res) => {
    upload.single("project")(req, res, async (uploadError) => {
        if (uploadError) {
            const isTooLarge = uploadError.code === "LIMIT_FILE_SIZE";

            return res.status(isTooLarge ? 413 : 400).json({
                status: "error",
                message: isTooLarge
                    ? "The ZIP file exceeds the 25 MB upload limit."
                    : uploadError.message || "Unable to upload the ZIP file.",
            });
        }

        if (!req.file) {
            return res.status(400).json({
                status: "error",
                message: "Please upload a ZIP file.",
            });
        }

        let destinationPath;

        try {
            const ownerId = req.session.userId;

            // Step 1: Validate the archive.
            await validateZipArchive(req.file.path);

            // Step 2: Create a unique project folder.
            const projectFolder = `project-${crypto.randomBytes(12).toString("hex")}`;

            // Step 3: Create the user's private project directory.
            const userRoot = path.join(PROJECTS_ROOT, ownerId);

            await fs.promises.mkdir(userRoot, {
                recursive: true,
            });

            destinationPath = path.join(userRoot, projectFolder);

            // Step 4: Extract the archive.
            const result = await extractZipArchive(
                req.file.path,
                destinationPath
            );

            // Step 5: Create a safe display name.
            const originalName = path.basename(
                req.file.originalname,
                path.extname(req.file.originalname)
            );

            const displayName =
                originalName
                    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
                    .trim()
                    .slice(0, 80) || "Uploaded project";

            // Step 6: Save the project in PostgreSQL.
            await pool.query(
                `INSERT INTO projects
                    (id, owner_id, name, folder, indexing_status,
                     indexed_chunk_count, indexed_file_count)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    projectFolder,
                    ownerId,
                    displayName,
                    projectFolder,
                    "pending",
                    0,
                    0
                ]
            );

            // Step 7: Set the active project for this session.
            req.session.activeProjectId = projectFolder;

            return res.json({
                status: "success",
                message: "Project uploaded and extracted successfully.",
                projectName: displayName,
                entryCount: result.entryCount,
                totalUncompressedBytes: result.totalBytes,
            });

        } catch (error) {
            console.error("Project upload failed:", error);

            // Remove any partially extracted project.
            if (destinationPath) {
                await fs.promises.rm(destinationPath, {
                    recursive: true,
                    force: true,
                }).catch((cleanupError) => {
                    console.error(
                        "Failed to clean up extracted project:",
                        cleanupError
                    );
                });
            }

            return res.status(500).json({
                status: "error",
                message: "The project could not be uploaded successfully.",
            });

        } finally {
            // Remove the temporary ZIP after processing.
            await fs.promises.unlink(req.file.path).catch((cleanupError) => {
                if (cleanupError.code !== "ENOENT") {
                    console.error(
                        "Failed to remove temporary ZIP:",
                        cleanupError
                    );
                }
            });
        }
    });
});
app.listen(PORT, () => {
    console.log(`DevDoc backend running on http://localhost:${PORT}`);
});