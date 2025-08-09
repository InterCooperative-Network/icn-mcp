import { request } from 'undici';

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
  const baseUrl = process.env.MCP_BASE_URL || 'http://localhost:8787/api';
  const file = { path: 'docs/protocols/signing-context.md', content: doc };
  const body = {
    task_id: taskId || 'unknown-task',
    title: 'docs: add signing-context protocol skeleton',
    body: 'Initial protocol spec draft for signing context',
    files: [file]
  };
  const res = await request(`${baseUrl}/pr/create`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.body.json();
  console.log('architect PR artifact:', json.artifact);
}

main().catch((e) => { console.error(e); process.exit(1); });

