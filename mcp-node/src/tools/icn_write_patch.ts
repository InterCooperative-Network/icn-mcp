import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { icnCheckPolicy, PolicyCheckRequest } from './icn_check_policy.js';
import { rethrowZod } from '../lib/zod-helpers.js';

export const WritePatchRequestSchema = z.object({
  filePath: z.string().min(1, 'File path is required'),
  content: z.string(),
  createIfNotExists: z.boolean().optional(),
  actor: z.string().optional(),
  description: z.string().optional()
}).strict();

export type WritePatchRequest = z.infer<typeof WritePatchRequestSchema>;

export interface WritePatchResponse {
  success: boolean;
  filePath: string;
  relativePath: string;
  operation: 'create' | 'update';
  linesWritten: number;
  policyCheck: {
    allowed: boolean;
    reasons: string[];
    suggestions: string[];
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

export async function icnWritePatch(request: WritePatchRequest): Promise<WritePatchResponse> {
  // Validate input
  try {
    WritePatchRequestSchema.parse(request);
  } catch (error) {
    rethrowZod(error);
  }

  // Set defaults after validation
  const finalRequest = {
    ...request,
    createIfNotExists: request.createIfNotExists ?? false,
    actor: request.actor ?? 'unknown'
  };

  const repoRoot = path.resolve(getRepoRoot());
  const absTarget = path.resolve(repoRoot, finalRequest.filePath);
  
  // Enforce repo boundary with proper path resolution
  if (!absTarget.startsWith(repoRoot + path.sep)) {
    throw new Error('File path must be within repository boundaries');
  }
  
  // Block dangerous roots using relative path
  const dangerous = [".git", "node_modules", ".env", ".env.local", ".env.production"];
  const rel = path.relative(repoRoot, absTarget).split(path.sep);
  if (dangerous.includes(rel[0])) {
    throw new Error(`Writing to ${rel.join("/")} is not allowed for security reasons`);
  }
  
  const relativePath = path.relative(repoRoot, absTarget);
  const fileExists = fs.existsSync(absTarget);
  
  // Check if file exists when createIfNotExists is false
  if (!fileExists && !finalRequest.createIfNotExists) {
    throw new Error(`File does not exist and createIfNotExists is false: ${finalRequest.filePath}`);
  }
  
  // Check policy before making any changes
  const policyRequest: PolicyCheckRequest = {
    changeset: [relativePath],
    actor: finalRequest.actor || 'unknown'
  };
  
  const policyResult = await icnCheckPolicy(policyRequest);
  
  if (!policyResult.allow) {
    return {
      success: false,
      filePath: absTarget,
      relativePath,
      operation: fileExists ? 'update' : 'create',
      linesWritten: 0,
      policyCheck: {
        allowed: false,
        reasons: policyResult.reasons,
        suggestions: policyResult.suggestions
      }
    };
  }
  
  try {
    // Ensure directory exists
    const dir = path.dirname(absTarget);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Write the file
    fs.writeFileSync(absTarget, finalRequest.content, 'utf8');
    
    const linesWritten = finalRequest.content ? finalRequest.content.split('\n').length : 0;
    
    return {
      success: true,
      filePath: absTarget,
      relativePath,
      operation: fileExists ? 'update' : 'create',
      linesWritten,
      policyCheck: {
        allowed: true,
        reasons: policyResult.reasons,
        suggestions: policyResult.suggestions
      }
    };
  } catch (error) {
    throw new Error(`Failed to write file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}