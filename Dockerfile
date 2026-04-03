FROM node:20-alpine AS build

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
FROM node:20-alpine

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

# The SQLite database retro.db is stored at the project root (/app/retro.db). 
# You should mount it as a volume to persist data: 
# -v /path/to/host/data/retro.db:/app/retro.db

CMD ["npm", "start"]
