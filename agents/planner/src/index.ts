import fs from 'node:fs';
import path from 'node:path';
import { registerAgent, createTask } from 'agent-sdk';

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

  const baseUrl = process.env.MCP_BASE_URL || 'http://localhost:8787';
  
  // Register agent and get token using SDK
  console.log('🤖 Registering planner agent...');
  const registration = await registerAgent(baseUrl, {
    name: 'Planner A',
    kind: 'planner'
  });
  
  console.log(`✅ Registered as agent ${registration.id}`);
  const token = registration.token;
  
  const created: string[] = [];
  for (const task of tasks) {
    try {
      const result = await createTask(baseUrl, token, {
        title: task.title,
        description: `Task created by planner: ${task.title}`
      });
      
      if (result.id) {
        created.push(result.id);
        console.log(`📋 Created task: ${result.id} - ${task.title}`);
      }
    } catch (error) {
      console.error(`❌ Failed to create task "${task.title}":`, error);
    }
  }
  
  console.log('✅ Planner completed. Created tasks:', created.join(', '));
}

main().catch((e) => { 
  console.error('❌ Planner failed:', e); 
  process.exit(1); 
});

