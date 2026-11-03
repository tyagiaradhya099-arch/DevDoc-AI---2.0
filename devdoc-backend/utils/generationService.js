// RAG Generation Service

const { getGeminiClient } = require("./embeddingService");

const PRIMARY_MODEL = "gemini-3.7-flash";
const FALLBACK_MODEL = "gemini-3.5-flash-lite";

const RETRYABLE_STATUSES = [408, 429, 500, 502, 503, 504];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));


// Generate an answer with retries
async function generateWithRetry(ai, request, model, maxAttempts) {

    for (let attempt = 0; attempt < maxAttempts; attempt++) {

        try {

            console.log(`[AI] Trying model: ${model}`);

            const response = await ai.models.generateContent({
                ...request,
                model: model,
            });

            const answer = response.text;

            if (typeof answer !== "string" || !answer.trim()) {
                throw new Error("AI returned an empty answer.");
            }

            console.log(`[AI] Successfully generated answer using ${model}`);

            return answer.trim();

        } catch (error) {

            const status = Number(error.status || error.code);

            const retryable = RETRYABLE_STATUSES.includes(status);

            if (!retryable || attempt === maxAttempts - 1) {
                throw error;
            }

            const delay = 1000 * (2 ** attempt);

            console.log(
                `[AI] ${model} unavailable. Retrying in ${delay}ms...`
            );

            await wait(delay);
        }
    }

}


// Main RAG generation function
async function generateAnswer(query, retrievedChunks) {

    if (typeof query !== "string" || !query.trim()) {
        throw new Error("A valid question is required.");
    }

    if (!Array.isArray(retrievedChunks)) {
        throw new Error("Retrieved code context must be an array.");
    }

    if (retrievedChunks.length === 0) {
        return "I couldn't find relevant code in this project to answer your question.";
    }


    // STEP 1: Prepare retrieved code context

    const codeContext = retrievedChunks.map((chunk, index) => {

        return `
Source ${index + 1}
File: ${chunk.filePath}
Lines: ${chunk.startLine}-${chunk.endLine}

Code:
${chunk.content}
`;

    }).join("\n\n");


    // STEP 2: Get Gemini client

    const ai = await getGeminiClient();


    // STEP 3: Prepare generation request

    const request = {

        contents: `
User question:
${query.trim()}

Retrieved code context:
${codeContext}
        `,

        config: {

            systemInstruction: `
You are DevDoc, an AI codebase assistant.

Answer using the supplied code context.
Explain relevant code clearly.
Mention file paths and line numbers when available.
If context is insufficient, say so.
Never invent code or functionality.
            `,

            maxOutputTokens: 1200,

        },

    };


    // STEP 4: Try primary model

    try {

        return await generateWithRetry(
            ai,
            request,
            PRIMARY_MODEL,
            4
        );

    } catch (error) {

        const status = Number(error.status || error.code);

        if (!RETRYABLE_STATUSES.includes(status)) {
            throw error;
        }

        console.warn(
            `[AI] Primary model failed. Switching to ${FALLBACK_MODEL}`
        );

    }


    // STEP 5: Try fallback model

    try {

        const answer = await generateWithRetry(
            ai,
            request,
            FALLBACK_MODEL,
            2
        );

        console.log("[AI] Fallback generation successful.");

        return answer;

    } catch (error) {

        console.error("[AI] Both models failed:", error);

        throw error;

    }

}


module.exports = {
    generateAnswer,
};