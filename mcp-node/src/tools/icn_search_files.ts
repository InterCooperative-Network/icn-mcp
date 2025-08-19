import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';

export interface FileSearchRequest {
  pattern: string;
  directory?: string;
  includeHidden?: boolean;
  maxResults?: number;
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

export async function icnSearchFiles(request: FileSearchRequest): Promise<FileSearchResponse> {
  const repoRoot = getRepoRoot();
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
      } catch (err) {
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