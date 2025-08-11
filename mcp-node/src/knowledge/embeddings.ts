import { TfIdf, WordTokenizer, PorterStemmer } from 'natural';

export interface EmbeddingOptions {
  maxFeatures?: number;
  minDocumentFrequency?: number;
  maxDocumentFrequency?: number;
  useStopWords?: boolean;
}

export class Embeddings {
  private tfidf: TfIdf;
  private tokenizer: WordTokenizer;
  private vocabulary: Map<string, number> = new Map();
  private options: Required<EmbeddingOptions>;
  private documents: string[] = [];
  private stopWords: Set<string>;

  constructor(options: EmbeddingOptions = {}) {
    this.options = {
      maxFeatures: options.maxFeatures ?? 1000,
      minDocumentFrequency: options.minDocumentFrequency ?? 1,
      maxDocumentFrequency: options.maxDocumentFrequency ?? 0.95,
      useStopWords: options.useStopWords ?? true
    };

    this.tfidf = new TfIdf();
    this.tokenizer = new WordTokenizer();
    
    // Common English stop words
    this.stopWords = new Set([
      'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
      'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
      'to', 'was', 'will', 'with', 'the', 'this', 'but', 'they', 'have',
      'had', 'what', 'said', 'each', 'which', 'she', 'do', 'how', 'their',
      'if', 'up', 'out', 'many', 'then', 'them', 'these', 'so', 'some',
      'her', 'would', 'make', 'like', 'into', 'him', 'time', 'two', 'more',
      'go', 'no', 'way', 'could', 'my', 'than', 'first', 'been', 'call',
      'who', 'oil', 'sit', 'now', 'find', 'long', 'down', 'day', 'did',
      'get', 'come', 'made', 'may', 'part'
    ]);
  }

  /**
   * Add a document to the corpus for training
   */
  addDocument(content: string): void {
    const processedContent = this.preprocessText(content);
    this.tfidf.addDocument(processedContent);
    this.documents.push(content);
  }

  /**
   * Add multiple documents to the corpus
   */
  addDocuments(documents: string[]): void {
    for (const doc of documents) {
      this.addDocument(doc);
    }
  }

  /**
   * Build vocabulary from the corpus
   */
  buildVocabulary(): void {
    const termFreqs = new Map<string, number>();
    const docFreqs = new Map<string, number>();
    const totalDocs = this.documents.length;

    // Calculate term and document frequencies
    for (let docIndex = 0; docIndex < this.documents.length; docIndex++) {
      const tokens = this.getUniqueTokens(this.documents[docIndex]);
      
      for (const token of tokens) {
        // Update document frequency
        docFreqs.set(token, (docFreqs.get(token) || 0) + 1);
        
        // Update term frequency across all documents
        const tf = this.tfidf.tfidf(token, docIndex);
        termFreqs.set(token, (termFreqs.get(token) || 0) + tf);
      }
    }

    // Filter terms by document frequency
    const validTerms: [string, number][] = [];
    for (const [term, docFreq] of docFreqs.entries()) {
      const docFreqRatio = docFreq / totalDocs;
      
      if (docFreq >= this.options.minDocumentFrequency && 
          docFreqRatio <= this.options.maxDocumentFrequency) {
        validTerms.push([term, termFreqs.get(term) || 0]);
      }
    }

    // Sort by term frequency and take top maxFeatures
    validTerms.sort((a, b) => b[1] - a[1]);
    const topTerms = validTerms.slice(0, this.options.maxFeatures);

    // Build vocabulary mapping
    this.vocabulary.clear();
    topTerms.forEach(([term], index) => {
      this.vocabulary.set(term, index);
    });
  }

