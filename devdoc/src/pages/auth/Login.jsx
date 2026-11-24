import API_BASE_URL from "../../api";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Login.css";

function Login() {
    const [formData, setFormData] = useState({
        email: "",
        password: ""
    });

    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.email.trim() || !formData.password) {
            alert("Please fill in all fields.");
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "include",
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (!response.ok) {
                alert(data.message || "Login failed.");
                return;
            }

            alert("Welcome back!");
            navigate("/home");

        } catch (error) {
            console.error("Login error:", error);
            alert("Unable to connect to the server.");
        }
    };

    return (
        <div className="login-page">
            <section className="login-brand-panel">
                <div className="login-brand">
                    <div className="login-brand-icon">D</div>
                    <span>DevDoc</span>
                </div>

                <div className="login-brand-content">
                    <h1>Understand your codebase. Build with clarity.</h1>
                    <p>
                        Your AI-powered development companion.
                        Explore projects, understand code, and
                        navigate complex codebases with confidence.
                    </p>
                </div>

                <div className="login-brand-footer">
                    Codebase Intelligence Platform
                </div>
            </section>

            <section className="login-form-panel">
                <div className="login-form-container">
                    <div className="login-form-header">
                        <h2>Welcome back</h2>
                        <p>Log in to continue to your DevDoc workspace.</p>
                    </div>

                    <form className="login-form" onSubmit={handleSubmit}>
                        <div className="login-field">
                            <label htmlFor="email">Email address</label>
                            <input
                                type="email"
                                id="email"
                                placeholder="you@example.com"
                                value={formData.email}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        email: e.target.value
                                    })
                                }
                            />
                        </div>

                        <div className="login-field">
                            <label htmlFor="password">Password</label>
                            <input
                                type="password"
                                id="password"
                                placeholder="Enter your password"
                                value={formData.password}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        password: e.target.value
                                    })
                                }
                            />
                        </div>

                        <button type="submit" className="login-submit-button">
                            Log in →
                        </button>
                    </form>

                    <p className="login-register-link">
                        Don't have an account?{" "}
                        <Link to="/register">Create account</Link>
                    </p>
                </div>
            </section>
        </div>
    );
}

export default Login;