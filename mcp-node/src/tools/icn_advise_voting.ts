export interface GovernanceScenario {
  /** Description of the governance scenario */
  description: string;
  /** Number of participants */
  participantCount: number;
  /** Decision context */
  context: {
    /** Type of decision */
    decisionType: 'election' | 'allocation' | 'policy' | 'constitutional' | 'emergency';
    /** Scope of impact */
    scope: 'local' | 'regional' | 'federation' | 'global';
    /** Urgency level */
    urgency: 'low' | 'medium' | 'high' | 'critical';
  };
  /** Participant characteristics */
  participants: {
    /** Expertise distribution */
    expertiseLevels: 'uniform' | 'varied' | 'highly_specialized';
    /** Stake distribution */
    stakeDistribution: 'equal' | 'proportional' | 'weighted' | 'highly_unequal';
    /** Trust levels between participants */
    trustNetwork: 'high_trust' | 'moderate_trust' | 'low_trust' | 'fragmented';
  };
  /** Constraints and requirements */
  constraints: {
    /** Time constraints */
    timeLimit?: number;
    /** Legitimacy requirements */
    legitimacyRequirements: string[];
    /** Fairness criteria */
    fairnessCriteria: string[];
    /** Resource constraints */
    resourceLimits?: string[];
  };
}

export interface VotingGoals {
  /** Primary objectives for the voting mechanism */
  objectives: Array<'legitimacy' | 'efficiency' | 'fairness' | 'expertise' | 'participation' | 'transparency'>;
  /** Relative importance weights (0-1) */
  weights: Record<string, number>;
  /** Success criteria */
  successCriteria: string[];
}

export interface VotingMechanismOption {
  /** Mechanism name */
  name: string;
  /** Mechanism type */
  type: 'direct' | 'representative' | 'liquid' | 'quadratic' | 'ranked_choice' | 'consensus' | 'sortition';
  /** Detailed description */
  description: string;
  /** Configuration parameters */
  parameters: Record<string, any>;
  /** Strengths for this scenario */
  strengths: string[];
  /** Weaknesses and concerns */
  weaknesses: string[];
  /** Suitability score (0-1) */
  suitabilityScore: number;
  /** Implementation complexity */
  complexity: 'low' | 'medium' | 'high';
  /** Manipulation resistance */
  manipulationResistance: 'low' | 'medium' | 'high';
  /** Resource requirements */
  resourceRequirements: string[];
}

export interface ManipulationVector {
  /** Vector name */
  name: string;
  /** Severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Description of the manipulation */
  description: string;
  /** Conditions that enable this manipulation */
  enablingConditions: string[];
  /** Potential impact */
  impact: string;
  /** Mitigation strategies */
  mitigations: string[];
  /** Detection mechanisms */
  detectionMethods: string[];
}

export interface VotingAdvice {
  primary: {
    mechanism: 'quadratic' | 'ranked_choice' | 'approval' | 'consensus' | 'hybrid' | 'sortition' | 'simple_majority' | 'supermajority';
    params: Record<string, unknown>;
  };
  alternatives: Array<{ mechanism: string; params: Record<string, unknown>; whenPreferable: string }>;
  tradeoffs: string[]; // participation vs expertise, speed vs deliberation, etc.
  risks: string[];     // e.g., identity manipulation, vote buying, delegation capture
  manipulationVectors: string[];
  requiredResources: { engineeringDays: number; opsHours: number; infraNotes: string[] };
  timelineEstimateDays: number;
  rationale: string[];
  confidence: number; // 0..1
}

export interface DelegationGraph {
  /** Delegation relationships */
  delegations: Array<{
    from: string;
    to: string;
    weight?: number;
  }>;
  /** Delegation chains */
  chains: Array<{
    chain: string[];
    length: number;
    totalWeight: number;
  }>;
  /** Power concentration metrics */
  concentration: {
    /** In-degree distribution */
    inDegree: Record<string, number>;
    /** PageRank-style centrality */
    centrality: Record<string, number>;
    /** Gini coefficient of power distribution */
    giniCoefficient: number;
  };
  /** Cycle detection */
  cycles: Array<{
    participants: string[];
    cycleType: 'direct' | 'indirect';
  }>;
  /** Warnings */
  warnings: Array<{
    type: 'excessive_depth' | 'cycle_detected' | 'power_concentration';
    severity: 'low' | 'medium' | 'high';
    description: string;
    affectedParticipants: string[];
  }>;
}

