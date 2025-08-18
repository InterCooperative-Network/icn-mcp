# Use Node.js 20 LTS with a more complete base
FROM node:20

# Set working directory
WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./
COPY mcp-server/package*.json ./mcp-server/
COPY mcp-node/package*.json ./mcp-node/
COPY agent-sdk/package*.json ./agent-sdk/
COPY agents/architect/package*.json ./agents/architect/
COPY agents/ops/package*.json ./agents/ops/
COPY agents/planner/package*.json ./agents/planner/
COPY agents/reviewer/package*.json ./agents/reviewer/

# Install all dependencies  
RUN npm ci

# Also specifically install mcp-server dependencies
RUN cd mcp-server && npm ci

# Copy source code including pre-built dist
COPY . .

# Create directories for runtime data
RUN mkdir -p /app/var /app/logs

# Create non-root user for security
RUN groupadd -g 1001 icn && \
    useradd -s /bin/bash -u 1001 -g icn -m icn && \
    chown -R icn:icn /app

# Switch to non-root user
USER icn

# Go back to app directory for runtime
WORKDIR /app

# Expose port 8787
EXPOSE 8787

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8787/healthz || exit 1

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8787
ENV MCP_DB_DIR=/app/var
ENV REPO_ROOT=/app

# Start the mcp-server (stay in root, use node_modules from mcp-server)
CMD ["node", "--preserve-symlinks", "dist/src/index.js"]