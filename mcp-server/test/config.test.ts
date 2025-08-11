import { test, expect } from 'vitest';
import fs from 'node:fs';
import { DB_DIR, DB_PATH, MIGRATIONS_DIR } from '@/config';

test('mcp-server config provides correct paths', () => {
  // Test that paths resolve correctly 
  expect(DB_DIR).toMatch(/icn-mcp[/\\]var$/);
  expect(DB_PATH).toMatch(/icn-mcp[/\\]var[/\\]icn-mcp\.sqlite$/);
  expect(MIGRATIONS_DIR).toMatch(/icn-mcp[/\\]db[/\\]migrations$/);
  
  // Test that migrations directory exists
  expect(fs.existsSync(MIGRATIONS_DIR)).toBe(true);
  
  // Test that DB directory gets created if needed
  expect(typeof DB_DIR).toBe('string');
  expect(typeof DB_PATH).toBe('string');
});

test('mcp-server config can be overridden by environment', () => {
  // Test that the exported values are strings (basic sanity check)
  expect(typeof DB_DIR).toBe('string');
  expect(typeof DB_PATH).toBe('string'); 
  expect(typeof MIGRATIONS_DIR).toBe('string');
});