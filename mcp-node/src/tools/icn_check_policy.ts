import fs from 'node:fs';
import { POLICY_RULES_PATH, CODEOWNERS_PATH } from '../config.js';

export interface PolicyCheckRequest {
  changeset: string[];
  actor?: string;
}

export interface PolicyResponse {
  allow: boolean;
  reasons: string[];
  suggestions: string[];
}

interface PolicyRules {
  no_direct_merges?: boolean;
  path_caps?: Record<string, string[]>;
  reviews_required?: Array<{ paths: string[]; reviewers: string[] }>;
  codeowners_integration?: boolean;
}

interface PolicyDecision {
  allow: boolean;
  reasons: string[];
}

function readPolicyRules(): PolicyRules {
  try {
    const data = fs.readFileSync(POLICY_RULES_PATH, 'utf8');
    return JSON.parse(data) as PolicyRules;
  } catch (err) {
    console.error('Failed to read policy.rules.json:', err);
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

function checkPolicyInternal(input: { actor: string; changedPaths: string[] }): PolicyDecision {
  const rules = readPolicyRules();
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
    const codeowners = parseCodeowners();
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

export async function icnCheckPolicy(request: PolicyCheckRequest): Promise<PolicyResponse> {
  const actor = request.actor || 'unknown';
  
  // Use the policy checker logic
  const decision: PolicyDecision = checkPolicyInternal({
    actor,
    changedPaths: request.changeset
  });
  
  // Generate suggestions based on the policy violations
  const suggestions: string[] = [];
  
  if (!decision.allow) {
    for (const reason of decision.reasons) {
      if (reason.includes('path') && reason.includes('not allowed')) {
        suggestions.push('Consider requesting permission or modifying files within your authorized paths');
      } else if (reason.includes('CODEOWNERS')) {
        suggestions.push('Request review from the appropriate code owners before proceeding');
      } else if (reason.includes('review required')) {
        suggestions.push('Ensure required reviewers have approved the changes');
      }
    }
    
    if (suggestions.length === 0) {
      suggestions.push('Review the policy violations and adjust the changeset accordingly');
    }
  }
  
  return {
    allow: decision.allow,
    reasons: decision.reasons,
    suggestions
  };
}