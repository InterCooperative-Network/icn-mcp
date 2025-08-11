import fs from 'node:fs/promises';
import path from 'node:path';
import { customAlphabet } from 'nanoid';
import { validateTemplate, WorkflowTemplate, WorkflowStep } from './workflows/schema.js';
import crypto from 'node:crypto';

// Deterministic ID generation
const nano = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 10);

export interface WorkflowState {
  workflowId: string;
  templateId: string;
  templateVersion: string;
  templateHash: string;
  status: 'active' | 'completed' | 'failed' | 'paused';
  currentStepId: string | null;
  stepData: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export interface WorkflowCheckpoint {
  id: string;
  stepId: string;
  timestamp: Date;
  data: Record<string, any>;
  notes?: string;
  sequence: number;
  sourceRequestId?: string;
}

export interface WorkflowStepState {
  id: string;
  workflowId: string;
  stepId: string;
  status: 'pending' | 'active' | 'completed' | 'failed' | 'skipped';
  sequence: number;
  completedAt?: Date;
  outputs?: Record<string, any>;
}

export interface WorkflowNextStep {
  step: WorkflowStep | null;
  isComplete: boolean;
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
}

// Database interface - will be injected to avoid circular dependencies
export interface WorkflowDatabase {
  // Template operations
  saveTemplate(template: WorkflowTemplate & { hash: string }): void;
  getTemplate(id: string, version?: string): (WorkflowTemplate & { hash: string }) | null;
  listTemplates(): (WorkflowTemplate & { hash: string })[];
  
  // Workflow operations  
  createWorkflow(state: WorkflowState): void;
  updateWorkflow(workflowId: string, updates: Partial<WorkflowState>): void;
  getWorkflow(workflowId: string): WorkflowState | null;
  
  // Step operations
  createWorkflowStep(step: WorkflowStepState): void;
  updateWorkflowStep(stepId: string, updates: Partial<WorkflowStepState>): void;
  getWorkflowSteps(workflowId: string): WorkflowStepState[];
  
  // Checkpoint operations
  createCheckpoint(checkpoint: WorkflowCheckpoint & { workflowId: string }): void;
  getCheckpoints(workflowId: string): WorkflowCheckpoint[];
  getCheckpointByRequestId(sourceRequestId: string): WorkflowCheckpoint | null;
}

// In-memory locks for concurrency control
const workflowLocks = new Map<string, Promise<any>>();

export class WorkflowEngine {
  private templates: Map<string, WorkflowTemplate & { hash: string }> = new Map();
  private db: WorkflowDatabase | null = null;
  private templatesLoaded = false;
  
  constructor() {
    // Templates will be loaded asynchronously via loadTemplates()
  }

  // Inject database implementation
  setDatabase(db: WorkflowDatabase): void {
    this.db = db;
  }

  // Async template loading
  async loadTemplates(): Promise<void> {
    if (this.templatesLoaded) return;

    try {
      const workflowsDir = path.resolve(process.cwd(), 'workflows');
      
      try {
        await fs.access(workflowsDir);
      } catch {
        console.warn('Workflows directory not found, creating empty template store');
        this.templatesLoaded = true;
        return;
      }

      const files = (await fs.readdir(workflowsDir)).filter(f => f.endsWith('.json'));
      
      for (const file of files) {
        try {
          const filePath = path.join(workflowsDir, file);
          const content = await fs.readFile(filePath, 'utf8');
          const rawTemplate = JSON.parse(content);
          
          // Validate and transform template
          const template = validateTemplate(rawTemplate);
          const hash = this.calculateTemplateHash(template);
          const templateWithHash = { ...template, hash };
          
          this.templates.set(template.id, templateWithHash);
          
          // Save to database if available
          if (this.db) {
            this.db.saveTemplate(templateWithHash);
          }
        } catch (error) {
          console.error(`Error loading workflow template ${file}:`, error);
        }
      }
      
      console.log(`Loaded ${this.templates.size} workflow templates`);
      this.templatesLoaded = true;
    } catch (error) {
      console.error('Error loading workflow templates:', error);
      this.templatesLoaded = true; // Mark as loaded to prevent retries
    }
  }

  private calculateTemplateHash(template: WorkflowTemplate): string {
    const hashData = JSON.stringify({
      id: template.id,
      version: template.version,
      steps: template.steps,
      metadata: template.metadata
    });
    return crypto.createHash('sha256').update(hashData).digest('hex').slice(0, 16);
  }

