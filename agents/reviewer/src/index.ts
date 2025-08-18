import { registerAgent, claimTask, runTask, checkPolicy } from 'agent-sdk';
import { spawn } from 'node:child_process';

interface ReviewOptions {
  skipBuild: boolean;
  skipTest: boolean;
  skipLint: boolean;
  maxLogChars: number;
}

function parseArgs(): { taskId?: string; options: ReviewOptions } {
  const args = process.argv.slice(2);
  const options: ReviewOptions = {
    skipBuild: args.includes('--no-build'),
    skipTest: args.includes('--no-test'),
    skipLint: args.includes('--no-lint'),
    maxLogChars: 500
  };

  const maxLogIndex = args.indexOf('--max-log-chars');
  if (maxLogIndex !== -1 && args[maxLogIndex + 1]) {
    options.maxLogChars = parseInt(args[maxLogIndex + 1], 10) || 500;
  }

  const taskIndex = args.indexOf('--task');
  const taskId = taskIndex !== -1 && args[taskIndex + 1] ? args[taskIndex + 1] : undefined;

  return { taskId, options };
}

function logStructured(phase: string, status: 'start' | 'pass' | 'fail', duration_ms?: number, sample?: string) {
  const log = {
    timestamp: new Date().toISOString(),
    phase,
    status,
    ...(duration_ms !== undefined && { duration_ms }),
    ...(sample && { sample })
  };
  console.log(JSON.stringify(log));
}

async function runCommand(command: string, args: string[], cwd = process.cwd()): Promise<{ stdout: string; stderr: string; code: number; duration: number }> {
  const startTime = Date.now();
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
      const duration = Date.now() - startTime;
      resolve({ stdout, stderr, code: code ?? 0, duration });
    });
  });
}

async function performCodeReview(taskId: string, token: string, baseUrl: string, options: ReviewOptions): Promise<void> {
  const reviewNotes: string[] = [];
  let reviewPassed = true;

  logStructured('review', 'start');
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
    if (!options.skipTest) {
      logStructured('test', 'start');
      console.log('📋 Running npm test...');
      const testResult = await runCommand('npm', ['test'], process.cwd());
      
      if (testResult.code === 0) {
        reviewNotes.push('✅ All tests passed successfully');
        logStructured('test', 'pass', testResult.duration);
        console.log('✅ Tests passed');
      } else {
        reviewNotes.push('❌ Tests failed');
        const sample = testResult.stderr.slice(-options.maxLogChars);
        reviewNotes.push(`Test output: ${sample}`);
        reviewPassed = false;
        logStructured('test', 'fail', testResult.duration, sample);
        console.log('❌ Tests failed');
      }
    } else {
      reviewNotes.push('⏭️ Tests skipped (--no-test)');
      console.log('⏭️ Tests skipped');
    }

    // 2. Run policy check on common review paths
    logStructured('policy', 'start');
    console.log('🛡️ Running policy checks...');
    const reviewPaths = [
      'docs/architecture/',
      'mcp-server/src/',
      'agents/',
      'agent-sdk/src/'
    ];

    const policyResult = await checkPolicy(baseUrl, token, {
      actor: 'reviewer',
      action: 'pr.create',
      paths: reviewPaths
    });

    if (policyResult.allow) {
      reviewNotes.push('✅ Policy checks passed');
      logStructured('policy', 'pass');
      console.log('✅ Policy checks passed');
    } else {
      reviewNotes.push('❌ Policy violations detected');
      const sample = policyResult.reasons.join(', ');
      reviewNotes.push(`Policy issues: ${sample}`);
      reviewPassed = false;
      logStructured('policy', 'fail', undefined, sample);
      console.log('❌ Policy violations detected:', policyResult.reasons);
    }

    // 3. Basic code quality checks
    if (!options.skipLint) {
      logStructured('lint', 'start');
      console.log('🔧 Running lint checks...');
      const lintResult = await runCommand('npm', ['run', 'lint'], process.cwd());
      
      if (lintResult.code === 0) {
        reviewNotes.push('✅ Lint checks passed');
        logStructured('lint', 'pass', lintResult.duration);
        console.log('✅ Lint checks passed');
      } else {
        reviewNotes.push('❌ Lint issues found');
        const sample = lintResult.stderr.slice(-options.maxLogChars);
        reviewNotes.push(`Lint output: ${sample}`);
        reviewPassed = false;
        logStructured('lint', 'fail', lintResult.duration, sample);
        console.log('❌ Lint issues found');
      }
    } else {
      reviewNotes.push('⏭️ Lint skipped (--no-lint)');
      console.log('⏭️ Lint skipped');
    }

    // 4. Check if build succeeds
    if (!options.skipBuild) {
      logStructured('build', 'start');
      console.log('🏗️ Running build check...');
      const buildResult = await runCommand('npm', ['run', 'build'], process.cwd());
      
      if (buildResult.code === 0) {
        reviewNotes.push('✅ Build successful');
        logStructured('build', 'pass', buildResult.duration);
        console.log('✅ Build successful');
      } else {
        reviewNotes.push('❌ Build failed');
        const sample = buildResult.stderr.slice(-options.maxLogChars);
        reviewNotes.push(`Build output: ${sample}`);
        reviewPassed = false;
        logStructured('build', 'fail', buildResult.duration, sample);
        console.log('❌ Build failed');
      }
    } else {
      reviewNotes.push('⏭️ Build skipped (--no-build)');
      console.log('⏭️ Build skipped');
    }

  } catch (error) {
    reviewNotes.push(`❌ Review error: ${error}`);
    reviewPassed = false;
    logStructured('review', 'fail', undefined, String(error));
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

  logStructured('review', reviewPassed ? 'pass' : 'fail');
  console.log(`🏁 Review completed with status: ${finalStatus}`);
  console.log('\nReview Summary:');
  console.log(finalNotes);
}

async function main() {
  const baseUrl = process.env.MCP_BASE_URL || 'http://localhost:8787';
  const { taskId, options } = parseArgs();
  
  try {
    // Register as reviewer agent
    console.log('🤖 Registering reviewer agent...');
    const registration = await registerAgent(baseUrl, {
      name: 'Code Reviewer',
      kind: 'reviewer'
    });
    
    console.log(`✅ Registered as agent ${registration.id}`);
    const token = registration.token;

    if (taskId) {
      // Run review for specific task
      console.log(`🎯 Running review for specific task: ${taskId}`);
      await performCodeReview(taskId, token, baseUrl, options);
      return;
    }

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
    await performCodeReview(claimResult.task_id, token, baseUrl, options);

  } catch (error) {
    logStructured('review', 'fail', undefined, String(error));
    console.error('❌ Reviewer agent error:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  logStructured('review', 'fail', undefined, String(error));
  console.error('❌ Reviewer agent failed:', error);
  process.exit(1);
});

