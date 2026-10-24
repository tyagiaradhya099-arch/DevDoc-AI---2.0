import { useCallback, useEffect, useState } from "react";
import "./App.css";

function App() {
  const[files, setFiles] = useState([]);
  const[selectedFile, setSelectedFile] = useState(null);
  const[fileContent, setFileContent] = useState("");// 🚀 ACTUAL PROJECT CODE
  const[collapsedFolders, setCollapsedFolders] = useState({});
  const[filesLoading, setFilesLoading] = useState(true);
  const[filesError, setFilesError] = useState("");
  const[fileLoading, setFileLoading] = useState(false);
  const[fileError, setFileError] = useState("");
  const[projectName, setProjectName] = useState("My Project");
  const[selectedZip, setSelectedZip] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadError, setUploadError] = useState("");

  //fetch file function
  const fetchFiles = useCallback(async () => {
  try {
    setFilesLoading(true);
    setFilesError("");

    const response = await fetch("http://localhost:5000/api/files");

    if (!response.ok) {
      throw new Error("Failed to load project files.");
    }

    const data = await response.json();
    setFiles(data.files);
  } catch (error) {

    console.error("failed to fetch project files:", error);
    setFilesError(
      "Unable to load project files. Please check that the backend is running."
    );
  } finally {
    setFilesLoading(false);
  }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // sending uploaded files to backend
const handleUpload = async () => {
  if (!selectedZip || isUploading) return;

  setIsUploading(true);
  setUploadMessage("");
  setUploadError("");

  const formData = new FormData();
  formData.append("project", selectedZip);

  try {
    const response = await fetch("http://localhost:5000/api/upload", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Project upload failed.");
    }

    setProjectName(data.projectName);
    setSelectedFile(null);
    setFileContent("");

    await fetchFiles();

    setUploadMessage("Project uploaded successfully!");
    setSelectedZip(null);
  } catch (error) {
    console.error("Project upload failed:", error);
    setUploadError(error.message || "Unable to upload the project.");
  } finally {
    setIsUploading(false);
  }
};
    
  //use to to show one file loading error otherwise show its content
  useEffect(() => {
    if (!selectedFile) return;

    const fetchFileContent = async () => {
    try {
      setFileLoading(true);
      setFileError("");
      setFileContent("");

      const response = await fetch(
        `http://localhost:5000/api/file?path=${encodeURIComponent(selectedFile)}`
      );

      if (!response.ok) {
        throw new Error("Failed to load file content.");
      }

      const data = await response.json();
      setFileContent(data.content);
    } catch (error) {
      console.error("Failed to fetch file content:", error);
      setFileError("Unable to open this file. Please try again.");
    } finally {
      setFileLoading(false);
    }
  };

  fetchFileContent();
}, [selectedFile]);
//to fetch project name from backend
useEffect(() => {
  fetch("http://localhost:5000/api/project")
    .then((response) => {
      if (!response.ok) {
        throw new Error("Failed to fetch project information.");
      }

      return response.json();
    })
    .then((data) => {
      setProjectName(data.projectName);
    })
    .catch((error) => {
      console.error("Failed to fetch project information:", error);
    });
}, []);
      

      //for tree structure of the file explorer

      const buildFileTree = (files) => {
        const root = {};

        files.forEach((file) => { 
          const parts = file.split("/");
          let current = root;

          parts.forEach((part, index) => {
            if(!current[part]) {
              current[part] = index === parts.length - 1 ? null : {};
            }

            if(index < parts.length - 1) {
              current = current[part];
            }
          });

        });
        return root;
      }
      const fileTree = buildFileTree(files);

      
        const getFileIcon = (fileName) => {
          const extension = fileName.split(".").pop().toLowerCase();

          const icons = {
            js: "🟨",
            jsx: "⚛️",
            css: "🎨",
            html: "🌐",
            json: "📦",
            md: "📝",
          };

          return icons[extension] || "📄";
        };

      const renderTree = (tree, parentPath = "") => {
        return Object.entries(tree).map(([name, children]) => {
          
          const fullPath = parentPath ? `${parentPath}/${name}` : name;

          if(children === null) {
            return (
              <button 
                className={`file-item ${selectedFile === fullPath ? "active" : ""}`}
                key={fullPath} 
                style={{
                 paddingLeft: "10px",
                }}
                onClick={() => setSelectedFile(fullPath)} 
              >
                {getFileIcon(name)} {name}
              </button>
            );
          }
          return (
            <div key={fullPath}>
              <button 
              type="button" 
              className="folder-item"
              style={{
                paddingLeft: "10px",
              }}
              onClick={() => {
                setCollapsedFolders((previous) => ({
                  ...previous,
                  [fullPath]: !previous[fullPath],
                }));
              }}
              >
                <span>{collapsedFolders[fullPath] ? ">" : "⌄"}</span>
                <span>📁 {name}</span>
              </button>

              {!collapsedFolders[fullPath] && (
                <div className="tree-children">
                  {renderTree(children, fullPath)}
                </div>
              )}
              
            </div>
          );
        });
      };
      //complete
  return (
    <div className="app">
      <aside className="sidebar">
        <h2>Devdoc</h2>
        <p className="sidebar-subtitle">Codebase Intelligence platform</p>

        <div className="project-section">
          <p className="section-label">WORKSPACE</p>
          <h3 className="project-name">📁 {projectName} </h3>
          <div className="project-upload">
            <label htmlFor="project-zip">Upload a project ZIP</label>
            <input
              id="project-zip"
              type="file"
              accept=".zip,application/zip"
              onChange={(event) => {
                setSelectedZip(event.target.files?.[0] ?? null);
              }}
            />
            {selectedZip && (
              <p className="selected-file-name">
               Selected: {selectedZip.name}
              </p>
            )}
            <button
              type="button"
              onClick={handleUpload}
              disabled={!selectedZip || isUploading}
              >
              {isUploading ? "Uploading..." : "Upload Project"} 
            </button>

            {uploadMessage && <p>{uploadMessage}</p>}
            {uploadError && <p className="explorer-error">{uploadError}</p>}
         </div>
          <p>EXPLORER</p>
          {filesLoading ? (
            <p className="explorer-status">Loading project files...</p>
          ) : filesError ? (
            <div className="explorer-error">
              <p>{filesError}</p>
              <button type="button" onClick={fetchFiles}>
                Retry
              </button>
            </div>
          ) : files.length === 0 ? (
            <p className="explorer-status">No files found.</p>
          ) : (
            renderTree(fileTree)
          )}
        </div>
      </aside>

      <main className="workspace">
        <div className="workspace-header">
          <h1>Code Workspace</h1>
          <p>Explore and understand your project's source code.</p>
        </div>
        {selectedFile ? (
          <div className="code-editor">
            <div className="editor-header">
              <span className="editor-filename">📄 {selectedFile}</span>
            </div>

            {fileLoading ? (
              <p className="explorer-status">Loading file contents...</p>
            ) : fileError ? (
              <p className="explorer-error">{fileError}</p>
            ) : (
              <div className="editor-content">
                <div className="line-numbers">
                  {fileContent.split("\n").map((_, index) => (
                    <div key={index}>{index + 1}</div>
                  ))}
               </div>

                <pre>
                  <code>{fileContent}</code>
                </pre>
              </div>
            )}
          </div>
        ) : (
          <h1 className="welcome-heading">Welcome to DevDoc</h1>
        )}
      </main>
      <aside className="ai-panel">
        <h2>DevDoc AI</h2>
        <p>Ask questions about codebase.</p>

        <div className="chat-container">
          <div className="chat-empty-state">
            <p> 💬 </p>
            <h3>Understand your code</h3>
            <p>Ask a question to explore your codebase.</p>
          </div>
          <div className="chat-input-area">
            <textarea
            placeholder="Ask DevDoc anything..."
            rows="3"
            />
            <button type="button">↑</button>
            <p></p>
          </div>
        </div>
      </aside>
    </div>
  );
}

export default App;