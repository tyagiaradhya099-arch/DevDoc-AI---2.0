function ProjectLibrary({
  projects,
  handleSwitchProject,
  handleRenameProject,
  handleDeleteProject,
  deletingProjectId,
  handleIndexProject,
  startingIndexProjectIds,
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
          {projects.map((project) => (
            <div key={project.id} className="project-library-entry">

              <div className="project-library-row">

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

                  {project.indexingStatus === "indexed" && (
                    <span className="project-indexed-status" title="Project indexed">
                       ✓
                    </span>
                  )}

                  {project.indexingStatus === "indexing" && (
                    <span className="project-indexing-status" title="Indexing in progress">
                        ⟳
                    </span>
                  )}

                  {project.indexingStatus === "failed" && (
                    <span className="project-index-failed" title="Indexing failed">
                        !
                    </span>
                  )}

                  {project.isActive && (
                    <span className="active-project-indicator">●</span>
                  )}
                </button>

                <button
                  type="button"
                  className="project-rename-button"
                  onClick={() => handleRenameProject(project)}
                  title={`Rename ${project.name}`}
                  aria-label={`Rename ${project.name}`}
                >
                  ✎
                </button>
                <button
                    type="button"
                    className="project-index-button"
                    onClick={() => handleIndexProject(project)}
                    disabled={
                        project.indexingStatus === "indexing" ||
                        startingIndexProjectIds.includes(project.id)
                    }
                    title={
                        project.indexingStatus === "indexing"
                            ? "Indexing in progress"
                            : "Index project"
                    }
                    aria-label={`Index ${project.name}`}
                >
                   {project.indexingStatus === "indexing" ||
                   startingIndexProjectIds.includes(project.id)
                        ? "⟳"
                        : "⚡"}
                </button>

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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ProjectLibrary;