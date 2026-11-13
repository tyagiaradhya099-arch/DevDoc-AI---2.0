import { useState } from "react";

function FileExplorer({
  files,
  selectedFile,
  onSelectFile,
  filesLoading,
  filesError,
  hasActiveProject,
  fetchFiles,
}) {
  const [collapsedFolders, setCollapsedFolders] = useState({});

  const buildFileTree = (files) => {
    const root = {};

    files.forEach((file) => {
      const parts = file.split("/");
      let current = root;

      parts.forEach((part, index) => {
        if (!current[part]) {
          current[part] = index === parts.length - 1 ? null : {};
        }

        if (index < parts.length - 1) {
          current = current[part];
        }
      });
    });

    return root;
  };

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

      if (children === null) {
        return (
          <button
            className={`file-item ${selectedFile === fullPath ? "active" : ""}`}
            key={fullPath}
            style={{ paddingLeft: "10px" }}
            onClick={() => onSelectFile(fullPath)}
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
            style={{ paddingLeft: "10px" }}
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

  const fileTree = buildFileTree(files);

  return (
    <div className="file-explorer">
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
  );
}

export default FileExplorer;