export interface ExplainTestFailuresRequest {
  testOutput: string;
  testType?: 'npm' | 'vitest' | 'jest' | 'cargo' | 'mocha' | 'custom';
  testCommand?: string;
  context?: string;
}

export interface TestFailureAnalysis {
  testName: string;
  error: string;
  file?: string;
  line?: number;
  category: 'syntax' | 'logic' | 'assertion' | 'timeout' | 'dependency' | 'environment' | 'unknown';
  severity: 'high' | 'medium' | 'low';
  suggestions: string[];
  relatedCode?: string;
}

export interface ExplainTestFailuresResponse {
  totalFailures: number;
  categorySummary: Record<string, number>;
  analyses: TestFailureAnalysis[];
  overallSuggestions: string[];
  priorityOrder: number[]; // Indices into analyses array, ordered by priority
}

function categorizeFailure(error: string, _testName: string): {
  category: TestFailureAnalysis['category'];
  severity: TestFailureAnalysis['severity'];
} {
  const errorLower = error.toLowerCase();
  
  // Syntax/compilation errors
  if (errorLower.includes('syntaxerror') || 
      errorLower.includes('unexpected token') ||
      errorLower.includes('cannot find module') ||
      errorLower.includes('module not found')) {
    return { category: 'syntax', severity: 'high' };
  }
  
  // Timeout errors
  if (errorLower.includes('timeout') || 
      errorLower.includes('timed out') ||
      errorLower.includes('exceeded')) {
    return { category: 'timeout', severity: 'medium' };
  }
  
  // Assertion errors - improved patterns
  if ((errorLower.includes('expected') && (errorLower.includes('received') || errorLower.includes('to equal'))) ||
      errorLower.includes('assert') ||
      errorLower.includes('toequal') ||
      errorLower.includes('tobe') ||
      errorLower.includes('assertion')) {
    return { category: 'assertion', severity: 'medium' };
  }
  
  // Logic errors (null reference, undefined, etc.)
  if (errorLower.includes('cannot read prop') ||
      errorLower.includes('cannot read property') ||
      errorLower.includes('undefined') ||
      errorLower.includes('null') ||
      errorLower.includes('is not a function')) {
    return { category: 'logic', severity: 'high' };
  }
  
  // Dependency/environment errors
  if (errorLower.includes('enoent') ||
      errorLower.includes('permission denied') ||
      errorLower.includes('network') ||
      errorLower.includes('connection')) {
    return { category: 'environment', severity: 'high' };
  }
  
  return { category: 'unknown', severity: 'medium' };
}

function generateSuggestions(analysis: TestFailureAnalysis): string[] {
  const suggestions: string[] = [];
  
  switch (analysis.category) {
    case 'syntax':
      suggestions.push('Check for syntax errors in the test file or imported modules');
      suggestions.push('Verify all imports are correct and modules exist');
      suggestions.push('Run the linter to catch syntax issues');
      break;
      
    case 'assertion':
      suggestions.push('Review the test assertion - expected vs actual values');
      suggestions.push('Check if the implementation logic matches test expectations');
      suggestions.push('Add debugging output to understand the actual values');
      break;
      
    case 'timeout':
      suggestions.push('Increase test timeout if the operation is legitimately slow');
      suggestions.push('Check for infinite loops or blocking operations');
      suggestions.push('Mock slow dependencies or network calls');
      break;
      
    case 'logic':
      suggestions.push('Check for null/undefined values before accessing properties');
      suggestions.push('Verify object initialization and data flow');
      suggestions.push('Add null checks or default values');
      break;
      
    case 'environment':
      suggestions.push('Check file permissions and paths');
      suggestions.push('Verify required dependencies are installed');
      suggestions.push('Check network connectivity and external service availability');
      break;
      
    case 'dependency':
      suggestions.push('Run npm install or update dependencies');
      suggestions.push('Check for version conflicts in package.json');
      suggestions.push('Clear node_modules and reinstall');
      break;
      
    default:
      suggestions.push('Review the full error message and stack trace');
      suggestions.push('Check recent changes that might have introduced the issue');
      suggestions.push('Run the specific test in isolation for better debugging');
  }
  
  return suggestions;
}

