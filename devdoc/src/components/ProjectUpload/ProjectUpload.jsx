function ProjectUpload({
  selectedZip,
  setSelectedZip,
  isUploading,
  uploadMessage,
  uploadError,
  handleUpload,
}) {
  return (
    <div className="project-upload">
      <input
        id="project-zip"
        className="upload-input"
        type="file"
        accept=".zip,application/zip"
        onChange={(event) => {
          setSelectedZip(event.target.files?.[0] ?? null);
        }}
      />

      <label htmlFor="project-zip" className="upload-trigger">
        <span className="upload-plus">+</span>
        Import project
      </label>

      {selectedZip && (
        <div className="upload-selected">
          <span className="selected-file-name">
            {selectedZip.name}
          </span>

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
  );
}

export default ProjectUpload;