const MAX_DELEGATION_DEPTH = 5;
const CONCENTRATION_THRESHOLD = 2; // Standard deviations above mean

/**
 * Analyze governance scenarios and recommend optimal voting mechanisms
 */
export async function icnAdviseVoting(
  scenario: GovernanceScenario, 
  goals: VotingGoals
): Promise<VotingAdvice> {
  // Analyze the scenario context
  const scenarioAnalysis = analyzeScenario(scenario);
  
  // Generate voting mechanism options
  const mechanismOptions = generateVotingOptions(scenario, goals);
  
  // Select best recommendation
  const recommendation = selectRecommendation(mechanismOptions, scenario, goals);
  
  // Analyze trade-offs
  const tradeOffs = analyzeTradeOffs(mechanismOptions, scenario, goals);
  
  // Identify manipulation vectors
  const manipulationWarnings = identifyManipulationVectors(recommendation.primary, scenario);
  
  // Perform delegation analysis if liquid democracy is involved
  let delegationAnalysis;
  if (recommendation.primary.type === 'liquid' || 
      mechanismOptions.some(option => option.type === 'liquid')) {
    delegationAnalysis = analyzeDelegationGraph(scenario);
  }
  
  // Generate implementation guidance
  const implementation = generateImplementationGuidance(recommendation.primary, scenario);
  
  // Convert to new VotingAdvice format
  return {
    primary: {
      mechanism: mapMechanismType(recommendation.primary.type),
      params: recommendation.primary.parameters || {}
    },
    alternatives: recommendation.alternatives.map(alt => ({
      mechanism: alt.type,
      params: alt.parameters || {},
      whenPreferable: `Better when: ${alt.strengths.slice(0, 2).join(', ')}`
    })),
    tradeoffs: tradeOffs.considerations.map(c => `${c.aspect}: ${c.rationale}`),
    risks: scenarioAnalysis.keyChallenges,
    manipulationVectors: manipulationWarnings.map(w => w.name),
    requiredResources: {
      engineeringDays: Math.ceil(implementation.timelineEstimate * 0.6),
      opsHours: Math.ceil(implementation.timelineEstimate * 8),
      infraNotes: implementation.setupRequirements
    },
    timelineEstimateDays: implementation.timelineEstimate,
    rationale: [
      `Selected ${recommendation.primary.name} based on scenario requirements`,
      `Suitability score: ${recommendation.primary.suitabilityScore.toFixed(2)}`,
      ...delegationAnalysis?.warnings.map(w => w.description) || []
    ],
    confidence: recommendation.primary.suitabilityScore
  };
}

function mapMechanismType(type: string): VotingAdvice['primary']['mechanism'] {
  switch (type) {
    case 'direct': return 'simple_majority';
    case 'quadratic': return 'quadratic';
    case 'ranked_choice': return 'ranked_choice';
    case 'consensus': return 'consensus';
    case 'liquid': return 'hybrid';
    case 'sortition': return 'sortition';
    default: return 'simple_majority';
  }
}

function analyzeDelegationGraph(scenario: GovernanceScenario): DelegationGraph {
  // Simulate delegation relationships based on scenario
  const participants = Array.from({ length: scenario.participantCount }, (_, i) => `participant_${i}`);
  const delegations = generateSimulatedDelegations(participants, scenario);
  
  // Build delegation chains
  const chains = buildDelegationChains(delegations);
  
  // Calculate power concentration
  const concentration = calculatePowerConcentration(delegations, participants);
  
  // Detect cycles
  const cycles = detectDelegationCycles(delegations);
  
  // Generate warnings
  const warnings = generateDelegationWarnings(chains, concentration, cycles);
  
  return {
    delegations,
    chains,
    concentration,
    cycles,
    warnings
  };
}

