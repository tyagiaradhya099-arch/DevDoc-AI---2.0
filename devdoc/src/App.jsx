import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const[files, setFiles] = useState([]);
  const[selectedFile, setSelectedFile] = useState(null);
  const[fileContent, setFileContent] = useState("");// 🚀 ACTUAL PROJECT CODE
  const [collapsedFolders, setCollapsedFolders] = useState({});


  useEffect(() => {
  fetch("http://localhost:5000/api/files")
    .then((response) => response.json())
    .then((data) => {
      setFiles(data.files);
    });
    }, []);
    useEffect(() => {
      if(!selectedFile) return;
      fetch(`http://localhost:5000/api/file?path=${encodeURIComponent(selectedFile)}`)
        .then((response) => response.json())
        .then((data) => {
          setFileContent(data.content);
        });
      },[selectedFile]);

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
          <h3 className="project-name">📁 My project </h3>
          <p>EXPLORER</p>
          {renderTree(fileTree)}
          
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

            <div className="editor-content">
              <div className="line-numbers">
                {fileContent.split("\n").map((_, index) => (
                  <div key={index}>{index + 1}</div>
                ))}
              </div>
              <pre>
                <code>{fileContent}  
                </code>
              </pre>
            </div>
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