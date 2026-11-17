import { useState } from "react";
import Prism from "prismjs";

import "prismjs/themes/prism-tomorrow.css";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-css";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-json";

function CodeEditor({
  selectedFile,
  fileContent,
  fileLoading,
  fileError,
}) {
  const [copied, setCopied] = useState(false);

   if (!selectedFile) {
      return (
            <div className="editor-empty-state">
                <div className="empty-state-icon">
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="m8 8-4 4 4 4" />
                        <path d="m16 8 4 4-4 4" />
                        <path d="m14 5-4 14" />
                    </svg>
                </div>

                <h2>Ready to explore?</h2>

                <p>
                   Select a file from the Explorer to start understanding your codebase.
                </p>

                <span className="empty-state-hint">
                    YOUR CODEBASE, MADE UNDERSTANDABLE.
                </span>
            </div>
        );
    }
  const getLanguage = (fileName) => {
    const extension = fileName.split(".").pop().toLowerCase();

    const languages = {
      html: Prism.languages.markup,
      css: Prism.languages.css,
      js: Prism.languages.javascript,
      jsx: Prism.languages.jsx,
      json: Prism.languages.json,
    };

    return languages[extension] || Prism.languages.plain || Prism.languages.markup;
  };

  const highlightedCode = Prism.highlight(
    fileContent || "",
    getLanguage(selectedFile),
    "javascript"
  );

  const pathParts = selectedFile.split("/");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fileContent || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error("Unable to copy code:", error);
    }
  };

  return (
    <div className="code-editor">
      <div className="editor-toolbar">
        <div className="editor-toolbar-top">
          <span className="editor-section-title">CODE EDITOR</span>
          <span className="editor-readonly-badge">READ ONLY</span>
        </div>

        <div className="editor-header">
          <div className="editor-breadcrumbs">
            <span className="breadcrumb-icon">▤</span>

            {pathParts.map((part, index) => (
              <span key={index} className="breadcrumb-item">
                {index > 0 && <span className="breadcrumb-separator">/</span>}
                <span className={index === pathParts.length - 1 ? "breadcrumb-current" : ""}>
                  {part}
                </span>
              </span>
            ))}
          </div>

          <button
            type="button"
            className="editor-copy-button"
            onClick={handleCopy}
            disabled={fileLoading || !!fileError}
            title="Copy file contents"
          >
            <span>⧉</span>
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {fileLoading ? (
        <p className="explorer-status">Loading file contents...</p>
      ) : fileError ? (
        <p className="explorer-error">{fileError}</p>
      ) : (
        <div className="editor-content">
          <div className="line-numbers">
            {(fileContent || "").split("\n").map((_, index) => (
              <div key={index}>{index + 1}</div>
            ))}
          </div>

          <pre>
            <code
              dangerouslySetInnerHTML={{ __html: highlightedCode }}
            />
          </pre>
        </div>
      )}
    </div>
  );
}

export default CodeEditor;