function generateSimulatedDelegations(
  participants: string[], 
  scenario: GovernanceScenario
): DelegationGraph['delegations'] {
  const delegations: DelegationGraph['delegations'] = [];
  
  // Simulate delegation patterns based on trust network
  const delegationRate = scenario.participants.trustNetwork === 'high_trust' ? 0.4 :
                        scenario.participants.trustNetwork === 'moderate_trust' ? 0.2 : 0.1;
  
  for (let i = 0; i < participants.length; i++) {
    if (Math.random() < delegationRate) {
      // Delegate to someone with higher index (simulating expertise delegation)
      const possibleDelegates = participants.slice(i + 1);
      if (possibleDelegates.length > 0) {
        const delegateTo = possibleDelegates[Math.floor(Math.random() * possibleDelegates.length)];
        delegations.push({
          from: participants[i],
          to: delegateTo,
          weight: 1
        });
      }
    }
  }
  
  return delegations;
}

function buildDelegationChains(delegations: DelegationGraph['delegations']): DelegationGraph['chains'] {
  const delegationMap = new Map<string, string>();
  
  // Build delegation mapping
  for (const delegation of delegations) {
    delegationMap.set(delegation.from, delegation.to);
  }
  
  const chains: DelegationGraph['chains'] = [];
  const visited = new Set<string>();
  
  // Find all delegation chains
  for (const delegation of delegations) {
    if (visited.has(delegation.from)) continue;
    
    const chain = [delegation.from];
    let current = delegation.from;
    let totalWeight = 0;
    
    // Follow the chain
    while (delegationMap.has(current) && chain.length < MAX_DELEGATION_DEPTH) {
      const next = delegationMap.get(current)!;
      
      // Check for cycles
      if (chain.includes(next)) {
        break;
      }
      
      chain.push(next);
      current = next;
      totalWeight += delegation.weight || 1;
      
      if (chain.length >= MAX_DELEGATION_DEPTH) {
        break;
      }
    }
    
    if (chain.length > 1) {
      chains.push({
        chain,
        length: chain.length,
        totalWeight
      });
      
      // Mark all participants in chain as visited
      chain.forEach(participant => visited.add(participant));
    }
  }
  
  return chains;
}

function calculatePowerConcentration(
  delegations: DelegationGraph['delegations'],
  participants: string[]
): DelegationGraph['concentration'] {
  const inDegree: Record<string, number> = {};
  const centrality: Record<string, number> = {};
  
  // Initialize
  participants.forEach(p => {
    inDegree[p] = 0;
    centrality[p] = 1;
  });
  
  // Calculate in-degree (direct delegations)
  delegations.forEach(delegation => {
    inDegree[delegation.to] += delegation.weight || 1;
  });
  
  // Simple PageRank-style centrality calculation
  for (let iter = 0; iter < 10; iter++) {
    const newCentrality: Record<string, number> = {};
    
    participants.forEach(p => {
      newCentrality[p] = 0.15; // Damping factor
    });
    
    delegations.forEach(delegation => {
      const weight = delegation.weight || 1;
      newCentrality[delegation.to] += 0.85 * centrality[delegation.from] * weight;
    });
    
    Object.assign(centrality, newCentrality);
  }
  
  // Calculate Gini coefficient
  const centralityValues = Object.values(centrality);
  const giniCoefficient = calculateGiniCoefficient(centralityValues);
  
  return {
    inDegree,
    centrality,
    giniCoefficient
  };
}

function detectDelegationCycles(delegations: DelegationGraph['delegations']): DelegationGraph['cycles'] {
  const delegationMap = new Map<string, string>();
  const cycles: DelegationGraph['cycles'] = [];
  
  // Build delegation mapping
  for (const delegation of delegations) {
    delegationMap.set(delegation.from, delegation.to);
  }
  
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  
  function dfs(node: string, path: string[]): boolean {
    if (recursionStack.has(node)) {
      // Found a cycle
      const cycleStart = path.indexOf(node);
      const cycle = path.slice(cycleStart);
      cycles.push({
        participants: cycle,
        cycleType: cycle.length === 2 ? 'direct' : 'indirect'
      });
      return true;
    }
    
    if (visited.has(node)) {
      return false;
    }
    
    visited.add(node);
    recursionStack.add(node);
    path.push(node);
    
    const next = delegationMap.get(node);
    if (next) {
      dfs(next, [...path]);
    }
    
    recursionStack.delete(node);
    return false;
  }
  
  // Check each node for cycles
  for (const [from] of delegationMap) {
    if (!visited.has(from)) {
      dfs(from, []);
    }
  }
  
  return cycles;
}

