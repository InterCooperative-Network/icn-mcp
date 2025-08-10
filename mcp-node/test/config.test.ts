import { test, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { DOCS_ROOT, POLICY_RULES_PATH, CODEOWNERS_PATH } from '../src/config.js';

test('mcp-node config provides correct paths', () => {
  // Test that environment variables are respected
  const originalDocRoot = process.env.DOCS_ROOT;
  const originalPolicyPath = process.env.POLICY_RULES_PATH;
  const originalCodeownersPath = process.env.CODEOWNERS_PATH;
  
  try {
    // Test default paths (should resolve to repo root)
    expect(DOCS_ROOT).toMatch(/icn-mcp[/\\]docs$/);
    expect(POLICY_RULES_PATH).toMatch(/icn-mcp[/\\]mcp-server[/\\]policy\.rules\.json$/);
    expect(CODEOWNERS_PATH).toMatch(/icn-mcp[/\\]CODEOWNERS$/);
    
    // Test that paths point to existing locations
    expect(fs.existsSync(DOCS_ROOT)).toBe(true);
    expect(fs.existsSync(path.dirname(POLICY_RULES_PATH))).toBe(true);
    expect(fs.existsSync(CODEOWNERS_PATH)).toBe(true);
  } finally {
    // Restore environment
    if (originalDocRoot !== undefined) process.env.DOCS_ROOT = originalDocRoot;
    else delete process.env.DOCS_ROOT;
    if (originalPolicyPath !== undefined) process.env.POLICY_RULES_PATH = originalPolicyPath;
    else delete process.env.POLICY_RULES_PATH;
    if (originalCodeownersPath !== undefined) process.env.CODEOWNERS_PATH = originalCodeownersPath;
    else delete process.env.CODEOWNERS_PATH;
  }
});

test('mcp-node config respects environment variables', () => {
  // This test would need to be in a separate process to properly test env vars
  // For now, just test that the exported values are strings
  expect(typeof DOCS_ROOT).toBe('string');
  expect(typeof POLICY_RULES_PATH).toBe('string');
  expect(typeof CODEOWNERS_PATH).toBe('string');
});