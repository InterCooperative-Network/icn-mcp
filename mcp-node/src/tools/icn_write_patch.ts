import fs from 'node:fs';
import path from 'node:path';
import { icnCheckPolicy, PolicyCheckRequest } from './icn_check_policy.js';

export interface WritePatchRequest {
  filePath: string;
  content: string;
  createIfNotExists?: boolean;
  actor?: string;
  description?: string;
}

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
  const repoRoot = getRepoRoot();
  const filePath = path.isAbsolute(request.filePath) 
    ? request.filePath 
    : path.resolve(repoRoot, request.filePath);
  
  // Ensure file path is within repo root for security
  if (!filePath.startsWith(repoRoot)) {
    throw new Error('File path must be within repository boundaries');
  }
  
  const relativePath = path.relative(repoRoot, filePath);
  const fileExists = fs.existsSync(filePath);
  
  // Check if file exists when createIfNotExists is false
  if (!fileExists && !request.createIfNotExists) {
    throw new Error(`File does not exist and createIfNotExists is false: ${request.filePath}`);
  }
  
  // Check policy before making any changes
  const policyRequest: PolicyCheckRequest = {
    changeset: [relativePath],
    actor: request.actor || 'unknown'
  };
  
  const policyResult = await icnCheckPolicy(policyRequest);
  
  if (!policyResult.allow) {
    return {
      success: false,
      filePath,
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
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Write the file
    fs.writeFileSync(filePath, request.content, 'utf8');
    
    const linesWritten = request.content ? request.content.split('\n').length : 0;
    
    return {
      success: true,
      filePath,
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