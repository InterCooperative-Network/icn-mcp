import fs from 'node:fs';
import path from 'node:path';
import { DOCS_ROOT } from '../config.js';

export interface ArchitectureSection {
  title: string;
  path: string;
  content: string;
}

export interface ArchitectureResponse {
  sections: ArchitectureSection[];
}

export async function icnGetArchitecture(task?: string): Promise<ArchitectureResponse> {
  const sections: ArchitectureSection[] = [];
  
  const architectureDocs = path.join(DOCS_ROOT, 'architecture');
  const protocolDocs = path.join(DOCS_ROOT, 'protocols');
  
  // Read architecture docs
  try {
    const archFiles = fs.readdirSync(architectureDocs).filter(f => f.endsWith('.md'));
    for (const file of archFiles) {
      const filePath = path.join(architectureDocs, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const title = file.replace('.md', '').replace(/^\d+-/, '');
      
      // If task is specified, filter content for relevance
      if (!task || isRelevantToTask(content, task)) {
        sections.push({
          title: `Architecture: ${title}`,
          path: `docs/architecture/${file}`,
          content: content.trim()
        });
      }
    }
  } catch (err) {
    console.error('Error reading architecture docs:', err);
  }
  
  // Read protocol docs
  try {
    const protocolFiles = fs.readdirSync(protocolDocs).filter(f => f.endsWith('.md'));
    for (const file of protocolFiles) {
      const filePath = path.join(protocolDocs, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const title = file.replace('.md', '').replace(/^\d+-/, '');
      
      // If task is specified, filter content for relevance
      if (!task || isRelevantToTask(content, task)) {
        sections.push({
          title: `Protocol: ${title}`,
          path: `docs/protocols/${file}`,
          content: content.trim()
        });
      }
    }
  } catch (err) {
    console.error('Error reading protocol docs:', err);
  }
  
  return { sections };
}

function isRelevantToTask(content: string, task: string): boolean {
  const taskLower = task.toLowerCase();
  const contentLower = content.toLowerCase();
  
  // Simple keyword matching - could be enhanced with more sophisticated relevance scoring
  const keywords = taskLower.split(/\s+/).filter(word => word.length > 2);
  return keywords.some(keyword => contentLower.includes(keyword));
}