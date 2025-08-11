import { KnowledgeGraph } from '../knowledge/graph.js';
import { Embeddings } from '../knowledge/embeddings.js';

export interface ContextBuildRequest {
  query: string;
  maxResults?: number;
  includeExamples?: boolean;
  includeWarnings?: boolean;
  focusAreas?: ('principles' | 'concepts' | 'relations' | 'examples')[];
}

export interface ContextualGuidance {
  relevantPrinciples: {
    id: string;
    type: string;
    statement: string;
    confidence: number;
    relevanceScore: number;
  }[];
  relatedConcepts: {
    name: string;
    weight: number;
    relations: string[];
    relevanceScore: number;
  }[];
  examples: {
    source: string;
    excerpt: string;
    relevanceScore: number;
  }[];
  warnings: {
    type: 'conflict' | 'uncertainty' | 'incomplete';
    message: string;
    affectedPrinciples?: string[];
  }[];
  recommendations: string[];
}

export interface ContextBuildResponse {
  query: string;
  guidance: ContextualGuidance;
  metadata: {
    searchTime: number;
    totalDocuments: number;
    totalPrinciples: number;
    totalConcepts: number;
    confidenceScore: number;
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

export async function icnBuildContext(request: ContextBuildRequest): Promise<ContextBuildResponse> {
  const startTime = Date.now();
  const kg = getKnowledgeGraph();
  const emb = getEmbeddings();
  
  const maxResults = request.maxResults || 10;
  const focusAreas = request.focusAreas || ['principles', 'concepts', 'relations', 'examples'];
  
  try {
    // Generate query embedding for semantic search
    const queryEmbedding = await emb.generateEmbedding(request.query);
    
    // Initialize guidance structure
    const guidance: ContextualGuidance = {
      relevantPrinciples: [],
      relatedConcepts: [],
      examples: [],
      warnings: [],
      recommendations: []
    };

    // Search for relevant principles
    if (focusAreas.includes('principles')) {
      const principles = await kg.searchPrinciples(request.query, undefined, maxResults * 2);
      
      for (const principle of principles) {
        const relevanceScore = calculateTextRelevance(request.query, principle.statement + ' ' + principle.context);
        
        if (relevanceScore > 0.1) {
          guidance.relevantPrinciples.push({
            id: principle.id,
            type: principle.type,
            statement: principle.statement,
            confidence: principle.confidence,
            relevanceScore
          });
        }
      }
      
      // Sort by relevance and limit results
      guidance.relevantPrinciples.sort((a, b) => b.relevanceScore - a.relevanceScore);
      guidance.relevantPrinciples = guidance.relevantPrinciples.slice(0, maxResults);
    }

    // Search for related concepts
    if (focusAreas.includes('concepts')) {
      const queryTerms = extractKeyTerms(request.query);
      const conceptsMap = new Map<string, {weight: number, relations: string[], relevanceScore: number}>();
      
      for (const term of queryTerms) {
        const relatedConcepts = await kg.getRelatedConcepts(term, 5);
        
        for (const related of relatedConcepts) {
          const existing = conceptsMap.get(related.concept);
          const relevanceScore = calculateTermRelevance(term, related.concept);
          
          if (existing) {
            existing.weight = Math.max(existing.weight, related.weight);
            existing.relations.push(related.relation);
            existing.relevanceScore = Math.max(existing.relevanceScore, relevanceScore);
          } else {
            conceptsMap.set(related.concept, {
              weight: related.weight,
              relations: [related.relation],
              relevanceScore
            });
          }
        }
      }
      
      // Convert to array and sort by relevance
      guidance.relatedConcepts = Array.from(conceptsMap.entries())
        .map(([name, data]) => ({
          name,
          weight: data.weight,
          relations: [...new Set(data.relations)],
          relevanceScore: data.relevanceScore
        }))
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, maxResults);
    }

    // Search for examples from documents
    if (focusAreas.includes('examples') && request.includeExamples) {
      const similarDocs = await kg.searchDocumentsByEmbedding(queryEmbedding, 5);
      
      for (const {document, similarity} of similarDocs) {
        if (similarity > 0.3) {
          const excerpt = extractRelevantExcerpt(document.content, request.query);
          
          guidance.examples.push({
            source: document.path,
            excerpt,
            relevanceScore: similarity
          });
        }
      }
    }

    // Generate warnings if requested
    if (request.includeWarnings) {
      guidance.warnings = await generateWarnings(request.query, guidance, kg);
    }

    // Generate recommendations
    guidance.recommendations = generateRecommendations(request.query, guidance);

    // Get metadata
    const stats = await kg.getStats();
    const confidenceScore = calculateOverallConfidence(guidance);
    
    return {
      query: request.query,
      guidance,
      metadata: {
        searchTime: Date.now() - startTime,
        totalDocuments: stats.documents,
        totalPrinciples: stats.principles,
        totalConcepts: stats.concepts,
        confidenceScore
      }
    };

  } catch (error) {
    console.error('Error building context:', error);
    
    return {
      query: request.query,
      guidance: {
        relevantPrinciples: [],
        relatedConcepts: [],
        examples: [],
        warnings: [{
          type: 'uncertainty',
          message: `Error building context: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        recommendations: ['Consider rephrasing your query or checking the knowledge base status']
      },
      metadata: {
        searchTime: Date.now() - startTime,
        totalDocuments: 0,
        totalPrinciples: 0,
        totalConcepts: 0,
        confidenceScore: 0
      }
    };
  }
}

/**
 * Extract key terms from a query
 */
function extractKeyTerms(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(term => term.length > 2)
    .filter(term => !isStopWord(term))
    .slice(0, 10); // Limit to top 10 terms
}

/**
 * Check if a word is a stop word
 */
function isStopWord(word: string): boolean {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'from', 'as', 'is', 'was', 'are', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
    'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'must',
    'this', 'that', 'these', 'those', 'it', 'they', 'them', 'their', 'we', 'us', 'our',
    'you', 'your', 'he', 'him', 'his', 'she', 'her', 'hers', 'how', 'what', 'when', 'where',
    'why', 'which', 'who', 'whom', 'whose'
  ]);
  return stopWords.has(word.toLowerCase());
}

/**
 * Calculate relevance between query and text
 */
function calculateTextRelevance(query: string, text: string): number {
  const queryTerms = new Set(extractKeyTerms(query));
  const textTerms = new Set(extractKeyTerms(text));
  
  const intersection = new Set([...queryTerms].filter(term => textTerms.has(term)));
  const union = new Set([...queryTerms, ...textTerms]);
  
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

/**
 * Calculate relevance between two terms
 */
function calculateTermRelevance(term1: string, term2: string): number {
  // Simple edit distance based relevance
  const distance = levenshteinDistance(term1.toLowerCase(), term2.toLowerCase());
  const maxLength = Math.max(term1.length, term2.length);
  
  if (maxLength === 0) return 0;
  return 1 - (distance / maxLength);
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i += 1) {
    matrix[0][i] = i;
  }
  
  for (let j = 0; j <= str2.length; j += 1) {
    matrix[j][0] = j;
  }
  
  for (let j = 1; j <= str2.length; j += 1) {
    for (let i = 1; i <= str1.length; i += 1) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Extract relevant excerpt from document content
 */
function extractRelevantExcerpt(content: string, query: string, maxLength: number = 200): string {
  // Note: extractKeyTerms(query) reserved for future weighting logic
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  let bestSentence = '';
  let bestScore = 0;
  
  for (const sentence of sentences) {
    const score = calculateTextRelevance(query, sentence);
    if (score > bestScore) {
      bestScore = score;
      bestSentence = sentence.trim();
    }
  }
  
  if (bestSentence.length > maxLength) {
    bestSentence = bestSentence.substring(0, maxLength) + '...';
  }
  
  return bestSentence || content.substring(0, maxLength) + '...';
}

/**
 * Generate warnings based on the context and query
 */
async function generateWarnings(query: string, guidance: ContextualGuidance, _kg: KnowledgeGraph): Promise<ContextualGuidance['warnings']> {
  const warnings: ContextualGuidance['warnings'] = [];
  
  // Check for conflicting principles
  const conflictingPrinciples = findConflictingPrinciples(guidance.relevantPrinciples);
  if (conflictingPrinciples.length > 0) {
    warnings.push({
      type: 'conflict',
      message: 'Found conflicting principles in the results',
      affectedPrinciples: conflictingPrinciples
    });
  }
  
  // Check for low confidence
  const lowConfidencePrinciples = guidance.relevantPrinciples.filter(p => p.confidence < 0.7);
  if (lowConfidencePrinciples.length > 0) {
    warnings.push({
      type: 'uncertainty',
      message: `${lowConfidencePrinciples.length} principles have low confidence scores`,
      affectedPrinciples: lowConfidencePrinciples.map(p => p.id)
    });
  }
  
  // Check for incomplete information
  if (guidance.relevantPrinciples.length === 0 && guidance.relatedConcepts.length === 0) {
    warnings.push({
      type: 'incomplete',
      message: 'No relevant principles or concepts found. The knowledge base may be incomplete for this query.'
    });
  }
  
  return warnings;
}

/**
 * Find conflicting principles in the guidance
 */
function findConflictingPrinciples(principles: ContextualGuidance['relevantPrinciples']): string[] {
  const conflicts: string[] = [];
  
  for (let i = 0; i < principles.length; i++) {
    for (let j = i + 1; j < principles.length; j++) {
      const p1 = principles[i];
      const p2 = principles[j];
      
      // Check for MUST vs other types on similar topics
      if (p1.type === 'MUST' && p2.type !== 'MUST') {
        if (calculateTextRelevance(p1.statement, p2.statement) > 0.5) {
          conflicts.push(p1.id, p2.id);
        }
      }
    }
  }
  
  return [...new Set(conflicts)];
}

/**
 * Generate recommendations based on the context
 */
function generateRecommendations(query: string, guidance: ContextualGuidance): string[] {
  const recommendations: string[] = [];
  
  // Recommendations based on principles
  const mustPrinciples = guidance.relevantPrinciples.filter(p => p.type === 'MUST');
  if (mustPrinciples.length > 0) {
    recommendations.push(`Pay special attention to ${mustPrinciples.length} MUST requirements that apply to your query`);
  }
  
  const shouldPrinciples = guidance.relevantPrinciples.filter(p => p.type === 'SHOULD');
  if (shouldPrinciples.length > 0) {
    recommendations.push(`Consider ${shouldPrinciples.length} SHOULD recommendations for best practices`);
  }
  
  // Recommendations based on concepts
  const highWeightConcepts = guidance.relatedConcepts.filter(c => c.weight > 0.8);
  if (highWeightConcepts.length > 0) {
    recommendations.push(`Focus on key concepts: ${highWeightConcepts.map(c => c.name).slice(0, 3).join(', ')}`);
  }
  
  // Recommendations based on examples
  if (guidance.examples.length > 0) {
    recommendations.push(`Review ${guidance.examples.length} relevant examples for implementation guidance`);
  }
  
  // Default recommendation if nothing specific found
  if (recommendations.length === 0) {
    recommendations.push('Consider refining your query or exploring related concepts to get more specific guidance');
  }
  
  return recommendations;
}

/**
 * Calculate overall confidence score for the guidance
 */
function calculateOverallConfidence(guidance: ContextualGuidance): number {
  let totalScore = 0;
  let totalWeight = 0;
  
  // Weight by principle confidence and relevance
  for (const principle of guidance.relevantPrinciples) {
    const weight = principle.relevanceScore;
    totalScore += principle.confidence * weight;
    totalWeight += weight;
  }
  
  // Weight by concept relevance
  for (const concept of guidance.relatedConcepts) {
    const weight = concept.relevanceScore * 0.5; // Lower weight than principles
    totalScore += concept.weight * weight;
    totalWeight += weight;
  }
  
  // Weight by example relevance
  for (const example of guidance.examples) {
    const weight = example.relevanceScore * 0.3; // Lower weight than concepts
    totalScore += example.relevanceScore * weight;
    totalWeight += weight;
  }
  
  return totalWeight > 0 ? totalScore / totalWeight : 0;
}