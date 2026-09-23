# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Vite (5173) + Express/WS (3000) concurrently — main dev loop
npm run dev:server    # Express/WS server only
npm run dev:client    # Vite dev server only
npm run build         # Production frontend build -> dist/
npm start             # Run the built app (Express serves dist/ + API + WS on :3000)
npm test              # Full test suite (vitest run)
npx vitest run test/auth.test.js   # Single test file
npm run lint           # Biome lint (server/, src/, test/, *.js)
npm run format          # Biome format --write
```

In dev, Vite proxies `/api` and `/s/` to `localhost:3000`, so the frontend always talks to one origin. CI (`.github/workflows/ci.yml`) runs lint → test → build on every push/PR to `main`.

## Architecture

**Two Express entry points.** `server/app.js` builds the Express app (middleware, `/api` routes, `/s/:code` short-link redirect, static `dist/` serving) with no `listen()` call, so it's importable directly in tests via `supertest`. `server/index.js` wraps it with an HTTP server, attaches the `ws` WebSocket server from `server/realtime.js` (`attachRealtime(server)` — rooms, presence, typing relay, payload cap and per-socket rate limit), and is the actual `npm start` entry point. Route handlers call a `broadcast(retroId, payload)` function injected from `index.js` into `routes.js` via `setBroadcast()` — this is how REST mutations (add entry, vote, rename column, finish retro, etc.) fan out to every connected client in that retro's WS room.

**Database migrations are numbered, append-only steps.** `server/db.js` gates schema changes on SQLite's `PRAGMA user_version`: each `if (schemaVersion < N) { ...; db.pragma('user_version = N') }` step runs exactly once per database. Step 1 is the whole pre-versioning history (the original `CREATE TABLE`s plus every old `try { ... } catch { console.error(...) }` migration block, kept verbatim); a database created before versioning reads `user_version` 0 and replays step 1 once. **Never edit or remove an existing step**: to change the schema, append a new step with the next number, even to reverse something an earlier step did (step 1 has several examples of one block undoing an earlier one). Keep each step safe to re-run (`table_info` / `IF NOT EXISTS` guards), since a crash between the change and the version bump replays it. `test/migrations.test.js` checks that a second boot applies nothing.

**Auth is a Bearer session token**, not JWT: `server/auth.js`'s `loadUser` middleware reads `sessions` by token and attaches `req.user` (or `null`) on every request; `requireAuth`/`requireAdmin` gate specific routes, and both also refuse an account still flagged `must_change_password` (the seeded admin/admin) — only routes using `requireAuthAllowPending` (`/auth/me`, logout, changing your own password) let it through. Retro boards themselves are public (no auth required to view/vote) — voting and anonymous participation are scoped by a client-generated `participant_id` (see `getParticipantId()` in `src/utils.js`) rather than a login; the server stores guest votes as `anon:<participant_id>` (see `voterId()` in `routes.js`) so a guest can never act under a real user's id. Finished retros reject new entries and votes server-side. Route input goes through the helpers at the top of `routes.js` (`cleanString`, `optionalString`, `passwordError`, `parseColumnNames`, and the `LIMITS` table of max lengths); public board writes are rate-limited per IP (`boardWriteLimiter`), and `X-Forwarded-For` is trusted only when the `TRUST_PROXY` env var is set (`server/app.js`).

**Frontend is a hash router over a vanilla/Preact split.** `src/main.js` matches `location.hash` and calls a `render*(appEl, ...)` function per view — `#/`, `#/app`, `#/login`, `#/register`, `#/users`, `#/retro/:id`. The admin dashboard, user management, and login views (`src/views/admin.js`, `users.js`, `login.js`, `landing.js`) are hand-rolled vanilla JS: `appEl.innerHTML = ...` template strings plus manual `addEventListener` wiring — no virtual DOM. Only the retro board itself (`src/views/retro/`) uses Preact with `htm` tagged templates (no JSX/build step for that). This split is intentional, not accidental — match whichever style the file you're editing already uses.

**Retro board state is centralized in one reducer.** `src/views/retro/reducer.js`'s `retroReducer` is the single point every state change flows through: the initial `GET /retros/:id` payload, every inbound WebSocket event (via `src/ws.js`'s `createRetroSocket`, wired up once in `RetroBoard.js`), and local optimistic updates (e.g. vote-before-server-confirms). Because the WS handlers are bound once on mount, routing everything through `dispatch` avoids stale-closure bugs. Many reducer cases are idempotency-guarded (check-then-append) because a client's own optimistic dispatch and the WS echo of its own broadcast can both arrive.

**Retro-end animations are a pluggable pool.** `src/views/retro/retroEndAnimations.js` exports `playRetroEndAnimation(onComplete)`, which checks `prefers-reduced-motion` once and otherwise picks a random entry from an array of `show*` functions (`shutdownScreen.js`, `solitaireCascade.js`, `marioEnding.js`, `deathStarEnding.js`, `pokeballEnding.js`, `bowlingStrike.js`, `shiningDoor.js`) — each a self-contained, dependency-free module that builds its own full-screen overlay and calls `onComplete` when done. To add a new one, write a new `show*.js` following the same shape and add it to the array; no other wiring needed.

**Styling is one file, theme-tokenized.** `src/style.css` defines CSS custom properties (`--bg-*`, `--text-*`, `--accent-*`, several in OKLCH) redefined per theme under `.theme-daylight` / `.theme-midnight` classes on `<html>`, toggled via `applyTheme()`/`setTheme()` in `src/utils.js`. There's no CSS-in-JS or per-component stylesheet — new component styles go in this file.

**Tests share one throwaway SQLite file for the whole run.** `vitest.config.js` sets `DB_PATH=./test/tmp/test.db` and `fileParallelism: false` specifically because test files run sequentially against the same on-disk database (wiped fresh by `test/global-setup.js` before the run) — don't parallelize test files or assume isolated state between them. `test/helpers.js` has shared fixtures (`loginAdmin` — a dedicated `testadmin` account, since the seeded admin/admin is locked out of the API until its password changes — `registerUser`, `createRetro`, etc.) — reuse them rather than re-authenticating by hand in new tests.

**UI strings are Turkish.** All user-facing text (buttons, labels, toasts, error messages) is in Turkish; code comments and identifiers are English. Match this when adding UI.
