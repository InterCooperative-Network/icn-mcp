import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import crypto from 'node:crypto';
import { insertWebhookEvent } from '@/db';
import { analyzePr } from '@/pr-coach';
import { webhooksInvalidSigTotal, webhooksReceivedTotal } from '@/metrics';

function safeStringify(body: unknown): string {
  if (typeof body === 'string') return body;
  try {
    const s = JSON.stringify(body);
    return typeof s === 'string' ? s : '';
  } catch {
    return '';
  }
}

function extractTaskId(payload: any): string | undefined {
  // Extract Task-ID marker from issue/PR bodies
  const possibleBodies = [
    payload?.issue?.body,
    payload?.pull_request?.body,
    payload?.comment?.body,
    payload?.issue_comment?.body
  ].filter(Boolean);

  for (const body of possibleBodies) {
    if (typeof body === 'string') {
      // Use safer regex: /(\s|^)Task-ID:\s*(task_[A-Za-z0-9_-]{6,})\b/
      const match = body.match(/(\s|^)Task-ID:\s*(task_[A-Za-z0-9_-]{6,})\b/);
      if (match) {
        return match[2]; // Return the second capture group (the actual task ID)
      }
    }
  }
  
  return undefined;
}

function verifyHmac256(payload: string | Buffer, signatureHeader: string | undefined, secret: string): boolean {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
  const theirSig = signatureHeader.slice('sha256='.length);
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(payload).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(digest, 'hex'), Buffer.from(theirSig, 'hex'));
  } catch {
    return false;
  }
}

export async function handleGitHubWebhook(req: FastifyRequest, reply: FastifyReply) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    req.log.error({ reqId: req.id }, 'WEBHOOK_SECRET missing');
    return reply.code(500).send({ ok: false, error: 'server_misconfigured' });
  }

  const event = (req.headers['x-github-event'] || req.headers['X-GitHub-Event']) as string | undefined;
  const delivery = (req.headers['x-github-delivery'] || req.headers['X-GitHub-Delivery']) as string | undefined;
  const sig = (req.headers['x-hub-signature-256'] || req.headers['X-Hub-Signature-256']) as string | undefined;

  // Prefer rawBody if available (e.g., via fastify-raw-body); fallback to re-stringifying body
  const raw: Buffer | string = (req as any).rawBody || safeStringify((req as any).body);

  if (!verifyHmac256(raw, sig, secret)) {
    webhooksInvalidSigTotal.inc();
    req.log.warn({ reqId: req.id }, 'github webhook invalid signature');
    return reply.code(401).send({ ok: false, error: 'invalid_signature' });
  }

  // Parse payload as JSON object for logging/routing
  const payload: any = typeof raw === 'string' && raw.length > 0
    ? JSON.parse(raw)
    : (typeof (req as any).body === 'object' && (req as any).body !== null ? (req as any).body : {});

  const action: string | undefined = payload?.action;
  const repoFullName: string | undefined = payload?.repository?.full_name;
  const senderLogin: string | undefined = payload?.sender?.login;
  const taskId = extractTaskId(payload);

  // Record event
  try {
    insertWebhookEvent({
      event: event ?? 'unknown',
      delivery: delivery ?? '',
      action: action ?? '',
      repo: repoFullName ?? '',
      sender: senderLogin ?? '',
      payload,
      task_id: taskId
    });
    webhooksReceivedTotal.inc({ event: event ?? 'unknown' });
    
    if (taskId) {
      req.log.info({ taskId, reqId: req.id, event, action }, 'webhook linked to task');
    }
  } catch (err) {
    req.log.error({ err, reqId: req.id }, 'failed to log webhook event');
  }

  // Minimal routing skeleton (extend in future phases)
  switch (event) {
    case 'issues':
    case 'issue_comment':
    case 'pull_request': {
      try {
        const analysis = analyzePr(payload as any);
        if (analysis.advice.length > 0) {
          req.log.info({ advice: analysis.advice, reqId: req.id }, 'pr coaching advice');
        }
      } catch (err) {
        req.log.error({ err, reqId: req.id }, 'pr coaching error');
      }
      break;
    }
    case 'check_suite':
      // Accept and process later
      break;
    default:
      // Unknown events are accepted but only logged
      break;
  }

  return reply.code(200).send({ ok: true });
}

export async function webhooksRoute(f: FastifyInstance) {
  // Note: For strict HMAC verification on raw bytes, consider adding fastify-raw-body plugin.
  f.post('/webhooks/github', async (req, reply) => handleGitHubWebhook(req, reply));
}


