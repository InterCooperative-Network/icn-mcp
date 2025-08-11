import Database from 'better-sqlite3';
import { WorkflowDatabase, WorkflowState, WorkflowStepState, WorkflowCheckpoint } from '../workflow-engine.js';
import { WorkflowTemplate } from '../workflows/schema.js';

export class SqliteWorkflowDatabase implements WorkflowDatabase {
  constructor(private db: Database.Database) {}

  // Template operations
  saveTemplate(template: WorkflowTemplate & { hash: string }): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO workflow_templates 
      (id, version, hash, title, description, category, tags, steps, metadata, loaded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      template.id,
      template.version,
      template.hash,
      template.title || template.name, // Use title if available, fallback to name
      template.description,
      template.category || null,
      JSON.stringify(template.tags || []),
      JSON.stringify(template.steps),
      JSON.stringify(template.metadata || {}),
      Date.now()
    );
  }

  getTemplate(id: string, version?: string): (WorkflowTemplate & { hash: string }) | null {
    let stmt: Database.Statement;
    let row: any;
    
    if (version) {
      stmt = this.db.prepare('SELECT * FROM workflow_templates WHERE id = ? AND version = ?');
      row = stmt.get(id, version);
    } else {
      // Get latest version
      stmt = this.db.prepare(`
        SELECT * FROM workflow_templates 
        WHERE id = ? 
        ORDER BY loaded_at DESC 
        LIMIT 1
      `);
      row = stmt.get(id);
    }

    if (!row) return null;

    return {
      id: row.id,
      version: row.version,
      hash: row.hash,
      name: row.title, // Map back to name for compatibility
      title: row.title,
      description: row.description,
      category: row.category,
      tags: JSON.parse(row.tags || '[]'),
      steps: JSON.parse(row.steps),
      metadata: JSON.parse(row.metadata || '{}')
    };
  }

  listTemplates(): (WorkflowTemplate & { hash: string })[] {
    const stmt = this.db.prepare(`
      SELECT * FROM workflow_templates 
      ORDER BY id, loaded_at DESC
    `);
    const rows = stmt.all() as any[];
    
    // Get latest version of each template
    const latestTemplates = new Map();
    for (const row of rows) {
      if (!latestTemplates.has(row.id)) {
        latestTemplates.set(row.id, {
          id: row.id,
          version: row.version,
          hash: row.hash,
          name: row.title,
          title: row.title,
          description: row.description,
          category: row.category,
          tags: JSON.parse(row.tags || '[]'),
          steps: JSON.parse(row.steps),
          metadata: JSON.parse(row.metadata || '{}')
        });
      }
    }
    
    return Array.from(latestTemplates.values());
  }

  // Workflow operations
  createWorkflow(state: WorkflowState): void {
    const stmt = this.db.prepare(`
      INSERT INTO workflows 
      (id, template_id, template_version, template_hash, status, current_step_id, step_data, created_at, updated_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      state.workflowId,
      state.templateId,
      state.templateVersion,
      state.templateHash,
      state.status,
      state.currentStepId,
      JSON.stringify(state.stepData),
      state.createdAt.getTime(),
      state.updatedAt.getTime(),
      state.createdBy || null
    );
  }

  updateWorkflow(workflowId: string, updates: Partial<WorkflowState>): void {
    const fields: string[] = [];
    const values: any[] = [];
    
    if (updates.status) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.currentStepId !== undefined) {
      fields.push('current_step_id = ?');
      values.push(updates.currentStepId);
    }
    if (updates.stepData) {
      fields.push('step_data = ?');
      values.push(JSON.stringify(updates.stepData));
    }
    if (updates.updatedAt) {
      fields.push('updated_at = ?');
      values.push(updates.updatedAt.getTime());
    }

    if (fields.length === 0) return;

    const stmt = this.db.prepare(`
      UPDATE workflows 
      SET ${fields.join(', ')} 
      WHERE id = ?
    `);
    
    values.push(workflowId);
    stmt.run(...values);
  }

  getWorkflow(workflowId: string): WorkflowState | null {
    const stmt = this.db.prepare('SELECT * FROM workflows WHERE id = ?');
    const row = stmt.get(workflowId) as any;
    
    if (!row) return null;

    return {
      workflowId: row.id,
      templateId: row.template_id,
      templateVersion: row.template_version,
      templateHash: row.template_hash,
      status: row.status,
      currentStepId: row.current_step_id,
      stepData: JSON.parse(row.step_data || '{}'),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      createdBy: row.created_by
    };
  }

  // Step operations
  createWorkflowStep(step: WorkflowStepState): void {
    const stmt = this.db.prepare(`
      INSERT INTO workflow_steps 
      (id, workflow_id, step_id, status, sequence, completed_at, outputs)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      step.id,
      step.workflowId,
      step.stepId,
      step.status,
      step.sequence,
      step.completedAt ? step.completedAt.getTime() : null,
      JSON.stringify(step.outputs || {})
    );
  }

  updateWorkflowStep(stepId: string, updates: Partial<WorkflowStepState>): void {
    const fields: string[] = [];
    const values: any[] = [];
    
    if (updates.status) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.completedAt) {
      fields.push('completed_at = ?');
      values.push(updates.completedAt.getTime());
    }
    if (updates.outputs) {
      fields.push('outputs = ?');
      values.push(JSON.stringify(updates.outputs));
    }

    if (fields.length === 0) return;

    const stmt = this.db.prepare(`
      UPDATE workflow_steps 
      SET ${fields.join(', ')} 
      WHERE id = ?
    `);
    
    values.push(stepId);
    stmt.run(...values);
  }

  getWorkflowSteps(workflowId: string): WorkflowStepState[] {
    const stmt = this.db.prepare(`
      SELECT * FROM workflow_steps 
      WHERE workflow_id = ? 
      ORDER BY sequence
    `);
    const rows = stmt.all(workflowId) as any[];
    
    return rows.map(row => ({
      id: row.id,
      workflowId: row.workflow_id,
      stepId: row.step_id,
      status: row.status,
      sequence: row.sequence,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      outputs: JSON.parse(row.outputs || '{}')
    }));
  }

  // Checkpoint operations
  createCheckpoint(checkpoint: WorkflowCheckpoint & { workflowId: string }): void {
    const stmt = this.db.prepare(`
      INSERT INTO workflow_checkpoints 
      (id, workflow_id, step_id, sequence, timestamp, data, notes, source_request_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      checkpoint.id,
      checkpoint.workflowId,
      checkpoint.stepId,
      checkpoint.sequence,
      checkpoint.timestamp.getTime(),
      JSON.stringify(checkpoint.data),
      checkpoint.notes || null,
      checkpoint.sourceRequestId || null
    );
  }

  getCheckpoints(workflowId: string): WorkflowCheckpoint[] {
    const stmt = this.db.prepare(`
      SELECT * FROM workflow_checkpoints 
      WHERE workflow_id = ? 
      ORDER BY timestamp
    `);
    const rows = stmt.all(workflowId) as any[];
    
    return rows.map(row => ({
      id: row.id,
      stepId: row.step_id,
      timestamp: new Date(row.timestamp),
      data: JSON.parse(row.data || '{}'),
      notes: row.notes,
      sequence: row.sequence,
      sourceRequestId: row.source_request_id
    }));
  }

  getCheckpointByRequestId(sourceRequestId: string): WorkflowCheckpoint | null {
    const stmt = this.db.prepare(`
      SELECT * FROM workflow_checkpoints 
      WHERE source_request_id = ? 
      LIMIT 1
    `);
    const row = stmt.get(sourceRequestId) as any;
    
    if (!row) return null;

    return {
      id: row.id,
      stepId: row.step_id,
      timestamp: new Date(row.timestamp),
      data: JSON.parse(row.data || '{}'),
      notes: row.notes,
      sequence: row.sequence,
      sourceRequestId: row.source_request_id
    };
  }
}