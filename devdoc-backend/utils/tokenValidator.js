// Token Validator

const { countTokensForChunk } = require("./embeddingService");

// Gemini Embedding 2 input limit
const MODEL_MAX_TOKENS = 8192;

// Our safer working limit
const DEFAULT_MAX_TOKENS = 7500;

// Overlap when splitting oversized chunks
const DEFAULT_SPLIT_OVERLAP_LINES = 5;

// Prevent excessively deep recursive splitting
const DEFAULT_MAX_SPLIT_DEPTH = 30;


// Main token validation function
async function validateAndSplitChunks(chunks, options = {}) {

    const maxTokens =
        options.maxTokens ?? DEFAULT_MAX_TOKENS;

    const splitOverlapLines =
        options.splitOverlapLines ?? DEFAULT_SPLIT_OVERLAP_LINES;

    const maxSplitDepth =
        options.maxSplitDepth ?? DEFAULT_MAX_SPLIT_DEPTH;


    // Validate configuration.
    if (
        !Number.isInteger(maxTokens) ||
        maxTokens <= 0 ||
        maxTokens > MODEL_MAX_TOKENS
    ) {
        throw new Error("Invalid token limit.");
    }

    if (
        !Number.isInteger(splitOverlapLines) ||
        splitOverlapLines < 0
    ) {
        throw new Error("Invalid split overlap.");
    }

    if (
        !Number.isInteger(maxSplitDepth) ||
        maxSplitDepth <= 0
    ) {
        throw new Error("Invalid maximum split depth.");
    }

    if (!Array.isArray(chunks)) {
        throw new Error("A valid list of chunks is required.");
    }


    const validatedChunks = [];

    let tokenCountRequests = 0;
    let splitOperations = 0;
    let largestTokenCount = 0;


    // Process and validate an individual chunk.
    async function processChunk(chunk, depth = 0) {

        // Count the actual tokens using Gemini.
        const tokenCount = await countTokensForChunk(chunk);

        tokenCountRequests++;

        largestTokenCount = Math.max(
            largestTokenCount,
            tokenCount
        );


        // Accept chunks within our configured limit.
        if (tokenCount <= maxTokens) {

            validatedChunks.push({
                ...chunk,
                tokenCount,
            });

            return;
        }


        // Prevent infinite recursive splitting.
        if (depth >= maxSplitDepth) {
            throw new Error(
                `Unable to split oversized chunk: ${chunk.relativePath}`
            );
        }


        const lines = chunk.content.split("\n");


        // CASE 1: Chunk contains multiple lines.
        if (lines.length > 1) {

            const midpoint = Math.floor(lines.length / 2);

            const allowedOverlap = Math.min(
                splitOverlapLines,
                Math.floor((lines.length - 2) / 2)
            );

            const leftEnd = midpoint + allowedOverlap;
            const rightStart = midpoint - allowedOverlap;

            splitOperations++;


            // Create the left part.
            const leftChunk = {
                ...chunk,

                content: lines
                    .slice(0, leftEnd)
                    .join("\n"),

                startLine: chunk.startLine,

                endLine: chunk.startLine + leftEnd - 1,
            };


            // Create the right part.
            const rightChunk = {
                ...chunk,

                content: lines
                    .slice(rightStart)
                    .join("\n"),

                startLine: chunk.startLine + rightStart,

                endLine: chunk.endLine,
            };


            // Validate both parts recursively.
            await processChunk(leftChunk, depth + 1);

            await processChunk(rightChunk, depth + 1);

            return;
        }


        // CASE 2: A single line is too large.
        // Split it using Unicode code points.
        const characters = Array.from(chunk.content);

        if (characters.length <= 1) {
            throw new Error(
                `Unable to split this oversized content further: ${chunk.relativePath}`
            );
        }

        const midpoint = Math.floor(characters.length / 2);

        splitOperations++;


        const leftChunk = {
            ...chunk,
            content: characters.slice(0, midpoint).join(""),
        };

        const rightChunk = {
            ...chunk,
            content: characters.slice(midpoint).join(""),
        };


        await processChunk(leftChunk, depth + 1);

        await processChunk(rightChunk, depth + 1);
    }


    // Validate every incoming chunk.
    for (const chunk of chunks) {
        await processChunk(chunk);
    }


    // Assign fresh sequential indexes after splitting.
    const chunkIndexes = new Map();

    const finalChunks = validatedChunks.map((chunk) => {

        const currentIndex =
            chunkIndexes.get(chunk.relativePath) || 0;

        const nextIndex = currentIndex + 1;

        chunkIndexes.set(chunk.relativePath, nextIndex);

        return {
            ...chunk,
            chunkIndex: nextIndex,
        };
    });


    // Return validated chunks and statistics.
    return {
        chunks: finalChunks,

        summary: {
            inputChunkCount: chunks.length,
            validatedChunkCount: finalChunks.length,
            splitOperations,
            tokenCountRequests,
            maxTokens,
            largestTokenCount,
        },
    };
}


// Export the validator.
module.exports = {
    validateAndSplitChunks,
};