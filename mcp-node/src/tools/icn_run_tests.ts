import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { STDOUT_TRUNCATE_LIMIT, STDERR_TRUNCATE_LIMIT } from './constants.js';

export const RunTestsRequestSchema = z.object({
  testType: z.enum(['npm', 'cargo', 'just', 'custom']).optional(),
  testCommand: z.string().optional(),
  workspace: z.string().optional(),
  testFile: z.string().optional(),
  timeout: z.number().int().positive().max(600000).optional()
}).strict();

export type RunTestsRequest = z.infer<typeof RunTestsRequestSchema>;

export interface TestResult {
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  duration: number;
  failures: TestFailure[];
}

export interface TestFailure {
  testName: string;
  error: string;
  file?: string;
  line?: number;
}

export interface RunTestsResponse {
  success: boolean;
  command: string;
  exitCode: number;
  result: TestResult;
  stdout: string;
  stderr: string;
  duration: number;
}

function getRepoRoot(): string {
  // Walk up to find the repo root (package.json at monorepo root)
  let cur = process.cwd();
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(cur, "package.json")) && fs.existsSync(path.join(cur, "docs"))) {
      return cur;
    }
    const up = path.dirname(cur);
    if (up === cur) break;
    cur = up;
  }
  return cur;
}

function parseTestOutput(stdout: string, stderr: string, testType: string): TestResult {
  const failures: TestFailure[] = [];
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let duration = 0;
  
  const output = stdout + '\n' + stderr;
  
  if (testType === 'npm' || testType === 'vitest') {
    // Parse vitest output
    const testMatch = output.match(/Tests\s+(\d+)\s+passed.*?(\d+)\s+failed.*?(\d+)\s+skipped/i);
    if (testMatch) {
      passed = parseInt(testMatch[1], 10);
      failed = parseInt(testMatch[2], 10);
      skipped = parseInt(testMatch[3], 10);
    }
    
    // Parse duration from vitest
    const durationMatch = output.match(/Duration\s+([\d.]+)s/i);
    if (durationMatch) {
      duration = parseFloat(durationMatch[1]) * 1000;
    }
    
    // Parse failure details
    const failurePattern = /❌.*?([^\n]+)\n.*?Error: ([^\n]+)/g;
    let match;
    while ((match = failurePattern.exec(output)) !== null) {
      failures.push({
        testName: match[1].trim(),
        error: match[2].trim()
      });
    }
  } else if (testType === 'cargo') {
    // Parse cargo test output
    const testMatch = output.match(/test result: (\w+)\. (\d+) passed; (\d+) failed; (\d+) ignored/);
    if (testMatch) {
      passed = parseInt(testMatch[2], 10);
      failed = parseInt(testMatch[3], 10);
      skipped = parseInt(testMatch[4], 10);
    }
    
    // Parse cargo test failures
    const failurePattern = /test (\S+) \.\.\. FAILED/g;
    let match;
    while ((match = failurePattern.exec(output)) !== null) {
      failures.push({
        testName: match[1],
        error: 'Test failed - check output for details'
      });
    }
  } else {
    // Generic parsing - try to find numbers
    const numbers = output.match(/(\d+)/g);
    if (numbers && numbers.length >= 3) {
      passed = parseInt(numbers[0], 10) || 0;
      failed = parseInt(numbers[1], 10) || 0;
      skipped = parseInt(numbers[2], 10) || 0;
    }
  }
  
  return {
    passed,
    failed,
    skipped,
    total: passed + failed + skipped,
    duration,
    failures
  };
}

function buildTestCommand(request: RunTestsRequest): string[] {
  if (request.testCommand) {
    return request.testCommand.split(' ');
  }
  
  switch (request.testType) {
    case 'cargo':
      return ['cargo', 'test'];
    case 'just':
      return ['just', 'verify'];
    case 'npm':
    default:
      if (request.workspace) {
        return ['npm', 'run', '-w', request.workspace, 'test'];
      } else if (request.testFile) {
        return ['npm', 'test', '--', request.testFile];
      } else {
        return ['npm', 'test'];
      }
  }
}

export async function icnRunTests(request: RunTestsRequest): Promise<RunTestsResponse> {
  // Validate input
  try {
    RunTestsRequestSchema.parse(request);
  } catch (error: any) {
    if (error?.errors) {
      throw new Error(`Invalid input: ${error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
    }
    throw error;
  }

  const repoRoot = getRepoRoot();
  const command = buildTestCommand(request);
  const timeout = request.timeout || 120000; // 2 minutes default
  
  const startTime = Date.now();
  
  return new Promise((resolve) => {
    const child = spawn(command[0], command.slice(1), {
      cwd: repoRoot,
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'test' }
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });
    
    const timeoutId = setTimeout(() => {
      child.kill('SIGTERM');
    }, timeout);
    
    child.on('close', (exitCode) => {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      const testResult = parseTestOutput(stdout, stderr, request.testType || 'npm');
      
      resolve({
        success: exitCode === 0,
        command: command.join(' '),
        exitCode: exitCode || -1,
        result: testResult,
        stdout: stdout.slice(-STDOUT_TRUNCATE_LIMIT),
        stderr: stderr.slice(-STDERR_TRUNCATE_LIMIT),  
        duration
      });
    });
    
    child.on('error', (error) => {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      
      resolve({
        success: false,
        command: command.join(' '),
        exitCode: -1,
        result: {
          passed: 0,
          failed: 1,
          skipped: 0,
          total: 1,
          duration,
          failures: [{
            testName: 'Command execution',
            error: error.message
          }]
        },
        stdout: '',
        stderr: error.message,
        duration
      });
    });
  });
}