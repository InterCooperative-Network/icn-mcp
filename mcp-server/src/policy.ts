import fs from 'node:fs';
import path from 'node:path';

export type PolicyRules = {
  no_direct_merges?: boolean;
  path_caps?: Record<string, string[]>;
  reviews_required?: Array<{ paths: string[]; reviewers: string[] }>;
};

export type PolicyDecision = {
  allow: boolean;
  reasons: string[];
};

const RULES_PATH = path.resolve(process.cwd(), 'policy.rules.json');
let cachedRules: PolicyRules | null = null;

function readRules(): PolicyRules {
  try {
    const data = fs.readFileSync(RULES_PATH, 'utf8');
    return JSON.parse(data) as PolicyRules;
  } catch {
    return { no_direct_merges: true, path_caps: {}, reviews_required: [] };
  }
}

export function initPolicyWatcher(onReload?: () => void) {
  cachedRules = readRules();
  try {
    fs.watch(RULES_PATH, { persistent: false }, () => {
      cachedRules = readRules();
      onReload?.();
    });
  } catch {
    // ignore watcher errors on some FS
  }
}

function matchGlob(glob: string, filePath: string): boolean {
  // extremely small glob support: '**' and '*'
  const esc = (s: string) => s.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const regexStr = '^' + esc(glob).replace(/\\\*\\\*/g, '.*').replace(/\\\*/g, '[^/]*') + '$';
  return new RegExp(regexStr).test(filePath);
}

export function checkPolicy(input: { actor: string; changedPaths: string[] }): PolicyDecision {
  const rules = cachedRules ?? readRules();
  const reasons: string[] = [];

  // path capabilities enforcement
  const caps = rules.path_caps?.[input.actor] ?? [];
  if (caps.length > 0) {
    for (const p of input.changedPaths) {
      const allowed = caps.some((g) => matchGlob(g, p));
      if (!allowed) reasons.push(`path ${p} not allowed for actor ${input.actor}`);
    }
  }

  return { allow: reasons.length === 0, reasons };
}

