import { 
  workflowEngine, 
  WorkflowState, 
  WorkflowNextStep, 
  WorkflowCheckpoint 
} from '../workflow-engine.js';
import { WorkflowTemplate } from '../workflows/schema.js';
import { icnGetArchitecture } from './icn_get_architecture.js';
import { icnGetInvariants } from './icn_get_invariants.js';
import { icnCheckPolicy } from './icn_check_policy.js';
import { icnGetTaskContext } from './icn_get_task_context.js';
import { icnSuggestApproach } from './icn_suggest_approach.js';

// Intent analysis regex patterns - extracted for maintainability and testing
export const ARCHITECTURE_INTENT_REGEX = /\b(architect|architecture|design|structure|component|system)\b/i;
export const POLICY_INTENT_REGEX = /\b(policy|rule|permission|access|allow|deny)\b/i;
export const TASK_INTENT_REGEX = /\b(task|plan|implement|develop|build|modify|add|create|update)\b/i;
export const APPROACH_INTENT_REGEX = /\b(approach|method|strategy|how)\b/i;

// Tool complexity weights for scoring
const TOOL_WEIGHT: Record<string, number> = {
  'icn_get_architecture': 2,
  'icn_get_invariants': 1,
  'icn_get_task_context': 1,
  'icn_check_policy': 3,
  'icn_suggest_approach': 2
};

export interface AuthContext {
  actor: string | null;
  bearer: string | null;
  roles: string[];
  scopes: string[];
  tenantId: string | null;
}

export interface StartWorkflowParams {
  templateId: string;
  initialData?: Record<string, any>;
  sourceRequestId?: string;
  authContext?: AuthContext;
}

export interface StartWorkflowResponse {
  workflowId: string;
  template: WorkflowTemplate;
  nextStep: WorkflowNextStep;
  state: WorkflowState;
}

export interface GetNextStepParams {
  workflowId: string;
  authContext?: AuthContext;
}

export interface GetNextStepResponse {
  nextStep: WorkflowNextStep;
  state: WorkflowState;
  availableActions: string[];
}

export interface CreateCheckpointParams {
  workflowId: string;
  stepId: string;
  data: Record<string, any>;
  notes?: string;
  completeStep?: boolean;
  sourceRequestId?: string;
  idempotencyKey?: string;
  authContext?: AuthContext;
}

export interface CreateCheckpointResponse {
  checkpoint: WorkflowCheckpoint;
  nextStep: WorkflowNextStep;
  state: WorkflowState;
}

export interface ListTemplatesParams {
  authContext?: AuthContext;
}

export interface ListTemplatesResponse {
  templates: WorkflowTemplate[];
  categories: string[];
  tags: string[];
}

export interface OrchestrationStep {
  id: string;
  tool: string;
  params: Record<string, any>;
  description: string;
  dependsOn?: string[];
}

export interface GetWorkflowStateParams {
  workflowId: string;
  authContext?: AuthContext;
}

export interface WorkflowActionParams {
  workflowId: string;
  action: 'pause' | 'resume' | 'fail';
  reason?: string;
  authContext?: AuthContext;
}

export interface WorkflowActionResponse {
  workflowId: string;
  action: 'pause' | 'resume' | 'fail';
  previousStatus: string;
  newStatus: string;
  timestamp: string;
  reason?: string;
}

export interface OrchestrationParams {
  intent: string;
  context?: string;
  constraints?: string[];
  actor?: string;
  authContext?: AuthContext;
  _testSeed?: string; // For deterministic IDs in tests
}

export interface OrchestrationResponse {
  plan: {
    id: string;
    intent: string;
    steps: OrchestrationStep[];
    expectedDuration: string;
    complexity: 'low' | 'medium' | 'high';
  };
  execution: {
    stepResults: Record<string, any>;
    currentStep: number;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    startedAt: Date;
    completedAt?: Date;
  };
}

/**
 * Start a new workflow from a template
 */
