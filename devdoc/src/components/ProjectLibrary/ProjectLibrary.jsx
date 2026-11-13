function ProjectLibrary({
  projects,
  startingIndexProjectIds,
  deletingProjectId,
  handleSwitchProject,
  handleRenameProject,
  handleDeleteProject,
  handleIndexProject,
}) {
  return (
        <div className="project-library">
          <p className="section-label">MY PROJECTS</p>

          {projects.length === 0 ? (
            <p className="explorer-status">
              No saved projects yet.
            </p>
          ) : (
           <div className="project-library-list">
              {projects.map((project) => {

                const status = project.indexingStatus || "pending";

                const isStarting = startingIndexProjectIds.includes(
                  project.id
                );

                return (
                  <div key={project.id} className="project-library-entry">

                    {/* Existing project management controls */}
                    <div className="project-library-row">

                      {/* Switch project */}
                      <button
                        type="button"
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

                      {/* Rename project */}
                      <button
                        type="button"
                        className="project-rename-button"
                        onClick={() => handleRenameProject(project)}
                        title={`Rename ${project.name}`}
                        aria-label={`Rename ${project.name}`}
                      >
                        ✎
                      </button>

                      {/* Delete project */}
                      <button
                        type="button"
                        className="project-delete-button"
                        onClick={() => handleDeleteProject(project)}
                        disabled={deletingProjectId === project.id}
                        title={`Delete ${project.name}`}
                        aria-label={`Delete ${project.name}`}
                      >
                        {deletingProjectId === project.id ? "..." : "×"}
                      </button>

                    </div>

                    {/* Project indexing controls */}
                    <div className="project-index-control">

                     {status === "indexing" ? (

                      <span className="project-index-status status-indexing">
                        ⏳ Indexing...
                      </span>

                     ) : status === "indexed" ? (
                      <>
                        <span className="project-index-status status-indexed">
                          ✓ Indexed ({project.indexedChunkCount ?? 0} chunks)
                        </span>

                        <button
                          type="button"
                          className="project-index-button"
                          onClick={() => handleIndexProject(project)}
                          disabled={isStarting}

                        >
                          {isStarting ? "Starting..." : "Re-index"}
                        </button>
                      </>
                      ) : (
                     <>

                      {status === "failed" && (
                        <span
                          className="project-index-status status-failed"
                          title={project.indexingError || "Indexing failed"}
                        >
                          Indexing failed
                        </span>
                      )}

                      {status === "empty" && (
                        <span className="project-index-status status-empty">
                          No indexable chunks found.
                        </span>
                      )}

                      <button
                        type="button"
                        className="project-index-button"
                        onClick={() => handleIndexProject(project)}
                        disabled={isStarting}
                      >
                        {isStarting
                          ? "Starting..."
                          : status === "failed"
                          ? "Retry indexing"
                          : status === "empty"
                          ? "Try again"
                          : "Analyze Codebase"}
                      </button>

                    </>
                  )}

                </div>

              </div>
            );
          })}
          </div>
        )}
        </div>
  );
}

export default ProjectLibrary;