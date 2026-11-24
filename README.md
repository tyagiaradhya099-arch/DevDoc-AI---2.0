# DevDoc – AI-Powered Codebase Assistant

DevDoc is a web-based application designed to make exploring and understanding software projects easier. It allows users to upload their codebases, browse files, view source code, and ask questions about their projects using an AI-powered assistant.

The idea behind DevDoc is to bring code exploration and AI-assisted understanding into one workspace.

**Live Demo:** https://dev-doc-ai-2-0.vercel.app

**GitHub Repository:** https://github.com/tyagiaradhya099-arch/DevDoc-AI---2.0

---

## Overview

Working with an unfamiliar codebase can be challenging, especially when a project contains multiple folders, files, and dependencies.

DevDoc provides a centralized workspace where users can explore project structures, read source files, and interact with an AI assistant to understand their code.

It combines project management, file exploration, and Retrieval-Augmented Generation (RAG) to provide context-aware answers about uploaded projects.

## Features

- **User Authentication:** Register and log in using individual accounts.
- **Project Management:** Upload, activate, rename, and delete projects.
- **Project Explorer:** Browse folders and files within an uploaded codebase.
- **Code Viewer:** Open and inspect source code files.
- **AI-Powered Chat:** Ask questions about an indexed codebase.
- **RAG-Based Retrieval:** Retrieve relevant code context before generating AI responses.
- **User-Specific Projects:** Associate project records with their respective owners.

## Screenshots

### Welcome Page

![DevDoc Welcome Page](Welcome.png)

### Project Library

![DevDoc Project Library](Projects.png)

### Dashboard / Overview

![DevDoc Overview](Overview.png)

### Authentication Page

![DevDoc Login](Login.png)

### Code Workspace
![DevDoc Workspace](Workspace.png)

## Technology Stack

| Category | Technologies |
|---|---|
| Frontend | React.js, Vite |
| Backend | Node.js, Express.js |
| Database | PostgreSQL (Neon) |
| Authentication | Express Session, connect-pg-simple |
| AI Model | Google Gemini API |
| Vector Database | LanceDB |
| Deployment | Vercel, Render |

## How DevDoc Works

DevDoc uses a Retrieval-Augmented Generation (RAG) workflow to answer questions about uploaded codebases.

1. The user uploads a software project.
2. The backend processes and indexes the project files.
3. Text embeddings are generated using the Gemini API.
4. Embeddings are stored in LanceDB.
5. When a user asks a question, the retrieval service searches for relevant project context.
6. The retrieved context is passed to Gemini to generate a response.

This approach helps the assistant answer questions using information from the uploaded project rather than relying only on general language-model knowledge.

## Project Structure

The repository contains two main applications:

- `devdoc/` – React frontend built using Vite.
- `devdoc-backend/` – Express backend responsible for authentication, project management, file operations, and AI-related services.

## Running Locally

### Prerequisites

- Node.js
- npm
- PostgreSQL database
- Google Gemini API key

### 1. Clone the repository

```bash
git clone https://github.com/tyagiaradhya099-arch/DevDoc-AI---2.0.git
cd DevDoc-AI---2.0
```

### 2. Set up the backend

```bash
cd devdoc-backend
npm install
```

Create a `.env` file inside the backend directory:

```env
NODE_ENV=development
PORT=5000
DATABASE_URL=your_postgresql_connection_string
SESSION_SECRET=your_session_secret
GEMINI_API_KEY=your_gemini_api_key
CLIENT_URL=http://localhost:5173
```

Start the backend:

```bash
npm start
```

### 3. Set up the frontend

Open another terminal:

```bash
cd devdoc
npm install
```

Create a `.env` file inside the frontend directory:

```env
VITE_API_URL=http://localhost:5000
```

Start the frontend:

```bash
npm run dev
```

Open the local URL provided by Vite.

## Deployment

DevDoc is deployed using:

- **Frontend:** Vercel
- **Backend:** Render
- **Database:** Neon PostgreSQL

The application uses environment variables to manage API configuration and sensitive credentials across development and production environments.

## Current Limitations

- The backend is hosted on Render's free tier and may take some time to respond after periods of inactivity.
- The free hosting environment does not provide persistent local filesystem storage.
- Uploaded project files and local LanceDB data may be lost after a backend restart or redeployment.
- AI responses depend on successful project indexing, retrieval quality, and Gemini API availability.

## What I Learned

Building DevDoc helped me work with several parts of full-stack development, including:

- Designing and connecting frontend and backend systems.
- Implementing authentication and session management.
- Working with PostgreSQL and database relationships.
- Handling file uploads and project-specific data.
- Understanding embeddings, vector storage, and similarity search.
- Implementing a basic RAG pipeline.
- Deploying a full-stack application using cloud platforms.

## Author

**Aradhya Tyagi**

GitHub: https://github.com/tyagiaradhya099-arch

---

*Built as a full-stack development project exploring AI-assisted software engineering and codebase understanding.*
