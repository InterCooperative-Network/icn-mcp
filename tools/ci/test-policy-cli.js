#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Run the policy check CLI and return the result
 */
function runPolicyCheck(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['tools/policy-check.js', ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd()
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', data => stdout += data.toString());
    child.stderr.on('data', data => stderr += data.toString());
    
    child.on('close', code => {
      resolve({ code, stdout, stderr });
    });
    
    child.on('error', reject);
  });
}

/**
 * Test the policy CLI tool
 */
async function testPolicyCli() {
  console.log('🧪 Testing policy CLI tool...');
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: Help message
  {
    const result = await runPolicyCheck(['--help']);
    if (result.code === 0 && result.stdout.includes('Usage:')) {
      console.log('✅ Help message works');
      passed++;
    } else {
      console.error('❌ Help message failed');
      failed++;
    }
  }
  
  // Test 2: Authorized path for architect
  {
    const result = await runPolicyCheck(['--actor', 'architect', '--paths', 'docs/test.md']);
    if (result.code === 0 && result.stdout.includes('Policy check passed')) {
      console.log('✅ Authorized path check works');
      passed++;
    } else {
      console.error('❌ Authorized path check failed');
      console.error('stdout:', result.stdout);
      console.error('stderr:', result.stderr);
      failed++;
    }
  }
  
  // Test 3: Unauthorized path for architect
  {
    const result = await runPolicyCheck(['--actor', 'architect', '--paths', 'mcp-server/src/db.ts']);
    if (result.code === 1 && result.stdout.includes('Policy check failed')) {
      console.log('✅ Unauthorized path rejection works');
      passed++;
    } else {
      console.error('❌ Unauthorized path rejection failed');
      console.error('stdout:', result.stdout);
      console.error('stderr:', result.stderr);
      failed++;
    }
  }
  
  // Test 4: Multiple paths with mixed authorization
  {
    const result = await runPolicyCheck(['--actor', 'ops', '--paths', 'ci/test.yml,mcp-server/src/db.ts']);
    if (result.code === 1 && result.stdout.includes('not allowed for actor ops')) {
      console.log('✅ Mixed path authorization works');
      passed++;
    } else {
      console.error('❌ Mixed path authorization failed');
      console.error('stdout:', result.stdout);
      console.error('stderr:', result.stderr);
      failed++;
    }
  }
  
  // Test 5: Diff format parsing
  {
    const testDiff = `diff --git a/docs/test.md b/docs/test.md
index abc123..def456 100644
--- a/docs/test.md
+++ b/docs/test.md
@@ -1,3 +1,4 @@
 # Test
 
 Content
+New line
`;
    
    const tmpFile = path.join('/tmp', 'test-diff.patch');
    fs.writeFileSync(tmpFile, testDiff);
    
    const result = await runPolicyCheck(['--actor', 'architect', '--diff', tmpFile]);
    
    // Clean up
    fs.unlinkSync(tmpFile);
    
    if (result.code === 0 && result.stdout.includes('docs/test.md')) {
      console.log('✅ Diff parsing works');
      passed++;
    } else {
      console.error('❌ Diff parsing failed');
      console.error('stdout:', result.stdout);
      console.error('stderr:', result.stderr);
      failed++;
    }
  }
  
  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    console.error('❌ Policy CLI tests failed');
    process.exit(1);
  } else {
    console.log('✅ All policy CLI tests passed');
  }
}

testPolicyCli().catch(error => {
  console.error('❌ Test runner error:', error);
  process.exit(1);
});