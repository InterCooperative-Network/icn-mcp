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

export const DOCS_ROOT = process.env.DOCS_ROOT ?? path.join(REPO_ROOT, "docs");
export const POLICY_RULES_PATH =
  process.env.POLICY_RULES_PATH ?? path.join(REPO_ROOT, "mcp-server", "policy.rules.json");
export const CODEOWNERS_PATH = process.env.CODEOWNERS_PATH ?? path.join(REPO_ROOT, "CODEOWNERS");