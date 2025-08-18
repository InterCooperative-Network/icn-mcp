import { registerAgent, createPR } from 'agent-sdk';

function renderDoc(): string {
  return `# Signing Context

This document outlines a minimal signing context protocol.

## Summary
Defines how signatures reference context and what data is required.

## Goals
- Deterministic context identifiers
- Clear payload boundaries

## Data Model
See docs/data-models/did.md
`;
}

async function main() {
  const doc = renderDoc();
  const taskId = process.argv.includes('--task') ? process.argv[process.argv.indexOf('--task') + 1] : '';
  const baseUrl = process.env.MCP_BASE_URL || 'http://localhost:8787';
  
  console.log('🤖 Registering architect agent...');
  const registration = await registerAgent(baseUrl, {
    name: 'Architect A',
    kind: 'architect'
  });
  
  console.log(`✅ Registered as agent ${registration.id}`);
  const token = registration.token;
  
  const file = { path: 'docs/protocols/signing-context.md', content: doc };
  const payload = {
    task_id: taskId || 'unknown-task',
    title: 'docs: add signing-context protocol skeleton',
    body: 'Initial protocol spec draft for signing context',
    files: [file]
  };
  
  console.log('📄 Creating PR with signing context document...');
  const result = await createPR(baseUrl, token, payload);
  
  console.log('✅ Architect PR artifact:', result.artifact);
}

main().catch((e) => { 
  console.error('❌ Architect failed:', e); 
  process.exit(1); 
});