function generateDelegationWarnings(
  chains: DelegationGraph['chains'],
  concentration: DelegationGraph['concentration'],
  cycles: DelegationGraph['cycles']
): DelegationGraph['warnings'] {
  const warnings: DelegationGraph['warnings'] = [];
  
  // Check for excessive chain depth
  const longChains = chains.filter(chain => chain.length >= MAX_DELEGATION_DEPTH);
  if (longChains.length > 0) {
    warnings.push({
      type: 'excessive_depth',
      severity: 'medium',
      description: `${longChains.length} delegation chains exceed maximum depth of ${MAX_DELEGATION_DEPTH}`,
      affectedParticipants: longChains.flatMap(chain => chain.chain)
    });
  }
  
  // Check for cycles
  if (cycles.length > 0) {
    warnings.push({
      type: 'cycle_detected',
      severity: 'high',
      description: `${cycles.length} delegation cycles detected, which can cause infinite loops`,
      affectedParticipants: cycles.flatMap(cycle => cycle.participants)
    });
  }
  
  // Check for power concentration
  const centralityValues = Object.values(concentration.centrality);
  const mean = centralityValues.reduce((sum, val) => sum + val, 0) / centralityValues.length;
  const stdDev = Math.sqrt(centralityValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / centralityValues.length);
  const threshold = mean + CONCENTRATION_THRESHOLD * stdDev;
  
  const highCentralityNodes = Object.entries(concentration.centrality)
    .filter(([, centrality]) => centrality > threshold)
    .map(([node]) => node);
  
  if (highCentralityNodes.length > 0) {
    warnings.push({
      type: 'power_concentration',
      severity: 'medium',
      description: `${highCentralityNodes.length} participants have disproportionately high delegation power`,
      affectedParticipants: highCentralityNodes
    });
  }
  
  return warnings;
}

function calculateGiniCoefficient(values: number[]): number {
  if (values.length === 0) return 0;
  
  const sortedValues = [...values].sort((a, b) => a - b);
  const n = sortedValues.length;
  const sum = sortedValues.reduce((a, b) => a + b, 0);
  
  if (sum === 0) return 0;
  
  let gini = 0;
  for (let i = 0; i < n; i++) {
    gini += (2 * (i + 1) - n - 1) * sortedValues[i];
  }
  
  return gini / (n * sum);
}

function analyzeScenario(scenario: GovernanceScenario) {
  const challenges: string[] = [];
  const successFactors: string[] = [];
  let riskLevel: 'low' | 'medium' | 'high' = 'low';
  
  // Analyze participant count impact
  if (scenario.participantCount > 1000) {
    challenges.push('Large-scale coordination challenges');
    successFactors.push('Scalable mechanism design');
  } else if (scenario.participantCount < 10) {
    challenges.push('Limited legitimacy from small group');
    successFactors.push('High participation rates');
  }
  
  // Analyze expertise distribution
  if (scenario.participants.expertiseLevels === 'highly_specialized') {
    challenges.push('Knowledge asymmetries between participants');
    successFactors.push('Expertise-weighted or advisory mechanisms');
  } else if (scenario.participants.expertiseLevels === 'uniform') {
    successFactors.push('Equal participation feasibility');
  }
  
  // Analyze stake distribution
  if (scenario.participants.stakeDistribution === 'highly_unequal') {
    challenges.push('Wealth-based influence concentration risk');
    riskLevel = 'high';
    successFactors.push('Stake-independent voting rights');
  }
  
  // Analyze trust network
  if (scenario.participants.trustNetwork === 'low_trust' || scenario.participants.trustNetwork === 'fragmented') {
    challenges.push('Low trust environment hampering cooperation');
    riskLevel = riskLevel === 'high' ? 'high' : 'medium';
    successFactors.push('Transparent and verifiable processes');
  }
  
  // Analyze decision context
  if (scenario.context.urgency === 'critical') {
    challenges.push('Time pressure limiting deliberation');
    successFactors.push('Rapid decision-making capability');
  }
  
  if (scenario.context.decisionType === 'constitutional') {
    challenges.push('High legitimacy requirements for foundational changes');
    successFactors.push('Broad consensus and supermajority support');
    riskLevel = riskLevel === 'low' ? 'medium' : 'high';
  }
  
  return {
    keyChallenges: challenges,
    criticalSuccessFactors: successFactors,
    riskLevel
  };
}

