import { Link } from "react-router-dom";
import "./Welcome.css";

function Welcome() {
    return (
        <div className="welcome-page">
            <nav className="welcome-nav">
                <div className="welcome-brand">
                    <div className="welcome-brand-icon">D</div>
                    <span>DevDoc</span>
                </div>

                <div className="welcome-nav-actions">
                    <Link to="/login" className="welcome-login">
                        Log in
                    </Link>

                    <Link to="/register" className="welcome-signup">
                        Get started →
                    </Link>
                </div>
            </nav>

            <main className="welcome-hero">
                <div className="welcome-badge">
                    AI-Powered Codebase Intelligence
                </div>

                <h1>
                    Understand your codebase.
                    <br />
                    <span>Build with clarity.</span>
                </h1>

                <p>
                    Explore projects, understand complex code,
                    and get meaningful insights into your codebase
                    with your AI-powered development companion.
                </p>

                <div className="welcome-hero-actions">
                    <Link to="/register" className="welcome-primary-button">
                        Create your account →
                    </Link>

                    <Link to="/login" className="welcome-secondary-button">
                        I already have an account
                    </Link>
                </div>

                <div className="welcome-footer">
                    Built for developers who want to understand their code.
                </div>
            </main>
        </div>
    );
}

export default Welcome;