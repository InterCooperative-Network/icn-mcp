import fs from 'node:fs';
import path from 'node:path';
import { request } from 'undici';

async function registerAgent(baseUrl: string): Promise<string> {
  const res = await request(`${baseUrl}/agent/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ 
      name: 'Planner A', 
      kind: 'planner' 
    })
  });
  const json = (await res.body.json()) as any;
  if (!json?.token) {
    throw new Error('Failed to register agent: no token received');
  }
  console.log('Planner registered successfully, agent ID:', json.id);
  return json.token;
}

async function main() {
  const overviewPath = path.resolve(process.cwd(), 'docs/architecture/00-overview.md');
  let contents = '';
  try { contents = fs.readFileSync(overviewPath, 'utf8'); } catch { /* noop */ }

  const hasIntent = contents.includes('Intent-0001');
  const tasks = [
    { title: 'Wire DB + task create/list API' },
    { title: 'Implement policy engine + /api/policy/check' },
    { title: 'Local PR adapter + /api/pr/create' }
  ];
  if (!hasIntent) {
    // still proceed; v0 planner is naive
    console.log('Intent-0001 not found; proceeding with default tasks');
  }

  const baseUrl = process.env.MCP_BASE_URL || 'http://localhost:8787/api';
  
  // Register agent and get token
  const token = await registerAgent(baseUrl);
  
  const created: string[] = [];
  for (const t of tasks) {
    const res = await request(`${baseUrl}/task/create`, {
      method: 'POST',
      headers: { 
        'content-type': 'application/json',
        'authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ title: t.title, created_by: 'planner' })
    });
    const json = (await res.body.json()) as any;
    if (json?.id) created.push(json.id);
  }
  console.log('planner created tasks:', created.join(', '));
}

main().catch((e) => { console.error(e); process.exit(1); });

