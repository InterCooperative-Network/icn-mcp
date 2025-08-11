import { KnowledgeGraph } from '../knowledge/graph.js';
import { DocumentIngester } from '../knowledge/ingester.js';
import { Embeddings } from '../knowledge/embeddings.js';

export interface PrincipleExtractionRequest {
  content?: string;
  filePath?: string;
  types?: ('MUST' | 'SHOULD' | 'MAY' | 'invariant' | 'formula' | 'governance')[];
  minConfidence?: number;
}

export interface ExtractedPrincipleResult {
  id: string;
  type: 'MUST' | 'SHOULD' | 'MAY' | 'invariant' | 'formula' | 'governance';
  statement: string;
  context: string;
  confidence: number;
  source: {
    path?: string;
    type: string;
  };
  relatedConcepts: string[];
}

export interface PrincipleExtractionResponse {
  principles: ExtractedPrincipleResult[];
  summary: {
    totalFound: number;
    byType: Record<string, number>;
    avgConfidence: number;
    warnings: string[];
  };
}

let knowledgeGraph: KnowledgeGraph | null = null;
let embeddings: Embeddings | null = null;

function getKnowledgeGraph(): KnowledgeGraph {
  if (!knowledgeGraph) {
    knowledgeGraph = new KnowledgeGraph();
  }
  return knowledgeGraph;
}

function getEmbeddings(): Embeddings {
  if (!embeddings) {
    embeddings = new Embeddings();
  }
  return embeddings;
}

