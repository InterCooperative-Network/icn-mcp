// Note: natural is available but we'll use string analysis instead for better compatibility
// import { natural } from 'natural';

export interface InvariantCheck {
  id: string;
  description: string;
  passed: boolean;
  evidence: string[];
  violations: string[];
  suggestions: string[];
}

export interface InvariantCheckResult {
  overallPass: boolean;
  checks: InvariantCheck[];
  summary: string;
  confidence: number;
}

export interface CheckInvariantsRequest {
  code?: string;
  design?: string;
  description?: string;
}

// Core ICN invariants to check
const ICN_INVARIANTS = {
  'INV-EVENTSOURCE-001': {
    description: 'Event-sourced: no state outside log',
    keywords: {
      positive: ['event', 'log', 'append', 'store', 'persist', 'record', 'emit'],
      negative: ['state', 'variable', 'field', 'property', 'cache', 'store'],
      patterns: [
        /event.*(?:store|log|append|emit)/i,
        /(?:persist|record|save).*event/i,
        /no.*(?:state|cache).*outside/i
      ]
    }
  },
  'INV-DETERMINISTIC-001': {
    description: 'Deterministic execution: inputs → outputs reproducible',
    keywords: {
      positive: ['deterministic', 'reproducible', 'consistent', 'pure', 'idempotent'],
      negative: ['random', 'Math.random', 'Date.now', 'timestamp', 'uuid', 'nonce'],
      patterns: [
        /pure.*function/i,
        /deterministic.*(?:execution|behavior)/i,
        /(?:same|identical).*(?:input|output)/i,
        /Math\.random/,
        /Date\.now/,
        /new Date\(\)/
      ]
    }
  },
  'INV-DEMOCRATIC-001': {
    description: 'Democratic governance: one member, one vote',
    keywords: {
      positive: ['vote', 'member', 'democratic', 'equal', 'one', 'fair'],
      negative: ['weight', 'multiply', 'stake', 'power', 'privilege', 'bias'],
      patterns: [
        /one.*member.*one.*vote/i,
        /equal.*(?:voting|rights)/i,
        /democratic.*(?:process|governance)/i,
        /(?:weighted|stake).*vote/i,
        /vote.*(?:weight|power|stake)/i
      ]
    }
  },
  'INV-NONTRANSFERABLE-001': {
    description: 'Non-transferable CC',
    keywords: {
      positive: ['non-transferable', 'bound', 'personal', 'individual', 'locked'],
      negative: ['transfer', 'send', 'give', 'trade', 'exchange', 'sell', 'buy'],
      patterns: [
        /non.?transferable/i,
        /(?:transfer|send|give).*(?:cc|credit|contribution)/i,
        /(?:cc|credit|contribution).*(?:transfer|send|give)/i,
        /(?:trade|exchange|sell|buy).*(?:cc|credit)/i
      ]
    }
  },
  'INV-NOVOTING-001': {
    description: 'No token-bought voting rights',
    keywords: {
      positive: ['membership', 'identity', 'person', 'individual', 'earned'],
      negative: ['buy', 'purchase', 'token', 'pay', 'stake', 'wealth', 'money'],
      patterns: [
        /(?:buy|purchase|pay).*(?:vote|voting|rights)/i,
        /(?:vote|voting|rights).*(?:buy|purchase|pay)/i,
        /token.*(?:vote|voting|rights)/i,
        /(?:wealth|money|stake).*(?:based|dependent).*vote/i
      ]
    }
  }
};

