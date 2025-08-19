import fs from 'node:fs';
import path from 'node:path';
import { BINARY_FILE_EXTENSIONS } from './constants.js';

export interface FileReadRequest {
  filePath: string;
  startLine?: number;
  endLine?: number;
  maxLines?: number;
}

export interface FileReadResponse {
  content: string;
  filePath: string;
  relativePath: string;
  totalLines: number;
  linesRead: number;
  encoding: string;
  size: number;
  modified: string;
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

function isBinaryFile(filePath: string): boolean {
  try {
    const buffer = fs.readFileSync(filePath, { flag: 'r' });
    const sample = buffer.slice(0, Math.min(512, buffer.length));
    
    // Check for null bytes (common in binary files)
    for (let i = 0; i < sample.length; i++) {
      if (sample[i] === 0) {
        return true;
      }
    }
    
    // Check for common binary file extensions
    const ext = path.extname(filePath).toLowerCase();
    return BINARY_FILE_EXTENSIONS.includes(ext);
  } catch {
    return false;
  }
}

export async function icnReadFile(request: FileReadRequest): Promise<FileReadResponse> {
  const repoRoot = getRepoRoot();
  const filePath = path.isAbsolute(request.filePath) 
    ? request.filePath 
    : path.resolve(repoRoot, request.filePath);
  
  // Ensure file path is within repo root for security
  if (!filePath.startsWith(repoRoot)) {
    throw new Error('File path must be within repository boundaries');
  }
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${request.filePath}`);
  }
  
  const stats = fs.statSync(filePath);
  
  // Check if it's a directory
  if (stats.isDirectory()) {
    throw new Error(`Path is a directory, not a file: ${request.filePath}`);
  }
  
  // Check if it's a binary file
  if (isBinaryFile(filePath)) {
    throw new Error(`Cannot read binary file: ${request.filePath}`);
  }
  
  // Check file size (limit to 1MB)
  if (stats.size > 1024 * 1024) {
    throw new Error(`File too large (${Math.round(stats.size / 1024)}KB > 1MB): ${request.filePath}`);
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const totalLines = lines.length;
    
    let selectedLines = lines;
    let linesRead = totalLines;
    
    // Apply line range if specified
    if (request.startLine !== undefined || request.endLine !== undefined) {
      const start = Math.max(0, (request.startLine || 1) - 1);
      const end = request.endLine !== undefined ? Math.min(totalLines, request.endLine) : totalLines;
      selectedLines = lines.slice(start, end);
      linesRead = selectedLines.length;
    }
    
    // Apply max lines limit
    if (request.maxLines && selectedLines.length > request.maxLines) {
      selectedLines = selectedLines.slice(0, request.maxLines);
      linesRead = request.maxLines;
    }
    
    return {
      content: selectedLines.join('\n'),
      filePath,
      relativePath: path.relative(repoRoot, filePath),
      totalLines,
      linesRead,
      encoding: 'utf8',
      size: stats.size,
      modified: stats.mtime.toISOString()
    };
  } catch (error) {
    throw new Error(`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}