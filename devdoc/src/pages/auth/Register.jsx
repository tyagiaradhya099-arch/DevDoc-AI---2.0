import API_BASE_URL from "../../api";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import "./Register.css";

function Register() {
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: ""
    });
    const navigate = useNavigate();
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name.trim() || !formData.email.trim() || !formData.password) {
             alert("Please fill in all fields.");
             return;
        }

        if (formData.password.length < 8) {
            alert("Password must be at least 8 characters.");
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "include",
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (!response.ok) {
               alert(data.message || "Registration failed.");
               return;
            }

            alert("Account created successfully!");
            navigate("/home");

        } catch (error) {
            console.error("Registration error:", error);
            alert("Unable to connect to the server.");
        }
    };
    return (
        <div className="register-page">

            {/* LEFT BRANDING PANEL */}
            <section className="register-brand-panel">

                <div className="register-brand">
                    <div className="register-brand-icon">D</div>
                    <span>DevDoc</span>
                </div>

                <div className="register-brand-content">
                    <h1>Understand your codebase. Build with clarity.</h1>

                    <p>
                        Your AI-powered development companion.
                        Explore projects, understand code, and
                        navigate complex codebases with confidence.
                    </p>
                </div>

                <div className="register-brand-footer">
                    Codebase Intelligence Platform
                </div>

            </section>

            {/* RIGHT REGISTRATION PANEL */}
            <section className="register-form-panel">

                <div className="register-form-container">

                    <div className="register-form-header">
                        <h2>Create your account</h2>
                        <p>Get started with your personal DevDoc workspace.</p>
                    </div>

                    <form className="register-form" onSubmit={handleSubmit}>

                        <div className="register-field">
                            <label htmlFor="name">Full name</label>
                            <input
                                type="text"
                                id="name"
                                placeholder="Enter your name"
                                value={formData.name}
                                onChange={(e) =>
                                    setFormData({ ...formData, name: e.target.value })
                                }
                            />
                        </div>

                        <div className="register-field">
                            <label htmlFor="email">Email address</label>
                            <input
                                type="email"
                                id="email"
                                placeholder="you@example.com"
                                value={formData.email}
                                onChange={(e) =>
                                    setFormData({ ...formData, email: e.target.value })
                                }
                            />
                        </div>

                        <div className="register-field">
                            <label htmlFor="password">Password</label>
                            <input
                                type="password"
                                id="password"
                                placeholder="Create a password"
                                value={formData.password}
                                onChange={(e) =>
                                    setFormData({ ...formData, password: e.target.value })
                                }
                            />
                        </div>

                        <button
                            type="submit"
                            className="register-submit-button"
                        >
                            Create account →
                        </button>

                    </form>

                    <p className="register-login-link">
                        Already have an account?{" "}
                        <Link to="/login">Log in</Link>
                    </p>

                </div>

            </section>

        </div>
    );
}

export default Register;