  public getAvailableTemplates(): WorkflowTemplate[] {
    return Array.from(this.templates.values());
  }

  public getTemplate(templateId: string): WorkflowTemplate | null {
    const template = this.templates.get(templateId);
    return template || (this.db ? this.db.getTemplate(templateId) : null);
  }

  // Atomic workflow operations with locking
  private async withWorkflowLock<T>(workflowId: string, operation: () => Promise<T>): Promise<T> {
    // Wait for any existing operation on this workflow
    const existingLock = workflowLocks.get(workflowId);
    if (existingLock) {
      await existingLock;
    }

    // Create new lock
    const lockPromise = operation();
    workflowLocks.set(workflowId, lockPromise);

    try {
      const result = await lockPromise;
      return result;
    } finally {
      workflowLocks.delete(workflowId);
    }
  }

  public async startWorkflow(
    templateId: string, 
    initialData: Record<string, any> = {},
    createdBy?: string,
    _sourceRequestId?: string
  ): Promise<string> {
    await this.loadTemplates(); // Ensure templates are loaded

    const template = this.templates.get(templateId) || (this.db ? this.db.getTemplate(templateId) : null);
    if (!template) {
      throw new Error(`Workflow template not found: ${templateId}`);
    }

    const workflowId = `wf_${Date.now()}_${nano()}`;
    const now = new Date();

    return this.withWorkflowLock(workflowId, async () => {
      const workflowState: WorkflowState = {
        workflowId,
        templateId,
        templateVersion: template.version,
        templateHash: template.hash,
        status: 'active',
        currentStepId: template.steps.length > 0 ? template.steps[0].id : null,
        stepData: { ...initialData },
        createdAt: now,
        updatedAt: now,
        createdBy
      };

      // Persist to database
      if (this.db) {
        this.db.createWorkflow(workflowState);
        
        // Initialize step states
        template.steps.forEach((step, index) => {
          const stepState: WorkflowStepState = {
            id: `${workflowId}_${step.id}`,
            workflowId,
            stepId: step.id,
            status: index === 0 ? 'active' : 'pending',
            sequence: index
          };
          this.db!.createWorkflowStep(stepState);
        });
      }

      return workflowId;
    });
  }

