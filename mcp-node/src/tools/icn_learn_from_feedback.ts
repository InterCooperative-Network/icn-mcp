import { nanoid } from 'nanoid';
import { KnowledgeGraph } from '../knowledge/graph.js';

export interface FeedbackRequest {
  type: 'success' | 'failure' | 'correction' | 'improvement';
  context: {
    query?: string;
    principleIds?: string[];
    conceptNames?: string[];
    taskDescription?: string;
  };
  feedback: {
    whatWorked?: string[];
    whatFailed?: string[];
    corrections?: {
      principleId?: string;
      conceptName?: string;
      originalValue: string;
      correctedValue: string;
      reason: string;
    }[];
    suggestions?: string[];
    confidenceAdjustment?: {
      principleId?: string;
      conceptName?: string;
      newConfidence: number;
      reason: string;
    }[];
  };
  metadata?: {
    source: string;
    timestamp?: Date;
    userId?: string;
  };
}

export interface LearningUpdate {
  principleUpdates: {
    id: string;
    oldWeight: number;
    newWeight: number;
    reason: string;
  }[];
  conceptUpdates: {
    name: string;
    oldWeight: number;
    newWeight: number;
    reason: string;
  }[];
  newPatterns: {
    pattern: string;
    confidence: number;
    examples: string[];
  }[];
  improvedRelations: {
    from: string;
    to: string;
    oldWeight: number;
    newWeight: number;
  }[];
}

export interface FeedbackResponse {
  feedbackId: string;
  processed: {
    principles: number;
    concepts: number;
    patterns: number;
    relations: number;
  };
  learning: LearningUpdate;
  recommendations: string[];
  status: 'success' | 'partial' | 'error';
  message: string;
}

let knowledgeGraph: KnowledgeGraph | null = null;

function getKnowledgeGraph(): KnowledgeGraph {
  if (!knowledgeGraph) {
    knowledgeGraph = new KnowledgeGraph();
  }
  return knowledgeGraph;
}

