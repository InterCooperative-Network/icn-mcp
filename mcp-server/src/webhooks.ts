import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import crypto from 'node:crypto';
import { insertWebhookEvent, insertTask, getTaskById } from '@/db';
import { analyzePr } from '@/pr-coach';
import { webhooksInvalidSigTotal, webhooksReceivedTotal } from '@/metrics';
import { createCommitStatus, createPullRequestComment, createIssueComment } from '@/github';

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
      // Use strict regex: Task-ID: followed by task_[alphanumeric_-]
      const taskId =
        /Task-ID:\s*([a-zA-Z0-9_-]+)/.exec(body)?.[1] ??
        /Task[- ]ID:\s*([a-zA-Z0-9_-]+)/i.exec(body)?.[1] ?? null;
      if (taskId) {
        return taskId.trim();
      }
    }
  }
  
  return undefined;
}

function verifyGithubSignature(req: FastifyRequest, secret: string): boolean {
  const sigHeader =
    (req.headers['x-hub-signature-256'] as string | undefined) ||
    (req.headers['X-Hub-Signature-256'] as unknown as string | undefined);

  if (!sigHeader || !sigHeader.startsWith('sha256=')) return false;

  const raw = req.rawBody ?? Buffer.from(
    typeof req.body === 'string' ? req.body : JSON.stringify(req.body) ?? ''
  );

  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex');

  const a = Buffer.from(sigHeader);
  const b = Buffer.from(expected);
  // avoid throw on unequal length
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function handleGitHubWebhook(req: FastifyRequest, reply: FastifyReply) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    req.log.error({ reqId: req.id }, 'WEBHOOK_SECRET missing');
    return reply.code(500).send({ ok: false, error: 'server_misconfigured' });
  }

  if (!verifyGithubSignature(req, secret)) {
    webhooksInvalidSigTotal.inc();
    req.log.warn({ reqId: req.id }, 'github webhook signature verification failed');
    return reply.code(401).send({ ok: false });
  }

  const event = (req.headers['x-github-event'] || req.headers['X-GitHub-Event']) as string | undefined;
  const delivery = (req.headers['x-github-delivery'] || req.headers['X-GitHub-Delivery']) as string | undefined;

  // Parse payload as JSON object for logging/routing
  const payload: any = typeof req.body === 'object' && req.body !== null ? req.body : {};

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
        
        // Create task if Task-ID is found and task doesn't exist
        if (taskId) {
          req.log.info({ taskId, reqId: req.id, event, action }, 'found Task-ID in webhook');
          const existingTask = getTaskById(taskId);
          if (!existingTask) {
            req.log.info({ taskId, reqId: req.id }, 'creating new task from webhook');
            // Create new task based on webhook payload
            const title = generateTaskTitle(event, action, payload);
            const description = generateTaskDescription(event, payload);
            const createdBy = senderLogin || 'webhook';
            
            try {
              const { id } = insertTask({ id: taskId, title, description, created_by: createdBy });
              req.log.info({ taskId: id, reqId: req.id, event, action }, 'task created from webhook');
              
              // Post initial status/comment for task creation
              await postTaskCreationResponse(event, payload, id, req);
            } catch (err) {
              req.log.error({ err, taskId, reqId: req.id }, 'failed to create task from webhook');
            }
          } else {
            req.log.info({ taskId, reqId: req.id, event, action }, 'task already exists, skipping creation');
          }
        }
      } catch (err) {
        req.log.error({ err, reqId: req.id }, 'webhook event processing error');
      }
      break;
    }
    case 'push': {
      // Handle push events specifically
      try {
        if (taskId) {
          const existingTask = getTaskById(taskId);
          if (existingTask) {
            // Post commit status for existing task
            const sha = payload?.after || payload?.head_commit?.id;
            if (sha) {
              await createCommitStatus({
                sha,
                state: 'pending',
                context: 'icn-mcp/task-processing',
                description: `Processing task ${taskId}`
              });
              req.log.info({ taskId, sha, reqId: req.id }, 'commit status posted for task');
            }
          }
        }
      } catch (err) {
        req.log.error({ err, reqId: req.id }, 'push event processing error');
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

// Helper functions for task generation and GitHub responses
function generateTaskTitle(event: string | undefined, action: string | undefined, payload: any): string {
  const prefix = `[${event?.toUpperCase()}]`;
  
  switch (event) {
    case 'issues':
      return `${prefix} ${payload?.issue?.title || 'Issue processing'}`;
    case 'pull_request':
      return `${prefix} ${payload?.pull_request?.title || 'PR processing'}`;
    case 'issue_comment':
      return `${prefix} Comment on: ${payload?.issue?.title || 'Unknown issue'}`;
    default:
      return `${prefix} ${action || 'Event'} processing`;
  }
}

function generateTaskDescription(event: string | undefined, payload: any): string {
  const repoName = payload?.repository?.full_name || 'Unknown repository';
  const sender = payload?.sender?.login || 'Unknown user';
  
  let description = `Automated task created from ${event} event in ${repoName} by ${sender}.\n\n`;
  
  switch (event) {
    case 'issues':
      description += `Issue: ${payload?.issue?.title}\n`;
      description += `URL: ${payload?.issue?.html_url}\n`;
      if (payload?.issue?.body) {
        description += `\nIssue body:\n${payload.issue.body}`;
      }
      break;
    case 'pull_request':
      description += `Pull Request: ${payload?.pull_request?.title}\n`;
      description += `URL: ${payload?.pull_request?.html_url}\n`;
      if (payload?.pull_request?.body) {
        description += `\nPR body:\n${payload.pull_request.body}`;
      }
      break;
    case 'issue_comment':
      description += `Comment on: ${payload?.issue?.title}\n`;
      description += `Issue URL: ${payload?.issue?.html_url}\n`;
      description += `Comment URL: ${payload?.comment?.html_url}\n`;
      if (payload?.comment?.body) {
        description += `\nComment:\n${payload.comment.body}`;
      }
      break;
    default:
      description += `Event data: ${JSON.stringify(payload, null, 2)}`;
  }
  
  return description;
}

async function postTaskCreationResponse(event: string | undefined, payload: any, taskId: string, req: FastifyRequest): Promise<void> {
  try {
    const responseMessage = `✅ Task ${taskId} has been created and will be processed by ICN MCP agents.`;
    
    switch (event) {
      case 'issues':
        if (payload?.issue?.number) {
          await createIssueComment({
            issue_number: payload.issue.number,
            body: responseMessage
          });
          req.log.info({ taskId, issueNumber: payload.issue.number }, 'issue comment posted');
        }
        break;
      case 'pull_request':
        if (payload?.pull_request?.number) {
          await createPullRequestComment({
            pull_number: payload.pull_request.number,
            body: responseMessage
          });
          req.log.info({ taskId, prNumber: payload.pull_request.number }, 'PR comment posted');
        }
        break;
      case 'issue_comment':
        if (payload?.issue?.number) {
          await createIssueComment({
            issue_number: payload.issue.number,
            body: responseMessage
          });
          req.log.info({ taskId, issueNumber: payload.issue.number }, 'issue comment reply posted');
        }
        break;
    }
  } catch (err) {
    req.log.error({ err, taskId, event }, 'failed to post task creation response');
  }
}

export async function webhooksRoute(f: FastifyInstance) {
  // Note: For strict HMAC verification on raw bytes, consider adding fastify-raw-body plugin.
  f.post('/webhooks/github', async (req, reply) => handleGitHubWebhook(req, reply));
}


