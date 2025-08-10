import Fastify from 'fastify';
import { healthRoute, apiRoutes } from './api.js';
import { metricsRoute } from './metrics.js';

// Configure pino logger
const isDev = process.env.NODE_ENV !== 'production';
const logger = {
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  transport: isDev ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  } : undefined,
  serializers: {
    req: (req: any) => ({
      method: req.method,
      url: req.url,
      headers: req.headers,
      remoteAddress: req.remoteAddress,
      remotePort: req.remotePort
    }),
    res: (res: any) => ({
      statusCode: res.statusCode,
      headers: res.headers
    })
  }
};

const app = Fastify({ 
  logger,
  genReqId: (req) => {
    const id = Math.random().toString(36).slice(2, 10);
    // Ensure request ID is available in logs
    req.headers['x-request-id'] = id;
    return id;
  }
});

app.register(healthRoute);
app.register(apiRoutes, { prefix: '/api' });
app.register(metricsRoute);

const port = Number(process.env.PORT || 8787);
app.listen({ port, host: '0.0.0.0' })
  .then(() => app.log.info({ port }, 'MCP server listening'))
  .catch((e) => { 
    app.log.error(e, 'Failed to start server'); 
    process.exit(1); 
  });