export async function icnExtractPrinciples(request: PrincipleExtractionRequest): Promise<PrincipleExtractionResponse> {
  const kg = getKnowledgeGraph();
  const emb = getEmbeddings();
  
  let principles: ExtractedPrincipleResult[] = [];
  const warnings: string[] = [];
  const byType: Record<string, number> = {};

  try {
    if (request.content) {
      // Extract principles from provided content
      const ingester = new DocumentIngester(kg, emb);
      const metadata = {
        path: request.filePath || 'adhoc-content',
        type: 'markdown' as const,
        lastModified: new Date(),
        version: '1.0',
        hash: generateHash(request.content)
      };

      const extractedPrinciples = await (ingester as any).extractPrinciples(request.content, metadata);
      
      for (const principle of extractedPrinciples) {
        if (!request.types || request.types.includes(principle.type as any)) {
          if (!request.minConfidence || principle.confidence >= request.minConfidence) {
            // Get related concepts for this principle
            const relatedConcepts = await getRelatedConcepts(principle.statement, kg);
            
            principles.push({
              id: principle.id,
              type: principle.type as any,
              statement: principle.statement,
              context: principle.context,
              confidence: principle.confidence,
              source: {
                path: principle.source.path,
                type: principle.source.type
              },
              relatedConcepts
            });

            byType[principle.type] = (byType[principle.type] || 0) + 1;
          }
        }
      }
    } else {
      // Search existing principles in knowledge graph
      const searchTypes = request.types || ['MUST', 'SHOULD', 'MAY', 'invariant', 'formula', 'governance'];
      
      for (const type of searchTypes) {
        const storedPrinciples = await kg.searchPrinciples(undefined, type, 100);
        
        for (const stored of storedPrinciples) {
          if (!request.minConfidence || stored.confidence >= request.minConfidence) {
            const relatedConcepts = await getRelatedConcepts(stored.statement, kg);
            
            principles.push({
              id: stored.id,
              type: stored.type as any,
              statement: stored.statement,
              context: stored.context,
              confidence: stored.confidence,
              source: {
                path: stored.source_path,
                type: 'stored'
              },
              relatedConcepts
            });

            byType[stored.type] = (byType[stored.type] || 0) + 1;
          }
        }
      }
    }

    // Sort by confidence descending
    principles.sort((a, b) => b.confidence - a.confidence);

    // Add warnings for potential issues
    if (principles.length === 0) {
      warnings.push('No principles found matching the specified criteria');
    }

    const lowConfidencePrinciples = principles.filter(p => p.confidence < 0.7).length;
    if (lowConfidencePrinciples > 0) {
      warnings.push(`${lowConfidencePrinciples} principles have low confidence scores (< 0.7)`);
    }

    // Check for conflicting principles
    const conflicts = findConflictingPrinciples(principles);
    if (conflicts.length > 0) {
      warnings.push(`Found ${conflicts.length} potential conflicting principles`);
    }

    const avgConfidence = principles.length > 0 
      ? principles.reduce((sum, p) => sum + p.confidence, 0) / principles.length 
      : 0;

    return {
      principles,
      summary: {
        totalFound: principles.length,
        byType,
        avgConfidence,
        warnings
      }
    };

  } catch (error) {
    console.error('Error extracting principles:', error);
    warnings.push(`Error during extraction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    return {
      principles: [],
      summary: {
        totalFound: 0,
        byType: {},
        avgConfidence: 0,
        warnings
      }
    };
  }
}

/**
 * Get concepts related to a principle statement
 */
async function getRelatedConcepts(statement: string, kg: KnowledgeGraph): Promise<string[]> {
  try {
    // Extract key terms from the statement
    const words = statement.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .slice(0, 5); // Limit to top 5 key words

    const relatedConcepts: string[] = [];

    for (const word of words) {
      const related = await kg.getRelatedConcepts(word, 3);
      relatedConcepts.push(...related.map(r => r.concept));
    }

    // Remove duplicates and return unique concepts
    return [...new Set(relatedConcepts)];
  } catch (error) {
    console.error('Error getting related concepts:', error);
    return [];
  }
}

/**
 * Find potentially conflicting principles
 */
function findConflictingPrinciples(principles: ExtractedPrincipleResult[]): {principle1: string, principle2: string, reason: string}[] {
  const conflicts: {principle1: string, principle2: string, reason: string}[] = [];
  
  for (let i = 0; i < principles.length; i++) {
    for (let j = i + 1; j < principles.length; j++) {
      const p1 = principles[i];
      const p2 = principles[j];
      
      // Check for direct contradictions
      if (containsContradiction(p1.statement, p2.statement)) {
        conflicts.push({
          principle1: p1.id,
          principle2: p2.id,
          reason: 'Direct contradiction detected'
        });
      }
      
      // Check for MUST vs SHOULD/MAY conflicts
      if (p1.type === 'MUST' && (p2.type === 'SHOULD' || p2.type === 'MAY')) {
        if (semanticOverlap(p1.statement, p2.statement)) {
          conflicts.push({
            principle1: p1.id,
            principle2: p2.id,
            reason: 'MUST requirement conflicts with optional/recommended practice'
          });
        }
      }
    }
  }
  
  return conflicts;
}

/**
 * Check if two statements contain contradictory terms
 */
function containsContradiction(statement1: string, statement2: string): boolean {
  const contradictions = [
    ['must', 'must not'],
    ['should', 'should not'],
    ['required', 'forbidden'],
    ['allowed', 'prohibited'],
    ['enabled', 'disabled'],
    ['true', 'false']
  ];
  
  const s1Lower = statement1.toLowerCase();
  const s2Lower = statement2.toLowerCase();
  
  for (const [positive, negative] of contradictions) {
    if ((s1Lower.includes(positive) && s2Lower.includes(negative)) ||
        (s1Lower.includes(negative) && s2Lower.includes(positive))) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if two statements have semantic overlap
 */
function semanticOverlap(statement1: string, statement2: string): boolean {
  const words1 = new Set(statement1.toLowerCase().split(/\W+/).filter(w => w.length > 3));
  const words2 = new Set(statement2.toLowerCase().split(/\W+/).filter(w => w.length > 3));
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  // If more than 30% of words overlap, consider it semantic overlap
  return intersection.size / union.size > 0.3;
}

/**
 * Generate a simple hash for content
 */
function generateHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}