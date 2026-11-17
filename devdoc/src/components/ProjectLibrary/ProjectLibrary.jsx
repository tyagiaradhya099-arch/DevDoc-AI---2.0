function ProjectLibrary({
  projects,
  handleSwitchProject,
  handleRenameProject,
  handleDeleteProject,
  deletingProjectId,
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

                  {project.isActive && (
                    <span className="active-project-indicator">
                      ●
                    </span>
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