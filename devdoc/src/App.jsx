import { useCallback, useEffect, useState } from "react";
import AIChat from "./components/AIChat/AIChat";
import CodeEditor from "./components/CodeEditor/CodeEditor";
import FileExplorer from "./components/FileExplorer/FileExplorer";
import ProjectLibrary from "./components/ProjectLibrary/ProjectLibrary";
import ProjectUpload from "./components/ProjectUpload/ProjectUpload";
import "./App.css";

function App() {
  const[files, setFiles] = useState([]);
  const[selectedFile, setSelectedFile] = useState(null);
  const[fileContent, setFileContent] = useState("");// 🚀 ACTUAL PROJECT CODE
  const[filesLoading, setFilesLoading] = useState(true);
  const[filesError, setFilesError] = useState("");
  const[fileLoading, setFileLoading] = useState(false);
  const[fileError, setFileError] = useState("");
  const[projectName, setProjectName] = useState("");
  const[hasActiveProject, setHasActiveProject] = useState(null);
  const[selectedZip, setSelectedZip] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadError, setUploadError] = useState("");
  const[projects, setProjects] = useState([]);
  const [deletingProjectId, setDeletingProjectId] = useState(null);
  const [startingIndexProjectIds, setStartingIndexProjectIds] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  //Send a question to DevDoc AI.
  const handleSendMessage = async () => {
    const query = chatInput.trim();

    //Don't send empty messages.
    if(!query || isSendingMessage) return;

    //Display the user's message immediately.
    setChatMessages((previous) => [
      ...previous,
      { role: "user", content: query},
    ]);

    setChatInput("");
    setIsSendingMessage(true);

    try {
      const response = await fetch("http://localhost:5000/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        limit: 5,
      }),
    });
     const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Unable to get an AI response.");
    }
    // Display Gemini's answer and its sources.
    setChatMessages((previous) => [
      ...previous,
      {
        role: "assistant",
        content: data.answer,
        sources: data.sources || [],
      },
    ]);
  } catch (error) {

    console.error("Chat request failed:", error);

    setChatMessages((previous) => [
      ...previous,
      {
        role: "error",
        content: error.message || "Something went wrong.",
      },
    ]);

  } finally {

    setIsSendingMessage(false);

  }
};
  //fetch file function
  const fetchFiles = useCallback(async () => {
  try {
    setFilesLoading(true);
    setFilesError("");

    const response = await fetch("http://localhost:5000/api/files");

    if (!response.ok) {
      throw new Error("Failed to load project files.");
    }

    const data = await response.json();
    setFiles(data.files);
  } catch (error) {

    console.error("failed to fetch project files:", error);
    setFilesError(
      "Unable to load project files. Please check that the backend is running."
    );
  } finally {
    setFilesLoading(false);
  }
  }, []);
  //to show retrieved projects from the backend
