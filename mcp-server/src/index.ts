import Fastify from 'fastify';
import { healthRoute, apiRoutes } from './api.js';

const app = Fastify({ logger: false });
app.register(healthRoute);
app.register(apiRoutes, { prefix: '/api' });

const port = Number(process.env.PORT || 8787);
app.listen({ port, host: '0.0.0.0' })
  .then(() => console.log(`MCP server listening on :${port}`))
  .catch((e) => { console.error(e); process.exit(1); });

