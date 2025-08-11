import { 
  workflowEngine, 
  WorkflowState, 
  WorkflowNextStep, 
  WorkflowCheckpoint 
} from '../workflow-engine.js';
import { WorkflowTemplate } from '../workflows/schema.js';

export interface StartWorkflowParams {
  templateId: string;
  initialData?: Record<string, any>;
  sourceRequestId?: string;
}

export interface StartWorkflowResponse {
  workflowId: string;
  template: WorkflowTemplate;
  nextStep: WorkflowNextStep;
  state: WorkflowState;
}

export interface GetNextStepParams {
  workflowId: string;
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
}

export interface CreateCheckpointResponse {
  checkpoint: WorkflowCheckpoint;
  nextStep: WorkflowNextStep;
  state: WorkflowState;
}

export interface ListTemplatesResponse {
  templates: WorkflowTemplate[];
  categories: string[];
  tags: string[];
}

/**
 * Start a new workflow from a template
 */
export async function icnStartWorkflow(
  params: StartWorkflowParams,
  createdBy?: string
): Promise<StartWorkflowResponse> {
  const { templateId, initialData = {}, sourceRequestId } = params;

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
    createdBy,
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
  const { workflowId } = params;

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
  const { workflowId, stepId, data, notes, completeStep = false, sourceRequestId } = params;

  const state = workflowEngine.getWorkflowState(workflowId);
  if (!state) {
    throw new Error(`Workflow not found: ${workflowId}`);
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
export async function icnListWorkflowTemplates(): Promise<ListTemplatesResponse> {
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
export async function icnGetWorkflowState(params: { workflowId: string }): Promise<WorkflowState> {
  const { workflowId } = params;
  
  const state = workflowEngine.getWorkflowState(workflowId);
  if (!state) {
    throw new Error(`Workflow not found: ${workflowId}`);
  }

  return state;
}