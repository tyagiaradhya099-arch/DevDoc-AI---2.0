const express = require("express");
const cors = require("cors");

const app = express();

const PORT= 5000;

app.use(express.json());
app.use(cors());

const fs = require("fs");
const path = require("path");
const multer = require("multer");
const crypto = require("crypto");
const yauzl = require("yauzl");
const { Transform } = require("stream");
const { pipeline } = require("stream/promises");

let activeProjectPath = path.join(__dirname, "sample-project");
let activeProjectName = path.basename(activeProjectPath);

const PROJECTS_ROOT = path.join(__dirname, "user-projects");
fs.mkdirSync(PROJECTS_ROOT, {recursive: true});
//temporary upload directory
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
                            (segment) => segment === "." || segment === ".."
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

    for(const item of items) {
        console.log(item);
        const fullPath = path.join(directory, item.name);

        if(item.isDirectory()) {
            files = files.concat(getFiles(fullPath));
        }
        else {
            files.push(fullPath);
        }
    }
    return files;
}

//handling projectfile listing errors
app.get("/api/files", (req, res) => {
    try {
        const stats = fs.statSync(activeProjectPath);

        if (!stats.isDirectory()) {
            return res.status(400).json({
                status: "error",
                message: "The active project path is not a directory.",
            });
        }

        const files = getFiles(activeProjectPath).map(file =>
            path.relative(activeProjectPath, file).replace(/\\/g, "/")
        );

        return res.json({
            status: "success",
            files: files,
        });

    } catch (error) {
        console.error("Error listing project files:", error);

        if (error.code === "ENOENT") {
            return res.status(404).json({
                status: "error",
                message: "The active project directory was not found.",
            });
        }

        return res.status(500).json({
            status: "error",
            message: "Unable to list project files.",
        });
    }
});
app.get("/api/file", (req, res) => {
    const filePath = req.query.path;

    // check that the requested path is valid
    if(typeof filePath !== "string" || !filePath) {
        return res.status(400).json({
           status: "error",
           message: "A valid file path is required.", 
        });
    }
     // Resolve the requested path to an absolute path.
    const fullPath = path.join(activeProjectPath, filePath);

     // Calculate the path relative to the project directory.
     const relativePath = path.relative(activeProjectPath, fullPath);

     //prevent access outside the project directory.
     if(
        relativePath === ".." || 
        relativePath.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relativePath)
     ) {
        return res.status(403).json({
           status: "error",
           message: "Access outside the project directory is not allowed.",
        });
     }

    //handling  missing files(in case backend try to read a deleted file) 
   try {
    const stats = fs.statSync(fullPath);

    if (!stats.isFile()) {
      return res.status(400).json({
        status: "error",
        message: "The requested path is not a file.",
      });
    }

    const content = fs.readFileSync(fullPath, "utf-8");

    return res.json({
      status: "success",
      content: content,
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
app.get("/api/project", (req, res) => {
    res.json({
        status: "success",
        projectName: activeProjectName,
    });
});
//upload endpoint
app.post("/api/upload", (req, res) => {
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
            // Step 1: Validate the archive.
            await validateZipArchive(req.file.path);

            // Step 2: Create a unique destination for this project.
            const projectFolder = `project-${crypto.randomBytes(12).toString("hex")}`;

            destinationPath = path.join(PROJECTS_ROOT, projectFolder);

            // Step 3: Extract the archive.
            const result = await extractZipArchive(
                req.file.path,
                destinationPath
            );

            // Step 4: Create a safe display name.
            const originalName = path.basename(
                req.file.originalname,
                path.extname(req.file.originalname)
            );

            const displayName =
                originalName
                    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
                    .trim()
                    .slice(0, 80) || "Uploaded project";

            // Step 5: Switch projects only after extraction succeeds.
            activeProjectPath = destinationPath;
            activeProjectName = displayName;

            return res.json({
                status: "success",
                message: "Project uploaded and extracted successfully.",
                projectName: activeProjectName,
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

            return res.status(400).json({
                status: "error",
                message:
                    "The project could not be validated or safely extracted.",
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