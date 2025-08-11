import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { DOCS_ROOT } from '../config.js';
import { KnowledgeGraph } from './graph.js';
import { Embeddings } from './embeddings.js';

export interface DocumentMetadata {
  path: string;
  type: 'markdown' | 'json' | 'typescript';
  lastModified: Date;
  version: string;
  hash: string;
}

export interface ExtractedPrinciple {
  id: string;
  type: 'MUST' | 'SHOULD' | 'MAY' | 'invariant' | 'formula' | 'governance';
  statement: string;
  context: string;
  source: DocumentMetadata;
  confidence: number;
}

export interface ConceptRelation {
  from: string;
  to: string;
  type: 'references' | 'depends_on' | 'implements' | 'contradicts';
  weight: number;
}

export class DocumentIngester extends EventEmitter {
  private knowledgeGraph: KnowledgeGraph;
  private embeddings: Embeddings;
  private watchers: Map<string, fs.FSWatcher> = new Map();
  private watchDirectories: string[];

  constructor(knowledgeGraph: KnowledgeGraph, embeddings: Embeddings) {
    super();
    this.knowledgeGraph = knowledgeGraph;
    this.embeddings = embeddings;
    this.watchDirectories = [
      path.join(DOCS_ROOT),
      path.join(DOCS_ROOT, '..', 'specs'),
      path.join(DOCS_ROOT, '..', 'rfcs'),
      path.join(DOCS_ROOT, '..', 'charter'),
      path.join(DOCS_ROOT, '..', 'icn-rfcs')
    ];
  }

  /**
   * Start watching directories for changes and perform initial ingestion
   */
  async startWatching(): Promise<void> {
    // Perform initial ingestion
    await this.ingestAllDocuments();

    // Set up file watchers
    for (const dir of this.watchDirectories) {
      if (fs.existsSync(dir)) {
        await this.watchDirectory(dir);
      }
    }

    this.emit('started');
  }

  /**
   * Stop watching directories and clean up resources
   */
  async stopWatching(): Promise<void> {
    for (const [, watcher] of this.watchers) {
      watcher.close();
    }
    this.watchers.clear();
    this.emit('stopped');
  }

  /**
   * Ingest all documents in watch directories
   */
  private async ingestAllDocuments(): Promise<void> {
    for (const dir of this.watchDirectories) {
      if (fs.existsSync(dir)) {
        await this.ingestDirectory(dir);
      }
    }
  }

