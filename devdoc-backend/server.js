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

    const fullPath = path.join(PROJECT_PATH, filePath);

    const content = fs.readFileSync(fullPath, "utf-8");

    res.json({
        status: "success",
        content: content,
    });
});

app.listen(PORT, () => {
    console.log(`DevDoc backend running on http://localhost:${PORT}`);
});