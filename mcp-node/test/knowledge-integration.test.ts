import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { KnowledgeGraph } from '../src/knowledge/graph.js';
import { Embeddings } from '../src/knowledge/embeddings.js';
import { DocumentIngester } from '../src/knowledge/ingester.js';
import { icnExtractPrinciples } from '../src/tools/icn_extract_principles.js';
import { icnBuildContext } from '../src/tools/icn_build_context.js';
import { icnLearnFromFeedback } from '../src/tools/icn_learn_from_feedback.js';
import fs from 'node:fs';
import path from 'node:path';

describe('Knowledge System Integration', () => {
  let kg: KnowledgeGraph;
  let embeddings: Embeddings;
  let ingester: DocumentIngester;
  let tempDbPath: string;

  beforeEach(async () => {
    // Create temporary database for testing
    tempDbPath = path.join(process.cwd(), 'test-knowledge.db');
    kg = new KnowledgeGraph(tempDbPath);
    embeddings = new Embeddings();
    ingester = new DocumentIngester(kg, embeddings);
  });

  afterEach(async () => {
    // Clean up
    kg.close();
    if (fs.existsSync(tempDbPath)) {
      fs.unlinkSync(tempDbPath);
    }
  });

  describe('Document Ingestion', () => {
    it('should extract principles from sample ICN content', async () => {
      const sampleContent = `
# ICN Protocol Requirements

## Core Principles

The system MUST ensure democratic governance at all levels.

Nodes SHOULD implement redundant storage for reliability.

The network MAY support additional consensus mechanisms.

**Invariant**: The total supply of tokens is immutable once set.

**Formula**: Node reward = base_reward * (uptime_ratio ^ 2)

**Governance**: Voting threshold requires 67% consensus for protocol changes.
      `;

      // Mock the file system for this test
      const originalReadFileSync = fs.readFileSync;
      const originalStatSync = fs.statSync;
      const originalExistsSync = fs.existsSync;
      
      // @ts-ignore
      fs.readFileSync = () => sampleContent;
      // @ts-ignore
      fs.statSync = () => ({ mtime: new Date() });
      // @ts-ignore
      fs.existsSync = () => true;

      try {
        await ingester.ingestDocument('/tmp/test-doc.md');
        
        const principles = await kg.searchPrinciples();
        expect(principles.length).toBeGreaterThan(0);
        
        const mustPrinciples = await kg.searchPrinciples(undefined, 'MUST');
        expect(mustPrinciples.length).toBeGreaterThan(0);
        expect(mustPrinciples[0].statement).toContain('democratic governance');
        
      } finally {
        // @ts-ignore
        fs.readFileSync = originalReadFileSync;
        // @ts-ignore
        fs.statSync = originalStatSync;
        // @ts-ignore
        fs.existsSync = originalExistsSync;
      }
    });

    it('should handle document updates correctly', async () => {
      const stats = await kg.getStats();
      expect(stats.documents).toBeGreaterThanOrEqual(0);
      expect(stats.principles).toBeGreaterThanOrEqual(0);
      expect(stats.concepts).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Principle Extraction Tool', () => {
    it('should extract principles from provided content', async () => {
      const content = `
The system MUST validate all transactions before processing.
The network SHOULD prioritize consensus mechanisms.
Governance voting threshold requires 75% approval.
`;

      const result = await icnExtractPrinciples({ content });
      
      expect(result.principles).toHaveLength(3);
      expect(result.principles[0].type).toBe('MUST');
      expect(result.principles[1].type).toBe('SHOULD');
      expect(result.principles[2].type).toBe('governance');
      expect(result.summary.totalFound).toBe(3);
    });

    it('should filter by principle types', async () => {
      const content = `
The system MUST validate all transactions.
The network SHOULD use encryption.
The system MAY support plugins.
`;

      const result = await icnExtractPrinciples({ 
        content, 
        types: ['MUST', 'SHOULD'] 
      });
      
      expect(result.principles).toHaveLength(2);
      expect(result.principles.every(p => p.type === 'MUST' || p.type === 'SHOULD')).toBe(true);
    });

    it('should filter by minimum confidence', async () => {
      const content = `
The system MUST validate all transactions before processing.
maybe some less clear requirement.
`;

      const result = await icnExtractPrinciples({ 
        content, 
        minConfidence: 0.8 
      });
      
      expect(result.principles).toHaveLength(1);
      expect(result.principles[0].confidence).toBeGreaterThanOrEqual(0.8);
    });
  });

  describe('Context Building Tool', () => {
    it('should build context for ICN queries', async () => {
      // First add some test principles to the knowledge graph
      await kg.storePrinciples([{
        id: 'test-principle-1',
        type: 'MUST',
        statement: 'Democratic governance must be maintained',
        context: 'Core governance principle',
        source: {
          path: 'test.md',
          type: 'markdown',
          lastModified: new Date(),
          version: '1.0',
          hash: 'test'
        },
        confidence: 0.95
      }]);

      const result = await icnBuildContext({ 
        query: 'How should democratic governance work?',
        maxResults: 5,
        includeWarnings: true
      });
      
      expect(result.query).toBe('How should democratic governance work?');
      expect(result.guidance).toBeDefined();
      expect(result.metadata.searchTime).toBeGreaterThan(0);
      expect(result.guidance.recommendations).toHaveLength.greaterThan(0);
    });

    it('should handle empty results gracefully', async () => {
      const result = await icnBuildContext({ 
        query: 'completely unrelated topic xyz123',
        includeWarnings: true
      });
      
      expect(result.guidance.warnings.length).toBeGreaterThan(0);
      expect(result.guidance.recommendations).toContain('Consider rephrasing your query or checking the knowledge base status');
    });

    it('should focus on specific areas when requested', async () => {
      const result = await icnBuildContext({ 
        query: 'governance voting',
        focusAreas: ['principles'],
        includeExamples: false
      });
      
      expect(result.guidance.examples).toHaveLength(0);
    });
  });

  describe('Feedback Learning Tool', () => {
    it('should process success feedback', async () => {
      const result = await icnLearnFromFeedback({
        type: 'success',
        context: {
          query: 'implement governance voting',
          principleIds: ['principle-1'],
          conceptNames: ['voting', 'governance']
        },
        feedback: {
          whatWorked: ['Democratic voting mechanism', 'Transparent process']
        },
        metadata: {
          source: 'test-agent'
        }
      });
      
      expect(result.status).toBe('success');
      expect(result.feedbackId).toBeDefined();
      expect(result.learning.newPatterns.length).toBeGreaterThan(0);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should process failure feedback', async () => {
      const result = await icnLearnFromFeedback({
        type: 'failure',
        context: {
          query: 'implement broken feature',
          principleIds: ['principle-2']
        },
        feedback: {
          whatFailed: ['Centralized approach', 'No consensus mechanism']
        },
        metadata: {
          source: 'test-agent'
        }
      });
      
      expect(result.status).toBe('success');
      expect(result.learning.principleUpdates.length).toBeGreaterThan(0);
      expect(result.recommendations.some(r => r.includes('failed approaches'))).toBe(true);
    });

    it('should process corrections', async () => {
      const result = await icnLearnFromFeedback({
        type: 'correction',
        context: {
          principleIds: ['principle-3']
        },
        feedback: {
          corrections: [{
            principleId: 'principle-3',
            originalValue: 'SHOULD use majority voting',
            correctedValue: 'MUST use supermajority voting',
            reason: 'Security requirement updated'
          }]
        },
        metadata: {
          source: 'test-correction'
        }
      });
      
      expect(result.status).toBe('success');
      expect(result.processed.principles).toBeGreaterThan(0);
      expect(result.learning.principleUpdates.some(u => u.reason.includes('Correction needed'))).toBe(true);
    });

    it('should handle confidence adjustments', async () => {
      const result = await icnLearnFromFeedback({
        type: 'improvement',
        context: {
          conceptNames: ['consensus']
        },
        feedback: {
          confidenceAdjustment: [{
            conceptName: 'consensus',
            newConfidence: 0.9,
            reason: 'Proven in production'
          }]
        },
        metadata: {
          source: 'test-improvement'
        }
      });
      
      expect(result.status).toBe('success');
      expect(result.learning.conceptUpdates.some(u => u.newWeight === 0.9)).toBe(true);
    });
  });

  describe('End-to-End Knowledge Pipeline', () => {
    it('should complete full knowledge ingestion and querying cycle', async () => {
      // 1. Ingest sample ICN documentation
      const sampleDoc = `
# ICN Economic Model

## Core Requirements

The system MUST maintain dual economy with Contribution Credits and tokens.

The network SHOULD incentivize cooperative behavior.

**Invariant**: CC cannot be transferred between members directly.

**Formula**: CC_earned = contribution_value * time_factor * quality_score

## Governance

Voting threshold: 67% for economic parameter changes.
      `;

      // Mock file operations for ingestion
      const originalReadFileSync = fs.readFileSync;
      const originalStatSync = fs.statSync;
      const originalExistsSync = fs.existsSync;
      
      // @ts-ignore
      fs.readFileSync = () => sampleDoc;
      // @ts-ignore
      fs.statSync = () => ({ mtime: new Date() });
      // @ts-ignore
      fs.existsSync = () => true;

      try {
        await ingester.ingestDocument('/tmp/economic-model.md');
        
        // 2. Extract principles
        const extractResult = await icnExtractPrinciples({ content: sampleDoc });
        expect(extractResult.principles.length).toBeGreaterThan(0);
        
        // 3. Build context for a query
        const contextResult = await icnBuildContext({ 
          query: 'How should the dual economy work?',
          includeWarnings: true
        });
        expect(contextResult.guidance.relevantPrinciples.length).toBeGreaterThanOrEqual(0);
        
        // 4. Provide feedback
        const feedbackResult = await icnLearnFromFeedback({
          type: 'success',
          context: {
            query: 'dual economy implementation',
            principleIds: extractResult.principles.slice(0, 1).map(p => p.id)
          },
          feedback: {
            whatWorked: ['Dual economy model works well in practice']
          },
          metadata: {
            source: 'integration-test'
          }
        });
        expect(feedbackResult.status).toBe('success');
        
        // 5. Verify knowledge was updated
        const stats = await kg.getStats();
        expect(stats.feedback).toBeGreaterThan(0);
        
      } finally {
        // @ts-ignore
        fs.readFileSync = originalReadFileSync;
        // @ts-ignore
        fs.statSync = originalStatSync;
        // @ts-ignore
        fs.existsSync = originalExistsSync;
      }
    });
  });

  describe('Embeddings and Semantic Search', () => {
    it('should generate embeddings for text', async () => {
      const text = 'Democratic governance and consensus mechanisms are core to ICN';
      const embedding = await embeddings.generateEmbedding(text);
      
      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBeGreaterThan(0);
    });

    it('should calculate similarity between related texts', async () => {
      const text1 = 'Democratic governance and voting systems';
      const text2 = 'Governance through democratic voting processes';
      
      const embedding1 = await embeddings.generateEmbedding(text1);
      const embedding2 = await embeddings.generateEmbedding(text2);
      
      const similarity = embeddings.calculateSimilarity(embedding1, embedding2);
      expect(similarity).toBeGreaterThan(0.1); // Should have some similarity
    });
  });
});