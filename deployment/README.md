# ICN MCP Deployment Guide

This guide covers deploying the ICN MCP server using Docker and Docker Compose with production-ready security hardening.

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
   # IMPORTANT: Edit .env with your secure configuration
   
   # Generate secure Grafana password
   echo "your-secure-password-here" > deployment/secrets/grafana_admin_password.txt
   
   # Start the services
   docker compose up -d
   ```

3. **Access the Services**
   - MCP Server: http://localhost:8787
   - Health Check: http://localhost:8787/healthz
   - Metrics: http://localhost:8787/metrics
   - Prometheus: http://localhost:9090
   - Grafana: http://localhost:3000 (admin/[your-password])

## Services Overview

### MCP Server
- **Port**: 8787
- **Health**: `/healthz`
- **Metrics**: `/metrics` (Prometheus format)
- **Dashboard**: `/dashboard` (built-in metrics dashboard)
- **Security**: Read-only filesystem, dropped capabilities, resource limits

### Prometheus
- **Port**: 9090
- **Configuration**: `deployment/prometheus/prometheus.yml`
- **Data Retention**: 15 days
- **Targets**: MCP Server metrics endpoint
- **Security**: Resource limits, no privileged access

### Grafana
- **Port**: 3000
- **Authentication**: Docker secrets for admin password
- **Dashboards**: Pre-configured ICN MCP dashboard
- **Data Source**: Prometheus (auto-configured)
- **Security**: Anonymous viewing, secure cookies

## Security Configuration

### Mandatory Security Setup

**Before deploying to production, you MUST:**

1. **Change all default passwords and tokens**:
   ```bash
   # Generate secure admin password for Grafana
   openssl rand -base64 32 > deployment/secrets/grafana_admin_password.txt
   
   # Set secure tokens in .env
   MAINTAINER_ADMIN_TOKEN=$(openssl rand -hex 32)
   MAINTAINER_TOKENS=$(openssl rand -hex 16),$(openssl rand -hex 16)
   ```

2. **Review environment variables**:
   ```bash
   # Example secure .env configuration
   LOG_LEVEL=info
   GITHUB_TOKEN=ghp_your_secure_github_token
   MAINTAINER_ADMIN_TOKEN=your_secure_admin_token_64_chars
   MAINTAINER_TOKENS=token1_32_chars,token2_32_chars
   RATE_LIMIT_MAX_REQUESTS=100
   ```

3. **Verify security hardening is active**:
   ```bash
   # Check container security
   docker inspect icn-mcp-mcp-1 | grep -A 10 "SecurityOpt"
   # Should show: "no-new-privileges:true"
   
   docker inspect icn-mcp-mcp-1 | grep ReadonlyRootfs
   # Should show: "ReadonlyRootfs": true
   ```

### Container Security Features

The deployment includes comprehensive security hardening:

- **Multi-stage build**: Separate builder and runtime stages
- **Non-root user**: Services run as unprivileged user (UID 10001)
- **Read-only filesystem**: Container filesystem is read-only
- **Dropped capabilities**: All Linux capabilities dropped
- **No new privileges**: Prevents privilege escalation
- **Resource limits**: CPU and memory limits enforced
- **Network isolation**: Services communicate via dedicated network
- **Secrets management**: Sensitive data stored in Docker secrets

### Production Security Checklist

- [ ] Changed default Grafana admin password
- [ ] Set secure maintainer tokens (minimum 32 characters)
- [ ] Configured GitHub token with minimal required permissions
- [ ] Enabled TLS termination with reverse proxy
- [ ] Configured firewall rules (only expose necessary ports)
- [ ] Set up log monitoring and alerting
- [ ] Implemented backup strategy for persistent volumes
- [ ] Configured log rotation and retention policies
- [ ] Reviewed and customized rate limiting settings
- [ ] Set up monitoring for security events

## Configuration

### Environment Variables

| Variable | Description | Security Impact |
|----------|-------------|-----------------|
| `MAINTAINER_ADMIN_TOKEN` | Admin API access token | **HIGH** - Full administrative access |
| `MAINTAINER_TOKENS` | Comma-separated maintainer tokens | **HIGH** - Administrative access |
| `GITHUB_TOKEN` | GitHub API token | **MEDIUM** - Repository access |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | **MEDIUM** - DoS protection |
| `LOG_LEVEL` | Application log level | **LOW** - Information disclosure |

### Persistent Volumes

Persistent data is stored in named volumes with proper permissions:
- `mcp-data`: SQLite database (owned by UID 10001)
- `prom-data`: Prometheus metrics data
- `grafana-data`: Grafana dashboards and settings

## Production Deployment

### TLS/SSL Termination

Use a reverse proxy for TLS termination:

```nginx
# Example nginx configuration
server {
    listen 443 ssl http2;
    server_name icn-mcp.example.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:8787;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Monitoring and Alerting

#### Key Security Metrics

Monitor these critical security metrics:
- `icn_mcp_policy_denies_total`: Policy violations (potential attacks)
- `icn_mcp_webhooks_invalid_signature_total`: Invalid webhook signatures
- `up{job="icn-mcp-server"}`: Service availability
- `process_resident_memory_bytes`: Memory usage (potential DoS)

#### Grafana Dashboard

The pre-configured dashboard includes:
- **Service status**: Real-time availability monitoring
- **Resource usage**: Memory, CPU, and Node.js event loop lag
- **Security metrics**: Policy denies and invalid webhook signatures
- **Performance metrics**: Request rates and response times

### Backup Strategy

```bash
# Automated backup script
#!/bin/bash
DATE=$(date +%Y%m%d-%H%M%S)

# Backup application data
docker run --rm \
  -v icn-mcp_mcp-data:/data:ro \
  -v $(pwd):/backup \
  alpine tar czf /backup/mcp-data-$DATE.tar.gz -C /data .

# Backup Grafana data
docker run --rm \
  -v icn-mcp_grafana-data:/data:ro \
  -v $(pwd):/backup \
  alpine tar czf /backup/grafana-data-$DATE.tar.gz -C /data .

# Encrypt backups (recommended)
gpg --cipher-algo AES256 --compress-algo 1 --s2k-mode 3 \
    --s2k-digest-algo SHA512 --s2k-count 65536 --force-mdc \
    --quiet --no-greeting --batch --yes \
    --passphrase-file ~/.backup-passphrase \
    --symmetric --output mcp-data-$DATE.tar.gz.gpg \
    mcp-data-$DATE.tar.gz
```

## Troubleshooting

### Security Issues

1. **Container fails to start with permission errors**
   ```bash
   # Check volume permissions
   docker volume inspect icn-mcp_mcp-data
   
   # Reset volume with correct permissions
   docker compose down
   docker volume rm icn-mcp_mcp-data
   docker compose up -d
   ```

2. **Health checks failing**
   ```bash
   # Test health endpoint manually
   curl -v http://localhost:8787/healthz
   
   # Check container logs
   docker compose logs mcp
   ```

3. **Metrics not appearing in Grafana**
   ```bash
   # Verify Prometheus targets
   curl http://localhost:9090/api/v1/targets
   
   # Test metrics endpoint
   curl http://localhost:8787/metrics
   ```

### Common Issues

1. **Port conflicts**
   ```bash
   # Check if ports are in use
   netstat -tlnp | grep -E ':(8787|9090|3000)'
   ```

2. **Build failures**
   ```bash
   # Clean build with security verification
   docker compose down
   docker system prune -f
   docker compose build --no-cache
   docker compose up -d
   
   # Verify security settings
   docker inspect icn-mcp-mcp-1 | grep -E "(ReadonlyRootfs|SecurityOpt|User)"
   ```

3. **ESM import errors**
   ```bash
   # Verify tsc-alias resolved paths correctly
   docker exec icn-mcp-mcp-1 find /app/mcp-server/dist -name "*.js" | head -5 | xargs grep -l "from.*\.js"
   ```

### First-Run Checklist

After deployment, verify:

1. **Prometheus targets are up**
   - Visit http://localhost:9090/targets
   - Ensure `icn-mcp-server` target is UP

2. **Grafana data source is configured**
   - Visit http://localhost:3000/datasources
   - Verify Prometheus data source is working

3. **Dashboard loads metrics**
   - Visit http://localhost:3000/dashboards
   - Open "ICN MCP Server Dashboard"
   - Verify metrics are displaying data

4. **Security hardening is active**
   ```bash
   # Verify container security
   docker inspect icn-mcp-mcp-1 | jq '.[] | {ReadonlyRootfs, SecurityOpt, User}'
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

# Rebuild with security verification
docker compose down
docker compose build
docker compose up -d

# Verify security settings are maintained
docker inspect icn-mcp-mcp-1 | grep -E "(SecurityOpt|ReadonlyRootfs)"
```