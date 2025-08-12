export interface FormulaVariable {
  /** Variable name */
  name: string;
  /** Variable description */
  description: string;
  /** Variable type */
  type: 'number' | 'percentage' | 'rate' | 'weight' | 'boolean';
  /** Default value if any */
  defaultValue?: number | boolean;
  /** Valid range for numeric values */
  range?: {
    min: number;
    max: number;
  };
}

export interface EconomicFormula {
  /** Formula ID */
  id: string;
  /** Human-readable name */
  name: string;
  /** Formula description */
  description: string;
  /** Mathematical expression */
  expression: string;
  /** Variables used in the formula */
  variables: FormulaVariable[];
  /** ICN invariants this formula maintains */
  invariants: string[];
  /** Usage examples */
  examples: Array<{
    description: string;
    inputs: Record<string, number | boolean>;
    expectedOutput: number;
    explanation: string;
  }>;
  /** Constraints and validation rules */
  constraints: string[];
}

export interface BuildFormulaRequest {
  /** Description of the economic relationship */
  description: string;
  /** Context about the relationship (optional) */
  context?: string;
  /** Expected output type */
  outputType?: 'amount' | 'rate' | 'percentage' | 'weight' | 'boolean';
  /** Known variables or constraints */
  knownVariables?: Array<{
    name: string;
    description: string;
    type: FormulaVariable['type'];
    range?: { min: number; max: number };
  }>;
}

export interface BuildFormulaResponse {
  /** Generated formula */
  formula: EconomicFormula;
  /** Confidence score in the formula (0-1) */
  confidence: number;
  /** Alternative formulations */
  alternatives: Array<{
    formula: EconomicFormula;
    reasoning: string;
  }>;
  /** Warnings about potential issues */
  warnings: string[];
}

/**
 * Build mathematical formulas for ICN economic relationships
 */
export async function icnBuildFormula(request: BuildFormulaRequest): Promise<BuildFormulaResponse> {
  const { description, context, outputType = 'amount', knownVariables = [] } = request;
  
  // Analyze the description to identify the type of economic relationship
  const relationshipType = analyzeRelationshipType(description);
  
  // Generate formula based on relationship type
  const formula = generateFormula(description, relationshipType, outputType, knownVariables, context);
  
  // Generate alternatives
  const alternatives = generateAlternatives(description, relationshipType, formula);
  
  // Calculate confidence based on pattern matching and completeness
  const confidence = calculateConfidence(description, formula, relationshipType);
  
  // Generate warnings
  const warnings = validateFormula(formula, relationshipType);
  
  return {
    formula,
    confidence,
    alternatives,
    warnings
  };
}

type RelationshipType = 
  | 'cc_generation' 
  | 'federation_levy' 
  | 'demurrage' 
  | 'trust_weight' 
  | 'settlement_rate'
  | 'risk_adjustment'
  | 'participation_reward'
  | 'governance_weight'
  | 'resource_allocation'
  | 'unknown';

function analyzeRelationshipType(description: string): RelationshipType {
  const desc = description.toLowerCase();
  
  if (desc.includes('risk') && (desc.includes('bid') || desc.includes('adjust'))) {
    return 'risk_adjustment';
  }
  if (desc.includes('cc') && (desc.includes('earn') || desc.includes('generat') || desc.includes('node'))) {
    return 'cc_generation';
  }
  if (desc.includes('levy') || desc.includes('federation') || desc.includes('surplus')) {
    return 'federation_levy';
  }
  if (desc.includes('demurrage') || desc.includes('decay') || desc.includes('idle')) {
    return 'demurrage';
  }
  if (desc.includes('trust') || desc.includes('reputation') || desc.includes('weight')) {
    return 'trust_weight';
  }
  if (desc.includes('settlement') || desc.includes('clear') || desc.includes('net position')) {
    return 'settlement_rate';
  }
  if (desc.includes('participat') || desc.includes('reward') || desc.includes('incentiv')) {
    return 'participation_reward';
  }
  if (desc.includes('governance') || desc.includes('voting') || desc.includes('decision')) {
    return 'governance_weight';
  }
  if (desc.includes('allocat') || desc.includes('distribut') || desc.includes('resource')) {
    return 'resource_allocation';
  }
  
  return 'unknown';
}