function analyzeText(text: string, invariant: any): { score: number; evidence: string[]; violations: string[] } {
  const evidence: string[] = [];
  const violations: string[] = [];
  let score = 0;
  
  const lowerText = text.toLowerCase();
  
  // Check positive keywords
  for (const keyword of invariant.keywords.positive) {
    if (lowerText.includes(keyword)) {
      score += 1;
      evidence.push(`Found positive indicator: "${keyword}"`);
    }
  }
  
  // Check negative keywords (violations)
  for (const keyword of invariant.keywords.negative) {
    if (lowerText.includes(keyword)) {
      score -= 2;
      violations.push(`Found negative indicator: "${keyword}"`);
    }
  }
  
  // Check patterns
  for (const pattern of invariant.keywords.patterns) {
    const matches = text.match(pattern);
    if (matches) {
      if (pattern.source.includes('random|Date|uuid')) {
        score -= 3;
        violations.push(`Pattern violation: ${matches[0]}`);
      } else if (pattern.source.includes('transfer|buy|purchase|stake.*vote')) {
        score -= 3;
        violations.push(`Pattern violation: ${matches[0]}`);
      } else {
        score += 2;
        evidence.push(`Pattern match: ${matches[0]}`);
      }
    }
  }
  
  return { score, evidence, violations };
}

