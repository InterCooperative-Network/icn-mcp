import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { icnSearchFiles } from '../src/tools/icn_search_files.js';
import { icnReadFile } from '../src/tools/icn_read_file.js';
import { icnWritePatch } from '../src/tools/icn_write_patch.js';
import { icnRunTests } from '../src/tools/icn_run_tests.js';
import { icnRunLinters } from '../src/tools/icn_run_linters.js';
import { icnGeneratePRPatch } from '../src/tools/icn_generate_pr_patch.js';
import { icnExplainTestFailures } from '../src/tools/icn_explain_test_failures.js';

// Mock test directory structure for tests
const testDir = path.join(process.cwd(), 'test-tmp');

beforeEach(() => {
  // Create test directory structure
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  
  // Create some test files
  fs.writeFileSync(path.join(testDir, 'test.ts'), 'export const test = "hello";');
  fs.writeFileSync(path.join(testDir, 'test.js'), 'console.log("test");');
  fs.writeFileSync(path.join(testDir, 'README.md'), '# Test\nThis is a test file.');
  
  // Create subdirectory
  const subDir = path.join(testDir, 'subdir');
  if (!fs.existsSync(subDir)) {
    fs.mkdirSync(subDir);
  }
  fs.writeFileSync(path.join(subDir, 'nested.ts'), 'export const nested = true;');
});