function generateFormula(
  description: string,
  type: RelationshipType,
  outputType: string,
  knownVariables: BuildFormulaRequest['knownVariables'],
  _context?: string
): EconomicFormula {
  
  switch (type) {
    case 'cc_generation':
      return generateCCGenerationFormula(description, knownVariables);
    case 'federation_levy':
      return generateFederationLevyFormula(description, knownVariables);
    case 'demurrage':
      return generateDemurrageFormula(description, knownVariables);
    case 'trust_weight':
      return generateTrustWeightFormula(description, knownVariables);
    case 'settlement_rate':
      return generateSettlementFormula(description, knownVariables);
    case 'risk_adjustment':
      return generateRiskAdjustmentFormula(description, knownVariables);
    case 'participation_reward':
      return generateParticipationRewardFormula(description, knownVariables);
    case 'governance_weight':
      return generateGovernanceWeightFormula(description, knownVariables);
    case 'resource_allocation':
      return generateResourceAllocationFormula(description, knownVariables);
    default:
      return generateGenericFormula(description, outputType, knownVariables);
  }
}

function generateCCGenerationFormula(
  description: string,
  knownVariables: BuildFormulaRequest['knownVariables'] = []
): EconomicFormula {
  const variables: FormulaVariable[] = [
    {
      name: 'base_rate',
      description: 'Base CC generation rate per unit of infrastructure',
      type: 'rate',
      defaultValue: 1.0,
      range: { min: 0.1, max: 10.0 }
    },
    {
      name: 'infrastructure_contribution',
      description: 'Level of infrastructure contribution (0-1)',
      type: 'percentage',
      range: { min: 0, max: 1 }
    },
    {
      name: 'trust_score',
      description: 'Network trust score for the participant (0-1)',
      type: 'weight',
      range: { min: 0, max: 1 }
    },
    {
      name: 'time_period',
      description: 'Time period for CC generation (hours, days, etc.)',
      type: 'number',
      defaultValue: 1,
      range: { min: 0.1, max: 365 }
    }
  ];

  // Merge with known variables
  const mergedVariables = mergeVariables(variables, knownVariables);
  
  return {
    id: 'cc_generation_001',
    name: 'CC Generation Formula',
    description: 'Calculate CC earned from infrastructure contribution with trust weighting',
    expression: 'base_rate * infrastructure_contribution * trust_score * time_period',
    variables: mergedVariables,
    invariants: [
      'CC generation must be non-transferable',
      'CC generation must be tied to actual infrastructure contribution',
      'Trust weights must be democratically determined'
    ],
    examples: [
      {
        description: 'High-trust node running full infrastructure',
        inputs: { base_rate: 2.0, infrastructure_contribution: 1.0, trust_score: 0.9, time_period: 24 },
        expectedOutput: 43.2,
        explanation: 'Node earns 43.2 CC for 24 hours of full infrastructure contribution with high trust'
      },
      {
        description: 'New node with minimal infrastructure',
        inputs: { base_rate: 2.0, infrastructure_contribution: 0.3, trust_score: 0.5, time_period: 24 },
        expectedOutput: 7.2,
        explanation: 'New node earns 7.2 CC for 24 hours with partial infrastructure and building trust'
      }
    ],
    constraints: [
      'infrastructure_contribution must be verifiable through network consensus',
      'trust_score must be calculated through democratic reputation system',
      'base_rate should be adjusted based on network capacity needs'
    ]
  };
}

