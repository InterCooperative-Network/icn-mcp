import { describe, it, expect } from 'vitest';
import { 
  listAllPrompts, 
  generatePrompt, 
  getPromptMetadata, 
  validatePromptArguments,
  interpolateTemplate,
  ICN_PROMPTS,
  getPromptByName,
  getPromptsByCategory
} from '../src/prompts/index.js';

describe('ICN Prompts', () => {
  describe('Template Management', () => {
    it('should have all required prompt templates', () => {
      const prompts = ICN_PROMPTS;
      expect(prompts).toHaveLength(9); // 4 original + 5 consent prompts
      
      const promptNames = prompts.map(p => p.name);
      expect(promptNames).toContain('code-review');
      expect(promptNames).toContain('adr-template');
      expect(promptNames).toContain('release-notes');
      expect(promptNames).toContain('governance-proposal');
      // New consent prompts
      expect(promptNames).toContain('tool_consent_request');
      expect(promptNames).toContain('tool_progress_update');
      expect(promptNames).toContain('tools_display');
      expect(promptNames).toContain('consent_denied');
      expect(promptNames).toContain('consent_approved');
    });

    it('should return prompt by name', () => {
      const codeReview = getPromptByName('code-review');
      expect(codeReview).toBeDefined();
      expect(codeReview?.name).toBe('code-review');
      expect(codeReview?.category).toBe('review');

      const unknown = getPromptByName('unknown-prompt');
      expect(unknown).toBeUndefined();
    });

    it('should filter prompts by category', () => {
      const reviewPrompts = getPromptsByCategory('review');
      expect(reviewPrompts).toHaveLength(1);
      expect(reviewPrompts[0].name).toBe('code-review');

      const documentationPrompts = getPromptsByCategory('documentation');
      expect(documentationPrompts).toHaveLength(2); // adr-template + tools_display
      expect(documentationPrompts.map(p => p.name)).toContain('adr-template');
      expect(documentationPrompts.map(p => p.name)).toContain('tools_display');

      const workflowPrompts = getPromptsByCategory('workflow');
      expect(workflowPrompts).toHaveLength(5); // release-notes + 4 consent workflow prompts
      expect(workflowPrompts.map(p => p.name)).toContain('release-notes');

      const governancePrompts = getPromptsByCategory('governance');
      expect(governancePrompts).toHaveLength(1);
      expect(governancePrompts[0].name).toBe('governance-proposal');
    });
  });

  describe('Prompt Metadata', () => {
    it('should return correct metadata for existing prompts', () => {
      const metadata = getPromptMetadata('code-review');
      expect(metadata).toBeDefined();
      expect(metadata?.name).toBe('code-review');
      expect(metadata?.description).toContain('Review code changes');
      expect(metadata?.category).toBe('review');
      expect(metadata?.arguments).toHaveLength(3);
    });

    it('should return null for non-existent prompts', () => {
      const metadata = getPromptMetadata('non-existent');
      expect(metadata).toBeNull();
    });

    it('should list all prompts with full templates', () => {
      const allPrompts = listAllPrompts();
      expect(allPrompts).toHaveLength(9); // 4 original + 5 consent prompts
      
      for (const prompt of allPrompts) {
        expect(prompt.name).toBeDefined();
        expect(prompt.description).toBeDefined();
        expect(prompt.category).toBeDefined();
        expect(prompt.content).toBeDefined();
        expect(Array.isArray(prompt.arguments)).toBe(true);
      }
    });
  });

  describe('Template Interpolation', () => {
    it('should interpolate simple variables', () => {
      const template = 'Hello {{name}}, welcome to {{place}}!';
      const result = interpolateTemplate(template, { 
        name: 'John', 
        place: 'ICN' 
      });
      expect(result).toBe('Hello John, welcome to ICN!');
    });

    it('should handle conditional blocks', () => {
      const template = '{{#if greeting}}Hello {{name}}{{/if}}!';
      
      const withGreeting = interpolateTemplate(template, { 
        greeting: true, 
        name: 'Alice' 
      });
      expect(withGreeting).toBe('Hello Alice!');

      const withoutGreeting = interpolateTemplate(template, { 
        greeting: false, 
        name: 'Alice' 
      });
      expect(withoutGreeting).toBe('!');
    });

    it('should handle conditional blocks with else', () => {
      const template = '{{#if admin}}Admin Panel{{else}}User Dashboard{{/if}}';
      
      const adminResult = interpolateTemplate(template, { admin: true });
      expect(adminResult).toBe('Admin Panel');

      const userResult = interpolateTemplate(template, { admin: false });
      expect(userResult).toBe('User Dashboard');
    });

    it('should preserve unmatched variables', () => {
      const template = 'Hello {{name}}, {{unknownVar}} is undefined';
      const result = interpolateTemplate(template, { name: 'John' });
      expect(result).toBe('Hello John, {{unknownVar}} is undefined');
    });
  });

  describe('Argument Validation', () => {
    it('should validate required arguments', () => {
      const validation = validatePromptArguments('code-review', {
        changes: 'some diff content'
      });
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should fail validation for missing required arguments', () => {
      const validation = validatePromptArguments('code-review', {});
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("Required argument 'changes' is missing");
    });

    it('should handle non-existent prompts', () => {
      const validation = validatePromptArguments('unknown-prompt', {});
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("Prompt 'unknown-prompt' not found");
    });

    it('should allow optional arguments to be missing', () => {
      const validation = validatePromptArguments('code-review', {
        changes: 'diff content'
        // files and context are optional
      });
      expect(validation.valid).toBe(true);
    });
  });

  describe('Prompt Generation', () => {
    it('should generate code review prompt with required arguments', () => {
      const result = generatePrompt('code-review', {
        changes: '+ console.log("Hello World");'
      });
      
      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
      expect(result.content).toContain('Hello World');
      expect(result.content).toContain('ICN Code Review');
      expect(result.content).toContain('event-sourced');
    });

    it('should generate ADR template with title', () => {
      const result = generatePrompt('adr-template', {
        title: 'Use PostgreSQL for data persistence'
      });
      
      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
      expect(result.content).toContain('Use PostgreSQL for data persistence');
      expect(result.content).toContain('ADR:');
      expect(result.content).toContain('ICN invariant compliance');
    });

    it('should generate release notes with version and PRs', () => {
      const result = generatePrompt('release-notes', {
        version: 'v1.2.0',
        lastTag: 'v1.1.0',
        prList: '- #123: Add new feature\n- #124: Fix bug'
      });
      
      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
      expect(result.content).toContain('v1.2.0');
      expect(result.content).toContain('v1.1.0');
      expect(result.content).toContain('#123: Add new feature');
    });

    it('should handle conditional content in templates', () => {
      const resultWithHighlights = generatePrompt('release-notes', {
        version: 'v1.2.0',
        lastTag: 'v1.1.0',
        prList: '- #123: Add feature',
        highlights: 'Major performance improvements'
      });
      
      expect(resultWithHighlights.success).toBe(true);
      expect(resultWithHighlights.content).toContain('## Highlights');
      expect(resultWithHighlights.content).toContain('Major performance improvements');

      const resultWithoutHighlights = generatePrompt('release-notes', {
        version: 'v1.2.0',
        lastTag: 'v1.1.0',
        prList: '- #123: Add feature'
      });
      
      expect(resultWithoutHighlights.success).toBe(true);
      expect(resultWithoutHighlights.content).not.toContain('## Highlights');
    });

    it('should fail for missing required arguments', () => {
      const result = generatePrompt('code-review', {});
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors).toContain("Required argument 'changes' is missing");
    });

    it('should fail for non-existent prompts', () => {
      const result = generatePrompt('unknown-prompt', {});
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors).toContain("Prompt 'unknown-prompt' not found");
    });
  });

  describe('ICN-Specific Content', () => {
    it('should include ICN invariants in code review prompt', () => {
      const result = generatePrompt('code-review', {
        changes: 'test changes'
      });
      
      expect(result.content).toContain('Event-sourced architecture');
      expect(result.content).toContain('Deterministic operations');
      expect(result.content).toContain('Democratic governance');
      expect(result.content).toContain('Non-transferable coordination credits');
      expect(result.content).toContain('No token-bought voting');
    });

    it('should include ICN alignment check in ADR template', () => {
      const result = generatePrompt('adr-template', {
        title: 'Test Decision'
      });
      
      expect(result.content).toContain('ICN Alignment Check');
      expect(result.content).toContain('event-sourced architecture');
      expect(result.content).toContain('democratic governance');
      expect(result.content).toContain('federation scalability');
      expect(result.content).toContain('cooperative principles');
    });

    it('should reference ICN governance in release notes', () => {
      const result = generatePrompt('release-notes', {
        version: 'v1.0.0',
        lastTag: 'v0.9.0',
        prList: 'test'
      });
      
      expect(result.content).toContain('Governance & Policy');
      expect(result.content).toContain('ICN Protocol Updates');
      expect(result.content).toContain('ICN invariants');
      expect(result.content).toContain('cooperative principles');
    });

    it('should include democratic principles in governance proposal', () => {
      const result = generatePrompt('governance-proposal', {
        title: 'Test Proposal',
        proposer: 'Alice'
      });
      
      expect(result.content).toContain('Democratic Governance');
      expect(result.content).toContain('Event-Sourced');
      expect(result.content).toContain('Non-Transferable Credits');
      expect(result.content).toContain('Anti-Token-Voting');
      expect(result.content).toContain('Federation Autonomy');
      expect(result.content).toContain('Cooperative Values');
    });
  });

  describe('Invariant Violation Detection', () => {
    it('should prompt for checking token-based voting violations in code review', () => {
      const tokenVotingCode = `
+ function buyVotingPower(tokens) {
+   return tokens * VOTING_MULTIPLIER;
+ }
+ const votingPower = user.tokenBalance * votingWeight;
      `;

      const result = generatePrompt('code-review', {
        changes: tokenVotingCode,
        context: 'Adding token-weighted voting system'
      });

      expect(result.success).toBe(true);
      expect(result.content).toContain('No token-bought voting mechanisms');
      expect(result.content).toContain('Are there any centralization risks?');
      expect(result.content).toContain('democratic governance principles');
    });

    it('should detect centralization patterns in code review', () => {
      const centralizationCode = `
+ if (user.role === 'ADMIN') {
+   return allowUnrestrictedAccess();
+ }
+ const privilegedUsers = ['admin', 'superuser', 'owner'];
      `;

      const result = generatePrompt('code-review', {
        changes: centralizationCode,
        context: 'Adding administrative privileges'
      });

      expect(result.success).toBe(true);
      expect(result.content).toContain('centralization risks');
      expect(result.content).toContain('Democratic governance');
      expect(result.content).toContain('proper authorization/policy checking');
    });

    it('should validate non-deterministic operations in code review', () => {
      const nonDeterministicCode = `
+ const randomSeed = Math.random();
+ const votingDeadline = Date.now() + Math.random() * 86400000;
+ if (Math.random() > 0.5) { processVote(); }
      `;

      const result = generatePrompt('code-review', {
        changes: nonDeterministicCode,
        context: 'Adding randomized voting logic'
      });

      expect(result.success).toBe(true);
      expect(result.content).toContain('Deterministic operations');
      expect(result.content).toContain('Is the implementation deterministic?');
    });

    it('should check event sourcing violations in code review', () => {
      const eventSourcingViolation = `
+ database.users.update({ id: userId }, { $set: { balance: newBalance } });
+ delete user.previousVotes;
+ user.votingHistory = []; // Clear history
      `;

      const result = generatePrompt('code-review', {
        changes: eventSourcingViolation,
        context: 'Updating user data directly'
      });

      expect(result.success).toBe(true);
      expect(result.content).toContain('Event-sourced architecture');
      expect(result.content).toContain('event-sourced patterns');
    });

    it('should detect coordination credit transferability violations', () => {
      const transferableCredits = `
+ function transferCredits(from, to, amount) {
+   from.coordinationCredits -= amount;
+   to.coordinationCredits += amount;
+ }
+ const creditMarket = new TokenMarket(coordinationCredits);
      `;

      const result = generatePrompt('code-review', {
        changes: transferableCredits,
        context: 'Adding credit transfer functionality'
      });

      expect(result.success).toBe(true);
      expect(result.content).toContain('Non-transferable coordination credits');
      expect(result.content).toContain('No token-bought voting');
    });
  });

  describe('Template Engine Features', () => {
    it('should support built-in currentDate variable', () => {
      const result = generatePrompt('governance-proposal', {
        title: 'Test Proposal',
        proposer: 'Alice'
      });

      expect(result.success).toBe(true);
      const today = new Date().toISOString().split('T')[0];
      expect(result.content).toContain(`**Date:** ${today}`);
    });

    it('should handle missing optional arguments gracefully', () => {
      const result = generatePrompt('governance-proposal', {
        title: 'Minimal Proposal',
        proposer: 'Bob'
        // federationScope and economicImpact omitted
      });

      expect(result.success).toBe(true);
      expect(result.content).not.toContain('**Scope:**');
      expect(result.content).not.toContain('## Economic Impact Assessment');
    });

    it('should render conditional economic impact section', () => {
      const result = generatePrompt('governance-proposal', {
        title: 'Economic Policy Change',
        proposer: 'Charlie',
        economicImpact: 'significant'
      });

      expect(result.success).toBe(true);
      expect(result.content).toContain('## Economic Impact Assessment');
      expect(result.content).toContain('### Mana/Coordination Credit Effects');
      expect(result.content).toContain('### Federation Impact');
    });
  });
});