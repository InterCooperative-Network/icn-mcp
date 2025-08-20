import fs from 'node:fs';
import path from 'node:path';
import stripJsonComments from 'strip-json-comments';

/**
 * Test suite for JSON validation with tricky JSONC cases
 */
function runTests() {
  console.log('🧪 Testing JSON validation with tricky JSONC cases...');
  
  const testCases = [
    {
      name: 'Path mappings with @/* syntax',
      content: '{"paths":{"@/*":["src/*"]}}',
      shouldPass: true
    },
    {
      name: 'URLs in strings',
      content: '{"proxy":"http://localhost:3000"}',
      shouldPass: true  
    },
    {
      name: 'Escaped quotes in strings',
      content: '{"pattern":"foo\\\\\\"bar"}',
      shouldPass: true
    },
    {
      name: 'Block comment tokens in strings',
      content: '{"description":"not /* a comment */"}',
      shouldPass: true
    },
    {
      name: 'Single-line comments',
      content: '{"key":"value"//comment\n}',
      shouldPass: true
    },
    {
      name: 'Multi-line comments',
      content: '{"key":/*comment*/"value"}',
      shouldPass: true
    },
    {
      name: 'Mixed comments and complex strings',
      content: `{
        // Single line comment
        "paths": {
          "@/*": ["src/*"], // Path comment
          "proxy": "http://localhost:3000"
        },
        /* Multi-line
           comment */
        "pattern": "foo\\\\\\"bar"
      }`,
      shouldPass: true
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const testCase of testCases) {
    try {
      const stripped = stripJsonComments(testCase.content);
      JSON.parse(stripped);
      
      if (testCase.shouldPass) {
        console.log(`✅ ${testCase.name}`);
        passed++;
      } else {
        console.error(`❌ ${testCase.name}: Expected to fail but passed`);
        failed++;
      }
    } catch (error) {
      if (!testCase.shouldPass) {
        console.log(`✅ ${testCase.name}: Correctly failed with ${error.message}`);
        passed++;
      } else {
        console.error(`❌ ${testCase.name}: ${error.message}`);
        failed++;
      }
    }
  }
  
  // Test the actual fixture file
  try {
    const fixturePath = path.join(process.cwd(), 'tools/ci/test/fixtures/test-tsconfig.json');
    const content = fs.readFileSync(fixturePath, 'utf8');
    const stripped = stripJsonComments(content);
    JSON.parse(stripped);
    console.log('✅ Test fixture file validation');
    passed++;
  } catch (error) {
    console.error(`❌ Test fixture file validation: ${error.message}`);
    failed++;
  }
  
  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('✅ All JSONC validation tests passed');
  }
}

runTests();