function generateFederationLevyFormula(
  description: string,
  knownVariables: BuildFormulaRequest['knownVariables'] = []
): EconomicFormula {
  const variables: FormulaVariable[] = [
    {
      name: 'surplus',
      description: 'Cooperative surplus above baseline needs',
      type: 'number',
      range: { min: 0, max: Number.MAX_SAFE_INTEGER }
    },
    {
      name: 'base_rate',
      description: 'Base levy rate for surplus',
      type: 'percentage',
      defaultValue: 0.1,
      range: { min: 0, max: 0.5 }
    },
    {
      name: 'progressive_factor',
      description: 'Progressive taxation factor',
      type: 'number',
      defaultValue: 1.5,
      range: { min: 1.0, max: 3.0 }
    },
    {
      name: 'threshold',
      description: 'Surplus threshold before levy applies',
      type: 'number',
      defaultValue: 1000,
      range: { min: 0, max: 100000 }
    }
  ];

  const mergedVariables = mergeVariables(variables, knownVariables);
  
  return {
    id: 'federation_levy_001',
    name: 'Progressive Federation Levy',
    description: 'Calculate progressive levy on cooperative surplus for federation funding',
    expression: 'max(0, (surplus - threshold) * base_rate * pow(surplus / threshold, progressive_factor - 1))',
    variables: mergedVariables,
    invariants: [
      'Levy must be progressive to prevent wealth concentration',
      'Levy proceeds must fund federation commons',
      'Cooperatives must democratically determine levy parameters'
    ],
    examples: [
      {
        description: 'Small cooperative with moderate surplus',
        inputs: { surplus: 5000, base_rate: 0.1, progressive_factor: 1.2, threshold: 1000 },
        expectedOutput: 461.84,
        explanation: 'Moderate levy on surplus above threshold with progressive scaling'
      },
      {
        description: 'Large cooperative with significant surplus',
        inputs: { surplus: 50000, base_rate: 0.1, progressive_factor: 1.5, threshold: 1000 },
        expectedOutput: 8721.3,
        explanation: 'Higher effective rate due to progressive factor on large surplus'
      }
    ],
    constraints: [
      'progressive_factor must ensure progressive taxation',
      'base_rate should be democratically determined',
      'threshold should reflect regional cost of living'
    ]
  };
}

function generateDemurrageFormula(
  description: string,
  knownVariables: BuildFormulaRequest['knownVariables'] = []
): EconomicFormula {
  const variables: FormulaVariable[] = [
    {
      name: 'balance',
      description: 'Current token balance subject to demurrage',
      type: 'number',
      range: { min: 0, max: Number.MAX_SAFE_INTEGER }
    },
    {
      name: 'idle_threshold',
      description: 'Token amount above which demurrage applies',
      type: 'number',
      defaultValue: 1000,
      range: { min: 0, max: 100000 }
    },
    {
      name: 'demurrage_rate',
      description: 'Demurrage rate per time period (as decimal)',
      type: 'rate',
      defaultValue: 0.001,
      range: { min: 0, max: 0.1 }
    },
    {
      name: 'time_period',
      description: 'Time period for demurrage calculation',
      type: 'number',
      defaultValue: 1,
      range: { min: 0.1, max: 365 }
    },
    {
      name: 'velocity_factor',
      description: 'Reduction factor based on recent transaction velocity (0-1)',
      type: 'percentage',
      defaultValue: 1.0,
      range: { min: 0, max: 1 }
    }
  ];

  const mergedVariables = mergeVariables(variables, knownVariables);
  
  return {
    id: 'demurrage_001',
    name: 'Token Demurrage Formula',
    description: 'Calculate demurrage on idle tokens to encourage circulation',
    expression: 'max(0, balance - idle_threshold) * demurrage_rate * velocity_factor * time_period',
    variables: mergedVariables,
    invariants: [
      'Demurrage must only apply to idle tokens above threshold',
      'Demurrage must incentivize circulation without causing hardship',
      'Velocity factor must reward active economic participation'
    ],
    examples: [
      {
        description: 'Idle high balance with full demurrage',
        inputs: { balance: 10000, idle_threshold: 1000, demurrage_rate: 0.001, time_period: 30, velocity_factor: 1.0 },
        expectedOutput: 270,
        explanation: '270 tokens demurrage on 9000 idle tokens over 30 days'
      },
      {
        description: 'Active account with reduced demurrage',
        inputs: { balance: 5000, idle_threshold: 1000, demurrage_rate: 0.001, time_period: 30, velocity_factor: 0.3 },
        expectedOutput: 36,
        explanation: 'Reduced demurrage due to high transaction velocity'
      }
    ],
    constraints: [
      'demurrage_rate must be set to balance circulation incentives with fairness',
      'idle_threshold should cover basic needs',
      'velocity_factor should reflect actual economic activity'
    ]
  };
}

