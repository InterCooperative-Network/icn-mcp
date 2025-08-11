import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { DocumentMetadata, ExtractedPrinciple, ConceptRelation } from './ingester.js';

export interface StoredDocument {
  path: string;
  type: string;
  content: string;
  hash: string;
  version: string;
  lastModified: Date;
  embedding?: number[];
}

export interface StoredPrinciple {
  id: string;
  type: string;
  statement: string;
  context: string;
  source_path: string;
  confidence: number;
  weight: number;
}

export interface StoredConcept {
  name: string;
  frequency: number;
  source_paths: string[];
  weight: number;
}

export interface FeedbackRecord {
  id: string;
  principle_id?: string;
  concept_name?: string;
  feedback_type: 'positive' | 'negative' | 'correction';
  feedback_data: string;
  timestamp: Date;
}

export class KnowledgeGraph {
  private db: Database.Database;
  private dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(process.cwd(), 'var', 'knowledge.db');
    
    // Ensure directory exists
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(this.dbPath);
    this.initializeDatabase();
  }

  /**
   * Initialize database schema
   */
  private initializeDatabase(): void {
    // Enable WAL mode for better concurrency
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec('PRAGMA synchronous = NORMAL');
    this.db.exec('PRAGMA cache_size = 1000');
    
    // Disable foreign keys for test environments (can be overridden)
    if (process.env.NODE_ENV === 'test' || this.dbPath.includes('test')) {
      this.db.exec('PRAGMA foreign_keys = OFF');
    } else {
      this.db.exec('PRAGMA foreign_keys = ON');
    }

    // Documents table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        path TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        hash TEXT NOT NULL,
        version TEXT NOT NULL,
        last_modified DATETIME NOT NULL,
        embedding TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Principles table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS principles (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        statement TEXT NOT NULL,
        context TEXT NOT NULL,
        source_path TEXT NOT NULL,
        confidence REAL NOT NULL,
        weight REAL DEFAULT 1.0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (source_path) REFERENCES documents(path) ON DELETE CASCADE
      )
    `);

    // Concepts table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS concepts (
        name TEXT PRIMARY KEY,
        frequency INTEGER DEFAULT 1,
        weight REAL DEFAULT 1.0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Concept-document relationships
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS concept_documents (
        concept_name TEXT NOT NULL,
        document_path TEXT NOT NULL,
        frequency INTEGER DEFAULT 1,
        PRIMARY KEY (concept_name, document_path),
        FOREIGN KEY (concept_name) REFERENCES concepts(name) ON DELETE CASCADE,
        FOREIGN KEY (document_path) REFERENCES documents(path) ON DELETE CASCADE
      )
    `);

    // Relations table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS relations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_concept TEXT NOT NULL,
        to_concept TEXT NOT NULL,
        type TEXT NOT NULL,
        weight REAL NOT NULL,
        source_path TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (from_concept) REFERENCES concepts(name) ON DELETE CASCADE,
        FOREIGN KEY (to_concept) REFERENCES concepts(name) ON DELETE CASCADE,
        FOREIGN KEY (source_path) REFERENCES documents(path) ON DELETE CASCADE
      )
    `);

    // Feedback table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS feedback (
        id TEXT PRIMARY KEY,
        principle_id TEXT,
        concept_name TEXT,
        feedback_type TEXT NOT NULL,
        feedback_data TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (principle_id) REFERENCES principles(id) ON DELETE CASCADE,
        FOREIGN KEY (concept_name) REFERENCES concepts(name) ON DELETE CASCADE
      )
    `);

    // Create indexes for better query performance
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_principles_type ON principles(type)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_principles_source ON principles(source_path)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_concepts_weight ON concepts(weight DESC)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_relations_from ON relations(from_concept)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_relations_to ON relations(to_concept)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_feedback_type ON feedback(feedback_type)');
  }

  /**
   * Store or update a document in the knowledge graph
   */
  async storeDocument(metadata: DocumentMetadata, content: string, embedding?: number[]): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO documents 
      (path, type, content, hash, version, last_modified, embedding, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    const embeddingJson = embedding ? JSON.stringify(embedding) : null;
    stmt.run(
      metadata.path,
      metadata.type,
      content,
      metadata.hash,
      metadata.version,
      metadata.lastModified.toISOString(),
      embeddingJson
    );
  }

  /**
   * Get a document by path
   */
  async getDocument(path: string): Promise<StoredDocument | null> {
    const stmt = this.db.prepare('SELECT * FROM documents WHERE path = ?');
    const row = stmt.get(path) as any;
    
    if (!row) return null;

    return {
      path: row.path,
      type: row.type,
      content: row.content,
      hash: row.hash,
      version: row.version,
      lastModified: new Date(row.last_modified),
      embedding: row.embedding ? JSON.parse(row.embedding) : undefined
    };
  }

  /**
   * Remove a document and all related data
   */
  async removeDocument(path: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM documents WHERE path = ?');
    stmt.run(path);
  }

  /**
   * Store principles extracted from documents
   */
  async storePrinciples(principles: ExtractedPrinciple[]): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO principles 
      (id, type, statement, context, source_path, confidence, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    const transaction = this.db.transaction((principles: ExtractedPrinciple[]) => {
      for (const principle of principles) {
        stmt.run(
          principle.id,
          principle.type,
          principle.statement,
          principle.context,
          principle.source.path,
          principle.confidence
        );
      }
    });

    transaction(principles);
  }

  /**
   * Store concepts and update their frequencies
   */
  async storeConcepts(concepts: string[]): Promise<void> {
    if (concepts.length === 0) return;

    const insertStmt = this.db.prepare(`
      INSERT OR IGNORE INTO concepts (name) VALUES (?)
    `);

    const updateStmt = this.db.prepare(`
      UPDATE concepts SET frequency = frequency + 1, updated_at = CURRENT_TIMESTAMP 
      WHERE name = ?
    `);

    const transaction = this.db.transaction((concepts: string[]) => {
      for (const concept of concepts) {
        insertStmt.run(concept);
        updateStmt.run(concept);
      }
    });

    transaction(concepts);
  }

  /**
   * Store relationships between concepts
   */
  async storeRelations(relations: ConceptRelation[]): Promise<void> {
    if (relations.length === 0) return;

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO relations 
      (from_concept, to_concept, type, weight, source_path)
      VALUES (?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction((relations: ConceptRelation[]) => {
      for (const relation of relations) {
        stmt.run(
          relation.from,
          relation.to,
          relation.type,
          relation.weight,
          ''  // source_path - simplified for now
        );
      }
    });

    transaction(relations);
  }

  /**
   * Search for principles by type or content
   */
  async searchPrinciples(query?: string, type?: string, limit: number = 10): Promise<StoredPrinciple[]> {
    let sql = 'SELECT * FROM principles WHERE 1=1';
    const params: any[] = [];

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }

    if (query) {
      sql += ' AND (statement LIKE ? OR context LIKE ?)';
      params.push(`%${query}%`, `%${query}%`);
    }

    sql += ' ORDER BY weight DESC, confidence DESC LIMIT ?';
    params.push(limit);

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => ({
      id: row.id,
      type: row.type,
      statement: row.statement,
      context: row.context,
      source_path: row.source_path,
      confidence: row.confidence,
      weight: row.weight
    }));
  }

  /**
   * Find related concepts for a given concept
   */
  async getRelatedConcepts(conceptName: string, maxResults: number = 10): Promise<{concept: string, weight: number, relation: string}[]> {
    const stmt = this.db.prepare(`
      SELECT to_concept as concept, weight, type as relation 
      FROM relations 
      WHERE from_concept = ?
      UNION ALL
      SELECT from_concept as concept, weight, type as relation 
      FROM relations 
      WHERE to_concept = ?
      ORDER BY weight DESC 
      LIMIT ?
    `);

    const rows = stmt.all(conceptName, conceptName, maxResults) as any[];
    return rows.map(row => ({
      concept: row.concept,
      weight: row.weight,
      relation: row.relation
    }));
  }

  /**
   * Search documents by content similarity using embeddings
   */
  async searchDocumentsByEmbedding(queryEmbedding: number[], limit: number = 5): Promise<{document: StoredDocument, similarity: number}[]> {
    const stmt = this.db.prepare('SELECT * FROM documents WHERE embedding IS NOT NULL');
    const rows = stmt.all() as any[];

    const results: {document: StoredDocument, similarity: number}[] = [];

    for (const row of rows) {
      const embedding = JSON.parse(row.embedding);
      const similarity = this.cosineSimilarity(queryEmbedding, embedding);
      
      results.push({
        document: {
          path: row.path,
          type: row.type,
          content: row.content,
          hash: row.hash,
          version: row.version,
          lastModified: new Date(row.last_modified),
          embedding
        },
        similarity
      });
    }

    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * Get top concepts by weight/frequency
   */
  async getTopConcepts(limit: number = 20): Promise<StoredConcept[]> {
    const stmt = this.db.prepare(`
      SELECT c.name, c.frequency, c.weight,
             GROUP_CONCAT(cd.document_path) as source_paths
      FROM concepts c
      LEFT JOIN concept_documents cd ON c.name = cd.concept_name
      GROUP BY c.name
      ORDER BY c.weight DESC, c.frequency DESC
      LIMIT ?
    `);

    const rows = stmt.all(limit) as any[];
    return rows.map(row => ({
      name: row.name,
      frequency: row.frequency,
      weight: row.weight,
      source_paths: row.source_paths ? row.source_paths.split(',') : []
    }));
  }

  /**
   * Store feedback for learning
   */
  async storeFeedback(id: string, feedbackType: 'positive' | 'negative' | 'correction', 
                     feedbackData: string, principleId?: string, conceptName?: string): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO feedback (id, principle_id, concept_name, feedback_type, feedback_data)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(id, principleId || null, conceptName || null, feedbackType, feedbackData);
  }

  /**
   * Update weights based on feedback
   */
  async updateWeightsFromFeedback(): Promise<void> {
    // Update principle weights based on feedback
    this.db.exec(`
      UPDATE principles 
      SET weight = weight * (
        1 + 0.1 * (
          SELECT COUNT(*) FROM feedback 
          WHERE feedback.principle_id = principles.id 
          AND feedback.feedback_type = 'positive'
        ) - 0.1 * (
          SELECT COUNT(*) FROM feedback 
          WHERE feedback.principle_id = principles.id 
          AND feedback.feedback_type = 'negative'
        )
      )
      WHERE weight > 0
    `);

    // Update concept weights based on feedback
    this.db.exec(`
      UPDATE concepts 
      SET weight = weight * (
        1 + 0.1 * (
          SELECT COUNT(*) FROM feedback 
          WHERE feedback.concept_name = concepts.name 
          AND feedback.feedback_type = 'positive'
        ) - 0.1 * (
          SELECT COUNT(*) FROM feedback 
          WHERE feedback.concept_name = concepts.name 
          AND feedback.feedback_type = 'negative'
        )
      )
      WHERE weight > 0
    `);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    documents: number;
    principles: number;
    concepts: number;
    relations: number;
    feedback: number;
  }> {
    const stats = {
      documents: 0,
      principles: 0,
      concepts: 0,
      relations: 0,
      feedback: 0
    };

    const tables = ['documents', 'principles', 'concepts', 'relations', 'feedback'];
    for (const table of tables) {
      const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM ${table}`);
      const result = stmt.get() as any;
      stats[table as keyof typeof stats] = result.count;
    }

    return stats;
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }
}