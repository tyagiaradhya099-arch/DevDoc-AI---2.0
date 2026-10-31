//Gemini Embedding Service

const MODEL_NAME = "gemini-embedding-2";
const EMBEDDING_DIMENSIONS = 768;

//Keep one Gemini client instead of creating a new one
//for every chunk.
let geminiClient = null;

//Initialize Gemini client when required.
async function getGeminiClient() {
    const apiKey = process.env.GEMINI_API_KEY;

    if(!apiKey) {
        throw new Error("Gemini API key is missing.");
    }
    if(!geminiClient) {
        //Dynamically import the google GenAI SDK.
        //This works with our existing CommoJS backend.
        const { GoogleGenAI } = await import("@google/genai");

        geminiClient = new GoogleGenAI({
            apiKey: apiKey,
        });
    }
    return geminiClient;
}
//Prepare code chunk for Gemini.
function formatChunkForEmbedding(chunk) {
    if (
        !chunk ||
        typeof chunk.content !== "string" ||
        !chunk.content.trim()
    ) {
        throw new Error("A valid code chunk is required.");
    }

    if (
        typeof chunk.relativePath !== "string" ||
        !chunk.relativePath.trim()
    ) {
        throw new Error("Chunk file path is missing.");
    }

    return `title: ${chunk.relativePath} | text: ${chunk.content}`;
}
//Generate embedding for one code chunk.
async function generateEmbeddingForChunk(chunk) {
    //Validate incoming chunk.
    if(
        !chunk ||
        typeof chunk.content !== "string" || 
        !chunk.content.trim()
    ) {
        throw new Error("A valid code chunk is required.");
    }
    if (
        typeof chunk.relativePath !== "string" ||
        !chunk.relativePath.trim()
    ) {
        throw new Error("Chunk file path is missing.");
    }
    
    const ai = await getGeminiClient();

    //Prepare the document im Gemini's recommended format.
    const inputText = formatChunkForEmbedding(chunk);
    // Request an embedding from Gemini.
    const response = await ai.models.embedContent({
        model: MODEL_NAME,

        contents: inputText,

        config: {
            outputDimensionality: EMBEDDING_DIMENSIONS,
        },
    });

    //Extract the numerical vector.
    const embedding = response.embeddings?.[0]?.values;

    //Validate the returned embedding.
    if(
        !Array.isArray(embedding) || 
        embedding.length !== EMBEDDING_DIMENSIONS
    ) {
        throw new Error("Gemini returned an invalid embedding.");
    }
    //Return the original metadata with its embedding.
    return {
        ...chunk,
        embedding,
    };
}
// Count tokens before generating an embedding.
async function countTokensForChunk(chunk) {

    const ai = await getGeminiClient();

    // Use exactly the same formatted input as embedding generation.
    const inputText = formatChunkForEmbedding(chunk);

    const response = await ai.models.countTokens({

        model: MODEL_NAME,

        contents: inputText,

    });

    const tokenCount = response.totalTokens;

    if (
        !Number.isSafeInteger(tokenCount) ||
        tokenCount < 0
    ) {
        throw new Error("Gemini returned an invalid token count.");
    }

    return tokenCount;
}
// Export the embedding function.
module.exports = {
    generateEmbeddingForChunk,
    countTokensForChunk,
};