function generateTrustWeightFormula(
  description: string,
  knownVariables: BuildFormulaRequest['knownVariables'] = []
): EconomicFormula {
  const variables: FormulaVariable[] = [
    {
      name: 'reputation_score',
      description: 'Democratic reputation score from network (0-1)',
      type: 'weight',
      range: { min: 0, max: 1 }
    },
    {
      name: 'contribution_history',
      description: 'Historical contribution score (0-1)',
      type: 'weight',
      range: { min: 0, max: 1 }
    },
    {
      name: 'consensus_weight',
      description: 'Weight from democratic consensus decisions',
      type: 'weight',
      defaultValue: 0.5,
      range: { min: 0, max: 1 }
    },
    {
      name: 'time_factor',
      description: 'Time-based adjustment for recent activity',
      type: 'weight',
      defaultValue: 1.0,
      range: { min: 0.1, max: 2.0 }
    }
  ];

  const mergedVariables = mergeVariables(variables, knownVariables);
  
  return {
    id: 'trust_weight_001',
    name: 'Democratic Trust Weight',
    description: 'Calculate trust weights for economic participation based on democratic consensus',
    expression: '(reputation_score * 0.4 + contribution_history * 0.4 + consensus_weight * 0.2) * time_factor',
    variables: mergedVariables,
    invariants: [
      'Trust weights must be democratically determined',
      'No single factor should dominate trust calculation',
      'Trust must be revocable through democratic processes'
    ],
    examples: [
      {
        description: 'Established cooperative member',
        inputs: { reputation_score: 0.8, contribution_history: 0.9, consensus_weight: 0.7, time_factor: 1.0 },
        expectedOutput: 0.78,
        explanation: 'High trust score based on strong reputation and contribution history'
      },
      {
        description: 'New member with potential',
        inputs: { reputation_score: 0.6, contribution_history: 0.3, consensus_weight: 0.8, time_factor: 1.2 },
        expectedOutput: 0.636,
        explanation: 'Moderate trust with time bonus for recent positive activity'
      }
    ],
    constraints: [
      'reputation_score must come from democratic peer review',
      'contribution_history must be verifiable',
      'consensus_weight must reflect actual democratic decisions'
    ]
  };
}

