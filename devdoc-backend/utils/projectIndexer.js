// Project Indexing Orchestrator

const path = require("path");
const fs = require("fs/promises");

const { scanProjectFiles } = require("./filescanner");
const { extractFileContents } = require("./contentExtractor");
const { chunkFiles } = require("./chunker");
const { validateAndSplitChunks } = require("./tokenValidator");

const { generateEmbeddingForChunk } = require("./embeddingService");
const { storeEmbeddedChunks,
        deleteStaleProjectChunks,
} = require("./vectorStore");


// Configuration
const STORAGE_BATCH_SIZE = 10;
// Stay below Gemini's 30,000 tokens/minute free-tier limit.
const EMBEDDING_TOKEN_BUDGET = 24000;
const EMBEDDING_WINDOW_MS = 60 * 1000;

function createTokenRateLimiter() {
    const requests = [];

    return async function waitForCapacity(tokenCount) {
        while (true) {
            const now = Date.now();

            // Remove requests older than one minute.
            while (
                requests.length > 0 &&
                now - requests[0].timestamp >= EMBEDDING_WINDOW_MS
            ) {
                requests.shift();
            }

            const usedTokens = requests.reduce(
                (total, request) => total + request.tokens,
                0
            );

            if (usedTokens + tokenCount <= EMBEDDING_TOKEN_BUDGET) {
                requests.push({
                    timestamp: Date.now(),
                    tokens: tokenCount,
                });

                return;
            }

            const waitTime =
                EMBEDDING_WINDOW_MS -
                (now - requests[0].timestamp) + 250;

            console.log(
                `[INDEXER] Token budget reached. Waiting ${Math.ceil(waitTime / 1000)} seconds.`
            );

            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    };
}


// Main indexing function
async function indexProject(project, options = {}) {

    if (
        !project ||
        typeof project.id !== "string" ||
        !project.id.trim() ||
        typeof project.folder !== "string" ||
        !project.folder.trim()
    ) {
        throw new Error("Valid project information is required.");
    }

    // Validate the storage folder.
    if (
        project.folder === "." ||
        project.folder === ".." ||
        /[\\/]/.test(project.folder)
    ) {
        throw new Error("Invalid project folder.");
    }

    const batchSize =
        options.batchSize ?? STORAGE_BATCH_SIZE;

    if (!Number.isInteger(batchSize) || batchSize < 1) {
        throw new Error("Batch size must be a positive integer.");
    }

    // Resolve the actual project directory.
    const projectsRoot = path.resolve(
        __dirname,
        "..",
        "user-projects"
    );

    const projectPath = path.resolve(
        projectsRoot,
        project.folder
    );

    // Verify that the project exists.
    const projectStats = await fs.lstat(projectPath);

    if (
        !projectStats.isDirectory() ||
        projectStats.isSymbolicLink()
    ) {
        throw new Error("Invalid project directory.");
    }

    const indexingStartedAt = new Date().toISOString();

    let currentStage = "file scanning";
    let storedChunkCount = 0;
    let storageBatchCount = 0;

    try {

        // STEP 1: Scan project files.
        const scanResult = await scanProjectFiles(projectPath);

        // STEP 2: Extract file contents.
        currentStage = "content extraction";

        const extractionResult = await extractFileContents(
            projectPath,
            scanResult.files
        );

        // STEP 3: Generate code chunks.
        currentStage = "chunk generation";

        const chunkingResult = chunkFiles(
            extractionResult.files
        );

        // STEP 4: Validate chunk token limits.
        currentStage = "token validation";

        const validationResult = await validateAndSplitChunks(
            chunkingResult.chunks
        );

        const validatedChunks = validationResult.chunks;

        if (validatedChunks.length === 0) {
            currentStage = "stale chunk cleanup";

            await deleteStaleProjectChunks(
                project.id,
                indexingStartedAt
            );
            return {
                status: "empty",
                projectId: project.id,
                message: "No eligible code chunks were found.",

                summary: {
                    scannedFiles: scanResult.summary.fileCount,
                    extractedFiles: extractionResult.summary.extractedFileCount,
                    generatedChunks: 0,
                    embeddedChunks: 0,
                },
            };

        }


        // STEP 5: Generate embeddings.
        currentStage = "embedding generation";

        const waitForEmbeddingCapacity = createTokenRateLimiter();

        let batch = [];

        for (let i = 0; i < validatedChunks.length; i++) {

            const chunk = validatedChunks[i];

            // Wait until sufficient token capacity is available.
            await waitForEmbeddingCapacity(chunk.tokenCount);

            // Generate one embedding at a time.
            const embeddedChunk = await generateEmbeddingForChunk(chunk);

            batch.push(embeddedChunk);


            // Store when batch is full or when processing ends.
            const isBatchFull = batch.length >= batchSize;

            const isLastChunk = i === validatedChunks.length - 1;


            if (isBatchFull || isLastChunk) {

                currentStage = "vector storage";

                const storageResult = await storeEmbeddedChunks(
                    project.id,
                    batch
                );

                storedChunkCount += storageResult.storedCount;

                storageBatchCount++;

                // Clear the completed batch.
                batch = [];

                // Continue embedding generation.
                currentStage = "embedding generation";

            }

        }
        //STEP-6: Remove outdated chunks.
        currentStage = "stale chunk cleanup";

        const cleanupResult = await deleteStaleProjectChunks(
            project.id,
            indexingStartedAt
        );
        // STEP 7: Return indexing summary.
        return {

            status: "success",
            projectId: project.id,
            projectName: project.name,
            summary: {

                scannedFiles: scanResult.summary.fileCount,
                extractedFiles: extractionResult.summary.extractedFileCount,
                generatedChunks: chunkingResult.summary.totalChunks,
                validatedChunks: validatedChunks.length,
                embeddedChunks: storedChunkCount,
                storageBatches: storageBatchCount,
                staleChunksDeleted: cleanupResult.deletedCount,

            },

        };


    } catch (error) {

        // Attach useful information to the error.
        error.indexingStage = currentStage;

        error.partialChunksStored = storedChunkCount;

        throw error;

    }

}


// Export indexing functionality.
module.exports = {
    indexProject,
};