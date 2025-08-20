import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { z } from 'zod';
import { icnCheckPolicy, PolicyCheckRequest } from './icn_check_policy.js';

export const GeneratePRPatchRequestSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  changedFiles: z.array(z.string()).optional(),
  baseBranch: z.string().optional(),
  targetBranch: z.string().optional(),
  actor: z.string().optional(),
  createGitHubPR: z.boolean().optional()
}).strict();

export type GeneratePRPatchRequest = z.infer<typeof GeneratePRPatchRequestSchema>;

export interface PRPatchFile {
  path: string;
  status: 'added' | 'modified' | 'deleted';
  additions: number;
  deletions: number;
  diff: string;
}

export interface PRPatchDescriptor {
  title: string;
  description: string;
  files: PRPatchFile[];
  baseBranch: string;
  targetBranch: string;
  totalAdditions: number;
  totalDeletions: number;
  policyCheck: {
    allowed: boolean;
    reasons: string[];
    suggestions: string[];
  };
  artifact?: {
    path: string;
    created: string;
  };
}

export interface GeneratePRPatchResponse {
  success: boolean;
  prDescriptor: PRPatchDescriptor;
  githubPR?: {
    created: boolean;
    url?: string;
    number?: number;
    error?: string;
  };
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

async function getGitDiff(baseBranch: string, targetBranch: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['diff', '--no-color', `${baseBranch}..${targetBranch}`], {
      cwd: getRepoRoot(),
      stdio: 'pipe'
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (exitCode) => {
      if (exitCode === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Git diff failed: ${stderr}`));
      }
    });
    
    child.on('error', reject);
  });
}

async function getChangedFiles(baseBranch: string, targetBranch: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['diff', '--name-only', `${baseBranch}..${targetBranch}`], {
      cwd: getRepoRoot(),
      stdio: 'pipe'
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (exitCode) => {
      if (exitCode === 0) {
        resolve(stdout.trim().split('\n').filter(f => f.length > 0));
      } else {
        reject(new Error(`Git diff --name-only failed: ${stderr}`));
      }
    });
    
    child.on('error', reject);
  });
}

function parseDiffOutput(diff: string): PRPatchFile[] {
  const files: PRPatchFile[] = [];
  const fileBlocks = diff.split(/^diff --git /m).slice(1);
  
  for (const block of fileBlocks) {
    const lines = block.split('\n');
    const firstLine = lines[0];
    
    // Parse file path from "a/file b/file" format
    const pathMatch = firstLine.match(/a\/(.+?) b\/(.+?)$/);
    if (!pathMatch) continue;
    
    const filePath = pathMatch[2];
    let status: 'added' | 'modified' | 'deleted' = 'modified';
    let additions = 0;
    let deletions = 0;
    
    // Check for new/deleted files
    if (block.includes('new file mode')) {
      status = 'added';
    } else if (block.includes('deleted file mode')) {
      status = 'deleted';
    }
    
    // Count additions and deletions
    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        additions++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        deletions++;
      }
    }
    
    files.push({
      path: filePath,
      status,
      additions,
      deletions,
      diff: block
    });
  }
  
  return files;
}

function generateArtifactPath(title: string): string {
  const repoRoot = getRepoRoot();
  const artifactsDir = path.join(repoRoot, 'artifacts');
  
  // Ensure artifacts directory exists
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }
  
  // Create safe filename from title
  const safeTitle = title.replace(/[^a-zA-Z0-9-_]/g, '-').substring(0, 50);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  return path.join(artifactsDir, `PR-${safeTitle}-${timestamp}.json`);
}

export async function icnGeneratePRPatch(request: GeneratePRPatchRequest): Promise<GeneratePRPatchResponse> {
  // Validate input
  try {
    GeneratePRPatchRequestSchema.parse(request);
  } catch (error: any) {
    if (error?.errors) {
      throw new Error(`Invalid input: ${error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
    }
    throw error;
  }

  const repoRoot = getRepoRoot();
  const baseBranch = request.baseBranch || 'main';
  const targetBranch = request.targetBranch || 'HEAD';
  
  try {
    // Get changed files from request or git
    let changedFiles: string[] = [];
    let diff = '';
    let files: PRPatchFile[] = [];
    
    if (request.changedFiles && request.changedFiles.length > 0) {
      // Use provided files list
      changedFiles = request.changedFiles;
      
      // Create mock diff entries for provided files
      files = changedFiles.map(filePath => ({
        path: filePath,
        status: 'modified' as const,
        additions: 1,
        deletions: 0,
        diff: `diff --git a/${filePath} b/${filePath}\n--- a/${filePath}\n+++ b/${filePath}\n@@ -1 +1 @@\n-old content\n+new content`
      }));
    } else {
      // Try to get from git
      try {
        changedFiles = await getChangedFiles(baseBranch, targetBranch);
        diff = await getGitDiff(baseBranch, targetBranch);
        files = parseDiffOutput(diff);
      } catch {
        // If git fails, use empty changelist
        changedFiles = [];
        files = [];
      }
    }
    
    // Check policy before proceeding
    const policyRequest: PolicyCheckRequest = {
      changeset: changedFiles,
      actor: request.actor || 'unknown'
    };
    
    const policyResult = await icnCheckPolicy(policyRequest);
    
    // Calculate totals
    const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
    const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);
    
    // Create PR descriptor
    const prDescriptor: PRPatchDescriptor = {
      title: request.title,
      description: request.description,
      files,
      baseBranch,
      targetBranch,
      totalAdditions,
      totalDeletions,
      policyCheck: {
        allowed: policyResult.allow,
        reasons: policyResult.reasons,
        suggestions: policyResult.suggestions
      }
    };
    
    // Save artifact
    const artifactPath = generateArtifactPath(request.title);
    try {
      fs.writeFileSync(artifactPath, JSON.stringify(prDescriptor, null, 2), 'utf8');
    } catch (err) {
      throw new Error(`Failed to create artifact at ${artifactPath}: ${err instanceof Error ? err.message : String(err)}`);
    }
    
    prDescriptor.artifact = {
      path: path.relative(repoRoot, artifactPath),
      created: new Date().toISOString()
    };
    
    const response: GeneratePRPatchResponse = {
      success: true,
      prDescriptor
    };
    
    // Create GitHub PR if requested (placeholder - would need GitHub API integration)
    if (request.createGitHubPR) {
      response.githubPR = {
        created: false,
        error: 'GitHub PR creation not implemented - local artifact created instead'
      };
    }
    
    return response;
  } catch (error) {
    throw new Error(`Failed to generate PR patch: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}