import { registerAgent, claimTask, runTask, checkPolicy } from 'agent-sdk';
import { spawn } from 'node:child_process';

async function runCommand(command: string, args: string[], cwd = process.cwd()): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, stdio: 'pipe' });
    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({ stdout, stderr, code: code ?? 0 });
    });
  });
}

async function performCodeReview(taskId: string, token: string, baseUrl: string): Promise<void> {
  const reviewNotes: string[] = [];
  let reviewPassed = true;

  console.log(`🔍 Starting code review for task ${taskId}`);

  // Update task status to in_progress
  await runTask(baseUrl, token, {
    task_id: taskId,
    status: 'in_progress',
    notes: 'Starting code review: running tests and policy checks',
    task_kind: 'code_review'
  });

  try {
    // 1. Run npm test
    console.log('📋 Running npm test...');
    const testResult = await runCommand('npm', ['test'], process.cwd());
    
    if (testResult.code === 0) {
      reviewNotes.push('✅ All tests passed successfully');
      console.log('✅ Tests passed');
    } else {
      reviewNotes.push('❌ Tests failed');
      reviewNotes.push(`Test output: ${testResult.stderr.slice(-500)}`); // Last 500 chars
      reviewPassed = false;
      console.log('❌ Tests failed');
    }

    // 2. Run policy check on common review paths
    console.log('🛡️ Running policy checks...');
    const reviewPaths = [
      'docs/architecture/',
      'mcp-server/src/',
      'agents/',
      'agent-sdk/src/'
    ];

    const policyResult = await checkPolicy(baseUrl, token, {
      actor: 'reviewer',
      changedPaths: reviewPaths
    });

    if (policyResult.allow) {
      reviewNotes.push('✅ Policy checks passed');
      console.log('✅ Policy checks passed');
    } else {
      reviewNotes.push('❌ Policy violations detected');
      reviewNotes.push(`Policy issues: ${policyResult.reasons.join(', ')}`);
      reviewPassed = false;
      console.log('❌ Policy violations detected:', policyResult.reasons);
    }

    // 3. Basic code quality checks
    console.log('🔧 Running lint checks...');
    const lintResult = await runCommand('npm', ['run', 'lint'], process.cwd());
    
    if (lintResult.code === 0) {
      reviewNotes.push('✅ Lint checks passed');
      console.log('✅ Lint checks passed');
    } else {
      reviewNotes.push('❌ Lint issues found');
      reviewNotes.push(`Lint output: ${lintResult.stderr.slice(-500)}`);
      reviewPassed = false;
      console.log('❌ Lint issues found');
    }

    // 4. Check if build succeeds
    console.log('🏗️ Running build check...');
    const buildResult = await runCommand('npm', ['run', 'build'], process.cwd());
    
    if (buildResult.code === 0) {
      reviewNotes.push('✅ Build successful');
      console.log('✅ Build successful');
    } else {
      reviewNotes.push('❌ Build failed');
      reviewNotes.push(`Build output: ${buildResult.stderr.slice(-500)}`);
      reviewPassed = false;
      console.log('❌ Build failed');
    }

  } catch (error) {
    reviewNotes.push(`❌ Review error: ${error}`);
    reviewPassed = false;
    console.error('Review error:', error);
  }

  // Complete the task with final status
  const finalStatus = reviewPassed ? 'completed' : 'failed';
  const finalNotes = [
    `Code review ${reviewPassed ? 'PASSED' : 'FAILED'}`,
    '',
    'Review Summary:',
    ...reviewNotes,
    '',
    reviewPassed 
      ? '✅ All checks passed - code is ready for merge'
      : '❌ Issues found - please address before merging'
  ].join('\n');

  await runTask(baseUrl, token, {
    task_id: taskId,
    status: finalStatus,
    notes: finalNotes,
    task_kind: 'code_review'
  });

  console.log(`🏁 Review completed with status: ${finalStatus}`);
  console.log('\nReview Summary:');
  console.log(finalNotes);
}

async function main() {
  const baseUrl = process.env.MCP_BASE_URL || 'http://localhost:8787';
  
  try {
    // Register as reviewer agent
    console.log('🤖 Registering reviewer agent...');
    const registration = await registerAgent(baseUrl, {
      name: 'Code Reviewer',
      kind: 'reviewer'
    });
    
    console.log(`✅ Registered as agent ${registration.id}`);
    const token = registration.token;

    // Claim a task
    console.log('🎯 Claiming a task...');
    const claimResult = await claimTask(baseUrl, token);
    
    if (claimResult.error === 'no_available_tasks') {
      console.log('⏳ No tasks available for review');
      return;
    }

    if (!claimResult.task_id) {
      console.log('❌ Failed to claim task:', claimResult.error || 'Unknown error');
      return;
    }

    console.log(`📋 Claimed task: ${claimResult.task_id} - ${claimResult.title}`);

    // Perform the code review
    await performCodeReview(claimResult.task_id, token, baseUrl);

  } catch (error) {
    console.error('❌ Reviewer agent error:', error);
    process.exit(1);
  }
}

// Allow running with specific task ID for testing
if (process.argv.includes('--task')) {
  const taskId = process.argv[process.argv.indexOf('--task') + 1];
  if (taskId) {
    console.log(`🎯 Running review for specific task: ${taskId}`);
    // For specific task, still need to register and get token
    const baseUrl = process.env.MCP_BASE_URL || 'http://localhost:8787';
    registerAgent(baseUrl, { name: 'Code Reviewer', kind: 'reviewer' })
      .then(registration => {
        return performCodeReview(taskId, registration.token, baseUrl);
      })
      .catch(error => {
        console.error('❌ Specific task review error:', error);
        process.exit(1);
      });
  } else {
    console.error('❌ --task requires a task ID');
    process.exit(1);
  }
} else {
  main().catch((error) => {
    console.error('❌ Reviewer agent failed:', error);
    process.exit(1);
  });
}

