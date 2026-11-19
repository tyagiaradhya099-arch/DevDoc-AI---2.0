import { useRef } from "react";
function ProjectUpload({
  selectedZip,
  setSelectedZip,
  isUploading,
  uploadMessage,
  uploadError,
  handleUpload,
}) {
  const fileInputRef = useRef(null);
  return (
    <div className="project-upload">
      <input
        ref={fileInputRef}
        id="project-zip"
        className="upload-input"
        type="file"
        accept=".zip,application/zip"
        onChange={(event) => {
          setSelectedZip(event.target.files?.[0] ?? null);
        }}
      />

      <label htmlFor="project-zip" className="upload-trigger">
        <svg
          className="upload-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 16V4" />
          <path d="M7 9l5-5 5 5" />
          <path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" />
        </svg>

        <span>Import project</span>
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