DevDoc
Explore a codebase and ask questions about it without jumping between
files.

DevDoc is a web app I built to make it easier to understand and explore
software projects. You can upload a project, browse its files, open
source code, and ask questions about the codebase using an AI assistant.

Live app: https://dev-doc-ai-2-0.vercel.app\
Source code: https://github.com/tyagiaradhya099-arch/DevDoc-AI---2.0
Why I built it
When you're working with an unfamiliar project, understanding how its
files fit together can take time. I wanted to build one place where I
could browse a project's structure, read its files, and get help
understanding the code.

DevDoc is my attempt at putting those pieces together.
What you can do with it
- Create an account and sign in.
- Upload and manage your own projects.
- Browse a project's folder and file structure.
- Open files and view their contents in the workspace.
- Index a project so its content can be used for retrieval.
- Ask the AI assistant questions about the indexed codebase.
The AI answers depend on the project being indexed and on the
information available to the retrieval system. It is intended as a
code-understanding aid, not a replacement for reading or testing the
code yourself.
A look at the app
Add your own screenshots to the screenshots folder in this repository,
then keep the image paths below. GitHub will display each image when the
file exists.
Welcome page
screenshots/Welcome.png
Dashboard page
screenshots/Overview.png
Project library
screenshots/Project.png
Workspace
screenshots/Workspace.png
Authentication Page
screenshots/Login.png

Built with
  Part             Technologies
  Frontend         React, Vite
Backend          Node.js, Express
Database         PostgreSQL (Neon)
Login sessions   express-session, connect-pg-simple
AI               Google Gemini API
Vector search    LanceDB
How it works
The frontend communicates with an Express API. User accounts, project
records, and session data are stored in PostgreSQL. Project files are
handled by the backend. When a project is indexed, DevDoc creates
embeddings and stores them in LanceDB. When a user asks a question, the
retrieval layer finds relevant project context and the generation layer
sends that context to Gemini to produce an answer.

In short:
1. A user uploads and selects a project.
2. DevDoc reads and indexes the project's supported content.
3. Embeddings are stored in the vector store.
4. A question is converted into a retrieval query.
5. Relevant context is retrieved and sent to Gemini.
6. The assistant returns an answer based on that context.
Run it locally
You'll need Node.js and npm installed, along with a PostgreSQL database
and a Google Gemini API key.

Clone the repository:
git clone https://github.com/tyagiaradhya099-arch/DevDoc-AI---2.0.git
cd DevDoc-AI---2.0
Install the backend dependencies:
cd devdoc-backend
npm install
Create a .env file in devdoc-backend and provide the values used by
the backend:
NODE_ENV=development
PORT=5000
DATABASE_URL=your_postgresql_connection_string
SESSION_SECRET=your_session_secret
GEMINI_API_KEY=your_gemini_api_key
CLIENT_URL=http://localhost:5173
Start the backend:
npm start
In a second terminal, install and start the frontend:
cd devdoc
npm install
Create a .env file in devdoc:
VITE_API_URL=http://localhost:5000
Then run:
npm run dev
Open the local URL printed by Vite in your terminal.
Deployment
The frontend is deployed on Vercel and the backend runs on Render.
PostgreSQL is hosted on Neon.

The current backend deployment uses Render's free service. Its local
filesystem is temporary, so uploaded project files and local LanceDB
data may not survive a service restart or redeployment. The
database-backed account and project metadata are stored separately in
Neon. Keep this limitation in mind when trying the live demo.
A few implementation details
- Authentication uses server-side sessions.
- Session records are stored in PostgreSQL through
  connect-pg-simple.
- Project records are associated with their owner.
- The backend checks ownership when handling user-specific project
  operations.
- The codebase Q&A flow uses retrieval-augmented generation (RAG):
  retrieve relevant chunks first, then provide that context to the
  language model.
Current limitations
This is a personal project and a learning exercise, so there are
practical limits:
- The live backend may take a little time to wake up after being idle.
- The free hosting setup does not provide persistent local storage for
  uploaded files or LanceDB.
- AI responses depend on successful indexing, retrieval quality, and
  Gemini API availability.
- Large projects may take longer to index and may be affected by API
  usage limits.
What's next
The main goal was to build and deploy a working end-to-end application
and understand the engineering decisions behind it. Future improvements
will depend on testing the current version and identifying problems that
are worth solving.
Author
Built by Aradhya Tyagi.
- GitHub: https://github.com/tyagiaradhya099-arch
- Project repository:
  https://github.com/tyagiaradhya099-arch/DevDoc-AI---2.0
