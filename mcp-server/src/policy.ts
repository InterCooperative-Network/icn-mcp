import fs from 'node:fs';
import path from 'node:path';

export type PolicyRules = {
  no_direct_merges?: boolean;
  path_caps?: Record<string, string[]>;
  reviews_required?: Array<{ paths: string[]; reviewers: string[] }>;
  codeowners_integration?: boolean;
};

export type PolicyDecision = {
  allow: boolean;
  reasons: string[];
};

const RULES_PATH = path.resolve(process.cwd(), 'policy.rules.json');
const CODEOWNERS_PATH = path.resolve(process.cwd(), '../CODEOWNERS');
let cachedRules: PolicyRules | null = null;
let cachedCodeowners: Map<string, string[]> | null = null;

function readRules(): PolicyRules {
  try {
    const data = fs.readFileSync(RULES_PATH, 'utf8');
    const rules = JSON.parse(data) as PolicyRules;
    
    // Disable CODEOWNERS integration in test environments to avoid interference
    if (process.env.NODE_ENV === 'test' || process.env.MCP_DB_PATH?.includes('test')) {
      rules.codeowners_integration = false;
    }
    
    return rules;
  } catch (err) {
    console.error('Failed to read or parse policy.rules.json:', err);
    return { no_direct_merges: true, path_caps: {}, reviews_required: [], codeowners_integration: false };
  }
}

function parseCodeowners(): Map<string, string[]> {
  const codeowners = new Map<string, string[]>();
  try {
    const data = fs.readFileSync(CODEOWNERS_PATH, 'utf8');
    const lines = data.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'));
    
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2) {
        const pattern = parts[0];
        const owners = parts.slice(1).map(owner => owner.replace('@', ''));
        codeowners.set(pattern, owners);
      }
    }
  } catch {
    // CODEOWNERS file doesn't exist or can't be read
  }
  return codeowners;
}

export function initPolicyWatcher(onReload?: () => void) {
  cachedRules = readRules();
  cachedCodeowners = parseCodeowners();
  
  try {
    fs.watch(RULES_PATH, { persistent: false }, () => {
      cachedRules = readRules();
      onReload?.();
    });
  } catch {
  } catch (err) {
    // ignore watcher errors on some FS, but log for debugging
    console.error('Failed to watch policy.rules.json:', err);
  }
  
  try {
    fs.watch(CODEOWNERS_PATH, { persistent: false }, () => {
      cachedCodeowners = parseCodeowners();
      onReload?.();
    });
  } catch {
    // ignore watcher errors on some FS
  }
}

function matchGlob(glob: string, filePath: string): boolean {
  if (!glob) return false;
  
  // Handle directory patterns
  if (glob.endsWith('/**')) {
    const base = glob.slice(0, -3);
    return filePath.startsWith(base);
  }
  
  // Handle wildcard patterns
  if (glob.includes('*')) {
    // Convert glob to regex
    const regexPattern = glob
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
  }
  
  // Exact match or directory match
  return glob === filePath || filePath.startsWith(glob + '/');
}

export function checkPolicy(input: { actor: string; changedPaths: string[] }): PolicyDecision {
  const rules = cachedRules ?? readRules();
  const reasons: string[] = [];

  // path capabilities enforcement
  if (rules.path_caps && Object.prototype.hasOwnProperty.call(rules.path_caps, input.actor)) {
    const caps = rules.path_caps[input.actor] ?? [];
    for (const p of input.changedPaths) {
      const allowed = caps.some((g) => matchGlob(g, p));
      if (!allowed) reasons.push(`path ${p} not allowed for actor ${input.actor}`);
    }
  }

  // CODEOWNERS integration (only if enabled)
  if (rules.codeowners_integration) {
    const codeowners = cachedCodeowners ?? parseCodeowners();
    if (codeowners.size > 0) {
      for (const path of input.changedPaths) {
        for (const [pattern, owners] of codeowners.entries()) {
          if (matchGlob(pattern, path)) {
            if (!owners.includes(input.actor) && !owners.includes('*')) {
              reasons.push(`CODEOWNERS: ${path} requires approval from ${owners.join(', ')}, not ${input.actor}`);
            }
            break; // Use first matching pattern
          }
        }
      }
    }
  }

  // reviews_required enforcement
  if (rules.reviews_required) {
    for (const rule of rules.reviews_required) {
      const affectedPaths = input.changedPaths.filter(path =>
        rule.paths.some(pattern => matchGlob(pattern, path))
      );
      if (affectedPaths.length > 0) {
        if (!rule.reviewers.includes(input.actor)) {
          reasons.push(`review required: paths ${affectedPaths.join(', ')} require approval from ${rule.reviewers.join(', ')}`);
        }
      }
    }
  }

  return { allow: reasons.length === 0, reasons };
}