export async function icnStartWorkflow(
  params: StartWorkflowParams
): Promise<StartWorkflowResponse> {
  const { templateId, initialData = {}, sourceRequestId, authContext } = params;

  // Use authContext if provided
  const actualCreatedBy = authContext?.actor || 'unknown';

  // Get template to validate it exists
  const template = workflowEngine.getTemplate(templateId);
  if (!template) {
    const availableTemplates = workflowEngine.getAvailableTemplates();
    throw new Error(
      `Workflow template '${templateId}' not found. Available templates: ${
        availableTemplates.map(t => t.id).join(', ')
      }`
    );
  }

  // Start the workflow
  const workflowId = await workflowEngine.startWorkflow(
    templateId, 
    initialData, 
    actualCreatedBy,
    sourceRequestId
  );
  
  // Get initial state and next step
  const state = workflowEngine.getWorkflowState(workflowId);
  const nextStep = await workflowEngine.getNextStep(workflowId);

  if (!state) {
    throw new Error('Failed to create workflow state');
  }

  return {
    workflowId,
    template,
    nextStep,
    state
  };
}

/**
 * Get the next step in a workflow
 */
export async function icnGetNextStep(params: GetNextStepParams): Promise<GetNextStepResponse> {
  const { workflowId, authContext } = params;
  
  // TODO: Use authContext for authorization checks
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _authContext = authContext;

  const state = workflowEngine.getWorkflowState(workflowId);
  if (!state) {
    throw new Error(`Workflow not found: ${workflowId}`);
  }

  const nextStep = await workflowEngine.getNextStep(workflowId);
  
  // Generate available actions based on current step
  const availableActions: string[] = [];
  
  if (nextStep.step) {
    availableActions.push('complete_step');
    availableActions.push('create_checkpoint');
  }
  
  if (state.status === 'active') {
    availableActions.push('pause_workflow');
  } else if (state.status === 'paused') {
    availableActions.push('resume_workflow');
  }
  
  if (!nextStep.isComplete && state.status !== 'failed') {
    availableActions.push('fail_workflow');
  }

  return {
    nextStep,
    state,
    availableActions
  };
}

/**
 * Create a checkpoint and optionally complete the current step
 */
export async function icnCheckpoint(params: CreateCheckpointParams): Promise<CreateCheckpointResponse> {
  const { workflowId, stepId, data, notes, completeStep = false, sourceRequestId, idempotencyKey, authContext } = params;

  // TODO: Implement idempotency using idempotencyKey
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _idempotencyKey = idempotencyKey;

  const state = workflowEngine.getWorkflowState(workflowId);
  if (!state) {
    throw new Error(`Workflow not found: ${workflowId}`);
  }

  // Basic authorization check if authContext is provided
  if (authContext && state.createdBy !== authContext.actor && !authContext.roles.includes('admin')) {
    throw new Error('Access denied: insufficient permissions to modify this workflow');
  }

  // Create checkpoint
  const checkpoint = await workflowEngine.createCheckpoint(
    workflowId, 
    stepId, 
    data, 
    notes,
    sourceRequestId
  );

  // Complete step if requested
  if (completeStep) {
    await workflowEngine.completeStep(workflowId, stepId, data, sourceRequestId);
  }

  // Get updated state and next step
  const updatedState = workflowEngine.getWorkflowState(workflowId);
  const nextStep = await workflowEngine.getNextStep(workflowId);

  if (!updatedState) {
    throw new Error('Failed to get updated workflow state');
  }

  return {
    checkpoint,
    nextStep,
    state: updatedState
  };
}

/**
 * List available workflow templates
 */
export async function icnListWorkflowTemplates(params?: ListTemplatesParams): Promise<ListTemplatesResponse> {
  const { authContext } = params || {};
  
  // TODO: Use authContext for filtering templates by tenant/access
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _authContext = authContext;
  const templates = workflowEngine.getAvailableTemplates();
  
  // Extract unique categories and tags
  const categories = Array.from(new Set(templates.map(t => t.category).filter((c): c is string => typeof c === 'string'))).sort();
  const tags = Array.from(new Set(templates.flatMap(t => t.tags || []))).sort();

  return {
    templates,
    categories,
    tags
  };
}

/**
 * Get workflow state and history
 */
