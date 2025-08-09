import fs from 'node:fs';
import path from 'node:path';
import { insertArtifact } from './db.js';

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

