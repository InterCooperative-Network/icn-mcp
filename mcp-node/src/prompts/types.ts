import { z } from 'zod';

/**
 * Schema for prompt argument definitions
 */
export const PromptArgumentSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  required: z.boolean().optional().default(false),
});

/**
 * Schema for ICN prompt templates  
 */
export const ICNPromptSchema = z.object({
  name: z.string(),
  description: z.string(),
  arguments: z.array(PromptArgumentSchema).optional().default([]),
  category: z.enum(['workflow', 'documentation', 'review']),
  template: z.string(),
});

export type ICNPromptArgument = z.infer<typeof PromptArgumentSchema>;
export type ICNPrompt = z.infer<typeof ICNPromptSchema>;

/**
 * Prompt template with interpolated values
 */
export interface PromptTemplate {
  name: string;
  description: string;
  arguments: ICNPromptArgument[];
  category: 'workflow' | 'documentation' | 'review';
  content: string;
}