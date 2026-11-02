// LanceDB Vector Store

const path = require("path");
const crypto = require("crypto");

const DB_PATH = path.join(__dirname, "..", "vector-store");

const TABLE_NAME = "code_chunks";

const VECTOR_DIMENSIONS = 768;

// Reuse one database connection.
let databasePromise = null;

//1.Establish database connection.
async function getDatabase() {
    if(!databasePromise) {
        databasePromise = (async () => {
            const fs = require("fs/promises");

            // Ensure the database directory exists.
            await fs.mkdir(DB_PATH, { recursive: true });

            // Load LanceDB using dynamic import.
            const { connect } = await import("@lancedb/lancedb");

            return await connect(DB_PATH);

        })().catch((error) => {

            databasePromise = null;
            throw error;
        });
    }
    return databasePromise;
}

//2. Find an existing table or create one.
async function getCodeChunksTable(initialRecords = []) {
    const db = await getDatabase();

    // List existing tables.
    const existingTables = [];

    for await (const name of db.listTables()) {
        existingTables.push(name);
    }
        // Open the table if it already exists.
    if (existingTables.includes(TABLE_NAME)) {
        return await db.openTable(TABLE_NAME);
    }

    // A table needs initial records to establish its schema.
    if (initialRecords.length === 0) {
        return null;
    }

    // Create the table using the first batch of records.
    return await db.createTable(
        TABLE_NAME,
        initialRecords
    );
}

//3.Generate a stable ID for each chunk.
function createChunkId(projectId, chunk) {

    const uniqueValue = [
        projectId,
        chunk.relativePath,
        chunk.chunkIndex,
    ].join("\0");

    return crypto
    .createHash("sha256")
    .update(uniqueValue)
    .digest("hex");
}
//4.Prepare chunks for database storage.
function prepareRecords(projectId, embeddedChunks) {
    if (
        typeof projectId !== "string" || 
        !projectId.trim()
    ) {
        throw new Error("A valid project ID is required.");
    }
        if (!Array.isArray(embeddedChunks)) {
        throw new Error("A valid list of embedded chunks is required.");
    }
    
    return embeddedChunks.map((chunk) => {
        
        if(
            !Array.isArray(chunk.embedding) ||
            chunk.embedding.length !== VECTOR_DIMENSIONS ||
            !chunk.embedding.every(Number.isFinite)
        ) {
            throw new Error(
                `Invalid embedding for ${chunk.relativePath}`
            );
        }
                if (
            typeof chunk.content !== "string" ||
            typeof chunk.relativePath !== "string"
        ) {
            throw new Error("Invalid chunk metadata.");
        }
        return {
            id: createChunkId(projectId, chunk),

            project_id: projectId,

            relative_path: chunk.relativePath,

            extension: chunk.extension,

            chunk_index: chunk.chunkIndex,

            start_line: chunk.startLine,

            end_line: chunk.endLine,

            token_count: chunk.tokenCount ?? 0,

            content: chunk.content,

            embedding_model: "gemini-embedding-2",

            vector: chunk.embedding,

            indexed_at: new Date().toISOString(),

        };

    });
}
//5. Store embedded chunks.
async function storeEmbeddedChunks(projectId, embeddedChunks) {
    const records = prepareRecords(projectId, embeddedChunks);

    if(records.length === 0) {
        return {
            storedCount: 0,
            projectId,
            storedChunkId: [],
            message: "No chunks to store.",
        };
    }

    const table = await getCodeChunksTable(records);

        // Insert new records or update matching IDs.
    await table
        .mergeInsert("id")
        .whenMatchedUpdateAll()
        .whenNotMatchedInsertAll()
        .execute(records);

    const projectChunkCount = await table.countRows(
        `project_id = '${projectId.replace(/'/g, "''")}'`
    );

    return {
        status: "success",
        projectId,
        storedCount: records.length,
        totalProjectChunks: projectChunkCount,
        storedChunkIds: records.map((record) => record.id),
    };
}
// Delete outdated chunks belonging to a project.
async function deleteStaleProjectChunks(projectId, indexingStartedAt) {

    if (
        typeof projectId !== "string" ||
        !projectId.trim()
    ) {
        throw new Error("A valid project ID is required.");
    }

    const cutoffDate = new Date(indexingStartedAt);

    if (Number.isNaN(cutoffDate.getTime())) {
        throw new Error("A valid indexing start time is required.");
    }

    const table = await getCodeChunksTable();

    if (!table) {
        return {
            deletedCount: 0,
            projectId,
        };
    }

    const safeProjectId = projectId.replace(/'/g, "''");
    const cutoffTimestamp = cutoffDate.toISOString();

    const staleFilter =
        `project_id = '${safeProjectId}' AND indexed_at < '${cutoffTimestamp}'`;

    const deletedCount = await table.countRows(staleFilter);

    if (deletedCount > 0) {
        await table.delete(staleFilter);
    }

    return {
        status: "success",
        projectId,
        deletedCount,
    };
}

// 6. Count stored chunks for a project.
async function getProjectChunkCount(projectId) {

    const table = await getCodeChunksTable();

    if (!table) {
        return 0;
    }

    return await table.countRows(
        `project_id = '${projectId.replace(/'/g, "''")}'`
    );
}
// Remove outdated chunks after a successful re-indexing run.
async function deleteStaleProjectChunks(projectId, indexingStartedAt) {

    if (
        typeof projectId !== "string" ||
        !projectId.trim()
    ) {
        throw new Error("A valid project ID is required.");
    }

    const cutoffDate = new Date(indexingStartedAt);

    if (Number.isNaN(cutoffDate.getTime())) {
        throw new Error("A valid indexing start time is required.");
    }

    const table = await getCodeChunksTable();

    if (!table) {
        return {
            deletedCount: 0,
            projectId,
        };
    }

    const safeProjectId = projectId.replace(/'/g, "''");
    const cutoffTimestamp = cutoffDate.toISOString();

    const staleFilter =
        `project_id = '${safeProjectId}' AND indexed_at < '${cutoffTimestamp}'`;

    const deletedCount = await table.countRows(staleFilter);

    if (deletedCount > 0) {
        await table.delete(staleFilter);
    }

    return {
        status: "success",
        projectId,
        deletedCount,
    };
}
//7. Search for similar code chunks.
async function searchSimilarChunks(
    queryEmbedding,
    projectId,
    options = {}
) {
    if (
        !Array.isArray(queryEmbedding) ||
        queryEmbedding.length !== VECTOR_DIMENSIONS ||
        !queryEmbedding.every(Number.isFinite)
    ) {
        throw new Error("Invalid query embedding.");
    }

    if (
        typeof projectId !== "string" ||
        !projectId.trim()
    ) {
        throw new Error("A valid project ID is required.");
    }

    const limit = options.limit ?? 5;

    if (!Number.isInteger(limit) || limit < 1) {
        throw new Error("Search limit must be a positive integer.");
    }

    const table = await getCodeChunksTable();

    if (!table) {
        return [];
    }

    const safeProjectId = projectId.replace(/'/g, "''");

    const results = await table
        .vectorSearch(queryEmbedding)
        .distanceType("cosine")
        .where(`project_id = '${safeProjectId}'`)
        .limit(limit)
        .toArray();

    return results;
}
// Export database operations.
module.exports = {
    getDatabase,
    storeEmbeddedChunks,
    getProjectChunkCount,
    searchSimilarChunks,
    deleteStaleProjectChunks,
};
