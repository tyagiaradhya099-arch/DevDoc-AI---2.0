function CodeEditor({
  selectedFile,
  fileContent,
  fileLoading,
  fileError,
}) {
  if (!selectedFile) {
    return <h1 className="welcome-heading">Welcome to DevDoc</h1>;
  }

  return (
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
  );
}

export default CodeEditor;