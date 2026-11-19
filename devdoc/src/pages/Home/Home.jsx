import { Link, useNavigate } from "react-router-dom";
import "./Home.css";

function Home() {
  const navigate = useNavigate();

 const handleLogout = async () => {
    try {
        const response = await fetch(
            "http://localhost:5000/api/auth/logout",
            {
                method: "POST",
                credentials: "include"
            }
        );

        if (response.ok) {
            navigate("/", { replace: true });
        } else {
            alert("Logout failed. Please try again.");
        }
    } catch (error) {
        console.error("Logout error:", error);
        alert("Unable to connect to the server.");
    }
  };
  return (
    <div className="home-page">
      {/* SIDEBAR */}
      <aside className="home-sidebar">
        <div className="home-brand">
          <div className="brand-icon">D</div>
          <span>DevDoc</span>
        </div>

        <div className="home-nav">
          <p className="nav-label">MENU</p>

          <Link to="/" className="nav-item active">
            <span>⌂</span>
            Overview
          </Link>

          <Link to="/projects" className="nav-item">
            <span>▦</span>
            Projects
          </Link>

          <Link to="/workspace" className="nav-item">
            <span>⌘</span>
            Workspace
          </Link>
        </div>

        <div className="sidebar-bottom">
          <div>
            <span className="status-dot"></span>
              AI Engine
            <span className="status-text">Ready</span>
          </div>

          <button className="logout-button" onClick={handleLogout}>
              ↪ Logout
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="home-main">
        <header className="home-topbar">
          <span>Overview</span>
          <span className="topbar-caption">
            Codebase Intelligence Platform
          </span>
        </header>

        <section className="home-content">
          <div className="welcome-section">
            <div>
              <p className="eyebrow">YOUR DEVELOPMENT SPACE</p>
              <h1>Build with clarity.</h1>
              <p className="welcome-description">
                Understand your codebase, explore projects, and let AI
                help you navigate your code.
              </p>
            </div>

            <Link to="/workspace" className="primary-button">
              Open Workspace <span>→</span>
            </Link>
          </div>

          <section className="quick-actions">
            <div className="section-heading">
              <h2>Quick access</h2>
              <p>Pick up where you want to work.</p>
            </div>

            <div className="action-grid">
              <Link to="/projects" className="action-card">
                <div className="action-icon">▦</div>
                <h3>My Projects</h3>
                <p>View and manage your imported codebases.</p>
                <span className="card-arrow">→</span>
              </Link>

              <Link to="/workspace" className="action-card">
                <div className="action-icon">⌘</div>
                <h3>Code Workspace</h3>
                <p>Explore files and ask AI questions about your code.</p>
                <span className="card-arrow">→</span>
              </Link>
            </div>
          </section>

          <section className="home-bottom-section">
            <div className="section-heading">
              <h2>Getting started</h2>
              <p>Your workflow with DevDoc.</p>
            </div>

            <div className="workflow-list">
              <div className="workflow-item">
                <span className="workflow-number">01</span>
                <div>
                  <h3>Import a project</h3>
                  <p>Bring your codebase into DevDoc.</p>
                </div>
              </div>

              <div className="workflow-item">
                <span className="workflow-number">02</span>
                <div>
                  <h3>Analyze your code</h3>
                  <p>Let DevDoc index your project for AI-powered search.</p>
                </div>
              </div>

              <div className="workflow-item">
                <span className="workflow-number">03</span>
                <div>
                  <h3>Explore with AI</h3>
                  <p>Ask questions and understand how your code works.</p>
                </div>
              </div>
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}

export default Home;