import { checkPolicy } from './policy.js';

export type PrEvent = {
  action: string;
  pull_request?: { number: number; title: string; head: { ref: string }; base: { ref: string } };
  repository?: { full_name: string };
};

export function analyzePr(event: PrEvent): { advice: string[] } {
  const advice: string[] = [];
  if (!event.pull_request) return { advice };
  const title = event.pull_request.title || '';
  if (!/^feat\(|fix\(|chore\(|docs\(|test\(/.test(title)) {
    advice.push('Consider using conventional commit style in PR title.');
  }
  const decision = checkPolicy({ actor: 'reviewer', changedPaths: ['docs/**'] });
  if (!decision.allow) advice.push(...decision.reasons);
  return { advice };
}


