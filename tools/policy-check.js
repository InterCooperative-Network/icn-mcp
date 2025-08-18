#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

/**
 * Parse git diff output to extract changed file paths
 */
function parseGitDiff(diffOutput) {
  const lines = diffOutput.split('\n');
  const changedPaths = new Set();
  
  for (const line of lines) {
    // Match diff --git a/path b/path
    const gitMatch = line.match(/^diff --git a\/(.+) b\/(.+)$/);
    if (gitMatch) {
      changedPaths.add(gitMatch[2]); // Use the 'b' path (destination)
      continue;
    }
    
    // Match +++ b/path
    const addMatch = line.match(/^\+\+\+ b\/(.+)$/);
    if (addMatch && addMatch[1] !== '/dev/null') {
      changedPaths.add(addMatch[1]);
      continue;
    }
    
    // Match --- a/path 
    const deleteMatch = line.match(/^--- a\/(.+)$/);
    if (deleteMatch && deleteMatch[1] !== '/dev/null') {
      changedPaths.add(deleteMatch[1]);
      continue;
    }
  }
  
  return Array.from(changedPaths);
}

/**
 * Parse unified diff format to extract changed file paths
 */
function parseUnifiedDiff(diffContent) {
  const lines = diffContent.split('\n');
  const changedPaths = new Set();
  
  for (const line of lines) {
    // Match --- a/path or --- path
    const sourceMatch = line.match(/^--- (?:a\/)?(.+)$/);
    if (sourceMatch && !sourceMatch[1].includes('/dev/null')) {
      changedPaths.add(sourceMatch[1]);
      continue;
    }
    
    // Match +++ b/path or +++ path
    const targetMatch = line.match(/^\+\+\+ (?:b\/)?(.+)$/);
    if (targetMatch && !targetMatch[1].includes('/dev/null')) {
      changedPaths.add(targetMatch[1]);
      continue;
    }
    
    // Match Index: path (SVN style)
    const indexMatch = line.match(/^Index: (.+)$/);
    if (indexMatch) {
      changedPaths.add(indexMatch[1]);
      continue;
    }
  }
  
  return Array.from(changedPaths);
}

/**
 * Read policy rules from the configuration file
 */
function readPolicyRules() {
  const policyPath = path.resolve(process.cwd(), 'mcp-server/policy.rules.json');
  try {
    const data = fs.readFileSync(policyPath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`❌ Failed to read policy rules from ${policyPath}:`, err.message);
    process.exit(1);
  }
}

/**
 * Read CODEOWNERS file for ownership validation
 */
function readCodeowners() {
  const codeownersPath = path.resolve(process.cwd(), 'CODEOWNERS');
  const codeowners = new Map();
  
  try {
    const data = fs.readFileSync(codeownersPath, 'utf8');
    const lines = data.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      const parts = trimmed.split(/\s+/);
      if (parts.length < 2) continue;
      
      const pattern = parts[0];
      const owners = parts.slice(1).map(owner => owner.replace('@', ''));
      codeowners.set(pattern, owners);
    }
  } catch (err) {
    // CODEOWNERS file is optional
  }
  
  return codeowners;
}

/**
 * Simple glob matching for path patterns
 */
function matchGlob(glob, filePath) {
  // Convert glob pattern to regex
  let regex = glob
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]');
  
  regex = `^${regex}$`;
  return new RegExp(regex).test(filePath);
}

/**
 * Check policy for the given actor and changed paths
 */
function checkPolicy(actor, changedPaths, rules, codeowners) {
  const reasons = [];
  
  // Normalize paths by removing leading slashes
  const normalizedPaths = changedPaths.map(p => p.replace(/^\/+/, ''));
  
  // Path capabilities enforcement
  if (rules.path_caps && rules.path_caps[actor]) {
    const caps = rules.path_caps[actor];
    for (const path of normalizedPaths) {
      const allowed = caps.some(pattern => matchGlob(pattern, path));
      if (!allowed) {
        reasons.push(`path ${path} not allowed for actor ${actor}`);
      }
    }
  } else if (rules.path_caps) {
    // Actor not found in path_caps means no permissions
    for (const path of normalizedPaths) {
      reasons.push(`path ${path} not allowed for actor ${actor} (actor not in path_caps)`);
    }
  }
  
  // CODEOWNERS integration (only if enabled)
  if (rules.codeowners_integration && codeowners.size > 0) {
    for (const path of normalizedPaths) {
      for (const [pattern, owners] of codeowners.entries()) {
        if (matchGlob(pattern, path)) {
          if (!owners.includes(actor) && !owners.includes('*')) {
            reasons.push(`CODEOWNERS: ${path} requires approval from ${owners.join(', ')}, not ${actor}`);
          }
          break; // Use first matching pattern
        }
      }
    }
  }
  
  // Reviews required enforcement
  if (rules.reviews_required) {
    for (const rule of rules.reviews_required) {
      const affectedPaths = normalizedPaths.filter(path =>
        rule.paths.some(pattern => matchGlob(pattern, path))
      );
      if (affectedPaths.length > 0) {
        if (!rule.reviewers.includes(actor)) {
          reasons.push(`review required: paths ${affectedPaths.join(', ')} require approval from ${rule.reviewers.join(', ')}`);
        }
      }
    }
  }
  
  return { allow: reasons.length === 0, reasons };
}