function generateVotingOptions(scenario: GovernanceScenario, goals: VotingGoals): VotingMechanismOption[] {
  const options: VotingMechanismOption[] = [];
  
  // Direct Democracy Option
  options.push(generateDirectDemocracyOption(scenario, goals));
  
  // Liquid Democracy Option  
  options.push(generateLiquidDemocracyOption(scenario, goals));
  
  // Quadratic Voting Option
  if (scenario.context.decisionType === 'allocation') {
    options.push(generateQuadraticVotingOption(scenario, goals));
  }
  
  // Ranked Choice Option
  if (scenario.context.decisionType === 'election') {
    options.push(generateRankedChoiceOption(scenario, goals));
  }
  
  // Consensus Option
  if (scenario.participantCount <= 50) {
    options.push(generateConsensusOption(scenario, goals));
  }
  
  // Sortition Option
  if (scenario.participantCount > 100) {
    options.push(generateSortitionOption(scenario, goals));
  }
  
  return options.sort((a, b) => b.suitabilityScore - a.suitabilityScore);
}

function generateDirectDemocracyOption(scenario: GovernanceScenario, goals: VotingGoals): VotingMechanismOption {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  let score = 0.5;
  
  // Analyze strengths
  if (goals.objectives.includes('participation')) {
    strengths.push('Maximum direct participation');
    score += 0.2;
  }
  if (goals.objectives.includes('transparency')) {
    strengths.push('Simple and transparent process');
    score += 0.15;
  }
  if (scenario.participants.expertiseLevels === 'uniform') {
    strengths.push('Suitable for equal expertise levels');
    score += 0.1;
  }
  
  // Analyze weaknesses
  if (scenario.participantCount > 500) {
    weaknesses.push('Scalability challenges with large groups');
    score -= 0.2;
  }
  if (scenario.participants.expertiseLevels === 'highly_specialized') {
    weaknesses.push('Does not leverage specialized expertise');
    score -= 0.15;
  }
  if (scenario.context.urgency === 'critical') {
    weaknesses.push('May be too slow for urgent decisions');
    score -= 0.1;
  }
  
  return {
    name: 'Direct Democracy',
    type: 'direct',
    description: 'One person, one vote with simple majority rule',
    parameters: {
      threshold: 0.5,
      votingPeriod: scenario.context.urgency === 'critical' ? 1 : 7,
      quorum: Math.max(0.3, 1 - scenario.participantCount / 10000)
    },
    strengths,
    weaknesses,
    suitabilityScore: Math.max(0, Math.min(1, score)),
    complexity: 'low',
    manipulationResistance: 'medium',
    resourceRequirements: ['voting_platform', 'identity_verification']
  };
}

function generateLiquidDemocracyOption(scenario: GovernanceScenario, goals: VotingGoals): VotingMechanismOption {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  let score = 0.6;
  
  // Analyze strengths
  if (scenario.participants.expertiseLevels === 'highly_specialized') {
    strengths.push('Leverages expertise through delegation');
    score += 0.2;
  }
  if (goals.objectives.includes('efficiency')) {
    strengths.push('Efficient decision-making through delegation');
    score += 0.15;
  }
  if (scenario.participants.trustNetwork === 'high_trust') {
    strengths.push('High trust enables effective delegation');
    score += 0.1;
  }
  
  // Analyze weaknesses
  if (scenario.participants.trustNetwork === 'low_trust') {
    weaknesses.push('Low trust limits delegation effectiveness');
    score -= 0.25;
  }
  if (scenario.participants.stakeDistribution === 'highly_unequal') {
    weaknesses.push('Risk of delegation concentration among wealthy');
    score -= 0.2;
  }
  
  return {
    name: 'Liquid Democracy',
    type: 'liquid',
    description: 'Participants can vote directly or delegate to trusted experts',
    parameters: {
      maxDelegationChain: 3,
      revocationPeriod: 24,
      expertiseWeighting: scenario.participants.expertiseLevels === 'highly_specialized',
      transparentDelegation: true
    },
    strengths,
    weaknesses,
    suitabilityScore: Math.max(0, Math.min(1, score)),
    complexity: 'high',
    manipulationResistance: 'medium',
    resourceRequirements: ['delegation_platform', 'identity_verification', 'delegation_tracking']
  };
}

