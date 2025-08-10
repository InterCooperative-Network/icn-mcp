#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';

/**
 * Strip comments from JSON-like content to validate structure
 */
function stripJsonComments(content) {
  // Remove single-line comments
  content = content.replace(/\/\/.*$/gm, '');
  // Remove multi-line comments
  content = content.replace(/\/\*[\s\S]*?\*\//g, '');
  return content;
}

/**
 * Validate JSON files in the repository
 */
async function validateJson() {
  console.log('🔍 Validating JSON files...');
  
  const jsonFiles = await glob('**/*.json', {
    ignore: ['node_modules/**', 'dist/**', '.git/**']
  });
  
  let hasErrors = false;
  
  for (const file of jsonFiles) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      
      // Handle TypeScript config files that may have comments
      const shouldStripComments = file.includes('tsconfig.json');
      const jsonContent = shouldStripComments ? stripJsonComments(content) : content;
      
      JSON.parse(jsonContent);
      console.log(`✅ ${file}`);
    } catch (error) {
      console.error(`❌ ${file}: ${error.message}`);
      hasErrors = true;
    }
  }
  
  if (hasErrors) {
    console.error('\n❌ JSON validation failed');
    process.exit(1);
  } else {
    console.log('\n✅ All JSON files are valid');
  }
}

validateJson().catch(error => {
  console.error('Error during JSON validation:', error);
  process.exit(1);
});