/**
 * Get git diff output
 */
function getGitDiff(ref = 'HEAD') {
  return new Promise((resolve, reject) => {
    const git = spawn('git', ['diff', '--name-only', ref], { 
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: process.cwd()
    });
    
    let output = '';
    let error = '';
    
    git.stdout.on('data', data => output += data.toString());
    git.stderr.on('data', data => error += data.toString());
    
    git.on('close', code => {
      if (code !== 0) {
        reject(new Error(`git diff failed: ${error}`));
      } else {
        resolve(output.trim().split('\n').filter(line => line.length > 0));
      }
    });
  });
}

/**
 * Display usage information
 */
function showUsage() {
  console.log(`
Usage: node tools/policy-check.js [options]

Options:
  --actor <name>      Actor/agent name to check (required)
  --diff <file>       Path to diff file (use - for stdin)
  --git [ref]         Check git diff against ref (default: HEAD)
  --paths <paths>     Comma-separated list of file paths to check
  --help              Show this help message

Examples:
  # Check current git working directory changes
  node tools/policy-check.js --actor architect --git

  # Check git diff against main branch
  node tools/policy-check.js --actor planner --git main

  # Check specific paths
  node tools/policy-check.js --actor ops --paths "ci/deploy.yml,tools/build.sh"

  # Check diff from file
  git diff > changes.diff
  node tools/policy-check.js --actor reviewer --diff changes.diff

  # Check diff from stdin
  git diff | node tools/policy-check.js --actor architect --diff -
`);
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  let actor = null;
  let diffFile = null;
  let gitRef = null;
  let useGit = false;
  let paths = null;
  
  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--actor':
        actor = args[++i];
        break;
      case '--diff':
        diffFile = args[++i];
        break;
      case '--git':
        useGit = true;
        gitRef = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : 'HEAD';
        break;
      case '--paths':
        paths = args[++i].split(',').map(p => p.trim());
        break;
      case '--help':
        showUsage();
        process.exit(0);
        break;
      default:
        console.error(`❌ Unknown option: ${args[i]}`);
        showUsage();
        process.exit(1);
    }
  }
  
  if (!actor) {
    console.error('❌ --actor is required');
    showUsage();
    process.exit(1);
  }
  
  let changedPaths = [];
  
  try {
    if (paths) {
      changedPaths = paths;
    } else if (useGit) {
      console.log(`🔍 Checking git diff against ${gitRef}...`);
      changedPaths = await getGitDiff(gitRef);
      if (changedPaths.length === 0) {
        console.log('✅ No changes detected');
        process.exit(0);
      }
    } else if (diffFile) {
      console.log(`🔍 Reading diff from ${diffFile === '-' ? 'stdin' : diffFile}...`);
      let diffContent;
      
      if (diffFile === '-') {
        // Read from stdin
        diffContent = await new Promise((resolve, reject) => {
          let input = '';
          process.stdin.setEncoding('utf8');
          process.stdin.on('data', chunk => input += chunk);
          process.stdin.on('end', () => resolve(input));
          process.stdin.on('error', reject);
        });
      } else {
        diffContent = fs.readFileSync(diffFile, 'utf8');
      }
      
      // Try both git diff and unified diff formats
      changedPaths = parseGitDiff(diffContent);
      if (changedPaths.length === 0) {
        changedPaths = parseUnifiedDiff(diffContent);
      }
      
      if (changedPaths.length === 0) {
        console.log('✅ No file changes detected in diff');
        process.exit(0);
      }
    } else {
      console.error('❌ Must specify one of: --git, --diff, or --paths');
      showUsage();
      process.exit(1);
    }
    
    console.log(`📁 Found ${changedPaths.length} changed file(s):`);
    changedPaths.forEach(path => console.log(`   ${path}`));
    
    // Load policy rules and CODEOWNERS
    const rules = readPolicyRules();
    const codeowners = readCodeowners();
    
    console.log(`\n🔐 Checking policy for actor: ${actor}`);
    
    // Check policy
    const decision = checkPolicy(actor, changedPaths, rules, codeowners);
    
    if (decision.allow) {
      console.log('✅ Policy check passed - all changes are authorized');
      process.exit(0);
    } else {
      console.log('❌ Policy check failed - unauthorized changes detected:');
      decision.reasons.forEach(reason => console.log(`   • ${reason}`));
      
      console.log('\n💡 Suggestions:');
      const suggestions = [];
      
      for (const reason of decision.reasons) {
        if (reason.includes('path') && reason.includes('not allowed')) {
          suggestions.push('Consider requesting permission or modifying files within your authorized paths');
        } else if (reason.includes('CODEOWNERS')) {
          suggestions.push('Request review from the appropriate code owners before proceeding');
        } else if (reason.includes('review required')) {
          suggestions.push('Ensure required reviewers have approved the changes');
        }
      }
      
      if (suggestions.length === 0) {
        suggestions.push('Review the policy violations and adjust the changeset accordingly');
      }
      
      // Remove duplicates
      const uniqueSuggestions = [...new Set(suggestions)];
      uniqueSuggestions.forEach(suggestion => console.log(`   • ${suggestion}`));
      
      process.exit(1);
    }
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// Run main function
main().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});