function parseTestOutput(output: string, testType: string): TestFailureAnalysis[] {
  const analyses: TestFailureAnalysis[] = [];
  
  if (testType === 'vitest' || testType === 'jest' || testType === 'npm') {
    // Parse vitest/jest output  
    const lines = output.split('\n');
    let currentTest = '';
    let currentError = '';
    let inFailureBlock = false;
    
    for (const line of lines) {
      if (line.includes('❌') || line.includes('FAIL') || line.includes('✗')) {
        // Save previous test if exists
        if (currentTest && currentError) {
          const { category, severity } = categorizeFailure(currentError, currentTest);
          analyses.push({
            testName: currentTest,
            error: currentError.trim(),
            category,
            severity,
            suggestions: generateSuggestions({ testName: currentTest, error: currentError, category, severity, suggestions: [] })
          });
        }
        
        // Start new test
        currentTest = line.replace(/❌|FAIL|✗/, '').trim();
        currentError = '';
        inFailureBlock = true;
      } else if (inFailureBlock && line.trim()) {
        // Look for error patterns
        if (line.includes('Error:') || line.includes('AssertionError:') || 
            line.includes('expected') || line.includes('received')) {
          currentError += line.trim() + ' ';
        }
      } else if (line.trim() === '' && inFailureBlock) {
        // End of current failure block
        inFailureBlock = false;
      }
    }
    
    // Add the last test if exists
    if (currentTest && currentError) {
      const { category, severity } = categorizeFailure(currentError, currentTest);
      analyses.push({
        testName: currentTest,
        error: currentError.trim(),
        category,
        severity,
        suggestions: generateSuggestions({ testName: currentTest, error: currentError, category, severity, suggestions: [] })
      });
    }
  } else if (testType === 'cargo') {
    // Parse Cargo test output
    const failurePattern = /test (\S+) \.\.\. FAILED/g;
    let match;
    
    while ((match = failurePattern.exec(output)) !== null) {
      const testName = match[1];
      
      // Find the failure details
      const failureStart = output.indexOf(`---- ${testName} stdout ----`);
      const failureEnd = output.indexOf('\n\n', failureStart);
      const failureBlock = failureStart >= 0 ? 
        output.substring(failureStart, failureEnd >= 0 ? failureEnd : undefined) : '';
      
      const error = failureBlock.split('\n').slice(1).join('\n').trim() || 'Cargo test failed';
      
      const { category, severity } = categorizeFailure(error, testName);
      const analysis: TestFailureAnalysis = {
        testName,
        error,
        category,
        severity,
        suggestions: generateSuggestions({ testName, error, category, severity, suggestions: [] })
      };
      
      analyses.push(analysis);
    }
  } else {
    // Generic parsing for unknown test types
    const lines = output.split('\n');
    let currentTest = '';
    let currentError = '';
    
    for (const line of lines) {
      if (line.includes('FAIL') || line.includes('ERROR') || line.includes('✗')) {
        if (currentTest && currentError) {
          const { category, severity } = categorizeFailure(currentError, currentTest);
          analyses.push({
            testName: currentTest,
            error: currentError,
            category,
            severity,
            suggestions: generateSuggestions({ testName: currentTest, error: currentError, category, severity, suggestions: [] })
          });
        }
        currentTest = line.trim();
        currentError = '';
      } else if (currentTest && line.trim()) {
        currentError += line.trim() + ' ';
      }
    }
    
    // Add the last test if exists
    if (currentTest && currentError) {
      const { category, severity } = categorizeFailure(currentError, currentTest);
      analyses.push({
        testName: currentTest,
        error: currentError.trim(),
        category,
        severity,
        suggestions: generateSuggestions({ testName: currentTest, error: currentError, category, severity, suggestions: [] })
      });
    }
  }
  
  return analyses;
}

export async function icnExplainTestFailures(request: ExplainTestFailuresRequest): Promise<ExplainTestFailuresResponse> {
  const testType = request.testType || 'npm';
  const analyses = parseTestOutput(request.testOutput, testType);
  
  // Create category summary
  const categorySummary: Record<string, number> = {};
  for (const analysis of analyses) {
    categorySummary[analysis.category] = (categorySummary[analysis.category] || 0) + 1;
  }
  
  // Create priority order (high severity first, then by category importance)
  const priorityOrder = analyses
    .map((analysis, index) => ({ index, analysis }))
    .sort((a, b) => {
      // First by severity
      const severityOrder = { high: 3, medium: 2, low: 1 };
      const severityDiff = severityOrder[b.analysis.severity] - severityOrder[a.analysis.severity];
      if (severityDiff !== 0) return severityDiff;
      
      // Then by category importance
      const categoryOrder = { syntax: 6, environment: 5, logic: 4, assertion: 3, timeout: 2, dependency: 1, unknown: 0 };
      return categoryOrder[b.analysis.category] - categoryOrder[a.analysis.category];
    })
    .map(item => item.index);
  
  // Generate overall suggestions
  const overallSuggestions: string[] = [];
  
  if (categorySummary.syntax > 0) {
    overallSuggestions.push('Run linting and fix syntax errors first');
  }
  
  if (categorySummary.environment > 0) {
    overallSuggestions.push('Check environment setup: dependencies, permissions, and external services');
  }
  
  if (categorySummary.logic > 0) {
    overallSuggestions.push('Review code logic for null/undefined handling and data flow');
  }
  
  if (categorySummary.assertion > 0) {
    overallSuggestions.push('Verify test expectations match implementation behavior');
  }
  
  if (analyses.length > 5) {
    overallSuggestions.push('Consider running tests individually to isolate issues');
  }
  
  overallSuggestions.push('Check recent changes that might have introduced these failures');
  overallSuggestions.push('Review the complete stack trace for additional context');
  
  return {
    totalFailures: analyses.length,
    categorySummary,
    analyses,
    overallSuggestions,
    priorityOrder
  };
}