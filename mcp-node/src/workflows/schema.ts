import { z } from 'zod';

export const StepSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  description: z.string().optional(),
  actions: z.array(z.string()).default([]),
  dependsOn: z.array(z.string()).default([]),
  validation: z.object({ 
    requiredFlags: z.array(z.string()).default([]) 
  }).default({ requiredFlags: [] }),
  timeoutSec: z.number().int().positive().optional(),
  outputs: z.record(z.string(), z.any()).optional(),
}).strict();

export const TemplateSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  name: z.string(), // Keeping 'name' for backward compatibility but will map to 'title'
  title: z.string().optional(), // New field that takes precedence
  description: z.string(),
  category: z.string().optional(),
  tags: z.array(z.string()).default([]),
  steps: z.array(StepSchema).min(1),
  metadata: z.record(z.string(), z.any()).optional(),
}).strict();

export type WorkflowTemplate = z.infer<typeof TemplateSchema>;
export type WorkflowStep = z.infer<typeof StepSchema>;

// Validation functions
export function validateTemplate(template: unknown): WorkflowTemplate {
  const result = TemplateSchema.parse(template);
  
  // Check for cyclic dependencies
  checkCyclicDependencies(result.steps);
  
  return result;
}

function checkCyclicDependencies(steps: WorkflowStep[]): void {
  const stepIds = new Set(steps.map(s => s.id));
  
  // Check that all dependencies reference valid step IDs
  for (const step of steps) {
    for (const dep of step.dependsOn || []) {
      if (!stepIds.has(dep)) {
        throw new Error(`Step '${step.id}' depends on non-existent step '${dep}'`);
      }
    }
  }
  
  // Check for cycles using topological sort
  const visited = new Set<string>();
  const visiting = new Set<string>();
  
  function visit(stepId: string): void {
    if (visiting.has(stepId)) {
      throw new Error(`Cyclic dependency detected involving step '${stepId}'`);
    }
    
    if (visited.has(stepId)) {
      return;
    }
    
    visiting.add(stepId);
    
    const step = steps.find(s => s.id === stepId);
    if (step) {
      for (const dep of step.dependsOn || []) {
        visit(dep);
      }
    }
    
    visiting.delete(stepId);
    visited.add(stepId);
  }
  
  for (const step of steps) {
    if (!visited.has(step.id)) {
      visit(step.id);
    }
  }
}