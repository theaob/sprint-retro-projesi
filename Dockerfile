FROM node:22-bookworm-slim AS build

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the application
COPY . .

# Build the Vite frontend
RUN npm run build

# ---
# Production stage
FROM node:22-bookworm-slim

WORKDIR /app

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy server code
COPY server ./server

# Copy built frontend from the build stage
COPY --from=build /app/dist ./dist

# Expose the API and Web port
EXPOSE 3000

# Set environment variable for production
ENV NODE_ENV=production

# The SQLite database is stored in the /app/data directory by default.
# Mount this directory to a persistent volume to keep data between redeployments:
# -v /path/to/host/data:/app/data
# The server runs as the unprivileged `node` user (uid 1000). The
# entrypoint starts as root just long enough to give the data directory to
# `node` (volumes written by older, root-run images are owned by root),
# then drops privileges before starting the server.
RUN mkdir -p /app/data && chown node:node /app/data
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
ENTRYPOINT ["docker-entrypoint.sh"]

CMD ["node", "server/index.js"]
