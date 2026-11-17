import { Routes, Route, Navigate } from "react-router-dom";

import App from "./App";
import Home from "./pages/Home/Home";
import Projects from "./pages/Projects/Projects";

function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/projects" element={<Projects />} />
      <Route path="/workspace" element={<App />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default AppRouter;