  public async getNextStep(workflowId: string): Promise<WorkflowNextStep> {
    const workflow = this.getWorkflowState(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const template = this.getTemplate(workflow.templateId);
    if (!template) {
      throw new Error(`Template not found: ${workflow.templateId}`);
    }

    const steps = this.db ? this.db.getWorkflowSteps(workflowId) : [];
    const completedSteps = steps.filter(s => s.status === 'completed').map(s => s.stepId);

    // Check if workflow is complete
    if (completedSteps.length === template.steps.length) {
      return {
        step: null,
        isComplete: true,
        progress: {
          completed: template.steps.length,
          total: template.steps.length,
          percentage: 100
        }
      };
    }

    // Find next step based on dependencies
    const nextStep = template.steps.find(step => 
      !completedSteps.includes(step.id) &&
      this.areDependenciesMet(step, completedSteps)
    );

    if (!nextStep) {
      return {
        step: null,
        isComplete: false,
        progress: {
          completed: completedSteps.length,
          total: template.steps.length,
          percentage: Math.round((completedSteps.length / template.steps.length) * 100)
        }
      };
    }

    return {
      step: nextStep,
      isComplete: false,
      progress: {
        completed: completedSteps.length,
        total: template.steps.length,
        percentage: Math.round((completedSteps.length / template.steps.length) * 100)
      }
    };
  }

  private areDependenciesMet(step: WorkflowStep, completedSteps: string[]): boolean {
    if (!step.dependsOn || step.dependsOn.length === 0) {
      return true;
    }
    
    return step.dependsOn.every(dep => completedSteps.includes(dep));
  }

  public async createCheckpoint(
    workflowId: string, 
    stepId: string, 
    data: Record<string, any>, 
    notes?: string,
    sourceRequestId?: string
  ): Promise<WorkflowCheckpoint> {
    return this.withWorkflowLock(workflowId, async () => {
      // Check for existing checkpoint with same sourceRequestId (idempotency)
      if (sourceRequestId && this.db) {
        const existing = this.db.getCheckpointByRequestId(sourceRequestId);
        if (existing) {
          return existing;
        }
      }

      const workflow = this.getWorkflowState(workflowId);
      if (!workflow) {
        throw new Error(`Workflow not found: ${workflowId}`);
      }

      const existingCheckpoints = this.db ? this.db.getCheckpoints(workflowId) : [];
      const stepCheckpoints = existingCheckpoints.filter(c => c.stepId === stepId);
      const sequence = stepCheckpoints.length + 1;

      const checkpoint: WorkflowCheckpoint & { workflowId: string } = {
        id: `cp_${Date.now()}_${nano()}`,
        workflowId,
        stepId,
        timestamp: new Date(),
        data: { ...data },
        notes,
        sequence,
        sourceRequestId
      };

      // Persist checkpoint
      if (this.db) {
        this.db.createCheckpoint(checkpoint);
      }

      // Update workflow step data
      const updatedStepData = { ...workflow.stepData, ...data };
      if (this.db) {
        this.db.updateWorkflow(workflowId, { 
          stepData: updatedStepData, 
          updatedAt: new Date() 
        });
      }

      return checkpoint;
    });
  }

  public async completeStep(
    workflowId: string, 
    stepId: string, 
    outputs?: Record<string, any>,
    _sourceRequestId?: string
  ): Promise<void> {
    return this.withWorkflowLock(workflowId, async () => {
      const workflow = this.getWorkflowState(workflowId);
      if (!workflow) {
        throw new Error(`Workflow not found: ${workflowId}`);
      }

      if (!this.db) {
        throw new Error('Database not available for workflow persistence');
      }

      const steps = this.db.getWorkflowSteps(workflowId);
      const currentStep = steps.find(s => s.stepId === stepId);
      
      if (!currentStep) {
        throw new Error(`Step not found: ${stepId}`);
      }

      if (currentStep.status === 'completed') {
        return; // Idempotent - already completed
      }

      // Validate step can be completed (dependencies met)
      const template = this.getTemplate(workflow.templateId);
      if (template) {
        const templateStep = template.steps.find(s => s.id === stepId);
        const completedSteps = steps.filter(s => s.status === 'completed').map(s => s.stepId);
        
        if (templateStep && !this.areDependenciesMet(templateStep, completedSteps)) {
          throw new Error(`Cannot complete step ${stepId}: dependencies not met`);
        }
      }

      // Mark step as completed
      this.db.updateWorkflowStep(currentStep.id, {
        status: 'completed',
        completedAt: new Date(),
        outputs
      });

      // Update workflow step data
      const updatedStepData = { ...workflow.stepData, ...(outputs || {}) };
      
      // Check if workflow is complete
      const completedCount = steps.filter(s => s.status === 'completed').length + 1; // +1 for current step
      const isWorkflowComplete = template && completedCount === template.steps.length;

      this.db.updateWorkflow(workflowId, {
        stepData: updatedStepData,
        status: isWorkflowComplete ? 'completed' : workflow.status,
        currentStepId: isWorkflowComplete ? null : workflow.currentStepId,
        updatedAt: new Date()
      });
    });
  }

  public getWorkflowState(workflowId: string): WorkflowState | null {
    return this.db ? this.db.getWorkflow(workflowId) : null;
  }

  public async pauseWorkflow(workflowId: string): Promise<void> {
    return this.withWorkflowLock(workflowId, async () => {
      if (this.db) {
        this.db.updateWorkflow(workflowId, {
          status: 'paused',
          updatedAt: new Date()
        });
      }
    });
  }

  public async resumeWorkflow(workflowId: string): Promise<void> {
    return this.withWorkflowLock(workflowId, async () => {
      const workflow = this.getWorkflowState(workflowId);
      if (workflow && workflow.status === 'paused' && this.db) {
        this.db.updateWorkflow(workflowId, {
          status: 'active',
          updatedAt: new Date()
        });
      }
    });
  }

  public async failWorkflow(workflowId: string, reason?: string): Promise<void> {
    return this.withWorkflowLock(workflowId, async () => {
      if (this.db) {
        const updatedStepData = reason ? { failureReason: reason } : {};
        this.db.updateWorkflow(workflowId, {
          status: 'failed',
          stepData: updatedStepData,
          updatedAt: new Date()
        });
      }
    });
  }

  public getCheckpoints(workflowId: string): WorkflowCheckpoint[] {
    return this.db ? this.db.getCheckpoints(workflowId) : [];
  }
}

// Singleton instance - will be initialized with database
export const workflowEngine = new WorkflowEngine();