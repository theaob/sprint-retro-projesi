# Sprint Retro Projesi

Sprint Retro is a full-stack, real-time web application to help agile teams conduct sprint retrospective meetings smoothly. It provides capabilities to create retrospectives, gather team feedback, vote on items, and export results.

## Features

- **Real-Time Collaboration**: Built with WebSockets, allowing multiple team members to interact with the board simultaneously.
- **Authentication**: Secure access via simple authentication with a minimum 6-character password limit.
- **Short URL Redirection**: Generates clean, short sharing links (`/s/:code`) for retrospectives to make sharing with the team extremely simple.
- **Mobile-First Optimizations**: Tailored layouts for mobile devices including:
  - Sticky bottom navigation bar for main sections on mobile viewports.
  - Interactive board column tabs with smooth scrolling and scroll sync (active tab updates as you swipe columns).
  - Card-based responsive table layouts for easy user management on small screens.
  - Touch-friendly controls: entry edit/delete actions and larger tap targets are always reachable on touchscreens, not just on hover.
  - Theme toggle accessible from the header on all screen sizes.
- **Vote & Feedback Gathering**: Add items to your retro board and allow the team to vote on priority.
- **Configurable Vote Limits**: Admins can configure the maximum number of votes each participant is allowed to cast (locally enforced on devices).
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

### Docker
You can also use the provided `Dockerfile` to build and run the application inside a container. The setup uses a lightweight Debian base (`node:22-bookworm-slim`) and seamlessly supports multi-architecture builds (including `linux/amd64` and `linux/arm64/v8`).

#### Data Persistence
To ensure your data (retros, users, and votes) is kept between redeployments or version updates, you should mount a volume to the `/app/data` directory where the SQLite database is stored:

```bash
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  --name sprint-retro \
  sprint-retro-app
```

The container runs as the unprivileged `node` user (uid 1000), so the mounted data directory must be writable by it. For a directory created by an older (root) image, run `sudo chown -R 1000:1000 ./data` once before upgrading.

#### Behind a reverse proxy
If the app sits behind a reverse proxy (nginx, Traefik, a cloud load balancer), set `TRUST_PROXY` to the number of proxy hops, e.g. `-e TRUST_PROXY=1`. Rate limiting then uses the client IP from `X-Forwarded-For`. Leave it unset when the container is exposed directly, as in the command above: otherwise clients could set their own IP in that header and get around the login rate limit. Without it behind a proxy, every visitor shares the proxy's IP and one rate-limit budget.

An automated GitHub Actions workflow (`release-docker.yml`) is provided out-of-the-box to handle building and pushing these cross-platform images to Docker Hub.

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