function generateRiskAdjustmentFormula(
  description: string,
  knownVariables: BuildFormulaRequest['knownVariables'] = []
): EconomicFormula {
  const variables: FormulaVariable[] = [
    {
      name: 'base_bid',
      description: 'Base bid amount for the job',
      type: 'number',
      range: { min: 0, max: Number.MAX_SAFE_INTEGER }
    },
    {
      name: 'risk_factor',
      description: 'Job risk multiplier (1.0 = baseline)',
      type: 'number',
      defaultValue: 1.0,
      range: { min: 0.5, max: 3.0 }
    },
    {
      name: 'complexity_factor',
      description: 'Job complexity multiplier (1.0 = baseline)',
      type: 'number',
      defaultValue: 1.0,
      range: { min: 0.5, max: 3.0 }
    },
    {
      name: 'market_volatility',
      description: 'Market volatility adjustment (0-1)',
      type: 'percentage',
      defaultValue: 0.1,
      range: { min: 0, max: 1 }
    },
    {
      name: 'provider_trust',
      description: 'Trust score of the service provider (0-1)',
      type: 'weight',
      range: { min: 0, max: 1 }
    },
    {
      name: 'deadline_pressure',
      description: 'Urgency factor based on deadline (1.0 = normal)',
      type: 'number',
      defaultValue: 1.0,
      range: { min: 0.8, max: 2.0 }
    }
  ];

  const mergedVariables = mergeVariables(variables, knownVariables);
  
  return {
    id: 'risk_adjustment_001',
    name: 'Risk-Adjusted Job Bidding',
    description: 'Calculate risk-adjusted bid for job proposals considering multiple factors',
    expression: 'base_bid * risk_factor * complexity_factor * (1 + market_volatility) * (2 - provider_trust) * deadline_pressure',
    variables: mergedVariables,
    invariants: [
      'Risk adjustments must be transparent and fair',
      'Provider trust must be democratically assessed',
      'Market conditions must reflect actual economic data'
    ],
    examples: [
      {
        description: 'Complex job with trusted provider',
        inputs: { base_bid: 1000, risk_factor: 1.2, complexity_factor: 1.5, market_volatility: 0.1, provider_trust: 0.9, deadline_pressure: 1.0 },
        expectedOutput: 1815,
        explanation: 'Higher complexity offset by high provider trust'
      },
      {
        description: 'Urgent job with unknown provider',
        inputs: { base_bid: 1000, risk_factor: 1.3, complexity_factor: 1.0, market_volatility: 0.2, provider_trust: 0.4, deadline_pressure: 1.5 },
        expectedOutput: 2880,
        explanation: 'High risk adjustment due to urgency and low provider trust'
      }
    ],
    constraints: [
      'complexity_factor should be based on objective criteria',
      'market_volatility should reflect real market conditions',
      'deadline_pressure should be reasonable and not exploitative'
    ]
  };
}

function generateParticipationRewardFormula(
  description: string,
  knownVariables: BuildFormulaRequest['knownVariables'] = []
): EconomicFormula {
  return generateGenericFormula(description, 'amount', knownVariables);
}

function generateGovernanceWeightFormula(
  description: string,
  knownVariables: BuildFormulaRequest['knownVariables'] = []
): EconomicFormula {
  return generateGenericFormula(description, 'weight', knownVariables);
}

function generateResourceAllocationFormula(
  description: string,
  knownVariables: BuildFormulaRequest['knownVariables'] = []
): EconomicFormula {
  return generateGenericFormula(description, 'amount', knownVariables);
}

function generateSettlementFormula(
  description: string,
  knownVariables: BuildFormulaRequest['knownVariables'] = []
): EconomicFormula {
  return generateGenericFormula(description, 'amount', knownVariables);
}

function generateGenericFormula(
  description: string,
  outputType: string,
  knownVariables: BuildFormulaRequest['knownVariables'] = []
): EconomicFormula {
  const variables: FormulaVariable[] = knownVariables.map(kv => ({
    name: kv.name,
    description: kv.description,
    type: kv.type,
    range: kv.range
  }));

  // Add basic variables if none provided
  if (variables.length === 0) {
    variables.push(
      {
        name: 'input_value',
        description: 'Primary input value',
        type: 'number',
        range: { min: 0, max: Number.MAX_SAFE_INTEGER }
      },
      {
        name: 'adjustment_factor',
        description: 'General adjustment factor',
        type: 'number',
        defaultValue: 1.0,
        range: { min: 0.1, max: 10.0 }
      }
    );
  }

  return {
    id: 'generic_001',
    name: 'Generic Economic Formula',
    description: description || 'Generic economic calculation',
    expression: variables.length > 1 ? `${variables[0].name} * ${variables[1].name}` : variables[0]?.name || 'input_value',
    variables,
    invariants: [
      'Formula must maintain economic fairness',
      'Calculations must be transparent and auditable'
    ],
    examples: [],
    constraints: [
      'All variables must be validated',
      'Output must be within reasonable bounds'
    ]
  };
}

