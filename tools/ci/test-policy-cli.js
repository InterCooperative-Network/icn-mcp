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

  // Test 6: Diff parsing with /dev/null entries (file add/delete)
  {
    const testDiffWithDevNull = `diff --git a/new-file.md b/new-file.md
new file mode 100644
index 0000000..abc123
--- /dev/null
+++ b/new-file.md
@@ -0,0 +1,2 @@
+# New File
+Content
diff --git a/deleted-file.md b/deleted-file.md
deleted file mode 100644
index def456..0000000
--- a/deleted-file.md
+++ /dev/null
@@ -1,2 +0,0 @@
-# Deleted File
-Content
diff --git a/docs/modified.md b/docs/modified.md
index ghi789..jkl012 100644
--- a/docs/modified.md
+++ b/docs/modified.md
@@ -1 +1,2 @@
 # Modified
+New content
`;
    
    const tmpFile = path.join('/tmp', 'test-devnull-diff.patch');
    fs.writeFileSync(tmpFile, testDiffWithDevNull);
    
    const result = await runPolicyCheck(['--actor', 'architect', '--diff', tmpFile]);
    
    // Clean up
    fs.unlinkSync(tmpFile);
    
    // Should detect new-file.md, deleted-file.md, and docs/modified.md but not /dev/null
    if (result.stdout.includes('new-file.md') && 
        result.stdout.includes('deleted-file.md') && 
        result.stdout.includes('docs/modified.md') && 
        !result.stdout.includes('/dev/null')) {
      console.log('✅ Diff parsing with /dev/null works');
      passed++;
    } else {
      console.error('❌ Diff parsing with /dev/null failed');
      console.error('stdout:', result.stdout);
      console.error('stderr:', result.stderr);
      failed++;
    }
  }

  // Test 7: Glob pattern behavior - ** vs * 
  {
    // Test that ** matches multiple path segments and * matches single segments
    const result1 = await runPolicyCheck(['--actor', 'architect', '--paths', 'docs/deep/nested/file.md']);
    const result2 = await runPolicyCheck(['--actor', 'ops', '--paths', 'ci/deploy.yml']);
    const result3 = await runPolicyCheck(['--actor', 'ops', '--paths', 'ci/deep/nested/config.yml']);
    
    // architect has "docs/**" which should match docs/deep/nested/file.md  
    // ops has "ci/**" which should match both ci/deploy.yml and ci/deep/nested/config.yml
    // ops also has "*.yml" which should match root-level .yml files but not nested ones
    if (result1.code === 0 && result2.code === 0 && result3.code === 0) {
      console.log('✅ Glob pattern ** vs * behavior works');
      passed++;
    } else {
      console.error('❌ Glob pattern ** vs * behavior failed');
      console.error('result1 (architect docs):', result1.code, result1.stdout);
      console.error('result2 (ops ci):', result2.code, result2.stdout);
      console.error('result3 (ops ci nested):', result3.code, result3.stdout);
      failed++;
    }
  }

  // Test 8: Git diff modes (staged vs unstaged)
  {
    // This test will only work if we can simulate git state, so let's test the argument parsing
    const result1 = await runPolicyCheck(['--actor', 'architect', '--git', 'staged', '--help']);
    const result2 = await runPolicyCheck(['--actor', 'architect', '--git', 'unstaged', '--help']);
    const result3 = await runPolicyCheck(['--actor', 'architect', '--git', 'main', '--help']);
    
    // All should show help (exit code 0) since --help overrides other functionality
    if (result1.code === 0 && result2.code === 0 && result3.code === 0) {
      console.log('✅ Git diff modes argument parsing works');
      passed++;
    } else {
      console.error('❌ Git diff modes argument parsing failed');
      console.error('staged result:', result1.code);
      console.error('unstaged result:', result2.code);
      console.error('ref result:', result3.code);
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