function generateQuadraticVotingOption(scenario: GovernanceScenario, goals: VotingGoals): VotingMechanismOption {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  let score = 0.55;
  
  // Analyze strengths for allocation decisions
  if (scenario.context.decisionType === 'allocation') {
    strengths.push('Optimal for budget allocation decisions');
    score += 0.25;
  }
  if (goals.objectives.includes('fairness')) {
    strengths.push('Reduces impact of extreme preferences');
    score += 0.15;
  }
  
  // Analyze weaknesses
  if (scenario.participants.stakeDistribution === 'highly_unequal') {
    weaknesses.push('Wealthy participants can buy disproportionate influence');
    score -= 0.3;
  }
  
  return {
    name: 'Quadratic Voting',
    type: 'quadratic',
    description: 'Vote strength increases quadratically with number of votes cast',
    parameters: {
      creditAllocation: 'equal',
      costFunction: 'quadratic',
      maxVotesPerOption: Math.sqrt(scenario.participantCount),
      revealThreshold: 0.1
    },
    strengths,
    weaknesses,
    suitabilityScore: Math.max(0, Math.min(1, score)),
    complexity: 'medium',
    manipulationResistance: 'low',
    resourceRequirements: ['voting_credits', 'quadratic_calculation', 'fraud_prevention']
  };
}

function generateRankedChoiceOption(scenario: GovernanceScenario, goals: VotingGoals): VotingMechanismOption {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  let score = 0.65;
  
  // Analyze strengths for elections
  if (scenario.context.decisionType === 'election') {
    strengths.push('Eliminates spoiler effects in elections');
    score += 0.2;
  }
  if (goals.objectives.includes('fairness')) {
    strengths.push('Better represents complex preferences');
    score += 0.15;
  }
  
  // Analyze weaknesses
  if (scenario.participantCount > 1000) {
    weaknesses.push('Complex counting process for large groups');
    score -= 0.1;
  }
  
  return {
    name: 'Ranked Choice Voting',
    type: 'ranked_choice',
    description: 'Participants rank candidates in order of preference',
    parameters: {
      maxRankings: Math.min(10, Math.ceil(Math.log2(scenario.participantCount))),
      eliminationRounds: true,
      revealPreferences: false
    },
    strengths,
    weaknesses,
    suitabilityScore: Math.max(0, Math.min(1, score)),
    complexity: 'medium',
    manipulationResistance: 'high',
    resourceRequirements: ['ranking_interface', 'instant_runoff_calculation']
  };
}

function generateConsensusOption(scenario: GovernanceScenario, goals: VotingGoals): VotingMechanismOption {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  let score = 0.4;
  
  // Analyze strengths for small groups
  if (scenario.participantCount <= 20) {
    strengths.push('Achieves true agreement in small groups');
    score += 0.3;
  }
  if (goals.objectives.includes('legitimacy')) {
    strengths.push('Highest legitimacy through universal agreement');
    score += 0.2;
  }
  if (scenario.participants.trustNetwork === 'high_trust') {
    strengths.push('High trust facilitates consensus building');
    score += 0.15;
  }
  
  // Analyze weaknesses
  if (scenario.context.urgency === 'critical') {
    weaknesses.push('Too slow for urgent decisions');
    score -= 0.3;
  }
  if (scenario.participantCount > 50) {
    weaknesses.push('Impractical for large groups');
    score -= 0.4;
  }
  
  return {
    name: 'Consensus Building',
    type: 'consensus',
    description: 'Iterative process to reach universal agreement',
    parameters: {
      consensusThreshold: 0.95,
      maxRounds: 5,
      facilitationRequired: true,
      fallbackMechanism: 'supermajority'
    },
    strengths,
    weaknesses,
    suitabilityScore: Math.max(0, Math.min(1, score)),
    complexity: 'high',
    manipulationResistance: 'high',
    resourceRequirements: ['facilitation', 'deliberation_platform', 'time_allocation']
  };
}

