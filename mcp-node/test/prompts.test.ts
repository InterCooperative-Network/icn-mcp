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
      expect(prompts).toHaveLength(3);
      
      const promptNames = prompts.map(p => p.name);
      expect(promptNames).toContain('code-review');
      expect(promptNames).toContain('adr-template');
      expect(promptNames).toContain('release-notes');
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
      expect(documentationPrompts).toHaveLength(1);
      expect(documentationPrompts[0].name).toBe('adr-template');

      const workflowPrompts = getPromptsByCategory('workflow');
      expect(workflowPrompts).toHaveLength(1);
      expect(workflowPrompts[0].name).toBe('release-notes');
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
      expect(allPrompts).toHaveLength(3);
      
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
  });
});