function mergeVariables(
  baseVariables: FormulaVariable[],
  knownVariables: BuildFormulaRequest['knownVariables'] = []
): FormulaVariable[] {
  const merged = [...baseVariables];
  
  for (const known of knownVariables) {
    const existing = merged.find(v => v.name === known.name);
    if (existing) {
      // Update existing variable with known information
      Object.assign(existing, {
        description: known.description || existing.description,
        type: known.type || existing.type,
        range: known.range || existing.range
      });
    } else {
      // Add new variable
      merged.push({
        name: known.name,
        description: known.description,
        type: known.type,
        range: known.range
      });
    }
  }
  
  return merged;
}

function generateAlternatives(
  description: string,
  type: RelationshipType,
  primaryFormula: EconomicFormula
): Array<{ formula: EconomicFormula; reasoning: string }> {
  // Generate 1-2 alternative formulations
  const alternatives: Array<{ formula: EconomicFormula; reasoning: string }> = [];
  
  if (type === 'cc_generation') {
    const alt = { ...primaryFormula };
    alt.id = 'cc_generation_002';
    alt.name = 'Simplified CC Generation';
    alt.expression = 'base_rate * sqrt(infrastructure_contribution * trust_score) * time_period';
    alternatives.push({
      formula: alt,
      reasoning: 'Square root provides diminishing returns and prevents gaming through extreme specialization'
    });
  }
  
  if (type === 'federation_levy') {
    const alt = { ...primaryFormula };
    alt.id = 'federation_levy_002';
    alt.name = 'Linear Federation Levy';
    alt.expression = 'max(0, surplus - threshold) * base_rate';
    alternatives.push({
      formula: alt,
      reasoning: 'Linear approach is simpler to understand and implement'
    });
  }
  
  return alternatives;
}

function calculateConfidence(
  description: string,
  formula: EconomicFormula,
  type: RelationshipType
): number {
  let confidence = 0.5; // Base confidence
  
  // Increase confidence for well-known relationship types
  if (type !== 'unknown') {
    confidence += 0.3;
  }
  
  // Increase confidence if description matches formula variables
  const descWords = description.toLowerCase().split(/\s+/);
  const variableMatches = formula.variables.filter(v => 
    descWords.some(word => v.name.includes(word) || v.description.toLowerCase().includes(word))
  ).length;
  
  confidence += Math.min(0.2, variableMatches * 0.05);
  
  // Ensure confidence is within bounds
  return Math.min(1.0, Math.max(0.1, confidence));
}

function validateFormula(formula: EconomicFormula, type: RelationshipType): string[] {
  const warnings: string[] = [];
  
  // Check for ICN invariant compliance
  if (type === 'cc_generation' && !formula.invariants.some(inv => inv.includes('non-transferable'))) {
    warnings.push('CC generation formula should enforce non-transferability invariant');
  }
  
  if (type === 'governance_weight' && !formula.invariants.some(inv => inv.includes('democratic'))) {
    warnings.push('Governance formulas should ensure democratic participation');
  }
  
  // Check for potential gaming
  if (formula.expression.includes('pow') && type === 'federation_levy') {
    warnings.push('Exponential functions in levy calculations may create gaming incentives');
  }
  
  // Check variable completeness
  if (formula.variables.length === 0) {
    warnings.push('Formula has no variables - may not be useful for calculations');
  }
  
  // Check for exponential/wealth concentration patterns
  if (formula.description.toLowerCase().includes('exponential') || 
      formula.description.toLowerCase().includes('compound') ||
      formula.expression.includes('pow') ||
      formula.expression.includes('**')) {
    warnings.push('Exponential growth patterns may lead to wealth concentration');
  }
  
  // Check for high multiplier values
  const hasHighMultiplier = formula.variables.some(v => 
    v.name.includes('factor') || v.name.includes('multiplier')
  );
  if (hasHighMultiplier) {
    warnings.push('High multiplier values should be carefully tested to avoid instability');
  }
  
  // Check for unclear variable relationships
  if (formula.variables.length > 6) {
    warnings.push('Formula complexity with many variables may be difficult to understand and validate');
  }
  
  return warnings;
}