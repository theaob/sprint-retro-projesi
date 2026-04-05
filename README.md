# Sprint Retro Projesi

Sprint Retro is a full-stack, real-time web application to help agile teams conduct sprint retrospective meetings smoothly. It provides capabilities to create retrospectives, gather team feedback, vote on items, and export results.

## Features

- **Real-Time Collaboration**: Built with WebSockets, allowing multiple team members to interact with the board simultaneously.
- **Authentication**: Secure access via simple authentication.
- **Vote & Feedback Gathering**: Add items to your retro board and allow the team to vote on priority.
- **Export Data**: Easily export retro results to Excel (`.xlsx`) format.
- **Responsive Design**: Clean and modern UI with modern typography (Inter).

## Tech Stack

### Frontend
- **Vanilla JavaScript** (ES Modules)
- **Vite** for fast, optimized builds
- **CSS3** (Responsive, modern styling)

### Backend
- **Node.js** with **Express**
- **WebSockets** (`ws`) for real-time bi-directional communication
- **SQLite** (`better-sqlite3`) as a lightweight, robust database
- **Bcrypt.js** for password hashing

## Prerequisites

- [Node.js](https://nodejs.org/en/) (v16.0 or newer recommended)
- `npm` (comes with Node)

## Getting Started

1. **Install Dependencies**
   Run the following command from the root directory to install both frontend and backend dependencies:
   ```bash
   npm install
   ```

2. **Start the Development Server**
   Use the `concurrently` script to start both the Node server and the Vite dev server simultaneously:
   ```bash
   npm run dev
   ```
   This will start:
   - Backend Server on `http://localhost:3000`
   - Frontend Vite Server on `http://localhost:5173` (typically)

### Other Scripts
- `npm run dev:server` - Starts only the backend Express server.
- `npm run dev:client` - Starts only the Vite development server.
- `npm run build` - Builds the frontend for production into the `dist` directory.
- `npm run start` - Starts the backend server (used for production).

## Deployment

1. Run `npm run build` to generate the production frontend build. 
2. The `dist` folder will be created. The Express server is configured to serve these static files in production.
3. Start the application using `npm run start`.
Alternatively, you can use the provided `Dockerfile` to build and run the application inside a container.

## Project Structure

```text
sprint-retro-projesi/
├── server/            # Backend (Express / WS / SQLite logic)
├── src/               # Frontend (Vanilla JS / CSS logic)
├── Dockerfile         # Docker configuration
├── index.html         # Frontend entry point
├── package.json       # Project dependencies & scripts
├── vite.config.js     # Vite configuration
└── ...
```

## License

This project is licensed under the MIT License.
