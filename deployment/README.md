# ICN MCP Deployment Guide

This guide covers deploying the ICN MCP server using Docker and Docker Compose.

## Quick Start

1. **Prerequisites**
   - Docker and Docker Compose installed
   - At least 2GB RAM available
   - Ports 8787, 9090, and 3000 available

2. **Deploy with Docker Compose**
   ```bash
   # Clone the repository
   git clone https://github.com/InterCooperative-Network/icn-mcp.git
   cd icn-mcp
   
   # Copy and customize environment file
   cp .env.docker .env
   # Edit .env with your configuration
   
   # Start the services
   docker compose up -d
   ```

3. **Access the Services**
   - MCP Server: http://localhost:8787
   - Health Check: http://localhost:8787/healthz
   - Metrics: http://localhost:8787/metrics
   - Prometheus: http://localhost:9090
   - Grafana: http://localhost:3000 (admin/admin)

## Services Overview

### MCP Server
- **Port**: 8787
- **Health**: `/healthz`
- **Metrics**: `/metrics` (Prometheus format)
- **Dashboard**: `/dashboard` (built-in metrics dashboard)

### Prometheus
- **Port**: 9090
- **Configuration**: `deployment/prometheus.yml`
- **Data Retention**: 30 days
- **Targets**: MCP Server metrics endpoint

### Grafana
- **Port**: 3000
- **Default Login**: admin/admin (change in .env)
- **Dashboards**: Pre-configured ICN MCP dashboard
- **Data Source**: Prometheus (auto-configured)

## Configuration

### Environment Variables

Key environment variables (set in `.env`):

```bash
# GitHub Configuration
GITHUB_OWNER=InterCooperative-Network
GITHUB_REPO=icn-mcp
GITHUB_TOKEN=ghp_your_token_here

# Security
MAINTAINER_ADMIN_TOKEN=your_admin_token
MAINTAINER_TOKENS=token1,token2,token3

# Grafana
GRAFANA_ADMIN_PASSWORD=secure_password

# Rate Limiting
RATE_LIMIT_MAX_REQUESTS=100
```

### Volumes

Persistent data is stored in named volumes:
- `mcp-data`: SQLite database and application data
- `mcp-logs`: Application logs
- `prometheus-data`: Prometheus metrics data
- `grafana-data`: Grafana dashboards and settings

## Production Deployment

### Security Considerations

1. **Change Default Passwords**
   ```bash
   # Set secure Grafana password
   GRAFANA_ADMIN_PASSWORD=your_secure_password
   ```

2. **Configure Authentication**
   ```bash
   # Set maintainer tokens for API access
   MAINTAINER_ADMIN_TOKEN=secure_admin_token
   MAINTAINER_TOKENS=token1,token2,token3
   ```

3. **TLS/SSL Termination**
   - Use a reverse proxy (nginx, traefik) for TLS termination
   - Configure proper certificates

### Scaling Considerations

1. **Database**: SQLite is suitable for moderate workloads. For high load, consider external PostgreSQL.
2. **Metrics**: For long-term storage, consider remote Prometheus storage.
3. **Logs**: Configure log aggregation (ELK stack, Loki).

### Backup Strategy

```bash
# Backup volumes
docker run --rm -v icn-mcp_mcp-data:/data -v $(pwd):/backup alpine tar czf /backup/mcp-data-$(date +%Y%m%d).tar.gz -C /data .
docker run --rm -v icn-mcp_prometheus-data:/data -v $(pwd):/backup alpine tar czf /backup/prometheus-data-$(date +%Y%m%d).tar.gz -C /data .
```

## Monitoring and Alerting

### Key Metrics

Monitor these metrics in Grafana:
- `icn_mcp_tasks_total`: Total tasks created
- `icn_mcp_agents_total`: Active agents
- `icn_mcp_policy_denies_total`: Policy violations
- `up{job="icn-mcp-server"}`: Server availability

### Health Checks

The MCP server includes comprehensive health checks:
- `/healthz`: Basic health status
- `/healthz/context`: Configuration info
- `/healthz/db`: Database connectivity

## Troubleshooting

### Common Issues

1. **Port conflicts**
   ```bash
   # Check if ports are in use
   netstat -tlnp | grep -E ':(8787|9090|3000)'
   ```

2. **Volume permissions**
   ```bash
   # Fix volume permissions
   docker compose down
   docker volume rm icn-mcp_mcp-data
   docker compose up -d
   ```

3. **Build failures**
   ```bash
   # Clean build
   docker compose down
   docker system prune -f
   docker compose build --no-cache
   docker compose up -d
   ```

### Logs

```bash
# View logs
docker compose logs -f mcp-server
docker compose logs -f prometheus
docker compose logs -f grafana

# View specific service logs
docker logs icn-mcp-server
```

## Development

For development with hot reload:

```bash
# Start only dependencies
docker compose up -d prometheus grafana

# Run MCP server locally
npm ci
npm run build
npm run -w mcp-server dev
```

## Updates

To update the deployment:

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker compose down
docker compose build
docker compose up -d
```