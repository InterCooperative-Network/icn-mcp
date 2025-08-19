#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';

/**
 * Strip comments from JSON-like content to validate structure
 * More careful approach to avoid removing content inside strings
 */
function stripJsonComments(content) {
  // This is a simple approach that handles basic TypeScript config files
  // For more complex cases, we'd need a proper JSON-with-comments parser
  
  // Remove single-line comments that are not inside strings
  const lines = content.split('\n');
  const processedLines = lines.map(line => {
    // Find // that's not inside a string
    let inString = false;
    let escape = false;
    for (let i = 0; i < line.length - 1; i++) {
      if (escape) {
        escape = false;
        continue;
      }
      if (line[i] === '\\') {
        escape = true;
        continue;
      }
      if (line[i] === '"') {
        inString = !inString;
        continue;
      }
      if (!inString && line[i] === '/' && line[i + 1] === '/') {
        return line.substring(0, i);
      }
    }
    return line;
  });
  
  return processedLines.join('\n');
}

/**
 * Validate JSON files in the repository
 */
async function validateJson() {
  console.log('🔍 Validating JSON files recursively across all workspaces...');
  
  const jsonFiles = await glob('**/*.json', {
    ignore: ['node_modules/**', 'dist/**', '.git/**']
  });
  
  console.log(`📊 Found ${jsonFiles.length} JSON files to validate`);
  
  let hasErrors = false;
  let workspaceCount = {};
  
  for (const file of jsonFiles) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      
      // Handle TypeScript config files that may have comments
      const shouldStripComments = file.includes('tsconfig.json');
      const jsonContent = shouldStripComments ? stripJsonComments(content) : content;
      
      JSON.parse(jsonContent);
      console.log(`✅ ${file}`);
      
      // Track workspace coverage
      const workspace = file.split('/')[0] || 'root';
      workspaceCount[workspace] = (workspaceCount[workspace] || 0) + 1;
      
    } catch (error) {
      console.error(`❌ ${file}: ${error.message}`);
      hasErrors = true;
    }
  }
  
  console.log('\n📈 Workspace coverage:');
  Object.entries(workspaceCount).forEach(([workspace, count]) => {
    console.log(`  ${workspace}: ${count} files`);
  });
  
  if (hasErrors) {
    console.error('\n❌ JSON validation failed');
    process.exit(1);
  } else {
    console.log('\n✅ All JSON files are valid across all workspaces');
  }
}

validateJson().catch(error => {
  console.error('Error during JSON validation:', error);
  process.exit(1);
});