  /**
   * Recursively ingest all documents in a directory
   */
  private async ingestDirectory(dir: string): Promise<void> {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        await this.ingestDirectory(fullPath);
      } else if (entry.isFile() && this.shouldIngestFile(fullPath)) {
        await this.ingestDocument(fullPath);
      }
    }
  }

  /**
   * Set up file watcher for a directory
   */
  private async watchDirectory(dir: string): Promise<void> {
    const watcher = fs.watch(dir, { recursive: true }, async (eventType, filename) => {
      if (!filename) return;

      const fullPath = path.join(dir, filename);
      
      if (eventType === 'change' || eventType === 'rename') {
        if (fs.existsSync(fullPath) && this.shouldIngestFile(fullPath)) {
          await this.ingestDocument(fullPath);
          this.emit('documentUpdated', fullPath);
        } else {
          // File was deleted
          await this.knowledgeGraph.removeDocument(fullPath);
          this.emit('documentRemoved', fullPath);
        }
      }
    });

    this.watchers.set(dir, watcher);
  }

  /**
   * Check if a file should be ingested based on its extension
   */
  private shouldIngestFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ['.md', '.json', '.ts', '.js'].includes(ext);
  }

  /**
   * Ingest a single document
   */
  async ingestDocument(filePath: string): Promise<void> {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const stat = fs.statSync(filePath);
      
      const metadata: DocumentMetadata = {
        path: filePath,
        type: this.getDocumentType(filePath),
        lastModified: stat.mtime,
        version: this.generateVersion(content, stat.mtime),
        hash: this.generateHash(content)
      };

      // Check if document has changed
      const existingDoc = await this.knowledgeGraph.getDocument(filePath);
      if (existingDoc && existingDoc.hash === metadata.hash) {
        return; // No changes
      }

      // Extract principles and concepts
      const principles = await this.extractPrinciples(content, metadata);
      const concepts = await this.extractConcepts(content, metadata);
      const relations = await this.extractRelations(content, concepts, metadata);

      // Generate embeddings for semantic search
      const embedding = await this.embeddings.generateEmbedding(content);

      // Store in knowledge graph
      await this.knowledgeGraph.storeDocument(metadata, content, embedding);
      await this.knowledgeGraph.storePrinciples(principles);
      await this.knowledgeGraph.storeConcepts(concepts);
      await this.knowledgeGraph.storeRelations(relations);

      this.emit('documentIngested', filePath, principles.length, concepts.length);
    } catch (error) {
      console.error(`Error ingesting document ${filePath}:`, error);
      this.emit('error', error, filePath);
    }
  }

  /**
   * Extract principles from document content
   */
  async extractPrinciples(content: string, metadata: DocumentMetadata): Promise<ExtractedPrinciple[]> {
    const principles: ExtractedPrinciple[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const context = this.getContext(lines, i, 2);

      // Extract MUST/SHOULD/MAY requirements
      const rfcMatch = line.match(/(MUST|SHOULD|MAY|MUST NOT|SHOULD NOT)\s+(.+)/i);
      if (rfcMatch) {
        principles.push({
          id: this.generatePrincipleId(rfcMatch[2], metadata),
          type: rfcMatch[1].toUpperCase().replace(' NOT', '_NOT') as any,
          statement: rfcMatch[2].trim(),
          context,
          source: metadata,
          confidence: 0.9
        });
      }

      // Extract invariants
      const invariantMatch = line.match(/(?:invariant|immutable)[:,]?\s*(.+)/i);
      if (invariantMatch) {
        principles.push({
          id: this.generatePrincipleId(invariantMatch[1], metadata),
          type: 'invariant',
          statement: invariantMatch[1].trim(),
          context,
          source: metadata,
          confidence: 0.95
        });
      }

      // Extract formulas and economic relationships
      const formulaMatch = line.match(/(?:formula|equation|calculation)[:,]?\s*(.+)/i);
      if (formulaMatch || line.includes('=') && line.includes('$')) {
        principles.push({
          id: this.generatePrincipleId(line.trim(), metadata),
          type: 'formula',
          statement: line.trim(),
          context,
          source: metadata,
          confidence: 0.8
        });
      }

      // Extract governance rules
      const govMatch = line.match(/(?:voting|threshold|quorum|governance)[:,]?\s*(.+)/i);
      if (govMatch) {
        principles.push({
          id: this.generatePrincipleId(govMatch[1], metadata),
          type: 'governance',
          statement: govMatch[1].trim(),
          context,
          source: metadata,
          confidence: 0.85
        });
      }
    }

    return principles;
  }

  /**
   * Extract concepts from document content
   */
  private async extractConcepts(content: string, _metadata: DocumentMetadata): Promise<string[]> {
    const concepts: string[] = [];
    
    // Extract headings as concepts
    const headingMatches = content.match(/^#{1,6}\s+(.+)$/gm);
    if (headingMatches) {
      concepts.push(...headingMatches.map(h => h.replace(/^#+\s+/, '').trim()));
    }

    // Extract terms defined in bold or code blocks
    const boldMatches = content.match(/\*\*([^*]+)\*\*/g);
    if (boldMatches) {
      concepts.push(...boldMatches.map(b => b.replace(/\*\*/g, '').trim()));
    }

    const codeMatches = content.match(/`([^`]+)`/g);
    if (codeMatches) {
      concepts.push(...codeMatches.map(c => c.replace(/`/g, '').trim()));
    }

    // Remove duplicates and filter out common words
    return [...new Set(concepts)]
      .filter(concept => concept.length > 2 && !this.isCommonWord(concept));
  }

  /**
   * Extract relationships between concepts
   */
  private async extractRelations(content: string, concepts: string[], _metadata: DocumentMetadata): Promise<ConceptRelation[]> {
    const relations: ConceptRelation[] = [];
    
    // Simple co-occurrence based relationship extraction
    for (const concept1 of concepts) {
      for (const concept2 of concepts) {
        if (concept1 !== concept2) {
          const regex1 = new RegExp(concept1.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
          const regex2 = new RegExp(concept2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
          
          const matches1 = (content.match(regex1) || []).length;
          const matches2 = (content.match(regex2) || []).length;
          
          if (matches1 > 0 && matches2 > 0) {
            // Calculate weight based on proximity and frequency
            const weight = Math.min(matches1, matches2) / Math.max(matches1, matches2);
            
            if (weight > 0.1) {
              relations.push({
                from: concept1,
                to: concept2,
                type: 'references',
                weight
              });
            }
          }
        }
      }
    }

    return relations;
  }

  /**
   * Get surrounding context for a line
   */
  private getContext(lines: string[], index: number, radius: number): string {
    const start = Math.max(0, index - radius);
    const end = Math.min(lines.length, index + radius + 1);
    return lines.slice(start, end).join('\n');
  }

  /**
   * Generate a unique ID for a principle
   */
  private generatePrincipleId(statement: string, metadata: DocumentMetadata): string {
    const hash = this.generateHash(statement + metadata.path);
    return `principle-${hash.slice(0, 8)}`;
  }

  /**
   * Generate document version based on content and timestamp
   */
  private generateVersion(content: string, mtime: Date): string {
    const hash = this.generateHash(content);
    const timestamp = mtime.getTime();
    return `${timestamp}-${hash.slice(0, 8)}`;
  }

  /**
   * Generate hash for content
   */
  private generateHash(content: string): string {
    // Simple hash implementation
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get document type based on file extension
   */
  private getDocumentType(filePath: string): DocumentMetadata['type'] {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.md':
        return 'markdown';
      case '.json':
        return 'json';
      case '.ts':
      case '.js':
        return 'typescript';
      default:
        return 'markdown';
    }
  }

  /**
   * Check if a word is too common to be a useful concept
   */
  private isCommonWord(word: string): boolean {
    const commonWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'from', 'as', 'is', 'was', 'are', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
      'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'must',
      'this', 'that', 'these', 'those', 'it', 'they', 'them', 'their', 'we', 'us', 'our',
      'you', 'your', 'he', 'him', 'his', 'she', 'her', 'hers'
    ]);
    return commonWords.has(word.toLowerCase());
  }
}