const fetchProjects = useCallback(async () => {
  try {
  const response = await fetch("http://localhost:5000/api/projects");
    if(!response.ok) {
       throw new Error("Failed to fetch projects.");
    }
    const data = await response.json();
    setProjects(data.projects);
  } catch (error) {
    console.error("Failed to fetch projects:", error);
  }
}, []);
//  SWITCH BETWEEN SAVED PROJECTS
const handleSwitchProject = async (projectId) => {
  try {
    setUploadError("");
    setUploadMessage("");

    const response = await fetch(
      `http://localhost:5000/api/projects/${encodeURIComponent(projectId)}/activate`,
      {
        method: "POST",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to switch projects.");
    }

    // Update the active project information.
    setProjectName(data.projectName);
    setHasActiveProject(true);

    // Clear the previously selected file.
    setSelectedFile(null);
    setFileContent("");
    setFileError("");

    // Refresh the file explorer and Project Library.
    await fetchFiles();
    await fetchProjects();
  } catch (error) {
    console.error("Failed to switch project:", error);
    setUploadError(error.message || "Unable to switch projects.");
  }
};
//  RENAME A SAVED SAVED PROJECT
const handleRenameProject = async (project) => {
  // Ask the user for the new display name.
  const enteredName = window.prompt(
    "Enter a new project name:",
    project.name
  );

  // Stop if the user cancels.
  if (enteredName === null) return;

  const newName = enteredName.trim();

  // Validate the name before sending the request.
  if (!newName || newName.length > 80) {
    window.alert("Project name must contain 1–80 characters.");
    return;
  }

  // No request is needed if the name hasn't changed.
  if (newName === project.name) return;

  try {
    const response = await fetch(
      `http://localhost:5000/api/projects/${encodeURIComponent(project.id)}/rename`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newName,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to rename project.");
    }

    // Update the Project Library without reloading the page.
    setProjects((previousProjects) =>
      previousProjects.map((item) =>
        item.id === project.id
          ? { ...item, name: data.projectName }
          : item
      )
    );

    // Update the workspace heading if this project is active.
    if (project.isActive) {
      setProjectName(data.projectName);
    }

  } catch (error) {
    console.error("Failed to rename project:", error);
    window.alert(error.message || "Unable to rename project.");
  }
};
//  DELETE A SAVED PROJECT
const handleDeleteProject = async (project) => {
  // Ask for confirmation before permanently deleting files.
  const confirmed = window.confirm(
    `Are you sure you want to delete "${project.name}"? This will permanently remove its files.`
  );

  if (!confirmed) return;

  setDeletingProjectId(project.id);

  try {
    const response = await fetch(
      `http://localhost:5000/api/projects/${encodeURIComponent(project.id)}`,
      {
        method: "DELETE",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to delete project.");
    }

    // Update the active project information.
    setHasActiveProject(data.hasActiveProject);
    setProjectName(data.activeProjectName || "");

    // Clear the editor if the deleted project was active.
    if (project.isActive) {
      setSelectedFile(null);
      setFileContent("");
      setFileError("");
    }

    // Refresh the Project Library and file explorer.
    await fetchProjects();
    await fetchFiles();

  } catch (error) {
    console.error("Failed to delete project:", error);
    window.alert(error.message || "Unable to delete project.");
  } finally {
    setDeletingProjectId(null);
  }
};
// START PROJECT INDEXING
const handleIndexProject = async (project) => {

  // Prevent duplicate requests from the frontend.
  if (
    project.indexingStatus === "indexing") {
    return;
  }

  setStartingIndexProjectIds((previous) => [
    ...previous,
    project.id,
  ]);

  try {

    const response = await fetch(
      `http://localhost:5000/api/projects/${encodeURIComponent(project.id)}/index`,
      {
        method: "POST",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || "Unable to start project indexing."
      );
    }

    // Refresh the library to get the new indexing status.
    await fetchProjects();

  } catch (error) {

    console.error("Project indexing request failed:", error);

    window.alert(
      error.message || "Unable to start indexing."
    );

    await fetchProjects();

  } finally {

    // Re-enable the button after the request is accepted or fails.
    setStartingIndexProjectIds((previous) =>
      previous.filter((id) => id !== project.id)
    );

  }
};

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  useEffect(() => {
  fetchProjects();
}, [fetchProjects]);


// Check whether any project is currently indexing.
const hasIndexingProjects = projects.some(
  (project) => project.indexingStatus === "indexing"
);

// Automatically refresh the Project Library during indexing.
useEffect(() => {

  if (!hasIndexingProjects) return;

  const intervalId = window.setInterval(() => {
    fetchProjects();
  }, 2000);

  // Stop polling when indexing finishes or the component unmounts.
  return () => {
    window.clearInterval(intervalId);
  };

}, [hasIndexingProjects, fetchProjects]);



// SENDING UPLOADED FILES TO BACKEND
const handleUpload = async () => {
  if (!selectedZip || isUploading) return;

  setIsUploading(true);
  setUploadMessage("");
  setUploadError("");

  const formData = new FormData();
  formData.append("project", selectedZip);

  try {
    const response = await fetch("http://localhost:5000/api/upload", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Project upload failed.");
    }

    setProjectName(data.projectName);
    setHasActiveProject(true);

    setSelectedFile(null);
    setFileContent("");

    await fetchFiles();
    await fetchProjects();

    setUploadMessage("Project uploaded successfully!");
    setSelectedZip(null);
  } catch (error) {
    console.error("Project upload failed:", error);
    setUploadError(error.message || "Unable to upload the project.");
  } finally {
    setIsUploading(false);
  }
};

  //use to to show one file loading error otherwise show its content
  useEffect(() => {
    if (!selectedFile) return;

    const fetchFileContent = async () => {
    try {
      setFileLoading(true);
      setFileError("");
      setFileContent("");

      const response = await fetch(
        `http://localhost:5000/api/file?path=${encodeURIComponent(selectedFile)}`
      );

      if (!response.ok) {
        throw new Error("Failed to load file content.");
      }

      const data = await response.json();
      setFileContent(data.content);
    } catch (error) {
      console.error("Failed to fetch file content:", error);
      setFileError("Unable to open this file. Please try again.");
    } finally {
      setFileLoading(false);
    }
  };

  fetchFileContent();
}, [selectedFile]);
//to fetch project name from backend
useEffect(() => {
  fetch("http://localhost:5000/api/project")
    .then((response) => {
      if (!response.ok) {
        throw new Error("Failed to fetch project information.");
      }

      return response.json();
    })
    .then((data) => {
      setProjectName(data.projectName || "");
      setHasActiveProject(data.hasActiveProject);
    })
    .catch((error) => {
      console.error("Failed to fetch project information:", error);
      setHasActiveProject(null);
    });
}, []);
       
  return (
    <div className="app">
      <aside className="sidebar">
        <h2>Devdoc</h2>
        <p className="sidebar-subtitle">Codebase Intelligence platform</p>

        <div className="project-section">
          <p className="section-label">WORKSPACE</p>
          <h3 className="project-name">
            {hasActiveProject ? `📁 ${projectName}`:"📁 No project loaded" } 
          </h3>
          <ProjectUpload
            selectedZip={selectedZip}
            setSelectedZip={setSelectedZip}
            isUploading={isUploading}
            uploadMessage={uploadMessage}
            uploadError={uploadError}
            handleUpload={handleUpload}
          />
        </div>  
        <ProjectLibrary
          projects={projects}
          startingIndexProjectIds={startingIndexProjectIds}
          deletingProjectId={deletingProjectId}
          handleSwitchProject={handleSwitchProject}
          handleRenameProject={handleRenameProject}
          handleDeleteProject={handleDeleteProject}
          handleIndexProject={handleIndexProject}
        />
        <FileExplorer
          files={files}
          selectedFile={selectedFile}
          onSelectFile={setSelectedFile}
          filesLoading={filesLoading}
          filesError={filesError}
          hasActiveProject={hasActiveProject}
          fetchFiles={fetchFiles}
        />
      </aside>

      <main className="workspace">
        <div className="workspace-header">
          <h1>Code Workspace</h1>
          <p>Explore and understand your project's source code.</p>
        </div>
        <CodeEditor
          selectedFile={selectedFile}
          fileContent={fileContent}
          fileLoading={fileLoading}
          fileError={fileError}
        />
      </main>
      <AIChat
        chatMessages={chatMessages}
        chatInput={chatInput}
        setChatInput={setChatInput}
        handleSendMessage={handleSendMessage}
        isSendingMessage={isSendingMessage}
      />
      
    </div>  
  );
}

export default App;