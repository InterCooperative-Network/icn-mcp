import fs from 'node:fs';
import path from 'node:path';

export interface SuggestApproachRequest {
  task_description: string;
  files_to_modify?: string[];
  constraints?: string[];
  context?: string;
}

export interface PlaybookSuggestion {
  id: string;
  name: string;
  description: string;
  relevance_score: number;
  applicable_steps: string[];
  category: string;
  tags: string[];
}

export interface ApproachSuggestion {
  approach_name: string;
  description: string;
  steps: string[];
  considerations: string[];
  estimated_effort: 'low' | 'medium' | 'high';
  risk_level: 'low' | 'medium' | 'high';
}

export interface SuggestApproachResponse {
  recommended_playbooks: PlaybookSuggestion[];
  suggested_approaches: ApproachSuggestion[];
  key_considerations: string[];
  next_steps: string[];
}

export async function icnSuggestApproach(request: SuggestApproachRequest): Promise<SuggestApproachResponse> {
  const { task_description, files_to_modify = [], constraints = [], context = '' } = request;
  
  // Get repository root to find playbooks
  const repoRoot = findRepoRoot();
  const playbooksDir = path.join(repoRoot, 'playbooks');
  
  // Load available playbooks
  const playbooks = await loadPlaybooks(playbooksDir);
  
  // Analyze task to determine relevant playbooks and approaches
  const taskText = `${task_description} ${context}`.toLowerCase();
  const fileTypes = analyzeFileTypes(files_to_modify);
  
  // Score playbooks based on relevance
  const scoredPlaybooks = playbooks.map(playbook => {
    const relevanceScore = calculateRelevanceScore(playbook, taskText, fileTypes);
    return {
      ...playbook,
      relevance_score: relevanceScore,
      applicable_steps: playbook.steps
        .filter((step: any) => isStepApplicable(step, taskText, fileTypes))
        .map((step: any) => step.title)
    };
  }).filter(p => p.relevance_score > 0.1)
    .sort((a, b) => b.relevance_score - a.relevance_score);

  // Generate approach suggestions based on task analysis
  const approaches = generateApproachSuggestions(taskText, fileTypes, constraints);
  
  // Extract key considerations
  const considerations = extractKeyConsiderations(scoredPlaybooks, constraints, fileTypes);
  
  // Generate next steps
  const nextSteps = generateNextSteps(scoredPlaybooks, approaches);
  
  return {
    recommended_playbooks: scoredPlaybooks.slice(0, 3), // Top 3 most relevant
    suggested_approaches: approaches,
    key_considerations: considerations,
    next_steps: nextSteps
  };
}

function findRepoRoot(): string {
  // Start from current working directory and walk up
  let current = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(current, 'package.json')) && 
        fs.existsSync(path.join(current, 'docs'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return process.cwd(); // Fallback
}

async function loadPlaybooks(playbooksDir: string): Promise<any[]> {
  const playbooks: any[] = [];
  
  try {
    if (!fs.existsSync(playbooksDir)) {
      return playbooks;
    }
    
    const files = fs.readdirSync(playbooksDir).filter(f => f.endsWith('.json'));
    
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(playbooksDir, file), 'utf8');
        const playbook = JSON.parse(content);
        playbooks.push(playbook);
      } catch (err) {
        console.error(`Error loading playbook ${file}:`, err);
      }
    }
  } catch (err) {
    console.error('Error reading playbooks directory:', err);
  }
  
  return playbooks;
}

function analyzeFileTypes(files: string[]): { [key: string]: number } {
  const types: { [key: string]: number } = {};
  
  files.forEach(file => {
    const ext = path.extname(file);
    const dir = path.dirname(file);
    
    // Count file extensions
    types[ext] = (types[ext] || 0) + 1;
    
    // Count directory patterns
    if (dir.includes('mcp-node')) types['mcp'] = (types['mcp'] || 0) + 1;
    if (dir.includes('tools')) types['tools'] = (types['tools'] || 0) + 1;
    if (dir.includes('test')) types['test'] = (types['test'] || 0) + 1;
    if (dir.includes('docs')) types['docs'] = (types['docs'] || 0) + 1;
  });
  
  return types;
}

function calculateRelevanceScore(playbook: any, taskText: string, fileTypes: { [key: string]: number }): number {
  let score = 0;
  
  // Check tag relevance
  if (playbook.tags) {
    playbook.tags.forEach((tag: string) => {
      if (taskText.includes(tag.toLowerCase())) {
        score += 0.3;
      }
    });
  }
  
  // Check description relevance
  if (playbook.description && taskText.includes(playbook.description.toLowerCase())) {
    score += 0.2;
  }
  
  // Check file type relevance
  if (fileTypes['.ts'] && playbook.tags?.includes('typescript')) score += 0.2;
  if (fileTypes['mcp'] && playbook.tags?.includes('mcp')) score += 0.3;
  if (fileTypes['tools'] && playbook.tags?.includes('tools')) score += 0.2;
  
  // Check for specific keywords
  const keywords = ['tool', 'mcp', 'search', 'github', 'integration'];
  keywords.forEach(keyword => {
    if (taskText.includes(keyword) && 
        (playbook.name.toLowerCase().includes(keyword) || 
         playbook.description.toLowerCase().includes(keyword))) {
      score += 0.1;
    }
  });
  
  return Math.min(score, 1.0); // Cap at 1.0
}

