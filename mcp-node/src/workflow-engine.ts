import fs from 'node:fs';
import path from 'node:path';

export interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  actions: string[];
  validation?: string[];
  dependencies?: string[];
  outputs?: Record<string, any>;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  steps: WorkflowStep[];
  metadata?: Record<string, any>;
}

export interface WorkflowState {
  workflowId: string;
  templateId: string;
  status: 'active' | 'completed' | 'failed' | 'paused';
  currentStepId: string | null;
  completedSteps: string[];
  stepData: Record<string, any>;
  checkpoints: WorkflowCheckpoint[];
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowCheckpoint {
  id: string;
  stepId: string;
  timestamp: Date;
  data: Record<string, any>;
  notes?: string;
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

class WorkflowEngine {
  private workflows: Map<string, WorkflowState> = new Map();
  private templates: Map<string, WorkflowTemplate> = new Map();
  
  constructor() {
    this.loadWorkflowTemplates();
  }

  private loadWorkflowTemplates(): void {
    try {
      const workflowsDir = path.resolve(process.cwd(), 'workflows');
      
      if (!fs.existsSync(workflowsDir)) {
        console.warn('Workflows directory not found, creating empty template store');
        return;
      }

      const files = fs.readdirSync(workflowsDir).filter(f => f.endsWith('.json'));
      
      for (const file of files) {
        try {
          const filePath = path.join(workflowsDir, file);
          const content = fs.readFileSync(filePath, 'utf8');
          const template: WorkflowTemplate = JSON.parse(content);
          
          if (this.validateTemplate(template)) {
            this.templates.set(template.id, template);
          } else {
            console.warn(`Invalid workflow template: ${file}`);
          }
        } catch (error) {
          console.error(`Error loading workflow template ${file}:`, error);
        }
      }
      
      console.log(`Loaded ${this.templates.size} workflow templates`);
    } catch (error) {
      console.error('Error loading workflow templates:', error);
    }
  }

  private validateTemplate(template: any): template is WorkflowTemplate {
    return (
      typeof template.id === 'string' &&
      typeof template.name === 'string' &&
      typeof template.description === 'string' &&
      Array.isArray(template.steps) &&
      template.steps.every((step: any) => 
        typeof step.id === 'string' &&
        typeof step.title === 'string' &&
        Array.isArray(step.actions)
      )
    );
  }

  public getAvailableTemplates(): WorkflowTemplate[] {
    return Array.from(this.templates.values());
  }

  public getTemplate(templateId: string): WorkflowTemplate | null {
    return this.templates.get(templateId) || null;
  }

  public startWorkflow(templateId: string, initialData: Record<string, any> = {}): string {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Workflow template not found: ${templateId}`);
    }

    const workflowId = `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const workflowState: WorkflowState = {
      workflowId,
      templateId,
      status: 'active',
      currentStepId: template.steps.length > 0 ? template.steps[0].id : null,
      completedSteps: [],
      stepData: { ...initialData },
      checkpoints: [],
      createdAt: now,
      updatedAt: now
    };

    this.workflows.set(workflowId, workflowState);
    return workflowId;
  }

  public getNextStep(workflowId: string): WorkflowNextStep {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const template = this.templates.get(workflow.templateId);
    if (!template) {
      throw new Error(`Template not found: ${workflow.templateId}`);
    }

    // Check if workflow is complete
    if (workflow.completedSteps.length === template.steps.length) {
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

    // Find next step
    const nextStep = template.steps.find(step => 
      !workflow.completedSteps.includes(step.id) &&
      this.areDependenciesMet(step, workflow.completedSteps)
    );

    if (!nextStep) {
      // No available next step (likely waiting on dependencies)
      return {
        step: null,
        isComplete: false,
        progress: {
          completed: workflow.completedSteps.length,
          total: template.steps.length,
          percentage: Math.round((workflow.completedSteps.length / template.steps.length) * 100)
        }
      };
    }

    return {
      step: nextStep,
      isComplete: false,
      progress: {
        completed: workflow.completedSteps.length,
        total: template.steps.length,
        percentage: Math.round((workflow.completedSteps.length / template.steps.length) * 100)
      }
    };
  }

  private areDependenciesMet(step: WorkflowStep, completedSteps: string[]): boolean {
    if (!step.dependencies || step.dependencies.length === 0) {
      return true;
    }
    
    return step.dependencies.every(dep => completedSteps.includes(dep));
  }

  public createCheckpoint(
    workflowId: string, 
    stepId: string, 
    data: Record<string, any>, 
    notes?: string
  ): WorkflowCheckpoint {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const checkpoint: WorkflowCheckpoint = {
      id: `cp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      stepId,
      timestamp: new Date(),
      data: { ...data },
      notes
    };

    workflow.checkpoints.push(checkpoint);
    workflow.stepData = { ...workflow.stepData, ...data };
    workflow.updatedAt = new Date();

    return checkpoint;
  }

  public completeStep(workflowId: string, stepId: string, outputs?: Record<string, any>): void {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    if (!workflow.completedSteps.includes(stepId)) {
      workflow.completedSteps.push(stepId);
      
      if (outputs) {
        workflow.stepData = { ...workflow.stepData, ...outputs };
      }
      
      workflow.updatedAt = new Date();

      // Check if workflow is complete
      const template = this.templates.get(workflow.templateId);
      if (template && workflow.completedSteps.length === template.steps.length) {
        workflow.status = 'completed';
        workflow.currentStepId = null;
      } else {
        // Update current step to next available step
        const nextStep = this.getNextStep(workflowId);
        workflow.currentStepId = nextStep.step?.id || null;
      }
    }
  }

  public getWorkflowState(workflowId: string): WorkflowState | null {
    return this.workflows.get(workflowId) || null;
  }

  public pauseWorkflow(workflowId: string): void {
    const workflow = this.workflows.get(workflowId);
    if (workflow) {
      workflow.status = 'paused';
      workflow.updatedAt = new Date();
    }
  }

  public resumeWorkflow(workflowId: string): void {
    const workflow = this.workflows.get(workflowId);
    if (workflow && workflow.status === 'paused') {
      workflow.status = 'active';
      workflow.updatedAt = new Date();
    }
  }

  public failWorkflow(workflowId: string, reason?: string): void {
    const workflow = this.workflows.get(workflowId);
    if (workflow) {
      workflow.status = 'failed';
      workflow.stepData.failureReason = reason;
      workflow.updatedAt = new Date();
    }
  }
}

// Singleton instance
export const workflowEngine = new WorkflowEngine();