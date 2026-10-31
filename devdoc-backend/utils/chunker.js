// Default chunking configuration
const DEFAULT_CHUNK_LINES = 80;
const DEFAULT_OVERLAP_LINES = 15;


// Main chunking function
function chunkFiles(extractedFiles, options = {}) {

    const chunkLines =
        options.chunkLines ?? DEFAULT_CHUNK_LINES;

    const overlapLines =
        options.overlapLines ?? DEFAULT_OVERLAP_LINES;

    // Validate the chunking configuration.
    if (
        !Number.isInteger(chunkLines) ||
        chunkLines <= 0
    ) {
        throw new Error("chunkLines must be a positive integer.");
    }

    if (
        !Number.isInteger(overlapLines) ||
        overlapLines < 0 ||
        overlapLines >= chunkLines
    ) {
        throw new Error(
            "overlapLines must be non-negative and smaller than chunkLines."
        );
    }

    if (!Array.isArray(extractedFiles)) {
        throw new Error("A valid list of extracted files is required.");
    }

    const chunks = [];

    let filesChunked = 0;


    // Process each extracted file.
    for (const file of extractedFiles) {

        if (typeof file.content !== "string") {
            throw new Error(
                `Invalid content in file: ${file.relativePath}`
            );
        }

        const lines = file.content.split(/\r\n|\n|\r/);

        // Avoid counting a trailing newline as an extra source line.
        if (
            lines.length > 1 &&
            lines[lines.length - 1] === "" &&
            /(?:\r\n|\n|\r)$/.test(file.content)
        ) {
            lines.pop();
        }

        // Skip empty files.
        if (lines.length === 0 || (lines.length === 1 && lines[0] === "")) {
            continue;
        }

        filesChunked++;

        let startIndex = 0;
        let chunkIndex = 1;

        // Divide the file into overlapping chunks.
        while (startIndex < lines.length) {

            const endIndex = Math.min(
                startIndex + chunkLines,
                lines.length
            );

            const chunkContent = lines
                .slice(startIndex, endIndex)
                .join("\n");

            chunks.push({

                relativePath: file.relativePath,

                extension: file.extension,

                chunkIndex: chunkIndex,

                startLine: startIndex + 1,

                endLine: endIndex,

                content: chunkContent,

            });

            // Stop when the end of the file is reached.
            if (endIndex === lines.length) {
                break;
            }

            // Move forward while keeping the overlap.
            startIndex = endIndex - overlapLines;

            chunkIndex++;
        }
    }


    // Return generated chunks and summary.
    return {
        chunks,

        summary: {
            filesChunked,
            totalChunks: chunks.length,
            chunkLines,
            overlapLines,
        },
    };
}


// Export the chunking function.
module.exports = {
    chunkFiles,
};