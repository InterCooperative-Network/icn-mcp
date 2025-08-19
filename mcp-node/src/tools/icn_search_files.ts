import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';
import { execSync } from 'node:child_process';

export interface FileSearchRequest {
  pattern: string;
  directory?: string;
  includeHidden?: boolean;
  maxResults?: number;
  baseDir?: string; // optional override for cwd during tests or workspaces
}

export interface FileSearchResult {
  path: string;
  relativePath: string;
  size: number;
  modified: string;
  isDirectory: boolean;
}

export interface FileSearchResponse {
  results: FileSearchResult[];
  totalFound: number;
  searchPattern: string;
  searchDirectory: string;
}

function detectRepoRoot(): string {
  // If the REPO_ROOT environment variable is set, use it as the repository root directory.
  // This is useful in CI environments, scripts, or when automatic detection may fail.
  // The value should be an absolute path to the root of the repository.
  // If not set, the function will attempt to auto-detect the repository root via git.
  const env = process.env.REPO_ROOT;
  if (env) return env;
  try {
    const out = execSync('git rev-parse --show-toplevel', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
    if (out) return out;
  } catch {
    // Git command failed, fallback to process.cwd()
  }
  return process.cwd();
}

export async function icnSearchFiles(request: FileSearchRequest): Promise<FileSearchResponse> {
  const repoRoot = request.baseDir
    ? path.resolve(request.baseDir)
    : detectRepoRoot();
  const searchDir = request.directory ? path.resolve(repoRoot, request.directory) : repoRoot;
  const maxResults = request.maxResults || 50;
  
  // Ensure search directory is within repo root for security
  if (!searchDir.startsWith(repoRoot)) {
    throw new Error('Search directory must be within repository boundaries');
  }
  
  const globOptions = {
    cwd: searchDir,
    ignore: [
      'node_modules/**',
      '.git/**',
      'dist/**',
      '*.log',
      '.next/**',
      'coverage/**',
      '.nyc_output/**'
    ]
  };
  
  if (!request.includeHidden) {
    globOptions.ignore.push('.*/**', '.*/');
  }
  
  try {
    const matches = await glob(request.pattern, globOptions);
    const results: FileSearchResult[] = [];
    
    for (const match of matches.slice(0, maxResults)) {
      const fullPath = path.join(searchDir, match);
      const relativePath = path.relative(repoRoot, fullPath);
      
      try {
        const stats = fs.statSync(fullPath);
        results.push({
          path: fullPath,
          relativePath,
          size: stats.size,
          modified: stats.mtime.toISOString(),
          isDirectory: stats.isDirectory()
        });
      } catch {
        // Skip files that can't be stat'd (permissions, etc.)
        continue;
      }
    }
    
    return {
      results,
      totalFound: matches.length,
      searchPattern: request.pattern,
      searchDirectory: path.relative(repoRoot, searchDir) || '.'
    };
  } catch (error) {
    throw new Error(`File search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}