const fs = require("fs/promises");
const path = require("path");

const DEFAULT_MAX_FILE_SIZE = 1 * 1024 * 1024;


// Check whether a file is inside the project directory.
function isInsideRoot(root, target) {
    const relativePath = path.relative(root, target);

    return (
        relativePath !== ".." &&
        !relativePath.startsWith(`..${path.sep}`) &&
        !path.isAbsolute(relativePath)
    );
}


// Main content extraction function.
async function extractFileContents(projectPath, scannedFiles, options = {}) {

    const maxFileSizeBytes =
        options.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE;

    if (!Array.isArray(scannedFiles)) {
        throw new Error("A valid list of scanned files is required.");
    }

    const rootPath = path.resolve(projectPath);

    const rootStats = await fs.lstat(rootPath);

    if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) {
        throw new Error("Invalid project directory.");
    }

    const extractedFiles = [];

    let skippedLargeFiles = 0;
    let skippedBinaryFiles = 0;

    // Process files one at a time.
    for (const file of scannedFiles) {

        const fullPath = path.resolve(
            rootPath,
            file.relativePath
        );

        // Verify that the file belongs to the project.
        if (!isInsideRoot(rootPath, fullPath)) {
            throw new Error(
                `Unsafe file path: ${file.relativePath}`
            );
        }

        // Check the actual file information again.
        const stats = await fs.lstat(fullPath);

        if (!stats.isFile() || stats.isSymbolicLink()) {
            throw new Error(
                `Invalid file encountered: ${file.relativePath}`
            );
        }

        // Skip files that exceed the allowed size.
        if (stats.size > maxFileSizeBytes) {
            skippedLargeFiles++;
            continue;
        }

        // Read file contents as bytes first.
        const buffer = await fs.readFile(fullPath);

        // Skip files containing null bytes.
        // These may be binary files rather than readable text.
        if (buffer.includes(0)) {
            skippedBinaryFiles++;
            continue;
        }

        // Convert the buffer into readable UTF-8 text.
        const content = buffer.toString("utf8");

        // Store the contents along with file metadata.
        extractedFiles.push({
            relativePath: file.relativePath,
            extension: file.extension,
            sizeBytes: stats.size,
            content: content,
        });
    }

    return {
        files: extractedFiles,

        summary: {
            extractedFileCount: extractedFiles.length,
            skippedLargeFiles,
            skippedBinaryFiles,
        },
    };
}


// Export the function for other backend files.
module.exports = {
    extractFileContents,
};