export async function icnGetWorkflowState(params: GetWorkflowStateParams): Promise<WorkflowState> {
  const { workflowId, authContext } = params;
  
  // TODO: Use authContext for tenant isolation and access checks
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _authContext = authContext;
  
  const state = workflowEngine.getWorkflowState(workflowId);
  if (!state) {
    throw new Error(`Workflow not found: ${workflowId}`);
  }

  return state;
}

/**
 * Pause an active workflow
 */
export async function icnPauseWorkflow(params: WorkflowActionParams): Promise<WorkflowActionResponse> {
  const { workflowId, authContext, reason } = params;
  
  // TODO: Use authContext for authorization checks
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _authContext = authContext;

  const state = workflowEngine.getWorkflowState(workflowId);
  if (!state) {
    throw new Error(`Workflow not found: ${workflowId}`);
  }

  const previousStatus = state.status;
  
  if (previousStatus !== 'active') {
    throw new Error(`Cannot pause workflow in ${previousStatus} state`);
  }

  await workflowEngine.pauseWorkflow(workflowId);
  
  return {
    workflowId,
    action: 'pause',
    previousStatus,
    newStatus: 'paused',
    timestamp: new Date().toISOString(),
    reason
  };
}

/**
 * Resume a paused workflow
 */
export async function icnResumeWorkflow(params: WorkflowActionParams): Promise<WorkflowActionResponse> {
  const { workflowId, authContext, reason } = params;
  
  // TODO: Use authContext for authorization checks
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _authContext = authContext;

  const state = workflowEngine.getWorkflowState(workflowId);
  if (!state) {
    throw new Error(`Workflow not found: ${workflowId}`);
  }

  const previousStatus = state.status;
  
  if (previousStatus !== 'paused') {
    throw new Error(`Cannot resume workflow in ${previousStatus} state`);
  }

  await workflowEngine.resumeWorkflow(workflowId);
  
  return {
    workflowId,
    action: 'resume',
    previousStatus,
    newStatus: 'active',
    timestamp: new Date().toISOString(),
    reason
  };
}

/**
 * Fail a workflow with optional reason
 */
export async function icnFailWorkflow(params: WorkflowActionParams): Promise<WorkflowActionResponse> {
  const { workflowId, authContext, reason } = params;
  
  // TODO: Use authContext for authorization checks
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _authContext = authContext;

  const state = workflowEngine.getWorkflowState(workflowId);
  if (!state) {
    throw new Error(`Workflow not found: ${workflowId}`);
  }

  const previousStatus = state.status;
  
  if (previousStatus === 'failed') {
    throw new Error(`Workflow is already in failed state`);
  }

  await workflowEngine.failWorkflow(workflowId, reason);
  
  return {
    workflowId,
    action: 'fail',
    previousStatus,
    newStatus: 'failed',
    timestamp: new Date().toISOString(),
    reason
  };
}

/**
 * Orchestrate multiple MCP tools to produce actionable plans from intents
 */
