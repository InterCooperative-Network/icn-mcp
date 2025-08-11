#!/usr/bin/env node

/**
 * Initialize the ICN Knowledge Base
 * 
 * This script scans and ingests all existing ICN documentation into the knowledge graph,
 * making it available for semantic search and contextual guidance.
 */

import { KnowledgeGraph } from './dist/knowledge/graph.js';
import { Embeddings } from './dist/knowledge/embeddings.js';
import { DocumentIngester } from './dist/knowledge/ingester.js';
import { DOCS_ROOT } from './dist/config.js';
import path from 'node:path';
import fs from 'node:fs';

async function initializeKnowledgeBase() {
  console.log('🧠 Initializing ICN Knowledge Base...');
  
  try {
    // Initialize components
    const kg = new KnowledgeGraph();
    const embeddings = new Embeddings();
    const ingester = new DocumentIngester(kg, embeddings);

    // Get initial stats
    const initialStats = await kg.getStats();
    console.log(`📊 Current knowledge base stats:`, initialStats);

    // Scan for documents to ingest
    const docsToIngest = [];
    const scanDirs = [
      DOCS_ROOT,
      path.join(DOCS_ROOT, '..', 'icn-rfcs'),
      path.join(DOCS_ROOT, '..', 'specs'),
      path.join(DOCS_ROOT, '..', 'charter')
    ];

    for (const dir of scanDirs) {
      if (fs.existsSync(dir)) {
        console.log(`📂 Scanning directory: ${dir}`);
        const docs = scanDirectoryForDocs(dir);
        docsToIngest.push(...docs);
        console.log(`   Found ${docs.length} documents`);
      } else {
        console.log(`⚠️  Directory not found: ${dir}`);
      }
    }

    console.log(`📄 Total documents to ingest: ${docsToIngest.length}`);

    if (docsToIngest.length === 0) {
      console.log('ℹ️  No documents found to ingest');
      return;
    }

    // Set up event listeners for progress tracking
    let processedCount = 0;
    let totalPrinciples = 0;
    let totalConcepts = 0;

    ingester.on('documentIngested', (filePath, principleCount, conceptCount) => {
      processedCount++;
      totalPrinciples += principleCount;
      totalConcepts += conceptCount;
      
      const progress = ((processedCount / docsToIngest.length) * 100).toFixed(1);
      console.log(`✅ [${progress}%] ${path.relative(process.cwd(), filePath)} - ${principleCount} principles, ${conceptCount} concepts`);
    });

    ingester.on('error', (error, filePath) => {
      console.error(`❌ Error processing ${filePath}:`, error.message);
    });

    // Ingest all documents
    console.log('\n🔄 Starting document ingestion...');
    for (const docPath of docsToIngest) {
      await ingester.ingestDocument(docPath);
    }

    // Build embeddings vocabulary from ingested documents
    console.log('\n🔍 Building embeddings vocabulary...');
    embeddings.buildVocabulary();
    console.log(`📈 Vocabulary size: ${embeddings.getVocabularySize()} terms`);

    // Get final stats
    const finalStats = await kg.getStats();
    console.log('\n📊 Final knowledge base stats:', finalStats);

    // Show what was ingested
    console.log('\n📋 Ingestion Summary:');
    console.log(`   Documents processed: ${processedCount}`);
    console.log(`   Principles extracted: ${totalPrinciples}`);
    console.log(`   Concepts identified: ${totalConcepts}`);
    console.log(`   Relations mapped: ${finalStats.relations}`);

    // Test the knowledge base with some sample queries
    console.log('\n🧪 Testing knowledge base with sample queries...');
    
    await testKnowledgeBase(kg);

    // Close database connection
    kg.close();

    console.log('\n✨ Knowledge base initialization complete!');
    console.log('🚀 The ICN MCP server is now ready with full knowledge ingestion capabilities.');

  } catch (error) {
    console.error('💥 Failed to initialize knowledge base:', error);
    process.exit(1);
  }
}

/**
 * Recursively scan a directory for documents to ingest
 */
function scanDirectoryForDocs(dirPath) {
  const docs = [];
  
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        docs.push(...scanDirectoryForDocs(fullPath));
      } else if (entry.isFile() && shouldIngestFile(fullPath)) {
        docs.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dirPath}:`, error);
  }
  
  return docs;
}

/**
 * Check if a file should be ingested
 */
function shouldIngestFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath).toLowerCase();
  
  // Include markdown, JSON, and TypeScript files
  if (!['.md', '.json', '.ts', '.js'].includes(ext)) {
    return false;
  }
  
  // Exclude certain files
  const excludePatterns = [
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'node_modules',
    '.git',
    'dist',
    'build',
    'coverage'
  ];
  
  return !excludePatterns.some(pattern => filePath.includes(pattern));
}

/**
 * Test the knowledge base with sample queries
 */
async function testKnowledgeBase(kg) {
  // Test principle search
  const mustPrinciples = await kg.searchPrinciples(undefined, 'MUST', 3);
  console.log(`   MUST principles found: ${mustPrinciples.length}`);
  if (mustPrinciples.length > 0) {
    console.log(`   Example: "${mustPrinciples[0].statement}"`);
  }

  // Test invariants
  const invariants = await kg.searchPrinciples(undefined, 'invariant', 3);
  console.log(`   Invariants found: ${invariants.length}`);
  if (invariants.length > 0) {
    console.log(`   Example: "${invariants[0].statement}"`);
  }

  // Test concept search
  const topConcepts = await kg.getTopConcepts(5);
  console.log(`   Top concepts: ${topConcepts.map(c => c.name).join(', ')}`);

  // Test semantic search
  const governance = await kg.searchPrinciples('governance', undefined, 3);
  console.log(`   Governance-related principles: ${governance.length}`);
}

// Run the initialization if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeKnowledgeBase().catch(error => {
    console.error('Initialization failed:', error);
    process.exit(1);
  });
}

export { initializeKnowledgeBase };