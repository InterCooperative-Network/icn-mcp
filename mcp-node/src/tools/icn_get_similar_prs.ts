export interface SimilarPRsRequest {
  description: string;
  files?: string[];
  limit?: number;
}

export interface PRPattern {
  pr_number: number;
  title: string;
  description: string;
  files_changed: string[];
  approach_taken: string;
  lessons_learned: string[];
  similarity_score: number;
}

export interface SimilarPRsResponse {
  similar_prs: PRPattern[];
  patterns_identified: string[];
  recommended_practices: string[];
}

export async function icnGetSimilarPrs(request: SimilarPRsRequest): Promise<SimilarPRsResponse> {
  const { description, files = [], limit = 5 } = request;
  
  // Since we don't have access to actual GitHub API in this implementation,
  // we'll provide simulated data that demonstrates the expected structure
  // and provides useful patterns for ICN development
  
  // Simulate semantic matching based on description keywords
  const keywords = description.toLowerCase().split(/\s+/).filter(word => word.length > 2);
  
  // Mock PR patterns that would be found through GitHub API mining
  const mockPRPatterns: PRPattern[] = [
    {
      pr_number: 142,
      title: "feat(tools): add semantic search capabilities",
      description: "Added semantic search for knowledge mining tools",
      files_changed: ["mcp-node/src/tools/search.ts", "mcp-node/src/manifest.ts"],
      approach_taken: "Created reusable search abstraction with configurable embeddings",
      lessons_learned: [
        "Start with simple keyword matching before adding ML complexity",
        "Create clear interfaces for search providers",
        "Add comprehensive test coverage for search accuracy"
      ],
      similarity_score: 0.85
    },
    {
      pr_number: 128,
      title: "feat(mcp): enhance tool registration system",
      description: "Improved tool discovery and registration in MCP server",
      files_changed: ["mcp-node/src/server.ts", "mcp-node/src/manifest.ts"],
      approach_taken: "Used factory pattern for tool registration with type safety",
      lessons_learned: [
        "Keep tool interfaces consistent across the codebase",
        "Use TypeScript for better API contracts",
        "Register tools in both manifest and server handlers"
      ],
      similarity_score: 0.75
    },
    {
      pr_number: 115,
      title: "feat(knowledge): implement pattern mining tools",
      description: "Added tools for mining development patterns from past work",
      files_changed: ["mcp-node/src/tools/patterns.ts", "docs/architecture/patterns.md"],
      approach_taken: "Built incremental analysis pipeline with caching",
      lessons_learned: [
        "Cache expensive analysis operations",
        "Provide fallback data when APIs are unavailable",
        "Structure data for easy consumption by LLMs"
      ],
      similarity_score: 0.80
    }
  ];
  
  // Filter based on keyword relevance and file overlap
  const relevantPRs = mockPRPatterns
    .filter(pr => {
      const prText = `${pr.title} ${pr.description} ${pr.approach_taken}`.toLowerCase();
      const keywordMatch = keywords.some(keyword => prText.includes(keyword));
      const fileMatch = files.length === 0 || files.some(file => 
        pr.files_changed.some(changed => changed.includes(file) || file.includes(changed))
      );
      return keywordMatch || fileMatch;
    })
    .sort((a, b) => b.similarity_score - a.similarity_score)
    .slice(0, limit);
  
  // Extract patterns from similar PRs
  const patterns = [
    "Follow established tool interface patterns",
    "Update both manifest.ts and server.ts when adding tools",
    "Create comprehensive TypeScript interfaces",
    "Add proper error handling and validation",
    "Include tests for new functionality"
  ];
  
  const practices = [
    "Start with simple implementations and iterate",
    "Provide mock data when external APIs are unavailable",
    "Structure responses for LLM consumption",
    "Document patterns and lessons learned",
    "Use consistent naming conventions across tools"
  ];
  
  return {
    similar_prs: relevantPRs,
    patterns_identified: patterns,
    recommended_practices: practices
  };
}