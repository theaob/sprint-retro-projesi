FROM node:20-bookworm-slim AS build

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
FROM node:20-bookworm-slim

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

CMD ["npm", "start"]