function isStepApplicable(step: any, taskText: string, fileTypes: { [key: string]: number }): boolean {
  const stepText = `${step.title} ${step.description}`.toLowerCase();
  
  // Check if step mentions relevant files or concepts
  if (fileTypes['.ts'] && stepText.includes('typescript')) return true;
  if (fileTypes['mcp'] && stepText.includes('mcp')) return true;
  if (fileTypes['tools'] && stepText.includes('tool')) return true;
  
  // Check for task relevance
  const taskKeywords = taskText.split(/\s+/).filter(word => word.length > 3);
  return taskKeywords.some(keyword => stepText.includes(keyword));
}

function generateApproachSuggestions(
  taskText: string, 
  fileTypes: { [key: string]: number }, 
  constraints: string[]
): ApproachSuggestion[] {
  const approaches: ApproachSuggestion[] = [];
  
  // Incremental approach (always recommended)
  approaches.push({
    approach_name: "Incremental Implementation",
    description: "Build functionality step by step with testing at each stage",
    steps: [
      "Start with basic structure and interfaces",
      "Implement core functionality with minimal features",
      "Add tests and validation",
      "Enhance with additional features iteratively",
      "Integrate with existing systems"
    ],
    considerations: [
      "Allows for early feedback and course correction",
      "Reduces risk of major architectural mistakes",
      "Enables parallel work on different components"
    ],
    estimated_effort: "medium",
    risk_level: "low"
  });
  
  // If working with MCP tools
  if (fileTypes['mcp'] || taskText.includes('mcp') || taskText.includes('tool')) {
    approaches.push({
      approach_name: "Follow MCP Tool Pattern",
      description: "Use established MCP tool patterns for consistency",
      steps: [
        "Study existing tool implementations",
        "Create TypeScript interfaces following patterns",
        "Implement tool logic with proper error handling",
        "Register tool in manifest.ts and server.ts",
        "Add comprehensive tests"
      ],
      considerations: [
        "Ensures consistency with existing tools",
        "Leverages proven patterns and practices",
        "Simplifies maintenance and debugging"
      ],
      estimated_effort: "low",
      risk_level: "low"
    });
  }
  
  // If working with search/knowledge mining
  if (taskText.includes('search') || taskText.includes('mining') || taskText.includes('knowledge')) {
    approaches.push({
      approach_name: "Semantic Enhancement Approach",
      description: "Start with simple search and enhance with semantic capabilities",
      steps: [
        "Implement basic keyword-based search",
        "Add result ranking and filtering",
        "Integrate semantic similarity scoring",
        "Add context-aware search features",
        "Optimize for performance and accuracy"
      ],
      considerations: [
        "Complex semantic features can be added gradually",
        "Basic search provides immediate value",
        "Performance optimization can be done after functionality is proven"
      ],
      estimated_effort: "high",
      risk_level: "medium"
    });
  }
  
  return approaches;
}

function extractKeyConsiderations(
  playbooks: PlaybookSuggestion[], 
  constraints: string[], 
  fileTypes: { [key: string]: number }
): string[] {
  const considerations = new Set<string>();
  
  // Add considerations from top playbooks
  playbooks.slice(0, 2).forEach(playbook => {
    // These would come from the playbook's common_pitfalls in a real implementation
    considerations.add("Follow established patterns and conventions");
    considerations.add("Test incrementally as you build");
    considerations.add("Handle errors gracefully with meaningful messages");
  });
  
  // Add constraint-based considerations
  constraints.forEach(constraint => {
    if (constraint.toLowerCase().includes('performance')) {
      considerations.add("Optimize for performance from the start");
    }
    if (constraint.toLowerCase().includes('security')) {
      considerations.add("Implement proper security measures");
    }
  });
  
  // Add file type specific considerations
  if (fileTypes['.ts']) {
    considerations.add("Use TypeScript for better type safety");
  }
  if (fileTypes['mcp']) {
    considerations.add("Ensure MCP tool registration is complete");
  }
  
  return Array.from(considerations);
}

function generateNextSteps(
  playbooks: PlaybookSuggestion[], 
  approaches: ApproachSuggestion[]
): string[] {
  const steps: string[] = [];
  
  // Add steps from top playbook
  if (playbooks.length > 0) {
    const topPlaybook = playbooks[0];
    if (topPlaybook.applicable_steps.length > 0) {
      steps.push(`Follow "${topPlaybook.name}" playbook starting with: ${topPlaybook.applicable_steps[0]}`);
    }
  }
  
  // Add steps from top approach
  if (approaches.length > 0) {
    const topApproach = approaches[0];
    if (topApproach.steps.length > 0) {
      steps.push(`Begin ${topApproach.approach_name}: ${topApproach.steps[0]}`);
    }
  }
  
  // Add general steps
  steps.push("Review existing code patterns and conventions");
  steps.push("Create minimal implementation and test it");
  steps.push("Iterate based on feedback and requirements");
  
  return steps.slice(0, 5); // Limit to 5 next steps
}