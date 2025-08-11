import { icnSynthesizeSpec } from './icn_synthesize_spec.js';
import { icnCheckInvariants } from './icn_check_invariants.js';

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  category: 'schema' | 'api' | 'state' | 'invariant' | 'pattern';
  message: string;
  location?: string;
  suggestion: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  score: number;
  suggestions: string[];
  patterns: {
    good: string[];
    bad: string[];
  };
  summary: string;
}

export interface ValidateImplementationRequest {
  code: string;
  surface?: string;
  description?: string;
}

// Known good patterns from successful ICN implementations
const GOOD_PATTERNS = [
  {
    pattern: /export\s+(?:interface|type)\s+\w+Event/,
    category: 'schema',
    message: 'Event schema definition found',
    points: 2
  },
  {
    pattern: /\.emit\(.*Event\)/,
    category: 'state', 
    message: 'Event emission pattern',
    points: 3
  },
  {
    pattern: /async\s+function\s+\w+.*\(.*\)\s*:\s*Promise/,
    category: 'api',
    message: 'Async API function with Promise return type',
    points: 1
  },
  {
    pattern: /validate.*Schema|schema.*validate/,
    category: 'schema',
    message: 'Schema validation implementation',
    points: 2
  },
  {
    pattern: /readonly\s+\w+:|public\s+readonly/,
    category: 'state',
    message: 'Immutable field pattern',
    points: 1
  },
  {
    pattern: /memberId\s*:\s*string/,
    category: 'schema',
    message: 'Proper member identification',
    points: 1
  }
];

const BAD_PATTERNS = [
  {
    pattern: /var\s+\w+\s*=|let\s+\w+\s*=/,
    category: 'state',
    message: 'Mutable variables detected',
    points: -2,
    suggestion: 'Use const declarations or immutable data structures'
  },
  {
    pattern: /Math\.random|Date\.now|new Date\(\)/,
    category: 'invariant',
    message: 'Non-deterministic operations',
    points: -3,
    suggestion: 'Pass time/random values as parameters for deterministic execution'
  },
  {
    pattern: /transfer.*cc|send.*credit|\.transfer\(/,
    category: 'invariant',
    message: 'CC transfer functionality detected',
    points: -5,
    suggestion: 'Remove CC transfer - Contribution Credits must be non-transferable'
  },
  {
    pattern: /vote.*weight|weight.*vote|stake.*vote/,
    category: 'invariant',
    message: 'Weighted voting detected',
    points: -4,
    suggestion: 'Implement one-member-one-vote democratic governance'
  },
  {
    pattern: /throw\s+new\s+Error\([^)]*\)\s*;?\s*$/m,
    category: 'api',
    message: 'Bare error throwing without context',
    points: -1,
    suggestion: 'Provide structured error responses with context'
  }
];

function analyzeAPIContract(code: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const lines = code.split('\n');
  
  // Check for proper async/await usage
  let hasAsyncFunctions = false;
  let hasAwaitUsage = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (/async\s+function|async\s+\w+\s*\(/.test(line)) {
      hasAsyncFunctions = true;
    }
    
    if (/await\s+/.test(line)) {
      hasAwaitUsage = true;
    }
    
    // Check for proper error handling
    if (line.includes('catch') && !line.includes('try')) {
      issues.push({
        severity: 'warning',
        category: 'api',
        message: 'Catch block without corresponding try',
        location: `Line ${i + 1}`,
        suggestion: 'Ensure proper try-catch structure for error handling'
      });
    }
    
    // Check for proper return types on async functions
    if (/async\s+function\s+\w+.*\)(?:\s*:\s*\w+)?\s*\{/.test(line) && !line.includes('Promise')) {
      issues.push({
        severity: 'warning',
        category: 'api',
        message: 'Async function missing Promise return type annotation',
        location: `Line ${i + 1}`,
        suggestion: 'Add Promise<T> return type annotation for async functions'
      });
    }
  }
  
  if (hasAsyncFunctions && !hasAwaitUsage) {
    issues.push({
      severity: 'warning',
      category: 'api',
      message: 'Async functions without await usage',
      suggestion: 'Verify if async is needed or add proper await usage'
    });
  }
  
  return issues;
}

function analyzeSchemaCompliance(code: string, surface?: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  
  // Check for required fields based on surface
  if (surface) {
    const requiredPatterns = {
      'Identity': ['memberId', 'publicKey', 'created', 'status'],
      'Jobs': ['jobId', 'title', 'description', 'contributionCredits', 'status'],
      'Event Log': ['eventId', 'eventType', 'aggregateId', 'payload', 'hash'],
      'Governance': ['proposalId', 'title', 'description', 'votingDeadline', 'status'],
      'Issuance': ['issuanceId', 'amount', 'reason', 'recipients', 'status']
    };
    
    const required = requiredPatterns[surface as keyof typeof requiredPatterns];
    if (required) {
      for (const field of required) {
        if (!code.includes(field)) {
          issues.push({
            severity: 'error',
            category: 'schema',
            message: `Missing required field: ${field}`,
            suggestion: `Add ${field} field to match ${surface} surface specification`
          });
        }
      }
    }
  }
  
  // Check for proper TypeScript interfaces
  if (!code.includes('interface') && !code.includes('type')) {
    issues.push({
      severity: 'warning',
      category: 'schema',
      message: 'No TypeScript interfaces or types defined',
      suggestion: 'Define proper interfaces for data structures and API contracts'
    });
  }
  
  return issues;
}

