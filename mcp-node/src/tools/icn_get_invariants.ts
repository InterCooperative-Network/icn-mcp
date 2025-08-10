import fs from 'node:fs';
import path from 'node:path';

export interface Invariant {
  id: string;
  statement: string;
  evidence?: string;
  checks?: string[];
}

export interface InvariantsResponse {
  invariants: Invariant[];
}

export async function icnGetInvariants(): Promise<InvariantsResponse> {
  const invariants: Invariant[] = [];
  
  const docsRoot = path.resolve(process.cwd(), '../docs');
  const catalogPath = path.join(docsRoot, 'invariants', 'catalog.md');
  
  try {
    const content = fs.readFileSync(catalogPath, 'utf8');
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Parse invariant lines that start with "-" and contain "INV-"
      if (trimmed.startsWith('-') && trimmed.includes('INV-')) {
        const match = trimmed.match(/^-\s+(INV-[A-Z]+-\d+)\s+(.+)$/);
        if (match) {
          const [, id, statement] = match;
          invariants.push({
            id,
            statement,
            evidence: 'TODO: Formalize assert conditions and evidence.',
            checks: []
          });
        }
      }
    }
  } catch (err) {
    console.error('Error reading invariants catalog:', err);
  }
  
  return { invariants };
}