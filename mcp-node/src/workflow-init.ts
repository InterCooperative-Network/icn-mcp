import Database from 'better-sqlite3';
import { workflowEngine } from './workflow-engine.js';
import { SqliteWorkflowDatabase } from './database/sqlite-workflow-db.js';

// Initialize workflow system with database
export async function initializeWorkflowSystem(db: Database.Database): Promise<void> {
  // Set up database connection
  const workflowDb = new SqliteWorkflowDatabase(db);
  workflowEngine.setDatabase(workflowDb);
  
  // Load templates asynchronously
  await workflowEngine.loadTemplates();
  
  console.log('Workflow system initialized successfully');
}

// Re-export for convenience
export { workflowEngine };