function analyzeStateTransitions(code: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  
  // Check for state mutation patterns
  const mutationPatterns = [
    /\w+\.\w+\s*=\s*[^=]/,  // Property assignment
    /\w+\[\w+\]\s*=\s*/,    // Array/object index assignment
    /\.push\(|\.pop\(|\.shift\(|\.unshift\(/  // Array mutation methods
  ];
  
  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    for (const pattern of mutationPatterns) {
      if (pattern.test(line) && !line.includes('const') && !line.includes('let')) {
        issues.push({
          severity: 'warning',
          category: 'state',
          message: 'Direct state mutation detected',
          location: `Line ${i + 1}`,
          suggestion: 'Use immutable state updates or event sourcing patterns'
        });
      }
    }
  }
  
  // Check for event sourcing patterns
  const hasEventEmission = /\.emit\(|\.append\(|eventLog\./.test(code);
  const hasStateChanges = /\w+\s*=\s*\{|\w+\.\w+\s*=/.test(code);
  
  if (hasStateChanges && !hasEventEmission) {
    issues.push({
      severity: 'error',
      category: 'state',
      message: 'State changes without event emission',
      suggestion: 'Implement event sourcing - emit events for all state changes'
    });
  }
  
  return issues;
}

export async function icnValidateImplementation(request: ValidateImplementationRequest): Promise<ValidationResult> {
  const { code, surface, description } = request;
  const issues: ValidationIssue[] = [];
  const goodPatterns: string[] = [];
  const badPatterns: string[] = [];
  let score = 0;
  
  // Run invariant checks
  try {
    const invariantResult = await icnCheckInvariants({ code, description });
    
    for (const check of invariantResult.checks) {
      if (!check.passed) {
        issues.push({
          severity: 'error',
          category: 'invariant',
          message: `Invariant violation: ${check.description}`,
          suggestion: check.suggestions.join('; ')
        });
        score -= 5;
      } else {
        score += 2;
      }
    }
  } catch {
    issues.push({
      severity: 'warning',
      category: 'invariant',
      message: 'Could not run invariant checks',
      suggestion: 'Manually verify compliance with ICN invariants'
    });
  }
  
  // Check against synthesized spec if surface is provided
  if (surface) {
    try {
      const spec = await icnSynthesizeSpec({ surface });
      
      // Basic schema compliance check
      const schemaIssues = analyzeSchemaCompliance(code, surface);
      issues.push(...schemaIssues);
      
      score += (spec.requirements.length - schemaIssues.filter(i => i.severity === 'error').length) * 1;
      
    } catch {
      issues.push({
        severity: 'info',
        category: 'schema',
        message: `Could not synthesize spec for surface: ${surface}`,
        suggestion: 'Verify surface name or implement custom validation'
      });
    }
  }
  
  // Analyze API contract
  const apiIssues = analyzeAPIContract(code);
  issues.push(...apiIssues);
  
  // Analyze state transitions
  const stateIssues = analyzeStateTransitions(code);
  issues.push(...stateIssues);
  
  // Check good patterns
  for (const { pattern, message, points } of GOOD_PATTERNS) {
    const matches = code.match(pattern);
    if (matches) {
      goodPatterns.push(message);
      score += points;
    }
  }
  
  // Check bad patterns
  for (const { pattern, message, points, suggestion } of BAD_PATTERNS) {
    const matches = code.match(pattern);
    if (matches) {
      badPatterns.push(message);
      score += points;
      
      issues.push({
        severity: points <= -3 ? 'error' : 'warning',
        category: 'pattern',
        message,
        suggestion
      });
    }
  }
  
  // Generate overall suggestions
  const suggestions: string[] = [];
  
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  
  if (errorCount > 0) {
    suggestions.push(`Fix ${errorCount} critical errors before deployment`);
  }
  
  if (warningCount > 0) {
    suggestions.push(`Address ${warningCount} warnings to improve code quality`);
  }
  
  if (badPatterns.length > 0) {
    suggestions.push('Refactor code to follow ICN best practices');
  }
  
  if (goodPatterns.length > 0) {
    suggestions.push('Continue following identified good patterns');
  }
  
  if (score < 0) {
    suggestions.push('Implementation needs significant improvements for ICN compliance');
  } else if (score < 5) {
    suggestions.push('Implementation is basic but functional - consider enhancements');
  } else {
    suggestions.push('Implementation shows good adherence to ICN principles');
  }
  
  const valid = errorCount === 0 && score >= 0;
  
  const summary = valid
    ? `Implementation passed validation with score ${score}. ${goodPatterns.length} good patterns found.`
    : `Implementation failed validation. ${errorCount} errors, ${warningCount} warnings found.`;
  
  return {
    valid,
    issues,
    score: Math.max(0, score),
    suggestions,
    patterns: {
      good: goodPatterns,
      bad: badPatterns
    },
    summary
  };
}