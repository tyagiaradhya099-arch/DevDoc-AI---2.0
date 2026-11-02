// RAG Generation Service

const { getGeminiClient } = require("./embeddingService");

const MODEL_NAME = "gemini-3.8-flash";

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

    // STEP 1: Prepare retrieved code as context.
    const codeContext = retrievedChunks.map((chunk, index) => `
Source ${index + 1}
File: ${chunk.filePath}
Lines: ${chunk.startLine}-${chunk.endLine}

Code:
${chunk.content}
`).join("\n\n");

    // STEP 2: Get the existing Gemini client.
    const ai = await getGeminiClient();

    // STEP 3: Generate an answer using the retrieved context.
    const request = {
    model: MODEL_NAME,

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

let response;

for (let attempt = 0; attempt <= 3; attempt++) {

    try {
        response = await ai.models.generateContent(request);
        break;

    } catch (error) {

        const retryableStatuses = [408, 429, 500, 502, 503, 504];

        const isRetryable = retryableStatuses.includes(
            Number(error.status)
        );

        if (!isRetryable || attempt === 3) {
            throw error;
        }

        const delay = 1000 * (2 ** attempt) +
            Math.floor(Math.random() * 500);

        console.log(
            `Gemini temporarily unavailable. Retrying in ${delay}ms...`
        );

        await new Promise(resolve => setTimeout(resolve, delay));
    }
}
    // STEP 4: Extract the generated answer.
    const answer = response.text;

    if (typeof answer !== "string" || !answer.trim()) {
        throw new Error("Gemini returned an empty answer.");
    }

    return answer.trim();
}

module.exports = {
    generateAnswer,
};