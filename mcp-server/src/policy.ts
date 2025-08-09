export type PolicyDecision = {
  allowed: boolean;
  reason?: string;
};

export function evaluatePolicy(_action: string, _context: Record<string, unknown>): PolicyDecision {
  // TODO: implement policy evaluation
  return { allowed: true };
}

