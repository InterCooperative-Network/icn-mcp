import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { icnCheckPolicy, PolicyCheckRequest } from './icn_check_policy.js';

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
  } catch (error: any) {
    if (error?.errors) {
      throw new Error(`Invalid input: ${error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
    }
    throw error;
  }

  // Set defaults after validation
  const finalRequest = {
    ...request,
    createIfNotExists: request.createIfNotExists ?? false,
    actor: request.actor ?? 'unknown'
  };

  const repoRoot = getRepoRoot();
  const filePath = path.isAbsolute(finalRequest.filePath) 
    ? finalRequest.filePath 
    : path.resolve(repoRoot, finalRequest.filePath);
  
  // Ensure file path is within repo root for security
  if (!filePath.startsWith(repoRoot)) {
    throw new Error('File path must be within repository boundaries');
  }
  
  // Additional security: prevent writing to dangerous locations
  const relativePath = path.relative(repoRoot, filePath);
  const dangerousPaths = ['.git/', 'node_modules/', '.env', '.env.local', '.env.production'];
  if (dangerousPaths.some(dangerous => relativePath.startsWith(dangerous))) {
    throw new Error(`Writing to ${relativePath} is not allowed for security reasons`);
  }
  
  const fileExists = fs.existsSync(filePath);
  
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
    fs.writeFileSync(filePath, finalRequest.content, 'utf8');
    
    const linesWritten = finalRequest.content ? finalRequest.content.split('\n').length : 0;
    
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