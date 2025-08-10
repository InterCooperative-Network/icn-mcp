import path from "node:path";
import fs from "node:fs";

function repoRootFrom(cwd = process.cwd()): string {
  // Walk up to find the repo root (package.json at monorepo root)
  let cur = cwd;
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(cur, "package.json")) && fs.existsSync(path.join(cur, "docs"))) {
      return cur;
    }
    const up = path.dirname(cur);
    if (up === cur) break;
    cur = up;
  }
  // Fallback to cwd
  return cwd;
}

const REPO_ROOT = process.env.REPO_ROOT ? path.resolve(process.env.REPO_ROOT) : repoRootFrom();

export const DB_DIR = process.env.MCP_DB_DIR ?? path.join(REPO_ROOT, "var");
export const DB_PATH = path.join(DB_DIR, "icn-mcp.sqlite");

export const MIGRATIONS_DIR =
  process.env.MCP_MIGRATIONS_DIR ?? path.join(REPO_ROOT, "db", "migrations");