import { FastifyInstance } from 'fastify';
import client from 'prom-client';

// Register default metrics
client.collectDefaultMetrics();

export const tasksTotal = new client.Counter({
  name: 'icn_mcp_tasks_total',
  help: 'Total tasks created'
});

export const policyDeniesTotal = new client.Counter({
  name: 'icn_mcp_policy_denies_total',
  help: 'Number of policy denies'
});

export const prCreatesTotal = new client.Counter({
  name: 'icn_mcp_pr_creates_total',
  help: 'Number of PR creations by mode',
  labelNames: ['mode'] as const
});

export const agentsTotal = new client.Gauge({
  name: 'icn_mcp_agents_total',
  help: 'Number of registered agents'
});

export const webhooksInvalidSigTotal = new client.Counter({
  name: 'icn_mcp_webhooks_invalid_signature_total',
  help: 'Number of GitHub webhook requests with invalid signatures'
});

export const webhooksReceivedTotal = new client.Counter({
  name: 'icn_mcp_webhooks_received_total',
  help: 'Number of GitHub webhook events received',
  labelNames: ['event'] as const
});

const dashboardHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>ICN MCP Metrics Dashboard</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 30px; }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .metric-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric-title { font-size: 18px; font-weight: bold; margin-bottom: 10px; color: #333; }
        .metric-value { font-size: 36px; font-weight: bold; color: #007acc; margin-bottom: 10px; }
        .metric-description { font-size: 14px; color: #666; }
        .refresh-btn { background: #007acc; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin-bottom: 20px; }
        .refresh-btn:hover { background: #005999; }
        .raw-metrics { margin-top: 30px; }
        .raw-metrics-link { color: #007acc; text-decoration: none; }
        .raw-metrics-link:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>ICN MCP Metrics Dashboard</h1>
            <button class="refresh-btn" onclick="location.reload()">Refresh</button>
        </div>
        
        <div class="metrics-grid" id="metrics-grid">
            <!-- Metrics will be populated here -->
        </div>
        
        <div class="raw-metrics">
            <h3>Raw Metrics</h3>
            <p><a href="/metrics" class="raw-metrics-link">View Prometheus format metrics</a></p>
        </div>
    </div>

    <script>
        async function loadMetrics() {
            try {
                const response = await fetch('/metrics');
                const text = await response.text();
                const metrics = parsePrometheusMetrics(text);
                displayMetrics(metrics);
            } catch (error) {
                console.error('Failed to load metrics:', error);
            }
        }

        function parsePrometheusMetrics(text) {
            const lines = text.split('\n');
            const metrics = {};
            
            for (const line of lines) {
                if (line.startsWith('#') || !line.trim()) continue;
                
                const parts = line.split(' ');
                if (parts.length >= 2) {
                    const name = parts[0];
                    const value = parseFloat(parts[1]);
                    if (!isNaN(value)) {
                        metrics[name] = value;
                    }
                }
            }
            
            return metrics;
        }

        function displayMetrics(metrics) {
            const grid = document.getElementById('metrics-grid');
            grid.innerHTML = '';
            
            const metricDefinitions = [
                { key: 'icn_mcp_tasks_total', title: 'Total Tasks', description: 'Total number of tasks created' },
                { key: 'icn_mcp_agents_total', title: 'Active Agents', description: 'Number of registered agents' },
                { key: 'icn_mcp_policy_denies_total', title: 'Policy Denies', description: 'Number of policy denials' },
                { key: 'icn_mcp_pr_creates_total', title: 'PR Creates', description: 'Number of PRs created' },
                { key: 'icn_mcp_webhooks_received_total', title: 'Webhooks Received', description: 'GitHub webhook events received' },
                { key: 'icn_mcp_webhooks_invalid_signature_total', title: 'Invalid Webhook Sigs', description: 'Invalid webhook signatures' }
            ];
            
            for (const def of metricDefinitions) {
                const value = metrics[def.key] || 0;
                const card = createMetricCard(def.title, value, def.description);
                grid.appendChild(card);
            }
        }

        function createMetricCard(title, value, description) {
            const card = document.createElement('div');
            card.className = 'metric-card';
            card.innerHTML = \`
                <div class="metric-title">\${title}</div>
                <div class="metric-value">${value}</div>
                <div class="metric-description">${description}</div>
            \`;
            return card;
        }

        // Load metrics on page load
        loadMetrics();
        
        // Auto-refresh every 30 seconds
        setInterval(loadMetrics, 30000);
    </script>
</body>
</html>
`;

export async function metricsRoute(f: FastifyInstance) {
  f.get('/metrics', async (_req, reply) => {
    const metrics = await client.register.metrics();
    reply.header('Content-Type', client.register.contentType);
    return reply.send(metrics);
  });

  f.get('/dashboard', async (_req, reply) => {
    reply.header('Content-Type', 'text/html');
    return reply.send(dashboardHTML);
  });
}


