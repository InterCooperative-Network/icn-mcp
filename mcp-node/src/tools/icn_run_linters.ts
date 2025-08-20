import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { STDOUT_TRUNCATE_LIMIT, STDERR_TRUNCATE_LIMIT } from './constants.js';

export const RunLintersRequestSchema = z.object({
  linterType: z.enum(['eslint', 'prettier', 'tsc', 'custom']).optional(),
  linterCommand: z.string().optional(),
  workspace: z.string().optional(),
  files: z.array(z.string()).optional(),
  fix: z.boolean().optional(),
  timeout: z.number().int().positive().max(300000).optional()
}).strict();

export type RunLintersRequest = z.infer<typeof RunLintersRequestSchema>;

export interface LintIssue {
  file: string;
  line: number;
  column: number;
  rule: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

export interface LintResult {
  totalIssues: number;
  errors: number;
  warnings: number;
  fixable: number;
  issues: LintIssue[];
}

export interface RunLintersResponse {
  success: boolean;
  command: string;
  exitCode: number;
  result: LintResult;
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

function parseLintOutput(stdout: string, stderr: string, linterType: string): LintResult {
  const issues: LintIssue[] = [];
  let errors = 0;
  let warnings = 0;
  let fixable = 0;
  
  const output = stdout + '\n' + stderr;
  
  if (linterType === 'eslint') {
    // Parse ESLint output
    const linePattern = /(.+):(\d+):(\d+):\s+(error|warning):\s+(.+?)\s+([a-z-/@]+)?$/gm;
    let match;
    
    while ((match = linePattern.exec(output)) !== null) {
      const [, file, line, column, severity, message, rule] = match;
      issues.push({
        file: file.trim(),
        line: parseInt(line, 10),
        column: parseInt(column, 10),
        rule: rule || 'unknown',
        severity: severity as 'error' | 'warning',
        message: message.trim()
      });
      
      if (severity === 'error') errors++;
      if (severity === 'warning') warnings++;
    }
    
    // Parse ESLint summary
    const summaryMatch = output.match(/(\d+) problems? \((\d+) errors?, (\d+) warnings?\)/);
    if (summaryMatch) {
      errors = parseInt(summaryMatch[2], 10);
      warnings = parseInt(summaryMatch[3], 10);
    }
    
    // Parse fixable count
    const fixableMatch = output.match(/(\d+) errors? and (\d+) warnings? potentially fixable/);
    if (fixableMatch) {
      fixable = parseInt(fixableMatch[1], 10) + parseInt(fixableMatch[2], 10);
    }
  } else if (linterType === 'tsc') {
    // Parse TypeScript compiler output
    const tscPattern = /(.+)\((\d+),(\d+)\):\s+(error|warning)\s+TS\d+:\s+(.+)/g;
    let match;
    
    while ((match = tscPattern.exec(output)) !== null) {
      const [, file, line, column, severity, message] = match;
      issues.push({
        file: file.trim(),
        line: parseInt(line, 10),
        column: parseInt(column, 10),
        rule: 'typescript',
        severity: severity as 'error' | 'warning',
        message: message.trim()
      });
      
      if (severity === 'error') errors++;
      if (severity === 'warning') warnings++;
    }
  } else {
    // Generic parsing for other linters
    const genericPattern = /(.+):(\d+):(\d+):\s*(.+)/g;
    let match;
    
    while ((match = genericPattern.exec(output)) !== null) {
      const [, file, line, column, message] = match;
      issues.push({
        file: file.trim(),
        line: parseInt(line, 10) || 1,
        column: parseInt(column, 10) || 1,
        rule: 'unknown',
        severity: 'warning',
        message: message.trim()
      });
      warnings++;
    }
  }
  
  return {
    totalIssues: issues.length,
    errors,
    warnings,
    fixable,
    issues: issues.slice(0, 50) // Limit to first 50 issues
  };
}

function buildLintCommand(request: RunLintersRequest): string[] {
  if (request.linterCommand) {
    return request.linterCommand.split(' ');
  }
  
  switch (request.linterType) {
    case 'eslint':
      {
        const eslintCmd = ['npm', 'run', 'lint'];
        if (request.fix) eslintCmd.push('--', '--fix');
        if (request.files?.length) {
          eslintCmd.push('--');
          eslintCmd.push(...request.files);
        }
        return eslintCmd;
      }
      
    case 'prettier':
      {
        const prettierCmd = ['npx', 'prettier'];
        if (request.fix) {
          prettierCmd.push('--write');
        } else {
          prettierCmd.push('--check');
        }
        if (request.files?.length) {
          prettierCmd.push(...request.files);
        } else {
          prettierCmd.push('**/*.{ts,js,json,md}');
        }
        return prettierCmd;
      }
      
    case 'tsc':
      if (request.workspace) {
        return ['npm', 'run', '-w', request.workspace, 'build'];
      } else {
        return ['npm', 'run', 'build'];
      }
      
    case 'custom':
    default:
      return ['npm', 'run', 'lint'];
  }
}

export async function icnRunLinters(request: RunLintersRequest): Promise<RunLintersResponse> {
  // Validate input
  try {
    RunLintersRequestSchema.parse(request);
  } catch (error: any) {
    if (error?.errors) {
      throw new Error(`Invalid input: ${error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
    }
    throw error;
  }

  const repoRoot = getRepoRoot();
  const command = buildLintCommand(request);
  const timeout = request.timeout || 60000; // 1 minute default
  
  const startTime = Date.now();
  
  return new Promise((resolve) => {
    const child = spawn(command[0], command.slice(1), {
      cwd: repoRoot,
      stdio: 'pipe',
      env: { ...process.env }
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
      const lintResult = parseLintOutput(stdout, stderr, request.linterType || 'eslint');
      
      resolve({
        success: exitCode === 0,
        command: command.join(' '),
        exitCode: exitCode || -1,
        result: lintResult,
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
          totalIssues: 1,
          errors: 1,
          warnings: 0,
          fixable: 0,
          issues: [{
            file: 'command',
            line: 1,
            column: 1,
            rule: 'execution',
            severity: 'error',
            message: error.message
          }]
        },
        stdout: '',
        stderr: error.message,
        duration
      });
    });
  });
}