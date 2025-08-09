import fs from 'node:fs';
import path from 'node:path';
import { insertArtifact } from './db.js';
import { Octokit } from '@octokit/rest';

export type LocalPrFile = { path: string; content: string };

export async function createLocalPr(input: {
  task_id: string;
  title: string;
  body: string;
  files: LocalPrFile[];
}): Promise<{ ok: true; artifact: string }> {
  const branchesDir = path.resolve(process.cwd(), 'branches', input.task_id);
  const artifactsDir = path.resolve(process.cwd(), 'artifacts');
  fs.mkdirSync(branchesDir, { recursive: true });
  fs.mkdirSync(artifactsDir, { recursive: true });

  for (const file of input.files) {
    const abs = path.join(branchesDir, file.path);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, file.content, 'utf8');
  }

  const desc = {
    task_id: input.task_id,
    title: input.title,
    body: input.body,
    files: input.files.map((f) => f.path)
  };
  const artifactPath = path.join(artifactsDir, `PR-${input.task_id}.json`);
  fs.writeFileSync(artifactPath, JSON.stringify(desc, null, 2), 'utf8');
  insertArtifact({ task_id: input.task_id, kind: 'pr-descriptor', path: artifactPath, meta: { title: input.title, body: input.body } });
  return { ok: true, artifact: artifactPath };
}

export async function createPr(input: {
  task_id: string;
  title: string;
  body: string;
  files: LocalPrFile[];
}): Promise<{ mode: 'github'; url: string } | { mode: 'local'; artifact: string }> {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER || 'InterCooperative-Network';
  const repo = process.env.GITHUB_REPO || 'icn-mcp';
  const base = process.env.GITHUB_BASE || process.env.GITHUB_DEFAULT_BRANCH || 'main';

  if (token && owner && repo) {
    const octokit = new Octokit({ auth: token });
    const kebab = input.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
    const branch = `tasks/${input.task_id}-${kebab}`;

    // get default branch sha
    const { data: baseRef } = await octokit.git.getRef({ owner, repo, ref: `heads/${base}` });
    const baseSha = baseRef.object.sha;
    try {
      await octokit.git.createRef({ owner, repo, ref: `refs/heads/${branch}`, sha: baseSha });
    } catch {
      // Branch may already exist; safe to ignore and continue committing on it.
    }

    // commit files
    for (const file of input.files) {
      const content = Buffer.from(file.content, 'utf8').toString('base64');
      // Try to get existing file sha on branch
      let sha: string | undefined;
      try {
        const existing = await octokit.repos.getContent({ owner, repo, path: file.path, ref: branch });
        if (!Array.isArray(existing.data) && 'sha' in existing.data) sha = (existing.data as any).sha;
      } catch {
        // File may not exist on the branch yet; that's expected when creating it.
      }
      await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: file.path,
        message: `feat: update ${file.path} for ${input.task_id}`,
        content,
        sha,
        branch
      });
    }

    const { data: pr } = await octokit.pulls.create({
      owner,
      repo,
      title: input.title,
      head: branch,
      base,
      body: input.body
    });
    return { mode: 'github', url: pr.html_url };
  }

  const local = await createLocalPr(input);
  return { mode: 'local', artifact: local.artifact };
}

