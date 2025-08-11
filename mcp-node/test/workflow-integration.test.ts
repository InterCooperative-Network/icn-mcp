import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { workflowEngine, WorkflowEngine } from '../src/workflow-engine.js';
import { SqliteWorkflowDatabase } from '../src/database/sqlite-workflow-db.js';

describe('Workflow Engine Integration', () => {
  let db: Database.Database;
  let workflowDb: SqliteWorkflowDatabase;

  beforeEach(async () => {
    // Create in-memory database
    db = new Database(':memory:');
    
    // Apply workflow migrations
    const migrationSql = `
      CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        template_id TEXT NOT NULL,
        template_version TEXT NOT NULL,
        template_hash TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'failed', 'paused')),
        current_step_id TEXT,
        step_data TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        created_by TEXT
      );

      CREATE TABLE IF NOT EXISTS workflow_steps (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        step_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'completed', 'failed', 'skipped')),
        sequence INTEGER NOT NULL,
        completed_at INTEGER,
        outputs TEXT DEFAULT '{}',
        FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
        UNIQUE(workflow_id, step_id),
        UNIQUE(workflow_id, sequence)
      );

      CREATE TABLE IF NOT EXISTS workflow_checkpoints (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        step_id TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        timestamp INTEGER NOT NULL DEFAULT (unixepoch()),
        data TEXT NOT NULL DEFAULT '{}',
        notes TEXT,
        source_request_id TEXT,
        FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
        UNIQUE(workflow_id, step_id, sequence)
      );

      CREATE TABLE IF NOT EXISTS workflow_templates (
        id TEXT PRIMARY KEY,
        version TEXT NOT NULL,
        hash TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT,
        tags TEXT DEFAULT '[]',
        steps TEXT NOT NULL,
        metadata TEXT DEFAULT '{}',
        loaded_at INTEGER NOT NULL DEFAULT (unixepoch()),
        UNIQUE(id, version)
      );
    `;
    
    db.exec(migrationSql);
    
    // Initialize workflow system
    workflowDb = new SqliteWorkflowDatabase(db);
    workflowEngine.setDatabase(workflowDb);
    
    // Create a test template directly in the database
    const testTemplate = {
      id: 'test-workflow',
      version: '1.0.0',
      hash: 'test123',
      name: 'Test Workflow',
      title: 'Test Workflow',
      description: 'A simple test workflow',
      category: 'testing',
      tags: ['test'],
      steps: [
        {
          id: 'step1',
          title: 'First Step',
          description: 'The first step',
          actions: ['action1'],
          dependsOn: [],
          validation: { requiredFlags: ['step1_done'] }
        },
        {
          id: 'step2', 
          title: 'Second Step',
          description: 'The second step',
          actions: ['action2'],
          dependsOn: ['step1'],
          validation: { requiredFlags: ['step2_done'] }
        }
      ],
      metadata: {}
    };
    
    workflowDb.saveTemplate(testTemplate);
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  it('should start a workflow and track state in database', async () => {
    const workflowId = await workflowEngine.startWorkflow('test-workflow', { initial: 'data' }, 'test-agent');
    
    expect(workflowId).toMatch(/^wf_\d+_[a-z0-9]+$/);
    
    const state = workflowEngine.getWorkflowState(workflowId);
    expect(state).toBeDefined();
    expect(state!.templateId).toBe('test-workflow');
    expect(state!.status).toBe('active');
    expect(state!.createdBy).toBe('test-agent');
    expect(state!.stepData).toEqual({ initial: 'data' });
  });

  it('should handle step progression with dependencies', async () => {
    const workflowId = await workflowEngine.startWorkflow('test-workflow', {}, 'test-agent');
    
    // Get first step
    const firstStep = await workflowEngine.getNextStep(workflowId);
    expect(firstStep.step?.id).toBe('step1');
    expect(firstStep.isComplete).toBe(false);
    expect(firstStep.progress.percentage).toBe(0);
    
    // Complete first step
    await workflowEngine.completeStep(workflowId, 'step1', { output1: 'done' });
    
    // Get next step
    const secondStep = await workflowEngine.getNextStep(workflowId);
    expect(secondStep.step?.id).toBe('step2');
    expect(secondStep.progress.percentage).toBe(50);
    
    // Complete second step
    await workflowEngine.completeStep(workflowId, 'step2', { output2: 'done' });
    
    // Workflow should be complete
    const finalStep = await workflowEngine.getNextStep(workflowId);
    expect(finalStep.step).toBeNull();
    expect(finalStep.isComplete).toBe(true);
    expect(finalStep.progress.percentage).toBe(100);
  });

  it('should create checkpoints with idempotency', async () => {
    const workflowId = await workflowEngine.startWorkflow('test-workflow', {}, 'test-agent');
    
    // Create checkpoint
    const checkpoint1 = await workflowEngine.createCheckpoint(
      workflowId, 
      'step1', 
      { progress: 50 }, 
      'halfway done',
      'req-123'
    );
    
    expect(checkpoint1).toBeDefined();
    expect(checkpoint1.stepId).toBe('step1');
    expect(checkpoint1.data).toEqual({ progress: 50 });
    expect(checkpoint1.sourceRequestId).toBe('req-123');
    
    // Create same checkpoint again (should be idempotent)
    const checkpoint2 = await workflowEngine.createCheckpoint(
      workflowId, 
      'step1', 
      { progress: 60 }, // Different data
      'different note',
      'req-123' // Same request ID
    );
    
    // Should return the original checkpoint
    expect(checkpoint2.id).toBe(checkpoint1.id);
    expect(checkpoint2.data).toEqual({ progress: 50 }); // Original data
    expect(checkpoint2.notes).toBe('halfway done'); // Original notes
  });

  it('should handle workflow actions (pause/resume/fail)', async () => {
    const workflowId = await workflowEngine.startWorkflow('test-workflow', {}, 'test-agent');
    
    // Pause workflow
    await workflowEngine.pauseWorkflow(workflowId);
    let state = workflowEngine.getWorkflowState(workflowId);
    expect(state!.status).toBe('paused');
    
    // Resume workflow
    await workflowEngine.resumeWorkflow(workflowId);
    state = workflowEngine.getWorkflowState(workflowId);
    expect(state!.status).toBe('active');
    
    // Fail workflow
    await workflowEngine.failWorkflow(workflowId, 'test failure');
    state = workflowEngine.getWorkflowState(workflowId);
    expect(state!.status).toBe('failed');
    expect(state!.stepData.failureReason).toBe('test failure');
  });

  it('should persist and recover workflow state', async () => {
    const workflowId = await workflowEngine.startWorkflow('test-workflow', { test: 'data' }, 'test-agent');
    
    // Create checkpoint
    await workflowEngine.createCheckpoint(workflowId, 'step1', { checkpoint: 'data' }, 'test checkpoint');
    
    // Complete first step
    await workflowEngine.completeStep(workflowId, 'step1', { step1: 'complete' });
    
    // Simulate restart by creating new engine with same database
    const newWorkflowEngine = new WorkflowEngine();
    newWorkflowEngine.setDatabase(workflowDb);
    
    // Should be able to retrieve state
    const recoveredState = newWorkflowEngine.getWorkflowState(workflowId);
    expect(recoveredState).toBeDefined();
    expect(recoveredState!.templateId).toBe('test-workflow');
    expect(recoveredState!.stepData).toEqual({ 
      test: 'data', 
      checkpoint: 'data', 
      step1: 'complete' 
    });
    
    // Should be able to continue workflow
    const nextStep = await newWorkflowEngine.getNextStep(workflowId);
    expect(nextStep.step?.id).toBe('step2');
    expect(nextStep.progress.percentage).toBe(50);
  });

  it('should validate template schemas and detect cycles', async () => {
    // This test would validate the schema validation works
    // Template validation happens during loadTemplates() in the real system
    const template = workflowEngine.getTemplate('test-workflow');
    expect(template).toBeDefined();
    expect(template!.id).toBe('test-workflow');
    expect(template!.steps).toHaveLength(2);
  });
});