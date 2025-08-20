#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';

/**
 * Strip comments from JSON-like content to validate structure
 */
function stripJsonComments(content) {
  // Remove single-line comments (but not URLs)
  content = content.replace(/(?<!:)\/\/.*$/gm, '');
  // Remove multi-line comments (but be careful about strings containing /*)
  // Only match /* that are not inside strings
  let result = '';
  let inString = false;
  let inComment = false;
  let escape = false;
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];
    
    if (escape) {
      escape = false;
      if (!inComment) result += char;
      continue;
    }
    
    if (char === '\\' && inString) {
      escape = true;
      if (!inComment) result += char;
      continue;
    }
    
    if (char === '"' && !inComment) {
      inString = !inString;
      result += char;
      continue;
    }
    
    if (!inString) {
      if (char === '/' && nextChar === '*' && !inComment) {
        inComment = true;
        i++; // skip the *
        continue;
      }
      
      if (char === '*' && nextChar === '/' && inComment) {
        inComment = false;
        i++; // skip the /
        continue;
      }
    }
    
    if (!inComment) {
      result += char;
    }
  }
  
  return result;
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