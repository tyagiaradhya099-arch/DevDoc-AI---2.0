import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Projects.css";

function Projects() {
  const navigate = useNavigate();
  const [openingProjectId, setOpeningProjectId] = useState(null);
  const [openMenuProjectId, setOpenMenuProjectId] = useState(null);  
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchProjects = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");

      const response = await fetch("http://localhost:5000/api/projects", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch projects.");
      }

      const data = await response.json();
      setProjects(data.projects || []);
    } catch (error) {
      console.error("Failed to fetch projects:", error);
      setError("Unable to load projects. Please check that the backend is running.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Calculate overview statistics from actual project data.
  const stats = useMemo(() => ({
    total: projects.length,
    indexed: projects.filter(
      (project) => project.indexingStatus === "indexed"
    ).length,
    indexing: projects.filter(
      (project) => project.indexingStatus === "indexing"
    ).length,
  }), [projects]);

  // Filter projects by their names.
  const filteredProjects = useMemo(() => {
    return projects.filter((project) =>
      project.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [projects, searchQuery]);

  const handleOpenProject = async (projectId) => {
  try {
    setOpeningProjectId(projectId);

    const response = await fetch(
      `http://localhost:5000/api/projects/${projectId}/activate`,
      {
        method: "POST",
        credentials: "include",
      }
    );

    if (!response.ok) {
      throw new Error("Failed to activate project.");
    }

    navigate("/workspace");
  } catch (error) {
    console.error("Failed to open project:", error);
    setError("Unable to open this project. Please try again.");
  } finally {
    setOpeningProjectId(null);
  }
};

  return (
    <div className="projects-page">

      {/* SIDEBAR */}
      <aside className="projects-sidebar">
        <Link to="/" className="projects-brand">
          <div className="brand-icon">D</div>
          <span>DevDoc</span>
        </Link>

        <nav className="projects-nav">
          <p className="nav-label">MENU</p>

          <Link to="/" className="nav-item">
            <span>⌂</span>
            Overview
          </Link>

          <Link to="/projects" className="nav-item active">
            <span>▦</span>
            Projects
          </Link>

          <Link to="/workspace" className="nav-item">
            <span>⌘</span>
            Workspace
          </Link>
        </nav>

        <div className="sidebar-bottom">
          <span className="status-dot"></span>
          AI Engine
          <span className="status-text">Ready</span>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="projects-main">

        <header className="projects-topbar">
          <span>Projects</span>
          <span className="topbar-caption">
            Manage your codebases
          </span>
        </header>

        <div className="projects-content">

          <section className="projects-heading">
            <div>
              <p className="eyebrow">YOUR WORKSPACE</p>
              <h1>Projects</h1>
              <p className="welcome-description">
                Manage, analyze and explore your codebases in one place.
              </p>
            </div>

           <Link to="/workspace" className="primary-button">
              Open Workspace <span>→</span>
           </Link>
          </section>

          {/* PROJECT STATISTICS */}
          <section className="project-stats">

            <div className="stat-card">
              <span>Total Projects</span>
              <h2>{isLoading ? "—" : stats.total}</h2>
            </div>

            <div className="stat-card">
              <span>Indexed Projects</span>
              <h2>{isLoading ? "—" : stats.indexed}</h2>
            </div>

            <div className="stat-card">
              <span>Currently Indexing</span>
              <h2>{isLoading ? "—" : stats.indexing}</h2>
            </div>

          </section>

          {/* PROJECT LIST */}
          <section className="projects-list-section">

            <div className="projects-list-heading">
              <div>
                <h2>All Projects</h2>
                <p>Your imported codebases</p>
              </div>

              <input
                type="search"
                className="project-search"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>

            {isLoading ? (
              <div className="projects-message">
                Loading projects...
              </div>
            ) : error ? (
              <div className="projects-message error">
                {error}
                <button onClick={fetchProjects}>Try again</button>
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="projects-empty">
                <div className="empty-icon">▦</div>
                <h3>
                  {searchQuery ? "No matching projects" : "No projects yet"}
                </h3>
                <p>
                  {searchQuery
                    ? "Try searching with another project name."
                    : "Import your first codebase to start exploring with DevDoc."}
                </p>
                {!searchQuery && (
                  <Link to="/workspace" className="primary-button">
                    Go to Workspace <span>→</span>
                  </Link>
                )}
              </div>
            ) : (
              <div className="projects-grid">
                {filteredProjects.map((project) => (
                  <div className="project-card" key={project.id}>

                    <div className="project-card-top">
                       <div className="project-folder-icon">▦</div>

                       <div className="project-card-actions">
                           {project.isActive && (
                              <span className="active-badge">Active</span>
                           )}

                            <button
                               className="project-menu-button"
                               onClick={() =>
                                  setOpenMenuProjectId(
                                    openMenuProjectId === project.id ? null : project.id
                                  )
                                }
                               aria-label="Project options"
                            >
                              ⋮
                            </button>
                            {openMenuProjectId === project.id && (
                                <div className="project-dropdown">
                                   <button 
                                      onClick={() => {
                                        setOpenMenuProjectId(null);
                                        navigate("/workspace", {
                                            state: {action: "rename", projectId: project.id },
                                        });
                                      }}
                                    >  
                                      Rename
                                   </button>

                                    <button 
                                        onClick={() => {
                                          setOpenMenuProjectId(null);
                                          navigate("/workspace", {
                                            state: {
                                              action: "index",
                                              projectId: project.id,
                                            },
                                          });
                                        }}
                                    >
                                        Re-Index    
                                    </button>

                                    <button
                                      className="delete-option"
                                      onClick={() => {
                                        setOpenMenuProjectId(null);
                                        navigate("/workspace", {
                                           state: {
                                              action: "delete",
                                              projectId: project.id,
                                            },
                                        });
                                      }}
                                    >
                                      Delete
                                    </button>
                                </div>
                            )}
                       </div>
                    </div>

                    <h3>{project.name}</h3>

                    <div className="project-card-status">
                      <span className={`status-indicator ${project.indexingStatus || "pending"}`}></span>
                      {project.indexingStatus || "Pending"}
                    </div>

                    {project.indexingStatus === "indexed" && (
                      <p className="chunk-count">
                        {project.indexedChunkCount ?? 0} indexed chunks
                      </p>
                    )}

                    <button
                      className="project-open-link"
                      onClick={() => handleOpenProject(project.id)}
                      disabled={openingProjectId === project.id}
                    >
                      {openingProjectId === project.id
                      ? "Opening..."
                      : "Open Workspace →"}
                    </button>

                  </div>
                ))}
              </div>
            )}

          </section>
        </div>
      </main>
    </div>
  );
}

export default Projects;