function analyzeCode(code: string, invariant: any): { score: number; evidence: string[]; violations: string[] } {
  const evidence: string[] = [];
  const violations: string[] = [];
  let score = 0;
  
  // Basic AST-like analysis by looking for specific code patterns
  const lines = code.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Check for event sourcing patterns
    if (invariant.description.includes('Event-sourced')) {
      if (/\.emit\(|\.append\(|\.store\(|eventLog/.test(trimmed)) {
        score += 2;
        evidence.push(`Event sourcing pattern: ${trimmed}`);
      }
      if (/let\s+\w+\s*=|var\s+\w+\s*=|\w+\s*=\s*\{/.test(trimmed) && !trimmed.includes('const')) {
        score -= 1;
        violations.push(`Mutable state detected: ${trimmed}`);
      }
    }
    
    // Check for deterministic patterns
    if (invariant.description.includes('Deterministic')) {
      if (/Math\.random|Date\.now|new Date\(\)|crypto\.randomBytes/.test(trimmed)) {
        score -= 3;
        violations.push(`Non-deterministic operation: ${trimmed}`);
      }
      if (/pure|deterministic|idempotent/.test(trimmed.toLowerCase())) {
        score += 2;
        evidence.push(`Deterministic indicator: ${trimmed}`);
      }
    }
    
    // Check for democratic governance
    if (invariant.description.includes('Democratic')) {
      if (/vote.*weight|weight.*vote|stake.*vote/.test(trimmed.toLowerCase())) {
        score -= 3;
        violations.push(`Weighted voting detected: ${trimmed}`);
      }
      if (/memberVotes\.length|votes\.count|equal.*vote/.test(trimmed.toLowerCase())) {
        score += 2;
        evidence.push(`Democratic voting pattern: ${trimmed}`);
      }
    }
    
    // Check for CC transferability
    if (invariant.description.includes('Non-transferable')) {
      if (/transfer.*cc|send.*cc|cc\.transfer|give.*credit/.test(trimmed.toLowerCase())) {
        score -= 3;
        violations.push(`CC transfer detected: ${trimmed}`);
      }
      if (/non.?transferable|readonly.*cc|final.*credit/.test(trimmed.toLowerCase())) {
        score += 2;
        evidence.push(`Non-transferable pattern: ${trimmed}`);
      }
    }
    
    // Check for token-bought voting
    if (invariant.description.includes('No token-bought')) {
      if (/buy.*vote|purchase.*vote|pay.*vote|token.*vote/.test(trimmed.toLowerCase())) {
        score -= 3;
        violations.push(`Token-bought voting detected: ${trimmed}`);
      }
      if (/membership.*vote|identity.*vote|person.*vote/.test(trimmed.toLowerCase())) {
        score += 2;
        evidence.push(`Identity-based voting: ${trimmed}`);
      }
    }
  }
  
  return { score, evidence, violations };
}

function generateSuggestions(invariantId: string, violations: string[]): string[] {
  const suggestions: string[] = [];
  
  switch (invariantId) {
    case 'INV-EVENTSOURCE-001':
      if (violations.some(v => v.includes('state'))) {
        suggestions.push('Replace mutable state with event sourcing patterns');
        suggestions.push('Store all state changes as events in the event log');
        suggestions.push('Rebuild state from events rather than storing it directly');
      }
      break;
      
    case 'INV-DETERMINISTIC-001':
      if (violations.some(v => v.includes('random') || v.includes('Date'))) {
        suggestions.push('Replace non-deterministic operations with deterministic alternatives');
        suggestions.push('Use input-derived values instead of random generation');
        suggestions.push('Pass timestamps as parameters rather than generating them');
      }
      break;
      
    case 'INV-DEMOCRATIC-001':
      if (violations.some(v => v.includes('weight') || v.includes('stake'))) {
        suggestions.push('Implement one-member-one-vote instead of weighted voting');
        suggestions.push('Remove vote weighting based on stakes or tokens');
        suggestions.push('Ensure equal voting power for all members');
      }
      break;
      
    case 'INV-NONTRANSFERABLE-001':
      if (violations.some(v => v.includes('transfer'))) {
        suggestions.push('Remove CC transfer functionality');
        suggestions.push('Make CC balances non-transferable and member-bound');
        suggestions.push('Implement CC as contribution records rather than transferable assets');
      }
      break;
      
    case 'INV-NOVOTING-001':
      if (violations.some(v => v.includes('buy') || v.includes('token'))) {
        suggestions.push('Base voting rights on membership, not token ownership');
        suggestions.push('Remove ability to purchase voting power');
        suggestions.push('Implement identity-based voting rights');
      }
      break;
  }
  
  if (suggestions.length === 0) {
    suggestions.push('Review implementation against ICN principles');
    suggestions.push('Ensure compliance with cooperative governance model');
  }
  
  return suggestions;
}

export async function icnCheckInvariants(request: CheckInvariantsRequest): Promise<InvariantCheckResult> {
  const { code, design, description } = request;
  
  if (!code && !design && !description) {
    throw new Error('At least one of code, design, or description must be provided');
  }
  
  const analysisText = [code, design, description].filter(Boolean).join('\n\n');
  const checks: InvariantCheck[] = [];
  let totalScore = 0;
  let maxScore = 0;
  
  for (const [invariantId, invariant] of Object.entries(ICN_INVARIANTS)) {
    let result: { score: number; evidence: string[]; violations: string[] } = { 
      score: 0, 
      evidence: [], 
      violations: [] 
    };
    
    // Analyze text content
    const textResult = analyzeText(analysisText, invariant);
    result.score += textResult.score;
    result.evidence.push(...textResult.evidence);
    result.violations.push(...textResult.violations);
    
    // Additional code analysis if code is provided
    if (code) {
      const codeResult = analyzeCode(code, invariant);
      result.score += codeResult.score;
      result.evidence.push(...codeResult.evidence);
      result.violations.push(...codeResult.violations);
    }
    
    const passed = result.score >= 0 && result.violations.length === 0;
    const suggestions = passed ? [] : generateSuggestions(invariantId, result.violations);
    
    checks.push({
      id: invariantId,
      description: invariant.description,
      passed,
      evidence: result.evidence,
      violations: result.violations,
      suggestions
    });
    
    totalScore += Math.max(0, result.score);
    maxScore += 5; // Max possible score per invariant
  }
  
  const overallPass = checks.every(check => check.passed);
  const confidence = maxScore > 0 ? (totalScore / maxScore) : 0;
  
  const passedCount = checks.filter(c => c.passed).length;
  const failedCount = checks.length - passedCount;
  
  const summary = overallPass 
    ? `All ${checks.length} invariants passed. Implementation appears compliant with ICN principles.`
    : `${failedCount} of ${checks.length} invariants failed. Review violations and apply suggested fixes.`;
  
  return {
    overallPass,
    checks,
    summary,
    confidence: Math.round(confidence * 100) / 100
  };
}