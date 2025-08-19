import Fastify from 'fastify';
import { healthRoute, apiRoutes } from './api.js';
import { metricsRoute } from './metrics.js';
import { rateLimitMiddleware, initRateLimitCleanup, stopRateLimitCleanup } from './auth.js';

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

// Add raw body parser for webhook signature verification
app.addContentTypeParser('*', { parseAs: 'buffer' }, (req, body, done) => {
  // @ts-expect-error augment at runtime
  req.rawBody = body;
  done(null, body);
});

// Type augmentation for rawBody
declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: Buffer;
  }
}

// Add global rate limiting (except for health checks)
app.addHook('preHandler', async (req, reply) => {
  // Skip rate limiting for health checks
  if (req.url.startsWith('/healthz')) {
    return;
  }
  
  // Apply rate limiting
  await rateLimitMiddleware()(req, reply);
});

app.register(healthRoute);
app.register(apiRoutes, { prefix: '/api' });
app.register(metricsRoute);

// Initialize rate limit cleanup and register shutdown handler
initRateLimitCleanup();
app.addHook('onClose', async () => {
  stopRateLimitCleanup();
});

const port = Number(process.env.PORT || 8787);

// Start server
const start = async () => {
  try {
    await app.listen({ port, host: '0.0.0.0' });
    app.log.info({ port }, 'MCP server listening');
  } catch (err) {
    app.log.error(err, 'Failed to start server');
    process.exit(1);
  }
};

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  app.log.info({ signal }, 'Received shutdown signal, starting graceful shutdown');
  
  try {
    await app.close();
    app.log.info('Server closed successfully');
    process.exit(0);
  } catch (err) {
    app.log.error(err, 'Error during shutdown');
    process.exit(1);
  }
};

// Register signal handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (err) => {
  app.log.fatal(err, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  app.log.fatal({ reason, promise }, 'Unhandled rejection');
  process.exit(1);
});

start();