afterEach(() => {
  // Clean up test directory
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

describe('ICN File Operations Tools', () => {
  describe('icnSearchFiles', () => {
    it('should search for TypeScript files', async () => {
      const result = await icnSearchFiles({
        pattern: '**/*.ts',
        directory: 'test-tmp'
      });
      
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results.some(f => f.path.endsWith('test.ts'))).toBe(true);
      expect(result.results.some(f => f.path.endsWith('nested.ts'))).toBe(true);
    });

    it('should limit results when maxResults is specified', async () => {
      const result = await icnSearchFiles({
        pattern: '**/*',
        directory: 'test-tmp',
        maxResults: 2
      });
      
      expect(result.results.length).toBeLessThanOrEqual(2);
      expect(result.totalFound).toBeGreaterThanOrEqual(result.results.length);
    });

    it('should respect directory boundaries', async () => {
      await expect(icnSearchFiles({
        pattern: '**/*',
        directory: '../../../etc' // Try to escape repo
      })).rejects.toThrow('within repository boundaries');
    });
  });

  describe('icnReadFile', () => {
    it('should read a file completely', async () => {
      const result = await icnReadFile({
        filePath: path.join(testDir, 'README.md')
      });
      
      expect(result.content).toContain('# Test');
      expect(result.content).toContain('This is a test file');
      expect(result.totalLines).toBe(2);
    });

    it('should read file with line range', async () => {
      const result = await icnReadFile({
        filePath: path.join(testDir, 'README.md'),
        startLine: 1,
        endLine: 1
      });
      
      expect(result.content).toBe('# Test');
      expect(result.linesRead).toBe(1);
      expect(result.totalLines).toBe(2);
    });

    it('should respect file boundaries', async () => {
      await expect(icnReadFile({
        filePath: '../../../etc/passwd' // Try to escape repo
      })).rejects.toThrow('within repository boundaries');
    });

    it('should reject non-existent files', async () => {
      await expect(icnReadFile({
        filePath: 'nonexistent.txt'
      })).rejects.toThrow('File not found');
    });
  });

  describe('icnWritePatch', () => {
    it('should write a new file when createIfNotExists is true', async () => {
      const testFile = path.join(testDir, 'new-file.txt');
      const result = await icnWritePatch({
        filePath: testFile,
        content: 'Hello, world!',
        createIfNotExists: true,
        actor: 'test-actor'
      });
      
      expect(result.success).toBe(true);
      expect(result.operation).toBe('create');
      expect(fs.existsSync(testFile)).toBe(true);
      expect(fs.readFileSync(testFile, 'utf8')).toBe('Hello, world!');
    });

    it('should update an existing file', async () => {
      const testFile = path.join(testDir, 'test.ts');
      const result = await icnWritePatch({
        filePath: testFile,
        content: 'export const updated = "new content";',
        actor: 'test-actor'
      });
      
      expect(result.success).toBe(true);
      expect(result.operation).toBe('update');
      expect(fs.readFileSync(testFile, 'utf8')).toBe('export const updated = "new content";');
    });

    it('should enforce policy restrictions', async () => {
      const result = await icnWritePatch({
        filePath: path.join(testDir, 'restricted.txt'),
        content: 'restricted content',
        createIfNotExists: true,
        actor: 'unauthorized-actor'
      });
      
      // The exact behavior depends on policy configuration
      // but it should either succeed or fail with policy info
      expect(result).toHaveProperty('policyCheck');
      expect(result.policyCheck).toHaveProperty('allowed');
    });
  });
});

describe('ICN Test and Lint Tools', () => {
  describe('icnRunTests', () => {
    it('should run npm test command', async () => {
      const result = await icnRunTests({
        testType: 'npm',
        timeout: 10000
      });
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('command');
      expect(result).toHaveProperty('result');
      expect(result.result).toHaveProperty('total');
    });

    it('should handle custom test commands', async () => {
      const result = await icnRunTests({
        testCommand: 'echo "test output"',
        timeout: 5000
      });
      
      expect(result).toHaveProperty('stdout');
      expect(result.stdout).toContain('test output');
    });
  });

  describe('icnRunLinters', () => {
    it('should run linting commands', async () => {
      const result = await icnRunLinters({
        linterType: 'eslint',
        timeout: 30000
      });
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('result');
      expect(result.result).toHaveProperty('totalIssues');
    });
  });
});

describe('icnExplainTestFailures', () => {
  it('should parse vitest failure output', async () => {
    const testOutput = `
❌ test/example.test.ts > should work correctly
Error: expected 'actual' to equal 'expected'
  at test/example.test.ts:10:5

❌ test/another.test.ts > should also work
Error: Cannot read property 'undefined' of null
  at test/another.test.ts:15:3
`;
    
    const result = await icnExplainTestFailures({
      testOutput,
      testType: 'vitest'
    });
    
    expect(result.totalFailures).toBe(2);
    expect(result.analyses).toHaveLength(2);
    expect(result.analyses[0].category).toBe('assertion');
    expect(result.analyses[1].category).toBe('logic');
    expect(result.overallSuggestions.length).toBeGreaterThan(0);
  });

  it('should categorize different types of failures', async () => {
    const testOutput = `
❌ syntax error test
Error: SyntaxError: Unexpected token

❌ timeout test  
Error: Test timed out after 5000ms

❌ assertion test
Error: expected 5 to equal 10
`;
    
    const result = await icnExplainTestFailures({
      testOutput,
      testType: 'vitest'
    });
    
    expect(result.categorySummary.syntax).toBe(1);
    expect(result.categorySummary.timeout).toBe(1);
    expect(result.categorySummary.assertion).toBe(1);
  });

  it('should provide priority ordering', async () => {
    const testOutput = `
❌ low priority warning
Error: Warning message

❌ high priority syntax error
Error: SyntaxError: Critical issue
`;
    
    const result = await icnExplainTestFailures({
      testOutput,
      testType: 'vitest'
    });
    
    expect(result.priorityOrder).toHaveLength(2);
    // High severity (syntax) should come before low severity
    const firstPriority = result.analyses[result.priorityOrder[0]];
    expect(firstPriority.severity).toBe('high');
  });
});

describe('icnGeneratePRPatch', () => {
  it('should generate PR descriptor with policy check', async () => {
    const result = await icnGeneratePRPatch({
      title: 'Test PR',
      description: 'This is a test PR for the new tools',
      changedFiles: ['test-file.ts'],
      actor: 'test-actor'
    });
    
    expect(result.success).toBe(true);
    expect(result.prDescriptor.title).toBe('Test PR');
    expect(result.prDescriptor).toHaveProperty('policyCheck');
    expect(result.prDescriptor.policyCheck).toHaveProperty('allowed');
  });

  it('should create artifact file', async () => {
    const result = await icnGeneratePRPatch({
      title: 'Artifact Test',
      description: 'Testing artifact creation',
      changedFiles: ['src/test.ts'],
      actor: 'test-actor'
    });
    
    expect(result.prDescriptor.artifact).toBeDefined();
    if (result.prDescriptor.artifact) {
      expect(result.prDescriptor.artifact.path).toMatch(/PR-.*\.json$/);
    }
  });
});