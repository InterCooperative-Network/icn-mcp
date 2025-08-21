import { z, ZodIssue } from "zod";

export function formatZodIssues(issues: ZodIssue[]): string {
  return issues.map(e => {
    const path = e.path?.length ? e.path.join(".") : "(root)";
    return `${path}: ${e.message}`;
  }).join(", ");
}

export function rethrowZod(error: unknown): never {
  if (error && typeof error === "object" && "errors" in error) {
    // @ts-ignore
    const issues = error.errors as ZodIssue[];
    throw new Error(`Invalid input: ${formatZodIssues(issues)}`);
  }
  throw error as Error;
}

// Reusable test type normalization
const KNOWN_TYPES = ["npm","vitest","jest","cargo","mocha","custom"] as const;
export type KnownTestType = typeof KNOWN_TYPES[number];

export const TestTypeSchema = z.any().transform((v): KnownTestType => {
  const s = typeof v === "string" ? v.toLowerCase().trim() : "";
  return (KNOWN_TYPES as readonly string[]).includes(s) ? (s as KnownTestType) : "custom";
}).default("custom").catch("custom");