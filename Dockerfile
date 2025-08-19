# ---- builder ----
FROM node:20-bookworm-slim AS builder

ENV NODE_ENV=development
WORKDIR /app

# Enable corepack for deterministic npm
RUN corepack enable

# Copy root manifests first for better caching
COPY package.json package-lock.json ./
COPY npm-shrinkwrap.json* ./

# Copy workspace manifests for better cache hits
COPY mcp-server/package.json mcp-server/
COPY mcp-node/package.json mcp-node/
COPY agent-sdk/package.json agent-sdk/
COPY agents/architect/package.json agents/architect/
COPY agents/ops/package.json agents/ops/
COPY agents/planner/package.json agents/planner/
COPY agents/reviewer/package.json agents/reviewer/

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy the rest of the source code (pre-built)
COPY . .

# ---- runtime ----
FROM node:20-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

# Create non-root user with specific UID/GID
RUN groupadd -g 10001 nodeapp && useradd -r -u 10001 -g nodeapp nodeapp

# Copy production node_modules and package files
COPY --from=builder /app/package.json /app/package-lock.json ./
# Prefer clean prod deps in the runtime image:
RUN npm ci --omit=dev

# Copy built artifacts from correct location (root dist, not pre-existing mcp-server/dist)
COPY --from=builder /app/dist /app/mcp-server/dist
COPY mcp-server/package.json mcp-server/

# Create data directory for SQLite and set proper permissions
RUN mkdir -p /data && chown -R nodeapp:nodeapp /data

# Set environment variables
ENV PORT=8787
ENV MCP_DB_PATH=/data/icn-mcp.sqlite
ENV NODE_ENV=production

# Expose port
EXPOSE 8787

# Security hardening will be applied via docker-compose
USER nodeapp

# Node.js based health check (no external dependencies required)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:${PORT}/healthz', r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# Start the server with proper signal handling
CMD ["node", "mcp-server/dist/src/index.js"]