function generateSortitionOption(scenario: GovernanceScenario, goals: VotingGoals): VotingMechanismOption {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  let score = 0.5;
  
  // Analyze strengths for large populations
  if (scenario.participantCount > 1000) {
    strengths.push('Scalable for very large populations');
    score += 0.2;
  }
  if (goals.objectives.includes('fairness')) {
    strengths.push('Immune to wealth-based influence');
    score += 0.2;
  }
  if (scenario.context.urgency === 'high' || scenario.context.urgency === 'critical') {
    strengths.push('Can provide rapid decisions through small groups');
    score += 0.15;
  }
  
  // Analyze weaknesses
  if (goals.objectives.includes('participation')) {
    weaknesses.push('Limited direct participation');
    score -= 0.2;
  }
  
  return {
    name: 'Sortition Assembly',
    type: 'sortition',
    description: 'Randomly selected representative group makes decisions',
    parameters: {
      assemblySize: Math.min(150, Math.max(12, Math.ceil(Math.sqrt(scenario.participantCount)))),
      selectionCriteria: ['demographic_representation', 'stake_proportionality'],
      deliberationPeriod: scenario.context.urgency === 'critical' ? 3 : 14,
      expertInput: true
    },
    strengths,
    weaknesses,
    suitabilityScore: Math.max(0, Math.min(1, score)),
    complexity: 'medium',
    manipulationResistance: 'high',
    resourceRequirements: ['random_selection', 'assembly_coordination', 'expert_advisors']
  };
}

function selectRecommendation(
  options: VotingMechanismOption[], 
  scenario: GovernanceScenario, 
  _goals: VotingGoals
) {
  const primary = options[0]; // Highest scored option
  const alternatives = options.slice(1, 3); // Next best options
  
  // Consider hybrid approach for complex scenarios
  let hybrid = undefined;
  if (scenario.context.decisionType === 'constitutional' || scenario.participantCount > 5000) {
    hybrid = {
      description: 'Multi-phase approach combining deliberation and decision-making',
      phases: [
        {
          phase: 'deliberation',
          mechanism: 'sortition_assembly',
          rationale: 'Small group can thoroughly deliberate complex issues'
        },
        {
          phase: 'ratification',
          mechanism: 'direct_democracy',
          rationale: 'Broad participation legitimizes final decision'
        }
      ]
    };
  }
  
  return {
    primary,
    alternatives,
    hybrid
  };
}

function analyzeTradeOffs(
  options: VotingMechanismOption[], 
  scenario: GovernanceScenario, 
  _goals: VotingGoals
) {
  const considerations = [
    {
      aspect: 'Participation vs Expertise',
      options: ['Maximize direct participation', 'Leverage specialized expertise', 'Balance both'],
      recommendation: scenario.participants.expertiseLevels === 'highly_specialized' ? 
        'Leverage specialized expertise' : 'Maximize direct participation',
      rationale: scenario.participants.expertiseLevels === 'highly_specialized' ?
        'Specialized knowledge is critical for quality decisions' :
        'Broad participation increases legitimacy and buy-in'
    },
    {
      aspect: 'Speed vs Deliberation',
      options: ['Rapid decision-making', 'Thorough deliberation', 'Adaptive timeline'],
      recommendation: scenario.context.urgency === 'critical' ? 
        'Rapid decision-making' : 'Thorough deliberation',
      rationale: scenario.context.urgency === 'critical' ?
        'Time constraints require efficient processes' :
        'Complex decisions benefit from extended deliberation'
    },
    {
      aspect: 'Simplicity vs Sophistication',
      options: ['Simple and transparent', 'Sophisticated mechanisms', 'Progressive complexity'],
      recommendation: scenario.participants.trustNetwork === 'low_trust' ?
        'Simple and transparent' : 'Sophisticated mechanisms',
      rationale: scenario.participants.trustNetwork === 'low_trust' ?
        'Low trust requires simple, verifiable processes' :
        'High trust enables more sophisticated approaches'
    }
  ];
  
  const optimizations = [
    'Implement trial periods to test mechanism effectiveness',
    'Use adaptive thresholds based on participation patterns',
    'Combine multiple mechanisms for different decision phases'
  ];
  
  if (scenario.participantCount > 1000) {
    optimizations.push('Use sampling techniques to manage scale');
  }
  
  return {
    considerations,
    optimizations
  };
}

