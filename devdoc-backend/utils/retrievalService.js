// RAG Retrieval Service

const { generateQueryEmbedding } = require("./embeddingService");

const { searchSimilarChunks,
        searchChunksByKeywords,
} = require("./vectorStore");

async function retrieveRelevantChunks(query, projectId, options = {}) {
    if (typeof query !== "string" || !query.trim()) {
        throw new Error("A valid query is required.");
    }

    if (typeof projectId !== "string" || !projectId.trim()) {
        throw new Error("A valid project ID is required.");
    }

    const limit = options.limit ?? 5;
    const candidateLimit = Math.max(limit * 3, 10);

    // STEP 1: Run semantic and keyword retrieval.
    const [queryEmbedding, keywordResults] = await Promise.all([
        generateQueryEmbedding(query),
        searchChunksByKeywords(query, projectId, {
            limit: candidateLimit,
        }),
    ]);

    // STEP 2: Retrieve semantically similar chunks.
    const vectorResults = await searchSimilarChunks(
        queryEmbedding,
        projectId,
        { limit: candidateLimit }
    );
    

    // STEP 3: Merge results using Reciprocal Rank Fusion.
    const mergedResults = new Map();

    function addResults(results, source) {
        results.forEach((chunk, index) => {
            const key = `${chunk.relative_path}:${chunk.chunk_index}`;

            if (!mergedResults.has(key)) {
                mergedResults.set(key, {
                    ...chunk,
                    fusionScore: 0,
                });
            }

            const existing = mergedResults.get(key);

            const weight = source === "keyword" ? 2 : 1;

            existing.fusionScore += weight / (60 + index + 1);

            if (source === "vector") {
                existing._distance = chunk._distance;
            }
        });
    }

    addResults(vectorResults, "vector");
    addResults(keywordResults, "keyword");

    // STEP 4: Rank combined results.
    return [...mergedResults.values()]
        .sort((a, b) => b.fusionScore - a.fusionScore)
        .slice(0, limit)
        .map(chunk => ({
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