const express = require("express");
const cors = require("cors");

const app = express();

const PORT= 5000;

app.use(express.json());
app.use(cors());

const fs = require("fs");
const path = require("path");

const PROJECT_PATH = path.join(__dirname, "sample-project");

function getFiles(directory) {
    const items = fs.readdirSync(directory, { withFileTypes: true });

    let files = [];

    for(const item of items) {
        console.log(item);
        const fullPath = path.join(directory, item.name);

        if(item.isDirectory()) {
            files = files.concat(getFiles(fullPath));
        }
        else {
            files.push(fullPath);
        }
    }
    return files;
}


app.get("/api/files", (req, res) => {
    const files = getFiles(PROJECT_PATH).map(file =>
       path.relative(PROJECT_PATH, file).replace(/\\/g, "/")
    );
   res.json({
    status: "success",
    files: files,
   });
});
app.get("/api/file", (req, res) => {
    const filePath = req.query.path;

    // check that the requested path is valid
    if(typeof filePath !== "string" || !filePath) {
        return res.status(400).json({
           status: "error",
           message: "A valid file path is required.", 
        });
    }
     // Resolve the requested path to an absolute path.
    const fullPath = path.join(PROJECT_PATH, filePath);

     // Calculate the path relative to the project directory.
     const relativePath = path.relative(PROJECT_PATH, fullPath);

     //prevent access outside the project directory.
     if(
        relativePath === ".." || 
        relativePath.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relativePath)
     ) {
        return res.status(403).json({
           status: "error",
           message: "Access outside the project directory is not allowed.",
        });
     }

    //handling  missing files(in case backend try to read a deleted file) 
   try {
    const stats = fs.statSync(fullPath);

    if (!stats.isFile()) {
      return res.status(400).json({
        status: "error",
        message: "The requested path is not a file.",
      });
    }

    const content = fs.readFileSync(fullPath, "utf-8");

    return res.json({
      status: "success",
      content: content,
    });
   } catch (error) {
     if (error.code === "ENOENT") {
        return res.status(404).json({
         status: "error",
         message: "File not found.",
        });
     }

     console.error("Error reading file:", error);

     return res.status(500).json({
        status: "error",
        message: "Unable to read the requested file.",
    });
   }
});

app.listen(PORT, () => {
    console.log(`DevDoc backend running on http://localhost:${PORT}`);
});