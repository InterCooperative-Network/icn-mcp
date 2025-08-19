#!/usr/bin/env node

/**
 * Demo script to showcase UI and consent features
 */

import { icnDisplayTools } from './dist/tools/icn_display_tools.js';
import { icnRequestConsent } from './dist/tools/icn_request_consent.js';
import { icnReportProgress } from './dist/tools/icn_progress.js';

async function demonstrateFeatures() {
  console.log('🎯 ICN MCP UI and Consent Features Demo\n');

  // 1. Display available tools
  console.log('1️⃣ Displaying available tools:');
  console.log('=' .repeat(40));
  
  const toolsDisplay = await icnDisplayTools();
  console.log(`Found ${toolsDisplay.totalCount} tools in ${toolsDisplay.categories.length} categories`);
  console.log('Categories:', toolsDisplay.categories.join(', '));
  
  // Show a few example tools
  toolsDisplay.tools.slice(0, 3).forEach(tool => {
    const riskEmoji = tool.riskLevel === 'high' ? '🔴' : tool.riskLevel === 'medium' ? '🟡' : '🟢';
    console.log(`\n${riskEmoji} ${tool.name} (${tool.category})`);
    console.log(`   ${tool.description}`);
    console.log(`   Risk: ${tool.riskLevel} | Consent required: ${tool.requiresConsent}`);
    if (tool.example) {
      console.log(`   Example: ${tool.example}`);
    }
  });

  // 2. Request consent for a high-risk tool
  console.log('\n\n2️⃣ Requesting user consent for a high-risk operation:');
  console.log('=' .repeat(50));
  
  const consentRequest = await icnRequestConsent({
    toolName: 'icn_write_patch',
    toolArgs: { 
      files: ['src/new-feature.ts'],
      content: 'export function newFeature() { return "Hello World"; }'
    },
    context: 'Adding new functionality based on user requirements'
  });
  
  console.log('Consent Request Generated:');
  console.log('Request ID:', consentRequest.requestId);
  console.log('\nPrompt for user:');
  console.log('-' .repeat(30));
  console.log(consentRequest.prompt);
  console.log('-' .repeat(30));

  // 3. Demonstrate progress reporting
  console.log('\n\n3️⃣ Demonstrating progress reporting:');
  console.log('=' .repeat(40));
  
  const phases = [
    { phase: 'validation', progress: 25, message: 'Validating input parameters' },
    { phase: 'analysis', progress: 50, message: 'Analyzing file dependencies' },
    { phase: 'execution', progress: 75, message: 'Applying changes to file system' },
    { phase: 'completion', progress: 100, message: 'Operation completed successfully' }
  ];
  
  for (const phase of phases) {
    const progressReport = await icnReportProgress({
      toolName: 'icn_write_patch',
      phase: phase.phase,
      progress: phase.progress,
      message: phase.message
    });
    
    console.log('\nProgress Update:');
    console.log(progressReport.formatted);
    
    if (progressReport.isComplete) {
      console.log('✅ Execution completed!');
    }
    
    // Simulate some delay
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // 4. Show filtered tools by category
  console.log('\n\n4️⃣ Filtering tools by category (development):');
  console.log('=' .repeat(45));
  
  const devTools = await icnDisplayTools({ category: 'development' });
  console.log(`Found ${devTools.totalCount} development tools:`);
  
  devTools.tools.forEach(tool => {
    const riskEmoji = tool.riskLevel === 'high' ? '🔴' : tool.riskLevel === 'medium' ? '🟡' : '🟢';
    console.log(`${riskEmoji} ${tool.name} - ${tool.description}`);
  });

  console.log('\n🎉 Demo completed! The UI and consent features provide:');
  console.log('   ✅ Tool discovery and transparency');
  console.log('   ✅ Risk assessment and user consent');
  console.log('   ✅ Real-time progress updates');
  console.log('   ✅ Category-based filtering');
  console.log('   ✅ MCP client integration support');
  console.log('\n📖 See docs/ui-consent.md for detailed documentation');
}

// Run the demo
demonstrateFeatures().catch(console.error);