function identifyManipulationVectors(
  mechanism: VotingMechanismOption, 
  scenario: GovernanceScenario
): ManipulationVector[] {
  const vectors: ManipulationVector[] = [];
  
  // Identity manipulation
  if (mechanism.manipulationResistance !== 'high') {
    vectors.push({
      name: 'Identity Manipulation',
      severity: 'high',
      description: 'Creating fake identities to gain additional voting power',
      enablingConditions: ['Weak identity verification', 'Low verification costs'],
      impact: 'Disproportionate influence from bad actors',
      mitigations: ['Strong identity verification', 'Proof of personhood systems', 'Social verification'],
      detectionMethods: ['Pattern analysis', 'Social network verification', 'Biometric confirmation']
    });
  }
  
  // Vote buying
  if (mechanism.type === 'quadratic' || scenario.participants.stakeDistribution === 'highly_unequal') {
    vectors.push({
      name: 'Vote Buying',
      severity: 'medium',
      description: 'Purchasing votes from other participants',
      enablingConditions: ['High wealth inequality', 'No vote privacy', 'Transferable voting credits'],
      impact: 'Wealthy participants gain disproportionate influence',
      mitigations: ['Secret ballots', 'Non-transferable credits', 'Legal prohibitions'],
      detectionMethods: ['Statistical analysis', 'Payment tracking', 'Behavior monitoring']
    });
  }
  
  // Delegation capture
  if (mechanism.type === 'liquid') {
    vectors.push({
      name: 'Delegation Capture',
      severity: 'medium',
      description: 'Influential participants accumulating excessive delegated voting power',
      enablingConditions: ['No delegation limits', 'Asymmetric information', 'Network effects'],
      impact: 'Centralization of decision-making power',
      mitigations: ['Delegation caps', 'Transparent delegation tracking', 'Regular re-delegation'],
      detectionMethods: ['Delegation concentration metrics', 'Network analysis', 'Power distribution tracking']
    });
    
    // Add specific warnings for high concentration
    const delegationAnalysis = analyzeDelegationGraph(scenario);
    if (delegationAnalysis.warnings.some(w => w.type === 'power_concentration')) {
      vectors.push({
        name: 'Power Concentration Risk',
        severity: 'high',
        description: 'Simulated delegation patterns show high power concentration risk',
        enablingConditions: ['Trust network asymmetries', 'Expertise disparities'],
        impact: 'Small group controlling majority of delegated votes',
        mitigations: ['Implement delegation caps', 'Promote delegation diversity', 'Regular redistribution'],
        detectionMethods: ['Centrality analysis', 'Gini coefficient monitoring']
      });
    }
  }
  
  // Strategic nomination
  if (scenario.context.decisionType === 'election') {
    vectors.push({
      name: 'Strategic Nomination',
      severity: 'low',
      description: 'Introducing spoiler candidates to split opposition votes',
      enablingConditions: ['Low nomination barriers', 'Simple plurality voting'],
      impact: 'Suboptimal candidate selection',
      mitigations: ['Ranked choice voting', 'Approval voting', 'Primary systems'],
      detectionMethods: ['Candidate similarity analysis', 'Strategic behavior patterns']
    });
  }
  
  return vectors;
}

function generateImplementationGuidance(
  mechanism: VotingMechanismOption, 
  _scenario: GovernanceScenario
) {
  const setupRequirements = [
    'Secure voting platform deployment',
    'Identity verification system',
    'Vote privacy mechanisms',
    'Results auditing system'
  ];
  
  if (mechanism.type === 'liquid') {
    setupRequirements.push('Delegation tracking system', 'Revocation mechanisms');
  }
  
  if (mechanism.type === 'sortition') {
    setupRequirements.push('Random selection algorithm', 'Stratification systems');
  }
  
  if (mechanism.type === 'quadratic') {
    setupRequirements.push('Voting credit allocation', 'Quadratic cost calculation');
  }
  
  const timelineEstimate = mechanism.complexity === 'high' ? 60 :
                         mechanism.complexity === 'medium' ? 30 : 14;
  
  const resourceAllocation = {
    platform_development: mechanism.complexity === 'high' ? 0.4 : 0.3,
    security_auditing: 0.2,
    testing_validation: 0.2,
    user_education: 0.1,
    ongoing_maintenance: 0.1
  };
  
  const monitoringMetrics = [
    'participation_rate',
    'decision_legitimacy_perception',
    'manipulation_attempt_detection',
    'outcome_satisfaction'
  ];
  
  if (mechanism.type === 'liquid') {
    monitoringMetrics.push('delegation_concentration', 'revocation_frequency');
  }
  
  return {
    setupRequirements,
    timelineEstimate,
    resourceAllocation,
    monitoringMetrics
  };
}