export async function icnWorkflow(params: OrchestrationParams): Promise<OrchestrationResponse> {
  const { intent, context, constraints = [], actor, authContext, _testSeed } = params;
  
  // TODO: Use authContext for tool authorization and tenant isolation  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _authContext = authContext;
  
  // Generate unique ID for this orchestration (deterministic for tests)
  const orchestrationId = _testSeed ? `orch_${_testSeed}` : `orch_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  const startedAt = new Date();
  
  // Analyze intent to determine required tools and sequence
  const plan = await generateOrchestrationPlan(intent, context, constraints, actor, _testSeed);
  
  // Execute the orchestration plan
  const stepResults: Record<string, any> = {};
  let currentStep = 0;
  let status: 'pending' | 'in_progress' | 'completed' | 'failed' = 'in_progress';
  
  try {
    for (const [index, step] of plan.steps.entries()) {
      currentStep = index;
      
      // Check dependencies
      if (step.dependsOn) {
        for (const dependency of step.dependsOn) {
          if (!stepResults[dependency]) {
            throw new Error(`Step '${step.tool}' depends on '${dependency}' which hasn't completed successfully`);
          }
        }
      }
      
      // Execute the step
      let result;
      switch (step.tool) {
        case 'icn_get_architecture':
          result = await icnGetArchitecture(step.params.task);
          break;
        case 'icn_get_invariants':
          result = await icnGetInvariants();
          break;
        case 'icn_check_policy':
          if (!step.params.changeset || !Array.isArray(step.params.changeset)) {
            throw new Error(`icn_check_policy requires 'changeset' parameter as array`);
          }
          result = await icnCheckPolicy({
            changeset: step.params.changeset,
            actor: step.params.actor
          });
          break;
        case 'icn_get_task_context':
          if (!step.params.taskId || typeof step.params.taskId !== 'string') {
            throw new Error(`icn_get_task_context requires 'taskId' parameter as string`);
          }
          result = await icnGetTaskContext({
            taskId: step.params.taskId
          });
          break;
        case 'icn_suggest_approach':
          if (!step.params.task_description || typeof step.params.task_description !== 'string') {
            throw new Error(`icn_suggest_approach requires 'task_description' parameter as string`);
          }
          result = await icnSuggestApproach({
            task_description: step.params.task_description,
            files_to_modify: step.params.files_to_modify,
            constraints: step.params.constraints,
            context: step.params.context
          });
          break;
        default:
          throw new Error(`Unknown tool: ${step.tool}`);
      }
      
      stepResults[step.id] = result;
    }
    
    status = 'completed';
  } catch (error) {
    status = 'failed';
    stepResults.error = error instanceof Error ? error.message : 'Unknown error';
  }
  
  return {
    plan: {
      id: orchestrationId,
      intent,
      steps: plan.steps,
      expectedDuration: plan.expectedDuration,
      complexity: plan.complexity
    },
    execution: {
      stepResults,
      currentStep,
      status,
      startedAt,
      completedAt: status === 'completed' || status === 'failed' ? new Date() : undefined
    }
  };
}

/**
 * Generate an orchestration plan based on intent analysis
 */
async function generateOrchestrationPlan(
  intent: string, 
  context?: string, 
  constraints: string[] = [], 
  actor?: string,
  testSeed?: string
): Promise<{ steps: OrchestrationStep[]; expectedDuration: string; complexity: 'low' | 'medium' | 'high' }> {
  const steps: OrchestrationStep[] = [];
  
  // Intent analysis using extracted regex patterns
  const intentLower = intent.toLowerCase();
  const isArchitectureRelated = ARCHITECTURE_INTENT_REGEX.test(intentLower);
  const isPolicyRelated = POLICY_INTENT_REGEX.test(intentLower);
  const isTaskRelated = TASK_INTENT_REGEX.test(intentLower);
  const isApproachRelated = APPROACH_INTENT_REGEX.test(intentLower);
  
  // Step ID generator (deterministic for tests)
  let stepCounter = 0;
  const generateStepId = (tool: string): string => {
    stepCounter++;
    return testSeed ? `${tool}_${testSeed}_${stepCounter}` : `${tool}_${Date.now()}_${stepCounter}`;
  };
  
  // Always start with architecture context for complex intents
  let architectureStepId: string | undefined;
  if (isArchitectureRelated || isTaskRelated) {
    architectureStepId = generateStepId('icn_get_architecture');
    steps.push({
      id: architectureStepId,
      tool: 'icn_get_architecture',
      params: { task: intent },
      description: 'Gather relevant architecture documentation and patterns'
    });
  }
  
  // Add invariants check for system design or implementation
  let invariantsStepId: string | undefined;
  if (isArchitectureRelated || isTaskRelated) {
    invariantsStepId = generateStepId('icn_get_invariants');
    steps.push({
      id: invariantsStepId,
      tool: 'icn_get_invariants',
      params: {},
      description: 'Retrieve system invariants and constraints',
      // Invariants depend on architecture context being available first
      dependsOn: architectureStepId ? [architectureStepId] : undefined
    });
  }
  
  // Add task context if dealing with specific tasks
  let taskContextStepId: string | undefined;
  if (isTaskRelated && context) {
    taskContextStepId = generateStepId('icn_get_task_context');
    steps.push({
      id: taskContextStepId,
      tool: 'icn_get_task_context',
      params: { taskId: context },
      description: 'Gather specific task context and requirements'
      // Task context is independent, no dependencies
    });
  }
  
  // Policy check for implementation or modification intents
  let policyStepId: string | undefined;
  if (isPolicyRelated || isTaskRelated) {
    // Generate likely file paths from intent
    const changeset = extractLikelyFiles(intent, context);
    if (changeset.length > 0) {
      policyStepId = generateStepId('icn_check_policy');
      
      // Policy should depend on steps that provide changeset context
      const policyDependencies: string[] = [];
      if (taskContextStepId) policyDependencies.push(taskContextStepId);
      // Note: Policy does NOT depend on architecture or invariants directly
      
      steps.push({
        id: policyStepId,
        tool: 'icn_check_policy',
        params: { changeset, actor },
        description: 'Validate proposed changes against ICN policies',
        dependsOn: policyDependencies.length > 0 ? policyDependencies : undefined
      });
    }
  }
  
  // Add approach suggestion for planning intents
  if (isApproachRelated || isTaskRelated) {
    const approachStepId = generateStepId('icn_suggest_approach');
    
    // Approach should depend on data feeders (architecture + invariants), not policy
    const approachDependencies: string[] = [];
    if (architectureStepId) approachDependencies.push(architectureStepId);
    if (invariantsStepId) approachDependencies.push(invariantsStepId);
    
    steps.push({
      id: approachStepId,
      tool: 'icn_suggest_approach',
      params: { 
        task_description: intent,
        context,
        constraints
      },
      description: 'Generate implementation approach and recommendations',
      dependsOn: approachDependencies.length > 0 ? approachDependencies : undefined
    });
  }
  
  // Calculate complexity using tool weights and dependency depth
  const totalWeight = steps.reduce((sum, step) => sum + (TOOL_WEIGHT[step.tool] || 1), 0);
  const maxDepth = calculateMaxDependencyDepth(steps);
  const complexityScore = totalWeight + maxDepth;
  
  const complexity: 'low' | 'medium' | 'high' = 
    complexityScore <= 4 ? 'low' : 
    complexityScore <= 8 ? 'medium' : 'high';
    
  const expectedDuration = 
    complexity === 'low' ? '30-60 seconds' :
    complexity === 'medium' ? '1-2 minutes' : '2-5 minutes';
  
  return { steps, expectedDuration, complexity };
}

