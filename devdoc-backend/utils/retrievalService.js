// RAG Retrieval Service

const { generateQueryEmbedding } = require("./embeddingService");

const { searchSimilarChunks } = require("./vectorStore");


async function retrieveRelevantChunks(query, projectId, options = {}) {

    if (typeof query !== "string" || !query.trim()) {
        throw new Error("A valid query is required.");
    }

    if (typeof projectId !== "string" || !projectId.trim()) {
        throw new Error("A valid project ID is required.");
    }

    // STEP 1: Convert the user's question into an embedding.
    const queryEmbedding = await generateQueryEmbedding(query);

    // STEP 2: Search LanceDB for similar code chunks.
    const results = await searchSimilarChunks(
        queryEmbedding,
        projectId,
        options
    );

    // STEP 3: Return only the useful chunk information.
    return results.map((chunk) => ({
        filePath: chunk.relative_path,
        startLine: chunk.start_line,
        endLine: chunk.end_line,
        content: chunk.content,
        distance: chunk._distance,
    }));
}


module.exports = {
    retrieveRelevantChunks,
};