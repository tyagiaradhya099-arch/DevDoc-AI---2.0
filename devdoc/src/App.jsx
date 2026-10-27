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
  const[projectName, setProjectName] = useState("");
  const[hasActiveProject, setHasActiveProject] = useState(null);
  const[selectedZip, setSelectedZip] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadError, setUploadError] = useState("");
  const[projects, setProjects] = useState([]);

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
  //to show retrieved projects from the backend
const fetchProjects = useCallback(async () => {
  try {
  const response = await fetch("http://localhost:5000/api/projects");
    if(!response.ok) {
       throw new Error("Failed to fetch projects.");
    }
    const data = await response.json();
    setProjects(data.projects);
  } catch (error) {
    console.error("Failed to fetch projects:", error);
  }
}, []);
//  SWITCH BETWEEN SAVED PROJECTS
const handleSwitchProject = async (projectId) => {
  try {
    setUploadError("");
    setUploadMessage("");

    const response = await fetch(
      `http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/activate`,
      {
        method: "POST",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to switch projects.");
    }

    // Update the active project information.
    setProjectName(data.projectName);
    setHasActiveProject(true);

    // Clear the previously selected file.
    setSelectedFile(null);
    setFileContent("");
    setFileError("");

    // Refresh the file explorer and Project Library.
    await fetchFiles();
    await fetchProjects();
  } catch (error) {
    console.error("Failed to switch project:", error);
    setUploadError(error.message || "Unable to switch projects.");
  }
};

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  useEffect(() => {
  fetchProjects();
}, [fetchProjects]);

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
    setHasActiveProject(true);

    setSelectedFile(null);
    setFileContent("");

    await fetchFiles();
    await fetchProjects();

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
      setProjectName(data.projectName || "");
      setHasActiveProject(data.hasActiveProject);
    })
    .catch((error) => {
      console.error("Failed to fetch project information:", error);
      setHasActiveProject(null);
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
          <h3 className="project-name">
            {hasActiveProject ? `📁 ${projectName}`:"📁 No project loaded" } 
          </h3>
           {/* Minimal upload interface */}
          <div className="project-upload">
            <input
              id="project-zip"
              className="upload-input"
              type="file"
              accept=".zip,application/zip"
              onChange={(event) => {
                setSelectedZip(event.target.files?.[0] ?? null);
                setUploadMessage("");
                setUploadError("");
             }}
           />

           <label htmlFor="project-zip" className="upload-trigger">
             <span className="upload-plus">+</span>
             Import project
           </label>

           {selectedZip && (
            <div className="upload-selected">
              <span className="selected-file-name">{selectedZip.name}</span>

              <button
                type="button"
                className="upload-action"
                onClick={handleUpload}
                disabled={isUploading}
              >
                {isUploading ? "Uploading..." : "Upload"}
              </button>
           </div>
         )}

         {uploadMessage && (
            <p className="upload-feedback">{uploadMessage}</p>
         )}

         {uploadError && (
           <p className="upload-feedback upload-feedback-error">
              {uploadError}
           </p>
          )}
        </div>
        {/*PROJECT LIBRARY*/}
        <div className="project-library">
          <p className="section-label">MY PROJECTS</p>

          {projects.length === 0 ? (
            <p className="explorer-status">
              No saved projects yet.
            </p>
          ) : (
            <div className="project-library-list">
             {projects.map((project) => (
                <button
                  type="button"
                  key={project.id}
                  className={`project-library-item ${
                    project.isActive ? "active-project" : ""
                  }`}
                  onClick={() => handleSwitchProject(project.id)}
                  disabled={project.isActive}
                  title={project.name}
                >
                  <span className="project-library-icon">📁</span>

                  <span className="project-library-name">
                    {project.name}
                  </span>

                  {project.isActive && (
                    <span className="active-project-indicator">
                      Active
                    </span>
                  )}
                </button>
              ))} 
            </div>
          )}
        </div>
          <p>EXPLORER</p>
          {hasActiveProject === null ? (
            <p className="explorer-status">Checking project...</p>
          ) : !hasActiveProject ? (
            <p className="explorer-status">
              No project loaded. Import a ZIP to explore its files.
            </p>
          ) : filesLoading ? (
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