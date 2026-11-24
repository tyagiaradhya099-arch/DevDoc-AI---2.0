import API_BASE_URL from "./api";
import { Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";

import App from "./App";
import Home from "./pages/Home/Home";
import Projects from "./pages/Projects/Projects";
import Register from "./pages/auth/Register";
import Login from "./pages/auth/Login";
import Welcome from "./pages/Welcome/Welcome";

// Protect pages that require authentication
function ProtectedRoute({ children }) {
    const [status, setStatus] = useState("checking");

    useEffect(() => {
        fetch(`${API_BASE_URL}/api/auth/me`, {
            credentials: "include"
        })
            .then((response) => {
                setStatus(response.ok ? "authenticated" : "unauthenticated");
            })
            .catch(() => {
                setStatus("unauthenticated");
            });
    }, []);

    if (status === "checking") {
        return <div>Checking authentication...</div>;
    }

    if (status === "unauthenticated") {
        return <Navigate to="/login" replace />;
    }

    return children;
}

function AppRouter() {
    return (
        <Routes>
            <Route path="/" element={<Welcome />} />
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />

            <Route
                path="/home"
                element={
                    <ProtectedRoute>
                        <Home />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/projects"
                element={
                    <ProtectedRoute>
                        <Projects />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/workspace"
                element={
                    <ProtectedRoute>
                        <App />
                    </ProtectedRoute>
                }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

export default AppRouter;