  /**
   * Generate embedding vector for a document
   */
  async generateEmbedding(content: string): Promise<number[]> {
    // If vocabulary is empty, this might be the first document
    if (this.vocabulary.size === 0) {
      // For single document, create a simple TF-IDF representation
      return this.generateSimpleEmbedding(content);
    }

    const tokens = this.getTokens(content);
    const embedding = new Array(this.vocabulary.size).fill(0);

    // Calculate TF for the document
    const termCounts = new Map<string, number>();
    for (const token of tokens) {
      termCounts.set(token, (termCounts.get(token) || 0) + 1);
    }

    // Fill embedding vector
    for (const [term, count] of termCounts.entries()) {
      const vocabIndex = this.vocabulary.get(term);
      if (vocabIndex !== undefined) {
        // Simple TF-IDF approximation
        const tf = count / tokens.length;
        const idf = Math.log(this.documents.length / (this.getDocumentFrequency(term) + 1));
        embedding[vocabIndex] = tf * idf;
      }
    }

    // Normalize the vector
    return this.normalizeVector(embedding);
  }

  /**
   * Generate a simple embedding for single documents or when vocabulary is not built
   */
  private generateSimpleEmbedding(content: string): number[] {
    const tokens = this.getTokens(content);
    const termCounts = new Map<string, number>();
    
    for (const token of tokens) {
      termCounts.set(token, (termCounts.get(token) || 0) + 1);
    }

    // Create a fixed-size embedding based on term frequencies
    const maxTerms = Math.min(this.options.maxFeatures, 100);
    const topTerms = Array.from(termCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxTerms);

    const embedding = new Array(maxTerms).fill(0);
    topTerms.forEach(([term, count], index) => {
      embedding[index] = count / tokens.length; // Normalized frequency
    });

    return this.normalizeVector(embedding);
  }

  /**
   * Calculate similarity between two embeddings
   */
  calculateSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      // Handle different vector sizes by padding with zeros
      const maxLength = Math.max(embedding1.length, embedding2.length);
      const padded1 = [...embedding1, ...new Array(maxLength - embedding1.length).fill(0)];
      const padded2 = [...embedding2, ...new Array(maxLength - embedding2.length).fill(0)];
      return this.cosineSimilarity(padded1, padded2);
    }
    
    return this.cosineSimilarity(embedding1, embedding2);
  }

  /**
   * Find most similar documents to a query
   */
  async findSimilarDocuments(query: string, documentEmbeddings: {content: string, embedding: number[]}[], 
                           limit: number = 5): Promise<{content: string, similarity: number}[]> {
    const queryEmbedding = await this.generateEmbedding(query);
    
    const similarities = documentEmbeddings.map(doc => ({
      content: doc.content,
      similarity: this.calculateSimilarity(queryEmbedding, doc.embedding)
    }));

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * Preprocess text for tokenization
   */
  private preprocessText(text: string): string {
    // Remove markdown formatting
    let processed = text
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/`[^`]*`/g, '') // Remove inline code
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // Convert links to text
      .replace(/[#*_~]/g, '') // Remove markdown symbols
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    return processed;
  }

  /**
   * Get tokens from text
   */
  private getTokens(text: string): string[] {
    const processed = this.preprocessText(text);
    let tokens = this.tokenizer.tokenize(processed) || [];
    
    // Apply stemming
    tokens = tokens.map(token => PorterStemmer.stem(token));
    
    // Remove stop words if enabled
    if (this.options.useStopWords) {
      tokens = tokens.filter(token => !this.stopWords.has(token));
    }
    
    // Filter out very short tokens
    tokens = tokens.filter(token => token.length > 2);
    
    return tokens;
  }

  /**
   * Get unique tokens from text
   */
  private getUniqueTokens(text: string): Set<string> {
    return new Set(this.getTokens(text));
  }

  /**
   * Get document frequency for a term
   */
  private getDocumentFrequency(term: string): number {
    let count = 0;
    for (const doc of this.documents) {
      if (this.getUniqueTokens(doc).has(term)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Normalize a vector to unit length
   */
  private normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0) return vector;
    return vector.map(val => val / magnitude);
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
   * Get current vocabulary size
   */
  getVocabularySize(): number {
    return this.vocabulary.size;
  }

  /**
   * Get vocabulary terms
   */
  getVocabulary(): string[] {
    return Array.from(this.vocabulary.keys());
  }

  /**
   * Clear the corpus and vocabulary
   */
  clear(): void {
    this.tfidf = new TfIdf();
    this.vocabulary.clear();
    this.documents = [];
  }
}