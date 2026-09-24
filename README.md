# Sprint Retro Projesi

Sprint Retro is a full-stack, real-time web application to help agile teams conduct sprint retrospective meetings smoothly. It provides capabilities to create retrospectives, gather team feedback, vote on items, and export results.

## Features

- **Staged retros (optional)**: The facilitator moves everyone through *Hazırlık → Yaz → Oyla → Tartış → Kapanış* (setup, write, vote, discuss, wrap-up). A progress strip shows the current stage on every screen.
  - **Hidden writing**: while writing, each person sees only their own notes; everyone else's appear as placeholders until voting starts. The note text never reaches other browsers, not even the facilitator's.
  - **Independent voting**: vote counts stay hidden until voting ends, so early leaders don't snowball.
  - **Discussion focus and timer**: the note being discussed and a shared countdown are shown on every participant's screen.
  - Simple retros (everything open at once, as in earlier versions) remain the default.
- **Phone-first board**: one lane at a time with swipe and lane tabs, a writing box docked above the keyboard, 44px tap targets, and pinch-zoom kept on.
- **Anonymous by default**: participants join from a short link without an account; the optional display name is only used in the "who's here" list, never on notes.
- **Real-time collaboration** over WebSockets: notes, votes, stages, focus and timer update live for everyone.
- **Facilitator controls** in one sheet: share link, next stage, timer, lanes, finish or reopen, Excel export.
- **Templates**: Standart, GBI, Mad/Sad/Glad, Start/Stop/Continue, 4Ls, or admin-defined templates.
- **Export** retro results to Excel (`.xlsx`).
- **Accessible**: light and dark themes (or follow the system) checked to WCAG AA contrast, keyboard- and screen-reader-friendly dialogs, and a Back gesture that closes the open dialog.
- **Secure by default**: rate-limited sign-in, forced change of the default admin password, sessions revoked on password change.

## Tech Stack

### Frontend
- **Preact** + **htm** (JSX-like tagged templates, no compile step) for every view
- **Vite** for builds
- **CSS cascade layers** with design tokens (`src/styles/`)
- Fonts: Bricolage Grotesque, Atkinson Hyperlegible Next, JetBrains Mono

### Backend
- **Node.js** with **Express**
- **WebSockets** (`ws`) for real-time bi-directional communication
- **SQLite** (`better-sqlite3`) as a lightweight, robust database
- **Bcrypt.js** for password hashing

## Prerequisites

- [Node.js](https://nodejs.org/en/) 22 or newer
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
├── src/               # Frontend
│   ├── App.js         #   hash router
│   ├── ui/            #   shared components (buttons, fields, dialogs, icons, app shell)
│   ├── views/         #   pages; views/retro/ is the retro board
│   └── styles/        #   CSS in cascade layers (tokens, base, components, views, effects)
├── test/              # Vitest + supertest API tests
├── Dockerfile         # Docker configuration
├── index.html         # Frontend entry point
├── package.json       # Project dependencies & scripts
├── vite.config.js     # Vite configuration
└── ...
```

## License

This project is licensed under the MIT License.