/**
 * Calculate the maximum dependency depth in the step graph
 */
function calculateMaxDependencyDepth(steps: OrchestrationStep[]): number {
  const stepMap = new Map(steps.map(step => [step.id, step]));
  const depthCache = new Map<string, number>();
  
  function getDepth(stepId: string): number {
    if (depthCache.has(stepId)) {
      return depthCache.get(stepId)!;
    }
    
    const step = stepMap.get(stepId);
    if (!step || !step.dependsOn || step.dependsOn.length === 0) {
      depthCache.set(stepId, 0);
      return 0;
    }
    
    const maxDepDepth = Math.max(...step.dependsOn.map(getDepth));
    const depth = maxDepDepth + 1;
    depthCache.set(stepId, depth);
    return depth;
  }
  
  return Math.max(...steps.map(step => getDepth(step.id)));
}

/**
 * Extract likely file paths from intent description
 */
function extractLikelyFiles(intent: string, context?: string): string[] {
  const files: string[] = [];
  
  // Common patterns in intents that suggest file modifications
  if (/mcp.?server|server/i.test(intent)) {
    files.push('mcp-server/src/');
  }
  
  if (/mcp.?node|node|tool/i.test(intent)) {
    files.push('mcp-node/src/');
  }
  
  if (/agent|planner|architect|ops|reviewer/i.test(intent)) {
    files.push('agents/');
  }
  
  if (/workflow|template/i.test(intent)) {
    files.push('workflows/');
  }
  
  if (/doc|documentation|readme/i.test(intent)) {
    files.push('docs/');
  }
  
  if (/test|spec/i.test(intent)) {
    files.push('test/', '**/*.test.ts');
  }
  
  // If context provides more specific paths, include them
  if (context) {
    const contextFiles = context.match(/[\w-]+\/[\w-./]*\.[\w]+/g) || [];
    files.push(...contextFiles);
  }
  
  return files;
}