export async function icnLearnFromFeedback(request: FeedbackRequest): Promise<FeedbackResponse> {
  const kg = getKnowledgeGraph();
  const feedbackId = nanoid();
  
  const learning: LearningUpdate = {
    principleUpdates: [],
    conceptUpdates: [],
    newPatterns: [],
    improvedRelations: []
  };
  
  const recommendations: string[] = [];
  let processed = { principles: 0, concepts: 0, patterns: 0, relations: 0 };
  
  try {
    // Store the feedback record
    await kg.storeFeedback(
      feedbackId,
      mapFeedbackType(request.type),
      JSON.stringify({
        context: request.context,
        feedback: request.feedback,
        metadata: request.metadata
      }),
      request.context.principleIds?.[0],
      request.context.conceptNames?.[0]
    );

    // Process based on feedback type
    switch (request.type) {
      case 'success':
        await processSuccessFeedback(request, learning, kg);
        break;
      case 'failure':
        await processFailureFeedback(request, learning, kg);
        break;
      case 'correction':
        await processCorrectionFeedback(request, learning, kg);
        break;
      case 'improvement':
        await processImprovementFeedback(request, learning, kg);
        break;
    }

    // Apply confidence adjustments
    if (request.feedback.confidenceAdjustment) {
      for (const adjustment of request.feedback.confidenceAdjustment) {
        if (adjustment.principleId) {
          await adjustPrincipleWeight(adjustment.principleId, adjustment.newConfidence, adjustment.reason, kg);
          learning.principleUpdates.push({
            id: adjustment.principleId,
            oldWeight: 1.0, // Would need to fetch actual old weight
            newWeight: adjustment.newConfidence,
            reason: adjustment.reason
          });
        }
        if (adjustment.conceptName) {
          await adjustConceptWeight(adjustment.conceptName, adjustment.newConfidence, adjustment.reason, kg);
          learning.conceptUpdates.push({
            name: adjustment.conceptName,
            oldWeight: 1.0, // Would need to fetch actual old weight
            newWeight: adjustment.newConfidence,
            reason: adjustment.reason
          });
        }
      }
    }

    // Process corrections
    if (request.feedback.corrections) {
      for (const correction of request.feedback.corrections) {
        await processCorrection(correction, learning, kg);
        processed.principles += correction.principleId ? 1 : 0;
        processed.concepts += correction.conceptName ? 1 : 0;
      }
    }

    // Identify new patterns from successful feedback
    if (request.type === 'success' && request.feedback.whatWorked) {
      const newPatterns = await identifySuccessPatterns(request.feedback.whatWorked, kg);
      learning.newPatterns.push(...newPatterns);
      processed.patterns += newPatterns.length;
    }

    // Update weights based on accumulated feedback
    await kg.updateWeightsFromFeedback();

    // Generate recommendations
    recommendations.push(...await generateLearningRecommendations(request, learning, kg));

    // Count processed items
    processed.principles += learning.principleUpdates.length;
    processed.concepts += learning.conceptUpdates.length;
    processed.relations += learning.improvedRelations.length;

    return {
      feedbackId,
      processed,
      learning,
      recommendations,
      status: 'success',
      message: `Feedback processed successfully. Updated ${processed.principles} principles, ${processed.concepts} concepts, and identified ${processed.patterns} new patterns.`
    };

  } catch (error) {
    console.error('Error processing feedback:', error);
    return {
      feedbackId,
      processed,
      learning,
      recommendations: ['Error processing feedback. Please try again or contact support.'],
      status: 'error',
      message: `Error processing feedback: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Process success feedback to reinforce positive patterns
 */
async function processSuccessFeedback(request: FeedbackRequest, learning: LearningUpdate, kg: KnowledgeGraph): Promise<void> {
  // Boost weights of involved principles and concepts
  if (request.context.principleIds) {
    for (const principleId of request.context.principleIds) {
      await boostPrincipleWeight(principleId, 0.1, 'Success feedback', kg);
      learning.principleUpdates.push({
        id: principleId,
        oldWeight: 1.0, // Simplified
        newWeight: 1.1,
        reason: 'Positive feedback - successful application'
      });
    }
  }

  if (request.context.conceptNames) {
    for (const conceptName of request.context.conceptNames) {
      await boostConceptWeight(conceptName, 0.1, 'Success feedback', kg);
      learning.conceptUpdates.push({
        name: conceptName,
        oldWeight: 1.0, // Simplified
        newWeight: 1.1,
        reason: 'Positive feedback - successful application'
      });
    }
  }

  // Strengthen relationships between concepts that worked well together
  if (request.context.conceptNames && request.context.conceptNames.length > 1) {
    for (let i = 0; i < request.context.conceptNames.length; i++) {
      for (let j = i + 1; j < request.context.conceptNames.length; j++) {
        learning.improvedRelations.push({
          from: request.context.conceptNames[i],
          to: request.context.conceptNames[j],
          oldWeight: 0.5, // Simplified
          newWeight: 0.6,
        });
      }
    }
  }
}

/**
 * Process failure feedback to reduce weights and identify problems
 */
async function processFailureFeedback(request: FeedbackRequest, learning: LearningUpdate, kg: KnowledgeGraph): Promise<void> {
  // Reduce weights of involved principles and concepts
  if (request.context.principleIds) {
    for (const principleId of request.context.principleIds) {
      await reducePrincipleWeight(principleId, 0.1, 'Failure feedback', kg);
      learning.principleUpdates.push({
        id: principleId,
        oldWeight: 1.0, // Simplified
        newWeight: 0.9,
        reason: 'Negative feedback - failed application'
      });
    }
  }

  if (request.context.conceptNames) {
    for (const conceptName of request.context.conceptNames) {
      await reduceConceptWeight(conceptName, 0.1, 'Failure feedback', kg);
      learning.conceptUpdates.push({
        name: conceptName,
        oldWeight: 1.0, // Simplified
        newWeight: 0.9,
        reason: 'Negative feedback - failed application'
      });
    }
  }
}

/**
 * Process correction feedback to update knowledge
 */
async function processCorrectionFeedback(request: FeedbackRequest, learning: LearningUpdate, kg: KnowledgeGraph): Promise<void> {
  if (!request.feedback.corrections) return;

  for (const correction of request.feedback.corrections) {
    await processCorrection(correction, learning, kg);
  }
}

/**
 * Process improvement feedback to enhance knowledge
 */
async function processImprovementFeedback(request: FeedbackRequest, learning: LearningUpdate, kg: KnowledgeGraph): Promise<void> {
  if (request.feedback.suggestions) {
    for (const suggestion of request.feedback.suggestions) {
      const patterns = await extractPatternsFromSuggestion(suggestion);
      learning.newPatterns.push(...patterns);
    }
  }
}

/**
 * Process a single correction
 */
async function processCorrection(
  correction: NonNullable<FeedbackRequest['feedback']['corrections']>[0],
  learning: LearningUpdate,
  kg: KnowledgeGraph
): Promise<void> {
  // Note: In a real implementation, we would update the actual principle/concept
  // For now, we'll just record the correction intent
  
  if (correction.principleId) {
    learning.principleUpdates.push({
      id: correction.principleId,
      oldWeight: 1.0,
      newWeight: 0.8, // Reduce weight until corrected
      reason: `Correction needed: ${correction.reason}`
    });
  }

  if (correction.conceptName) {
    learning.conceptUpdates.push({
      name: correction.conceptName,
      oldWeight: 1.0,
      newWeight: 0.8, // Reduce weight until corrected
      reason: `Correction needed: ${correction.reason}`
    });
  }
}

/**
 * Identify success patterns from what worked
 */
async function identifySuccessPatterns(whatWorked: string[], kg: KnowledgeGraph): Promise<LearningUpdate['newPatterns']> {
  const patterns: LearningUpdate['newPatterns'] = [];

  for (const item of whatWorked) {
    // Extract pattern from successful approach
    const pattern = extractPattern(item);
    if (pattern) {
      patterns.push({
        pattern: pattern.description,
        confidence: pattern.confidence,
        examples: [item]
      });
    }
  }

  return patterns;
}

/**
 * Extract patterns from improvement suggestions
 */
async function extractPatternsFromSuggestion(suggestion: string): Promise<LearningUpdate['newPatterns']> {
  const patterns: LearningUpdate['newPatterns'] = [];
  
  // Simple pattern extraction - in reality this would be more sophisticated
  if (suggestion.toLowerCase().includes('always') || suggestion.toLowerCase().includes('should')) {
    patterns.push({
      pattern: `Best practice: ${suggestion}`,
      confidence: 0.7,
      examples: [suggestion]
    });
  }

  return patterns;
}

/**
 * Extract a pattern from a successful approach
 */
function extractPattern(approach: string): {description: string, confidence: number} | null {
  // Simple pattern extraction - would be more sophisticated in practice
  if (approach.length < 10) return null;

  return {
    description: `Successful approach pattern: ${approach.substring(0, 100)}...`,
    confidence: 0.8
  };
}

/**
 * Boost principle weight
 */
async function boostPrincipleWeight(principleId: string, boost: number, reason: string, kg: KnowledgeGraph): Promise<void> {
  // In a real implementation, we would update the database
  // For now, we'll just record the intent
  await kg.storeFeedback(nanoid(), 'positive', `Weight boost: ${boost} - ${reason}`, principleId, undefined);
}

/**
 * Reduce principle weight
 */
async function reducePrincipleWeight(principleId: string, reduction: number, reason: string, kg: KnowledgeGraph): Promise<void> {
  // In a real implementation, we would update the database
  // For now, we'll just record the intent
  await kg.storeFeedback(nanoid(), 'negative', `Weight reduction: ${reduction} - ${reason}`, principleId, undefined);
}

/**
 * Boost concept weight
 */
async function boostConceptWeight(conceptName: string, boost: number, reason: string, kg: KnowledgeGraph): Promise<void> {
  // In a real implementation, we would update the database
  // For now, we'll just record the intent
  await kg.storeFeedback(nanoid(), 'positive', `Weight boost: ${boost} - ${reason}`, undefined, conceptName);
}

/**
 * Reduce concept weight
 */
async function reduceConceptWeight(conceptName: string, reduction: number, reason: string, kg: KnowledgeGraph): Promise<void> {
  // In a real implementation, we would update the database
  // For now, we'll just record the intent
  await kg.storeFeedback(nanoid(), 'negative', `Weight reduction: ${reduction} - ${reason}`, undefined, conceptName);
}

/**
 * Adjust principle weight to specific value
 */
async function adjustPrincipleWeight(principleId: string, newWeight: number, reason: string, kg: KnowledgeGraph): Promise<void> {
  // In a real implementation, we would update the database directly
  // For now, we'll store as feedback
  await kg.storeFeedback(nanoid(), 'correction', `Weight adjustment to ${newWeight} - ${reason}`, principleId, undefined);
}

/**
 * Adjust concept weight to specific value
 */
async function adjustConceptWeight(conceptName: string, newWeight: number, reason: string, kg: KnowledgeGraph): Promise<void> {
  // In a real implementation, we would update the database directly
  // For now, we'll store as feedback
  await kg.storeFeedback(nanoid(), 'correction', `Weight adjustment to ${newWeight} - ${reason}`, undefined, conceptName);
}

/**
 * Generate learning recommendations based on feedback
 */
async function generateLearningRecommendations(
  request: FeedbackRequest,
  learning: LearningUpdate,
  kg: KnowledgeGraph
): Promise<string[]> {
  const recommendations: string[] = [];

  // Recommendations based on feedback type
  switch (request.type) {
    case 'success':
      recommendations.push('Continue applying the successful patterns identified');
      if (learning.newPatterns.length > 0) {
        recommendations.push(`${learning.newPatterns.length} new success patterns have been identified and can be reused`);
      }
      break;

    case 'failure':
      recommendations.push('Review the failed approaches and consider alternative strategies');
      if (learning.principleUpdates.length > 0) {
        recommendations.push(`${learning.principleUpdates.length} principles have reduced confidence - consider reviewing their applicability`);
      }
      break;

    case 'correction':
      recommendations.push('The corrections have been noted and will improve future guidance');
      recommendations.push('Consider reviewing related principles and concepts for consistency');
      break;

    case 'improvement':
      recommendations.push('Suggestions have been incorporated for future improvements');
      if (learning.newPatterns.length > 0) {
        recommendations.push(`${learning.newPatterns.length} new improvement patterns identified`);
      }
      break;
  }

  // General recommendations
  if (learning.improvedRelations.length > 0) {
    recommendations.push(`${learning.improvedRelations.length} concept relationships have been strengthened`);
  }

  return recommendations;
}

/**
 * Map feedback type to database enum
 */
function mapFeedbackType(type: FeedbackRequest['type']): 'positive' | 'negative' | 'correction' {
  switch (type) {
    case 'success':
    case 'improvement':
      return 'positive';
    case 'failure':
      return 'negative';
    case 'correction':
      return 'correction';
    default:
      return 'positive';
  }
}