const fs = require("fs/promises");
const path = require("path");

// Directories that should not be scanned.
const IGNORED_DIRECTORIES = new Set([
    "node_modules",
    ".git",
    "dist",
    "build",
    "coverage",
    ".next",
    ".nuxt",
    ".output",
    ".turbo",
    ".cache",
    "__pycache__",
    ".venv",
    "venv",
    "vendor",
    "bower_components",
    "Pods",
    ".gradle",
    "target",
]);

// Supported source-code and documentation extensions.
const ALLOWED_EXTENSIONS = new Set([
    ".js", ".jsx", ".mjs", ".cjs",
    ".ts", ".tsx", ".mts", ".cts",
    ".py",
    ".java",
    ".c", ".h", ".cpp", ".hpp",
    ".cs",
    ".go",
    ".rs",
    ".php",
    ".rb",
    ".swift",
    ".kt", ".kts",
    ".scala",
    ".html", ".htm",
    ".css", ".scss", ".sass", ".less",
    ".vue", ".svelte",
    ".json", ".jsonc",
    ".md", ".mdx", ".txt", ".rst",
    ".yaml", ".yml", ".toml",
    ".xml",
    ".sql",
    ".sh", ".bash", ".ps1",
    ".graphql", ".gql",
    ".tf",
    ".prisma",
    ".ex", ".exs",
    ".dart",
    ".lua",
]);

// Useful project files that don't have regular extensions.
const ALLOWED_SPECIAL_FILES = new Set([
    "dockerfile",
    "makefile",
    "procfile",
    "cmakelists.txt",
    ".gitignore",
    ".dockerignore",
    ".editorconfig",
]);

// Files that should never be included.
const BLOCKED_FILE_NAMES = new Set([
    ".npmrc",
    ".pypirc",
    "credentials.json",
    "service-account.json",
    "secrets.json",
    "id_rsa",
    "id_ed25519",
]);

// Initial scanner limits.
const DEFAULT_MAX_FILES = 5000;
const DEFAULT_MAX_FILE_SIZE = 1 * 1024 * 1024;
const DEFAULT_MAX_TOTAL_SIZE = 50 * 1024 * 1024;
const DEFAULT_MAX_DEPTH = 25;


// Check whether a path is inside the project directory.
function isInsideRoot(root, target) {
    const relativePath = path.relative(root, target);

    return (
        relativePath !== ".." &&
        !relativePath.startsWith(`..${path.sep}`) &&
        !path.isAbsolute(relativePath)
    );
}


// Check whether a filename contains sensitive information.
function isSensitiveFile(fileName) {
    const name = fileName.toLowerCase();

    return (
        name === ".env" ||
        name.startsWith(".env.") ||
        BLOCKED_FILE_NAMES.has(name)
    );
}


// Check whether a file is supported.
function isSupportedFile(fileName) {
    const name = fileName.toLowerCase();

    if (ALLOWED_SPECIAL_FILES.has(name)) {
        return true;
    }

    const extension = path.extname(name);

    return ALLOWED_EXTENSIONS.has(extension);
}


// Main scanner function.
async function scanProjectFiles(projectPath, options = {}) {

    const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
    const maxFileSizeBytes =
        options.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE;
    const maxTotalSizeBytes =
        options.maxTotalSizeBytes ?? DEFAULT_MAX_TOTAL_SIZE;
    const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;

    if (typeof projectPath !== "string" || !projectPath.trim()) {
        throw new Error("A valid project path is required.");
    }

    const rootPath = path.resolve(projectPath);

    // Verify that the project directory exists.
    const rootStats = await fs.lstat(rootPath);

    if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) {
        throw new Error("The project path is not a valid directory.");
    }

    const files = [];

    let totalBytes = 0;
    let skippedLargeFiles = 0;
    let skippedSensitiveFiles = 0;
    let skippedLockFiles = 0;
    let reachedFileLimit = false;


    // Recursively scan directories.
    async function scanDirectory(currentDirectory, depth = 0) {

        if (depth > maxDepth || reachedFileLimit) {
            return;
        }

        const entries = await fs.readdir(
            currentDirectory,
            { withFileTypes: true }
        );

        // Keep the scanning order predictable.
        entries.sort((a, b) => a.name.localeCompare(b.name));

        for (const entry of entries) {

            if (files.length >= maxFiles) {
                reachedFileLimit = true;
                return;
            }

            const fullPath = path.join(
                currentDirectory,
                entry.name
            );

            const stats = await fs.lstat(fullPath);

            // Never follow symbolic links.
            if (stats.isSymbolicLink()) {
                continue;
            }

            // Handle directories.
            if (stats.isDirectory()) {

                if (IGNORED_DIRECTORIES.has(entry.name)) {
                    continue;
                }

                await scanDirectory(fullPath, depth + 1);
                continue;
            }

            // Ignore anything that isn't a regular file.
            if (!stats.isFile()) {
                continue;
            }

            // Exclude sensitive files.
            if (isSensitiveFile(entry.name)) {
                skippedSensitiveFiles++;
                continue;
            }

            // Exclude common lockfiles.
            if (
                entry.name === "package-lock.json" ||
                entry.name === "yarn.lock" ||
                entry.name === "pnpm-lock.yaml" ||
                entry.name === "composer.lock" ||
                entry.name === "poetry.lock" ||
                entry.name === "Cargo.lock" ||
                entry.name === "Gemfile.lock"
            ) {
                skippedLockFiles++;
                continue;
            }

            // Check the file type.
            if (!isSupportedFile(entry.name)) {
                continue;
            }

            // Skip oversized files.
            if (stats.size > maxFileSizeBytes) {
                skippedLargeFiles++;
                continue;
            }

            // Enforce total scanning size.
            if (totalBytes + stats.size > maxTotalSizeBytes) {
                continue;
            }

            // Verify the file remains within the project directory.
            if (!isInsideRoot(rootPath, fullPath)) {
                continue;
            }

            const relativePath = path
                .relative(rootPath, fullPath)
                .split(path.sep)
                .join("/");

            files.push({
                relativePath,
                extension: path.extname(entry.name).toLowerCase(),
                sizeBytes: stats.size,
            });

            totalBytes += stats.size;
        }
    }


    await scanDirectory(rootPath);

    // Return file information and scan statistics.
    return {
        files,

        summary: {
            fileCount: files.length,
            totalBytes,
            skippedLargeFiles,
            skippedSensitiveFiles,
            skippedLockFiles,
            reachedFileLimit,
        },
    };
}


// Make the scanner available to other backend files.
module.exports = {
    scanProjectFiles,
};