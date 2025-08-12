export interface GovernanceFlowRequest {
  /** Type of decision being made */
  decisionType: 'constitutional' | 'budget' | 'policy' | 'operational' | 'emergency';
  /** Scope of the decision */
  scope: 'local' | 'regional' | 'global' | 'federation';
  /** Optional context about the specific decision */
  context?: string;
}

export interface ProposalRequirements {
  /** Required burn amount for proposal submission */
  burnAmount: number;
  /** Required format for proposals */
  format: {
    /** Minimum sections required */
    requiredSections: string[];
    /** Maximum proposal length */
    maxLength: number;
    /** Required metadata fields */
    metadata: string[];
  };
  /** Co-sponsor requirements */
  cosponsors: {
    /** Minimum number of co-sponsors */
    minimum: number;
    /** Required diversity (geographic, organizational, etc.) */
    diversityRequirements: string[];
  };
}

export interface DiscussionPeriod {
  /** Minimum discussion period in days */
  minimumDays: number;
  /** Discussion phases */
  phases: Array<{
    name: string;
    duration: number;
    activities: string[];
    requirements: string[];
  }>;
  /** Public comment requirements */
  publicComment: {
    /** Minimum comment period */
    minimumDays: number;
    /** Required notice mechanisms */
    noticeRequirements: string[];
  };
}

export interface VotingMechanism {
  /** Type of voting mechanism */
  type: 'direct' | 'liquid' | 'delegated' | 'sortition' | 'hybrid';
  /** Voting period duration */
  votingPeriod: number;
  /** Quorum requirements */
  quorum: {
    /** Minimum participation percentage */
    minimumParticipation: number;
    /** Calculation method */
    calculationMethod: string;
    /** Special requirements */
    specialRequirements?: string[];
  };
  /** Delegation rules (for liquid democracy) */
  delegation?: {
    /** Maximum delegation chain length */
    maxChainLength: number;
    /** Delegation revocation rules */
    revocationRules: string[];
    /** Expertise weighting */
    expertiseWeighting?: boolean;
  };
  /** Sortition parameters (if applicable) */
  sortition?: {
    /** Pool selection criteria */
    selectionCriteria: string[];
    /** Sample size */
    sampleSize: number;
    /** Stratification requirements */
    stratification: string[];
  };
}

export interface DecisionThreshold {
  /** Threshold type */
  type: 'simple_majority' | 'supermajority' | 'consensus' | 'qualified_majority';
  /** Threshold percentage (if applicable) */
  percentage?: number;
  /** Special conditions */
  conditions: string[];
  /** Fallback mechanisms */
  fallbacks: Array<{
    condition: string;
    mechanism: string;
    threshold: string;
  }>;
}

export interface ExecutionRules {
  /** Execution type */
  type: 'automatic' | 'manual' | 'phased' | 'conditional';
  /** Delay before execution */
  executionDelay: number;
  /** Required approvals for execution */
  requiredApprovals: string[];
  /** Execution phases (if phased) */
  phases?: Array<{
    name: string;
    description: string;
    conditions: string[];
    timeframe: number;
  }>;
  /** Appeal mechanisms */
  appeals: {
    /** Appeal period */
    appealPeriod: number;
    /** Appeal threshold */
    appealThreshold: number;
    /** Appeal process */
    process: string[];
  };
}

export interface GovernanceFlow {
  /** Flow identifier */
  id: string;
  /** Decision type and scope */
  context: {
    decisionType: string;
    scope: string;
    description: string;
  };
  /** Complete governance process */
  process: {
    /** Proposal requirements */
    proposalRequirements: ProposalRequirements;
    /** Discussion period rules */
    discussionPeriod: DiscussionPeriod;
    /** Voting mechanism */
    votingMechanism: VotingMechanism;
    /** Decision threshold */
    decisionThreshold: DecisionThreshold;
    /** Execution rules */
    executionRules: ExecutionRules;
  };
  /** Learning and adaptation */
  adaptation: {
    /** Success patterns from similar decisions */
    successPatterns: string[];
    /** Warning signs to monitor */
    warningSignsToMonitor: string[];
    /** Adaptation mechanisms */
    adaptationMechanisms: string[];
  };
  /** Estimated timeline */
  timeline: {
    /** Total estimated duration */
    totalDuration: number;
    /** Key milestones */
    milestones: Array<{
      name: string;
      day: number;
      description: string;
    }>;
  };
}

/**
 * Build complete governance flow from proposal to execution
 */
export async function icnBuildGovernanceFlow(request: GovernanceFlowRequest): Promise<GovernanceFlow> {
  const { decisionType, scope, context } = request;
  
  // Build proposal requirements based on decision type and scope
  const proposalRequirements = buildProposalRequirements(decisionType, scope);
  
  // Design discussion period based on complexity
  const discussionPeriod = buildDiscussionPeriod(decisionType, scope);
  
  // Select optimal voting mechanism
  const votingMechanism = selectVotingMechanism(decisionType, scope);
  
  // Determine decision threshold
  const decisionThreshold = determineDecisionThreshold(decisionType, scope);
  
  // Configure execution rules
  const executionRules = configureExecutionRules(decisionType, scope);
  
  // Generate adaptation guidance
  const adaptation = generateAdaptationGuidance(decisionType, scope);
  
  // Calculate timeline
  const timeline = calculateTimeline(proposalRequirements, discussionPeriod, votingMechanism, executionRules);
  
  return {
    id: `governance-flow-${decisionType}-${scope}-${Date.now()}`,
    context: {
      decisionType,
      scope,
      description: context || `${decisionType} decision at ${scope} level`
    },
    process: {
      proposalRequirements,
      discussionPeriod,
      votingMechanism,
      decisionThreshold,
      executionRules
    },
    adaptation,
    timeline
  };
}

function buildProposalRequirements(decisionType: string, scope: string): ProposalRequirements {
  // Calculate burn amount based on decision impact
  const baseBurn = getBurnAmount(decisionType, scope);
  
  // Determine format requirements
  const formatRequirements = getFormatRequirements(decisionType);
  
  // Calculate co-sponsor requirements
  const cosponsorRequirements = getCosponsorRequirements(decisionType, scope);
  
  return {
    burnAmount: baseBurn,
    format: formatRequirements,
    cosponsors: cosponsorRequirements
  };
}

function getBurnAmount(decisionType: string, scope: string): number {
  const typeMultipliers = {
    constitutional: 100,
    budget: 50,
    policy: 25,
    operational: 10,
    emergency: 5
  };
  
  const scopeMultipliers = {
    global: 10,
    federation: 5,
    regional: 2,
    local: 1
  };
  
  const baseAmount = typeMultipliers[decisionType as keyof typeof typeMultipliers] || 25;
  const scopeMultiplier = scopeMultipliers[scope as keyof typeof scopeMultipliers] || 1;
  
  return baseAmount * scopeMultiplier;
}

function getFormatRequirements(decisionType: string): ProposalRequirements['format'] {
  const baseRequirements = {
    requiredSections: ['summary', 'rationale', 'implementation', 'impact_analysis'],
    maxLength: 5000,
    metadata: ['author', 'category', 'urgency', 'affected_parties']
  };
  
  if (decisionType === 'constitutional') {
    return {
      ...baseRequirements,
      requiredSections: [...baseRequirements.requiredSections, 'legal_analysis', 'precedent_review', 'migration_plan'],
      maxLength: 10000,
      metadata: [...baseRequirements.metadata, 'expert_review', 'public_comment_summary']
    };
  } else if (decisionType === 'budget') {
    return {
      ...baseRequirements,
      requiredSections: [...baseRequirements.requiredSections, 'financial_projections', 'resource_allocation', 'success_metrics'],
      maxLength: 7500,
      metadata: [...baseRequirements.metadata, 'budget_period', 'funding_sources']
    };
  } else if (decisionType === 'emergency') {
    return {
      ...baseRequirements,
      requiredSections: ['summary', 'emergency_justification', 'immediate_actions', 'review_timeline'],
      maxLength: 2000,
      metadata: [...baseRequirements.metadata, 'emergency_type', 'expiration_date']
    };
  }
  
  return baseRequirements;
}

function getCosponsorRequirements(decisionType: string, scope: string): ProposalRequirements['cosponsors'] {
  let minimumCosponsors = 1;
  
  if (decisionType === 'constitutional') {
    minimumCosponsors = scope === 'global' ? 10 : scope === 'federation' ? 5 : 3;
  } else if (decisionType === 'budget') {
    minimumCosponsors = scope === 'global' ? 5 : scope === 'federation' ? 3 : 2;
  } else if (decisionType === 'emergency') {
    minimumCosponsors = 0; // Emergency decisions may not require co-sponsors
  }
  
  const diversityRequirements = [];
  if (scope === 'global' || scope === 'federation') {
    diversityRequirements.push('geographic_distribution', 'organizational_diversity');
  }
  if (decisionType === 'constitutional') {
    diversityRequirements.push('stakeholder_representation');
  }
  
  return {
    minimum: minimumCosponsors,
    diversityRequirements
  };
}

function buildDiscussionPeriod(decisionType: string, scope: string): DiscussionPeriod {
  let minimumDays = 7;
  
  if (decisionType === 'constitutional') {
    minimumDays = scope === 'global' ? 30 : scope === 'federation' ? 21 : 14;
  } else if (decisionType === 'budget') {
    minimumDays = scope === 'global' ? 21 : scope === 'federation' ? 14 : 10;
  } else if (decisionType === 'emergency') {
    minimumDays = 1;
  }
  
  const phases = [];
  
  if (decisionType !== 'emergency') {
    phases.push({
      name: 'initial_review',
      duration: Math.ceil(minimumDays * 0.3),
      activities: ['technical_review', 'impact_assessment', 'clarification_requests'],
      requirements: ['expert_input', 'stakeholder_identification']
    });
    
    phases.push({
      name: 'public_discussion',
      duration: Math.ceil(minimumDays * 0.5),
      activities: ['public_comment', 'community_forums', 'working_groups'],
      requirements: ['broad_participation', 'diverse_viewpoints']
    });
    
    phases.push({
      name: 'revision_period',
      duration: Math.ceil(minimumDays * 0.2),
      activities: ['proposal_amendments', 'consensus_building', 'final_review'],
      requirements: ['incorporated_feedback', 'final_documentation']
    });
  } else {
    phases.push({
      name: 'emergency_review',
      duration: 1,
      activities: ['immediate_assessment', 'emergency_validation'],
      requirements: ['urgency_verification', 'minimal_safeguards']
    });
  }
  
  return {
    minimumDays,
    phases,
    publicComment: {
      minimumDays: decisionType === 'emergency' ? 0 : Math.max(3, Math.ceil(minimumDays * 0.3)),
      noticeRequirements: scope === 'global' ? 
        ['network_announcement', 'federation_notice', 'public_posting'] :
        ['local_announcement', 'stakeholder_notice']
    }
  };
}

function selectVotingMechanism(decisionType: string, scope: string): VotingMechanism {
  let votingType: VotingMechanism['type'] = 'direct';
  let votingPeriod = 7;
  
  // Select mechanism based on decision type and scope
  if (decisionType === 'constitutional') {
    votingType = scope === 'global' ? 'hybrid' : 'liquid';
    votingPeriod = scope === 'global' ? 14 : scope === 'federation' ? 10 : 7;
  } else if (decisionType === 'budget') {
    votingType = scope === 'global' ? 'liquid' : 'direct';
    votingPeriod = scope === 'global' ? 10 : 7;
  } else if (decisionType === 'emergency') {
    votingType = 'sortition';
    votingPeriod = 1;
  }
  
  const quorum = {
    minimumParticipation: getQuorumThreshold(decisionType, scope),
    calculationMethod: 'eligible_voters',
    specialRequirements: decisionType === 'constitutional' ? ['stakeholder_representation'] : undefined
  };
  
  const mechanism: VotingMechanism = {
    type: votingType,
    votingPeriod,
    quorum
  };
  
  // Add delegation rules for liquid democracy
  if (votingType === 'liquid' || votingType === 'hybrid') {
    mechanism.delegation = {
      maxChainLength: 3,
      revocationRules: ['24_hour_notice', 'immediate_emergency'],
      expertiseWeighting: decisionType === 'budget' || decisionType === 'policy'
    };
  }
  
  // Add sortition parameters
  if (votingType === 'sortition' || votingType === 'hybrid') {
    mechanism.sortition = {
      selectionCriteria: ['participation_history', 'stake_in_outcome', 'expertise_relevance'],
      sampleSize: Math.min(100, Math.max(12, Math.ceil(getScopeParticipants(scope) * 0.1))),
      stratification: scope === 'global' ? ['geographic', 'organizational', 'expertise'] : ['organizational']
    };
  }
  
  return mechanism;
}

function getQuorumThreshold(decisionType: string, scope: string): number {
  const baseThresholds = {
    constitutional: 0.5,
    budget: 0.3,
    policy: 0.25,
    operational: 0.2,
    emergency: 0.1
  };
  
  const scopeAdjustment = {
    global: 0.1,
    federation: 0.05,
    regional: 0,
    local: -0.05
  };
  
  const base = baseThresholds[decisionType as keyof typeof baseThresholds] || 0.25;
  const adjustment = scopeAdjustment[scope as keyof typeof scopeAdjustment] || 0;
  
  return Math.max(0.1, Math.min(0.7, base + adjustment));
}

function getScopeParticipants(scope: string): number {
  // Estimated participant counts by scope
  const estimates = {
    global: 10000,
    federation: 1000,
    regional: 200,
    local: 50
  };
  
  return estimates[scope as keyof typeof estimates] || 100;
}

function determineDecisionThreshold(decisionType: string, scope: string): DecisionThreshold {
  let type: DecisionThreshold['type'] = 'simple_majority';
  let percentage: number | undefined;
  
  if (decisionType === 'constitutional') {
    type = 'supermajority';
    percentage = scope === 'global' ? 75 : scope === 'federation' ? 70 : 66;
  } else if (decisionType === 'budget') {
    type = 'qualified_majority';
    percentage = 60;
  } else if (decisionType === 'emergency') {
    type = 'simple_majority';
    percentage = 51;
  }
  
  const conditions = [];
  if (decisionType === 'constitutional') {
    conditions.push('supermajority_required', 'no_single_organization_veto');
  }
  if (scope === 'global') {
    conditions.push('federation_approval_required');
  }
  
  const fallbacks = [];
  if (type === 'supermajority') {
    fallbacks.push({
      condition: 'quorum_not_met_first_attempt',
      mechanism: 'extended_voting_period',
      threshold: 'qualified_majority_60_percent'
    });
    
    fallbacks.push({
      condition: 'multiple_failed_attempts',
      mechanism: 'consensus_building_process',
      threshold: 'agreement_seeking'
    });
  }
  
  return {
    type,
    percentage,
    conditions,
    fallbacks
  };
}

function configureExecutionRules(decisionType: string, scope: string): ExecutionRules {
  let executionType: ExecutionRules['type'] = 'manual';
  let executionDelay = 7;
  
  if (decisionType === 'operational' && scope === 'local') {
    executionType = 'automatic';
    executionDelay = 1;
  } else if (decisionType === 'emergency') {
    executionType = 'automatic';
    executionDelay = 0;
  } else if (decisionType === 'constitutional') {
    executionType = 'phased';
    executionDelay = 30;
  }
  
  const requiredApprovals = [];
  if (decisionType === 'constitutional') {
    requiredApprovals.push('legal_review', 'implementation_plan_approval');
  }
  if (decisionType === 'operational' && scope !== 'local') {
    requiredApprovals.push('operational_review'); // Add safeguard for non-local operational decisions
  }
  if (scope === 'global') {
    requiredApprovals.push('federation_coordination');
  }
  if (scope === 'federation') {
    requiredApprovals.push('federation_oversight');
  }
  
  const phases = executionType === 'phased' ? [
    {
      name: 'preparation',
      description: 'Prepare implementation infrastructure',
      conditions: ['resource_allocation', 'team_assignment'],
      timeframe: 14
    },
    {
      name: 'pilot_implementation',
      description: 'Limited scope implementation with monitoring',
      conditions: ['monitoring_systems', 'feedback_mechanisms'],
      timeframe: 30
    },
    {
      name: 'full_rollout',
      description: 'Complete implementation across all systems',
      conditions: ['pilot_success_validation', 'readiness_confirmation'],
      timeframe: 60
    }
  ] : undefined;
  
  return {
    type: executionType,
    executionDelay,
    requiredApprovals,
    phases,
    appeals: {
      appealPeriod: decisionType === 'emergency' ? 3 : 14,
      appealThreshold: 0.1,
      process: ['formal_objection', 'review_committee', 'appeal_decision']
    }
  };
}

function generateAdaptationGuidance(decisionType: string, scope: string): GovernanceFlow['adaptation'] {
  const successPatterns = [];
  const warningSignsToMonitor = [];
  const adaptationMechanisms = [];
  
  // Success patterns from governance research
  if (decisionType === 'constitutional') {
    successPatterns.push(
      'Broad stakeholder consultation increases legitimacy',
      'Incremental changes more successful than radical reforms',
      'Clear implementation timeline improves adoption'
    );
  } else if (decisionType === 'budget') {
    successPatterns.push(
      'Transparent allocation criteria improve acceptance',
      'Regular review cycles allow for adjustments',
      'Participatory budgeting increases satisfaction'
    );
  }
  
  // Warning signs to monitor
  warningSignsToMonitor.push(
    'Declining participation rates',
    'Increasing polarization in discussions',
    'Capture by special interests'
  );
  
  if (scope === 'global') {
    warningSignsToMonitor.push(
      'Federation-level resistance',
      'Implementation inconsistencies across regions'
    );
  }
  
  // Adaptation mechanisms
  adaptationMechanisms.push(
    'Regular process review and refinement',
    'Feedback collection from participants',
    'Threshold adjustment based on participation patterns'
  );
  
  if (decisionType !== 'emergency') {
    adaptationMechanisms.push(
      'A/B testing of governance mechanisms',
      'Learning from similar decisions in other contexts'
    );
  }
  
  return {
    successPatterns,
    warningSignsToMonitor,
    adaptationMechanisms
  };
}

function calculateTimeline(
  proposalRequirements: ProposalRequirements,
  discussionPeriod: DiscussionPeriod,
  votingMechanism: VotingMechanism,
  executionRules: ExecutionRules
): GovernanceFlow['timeline'] {
  let currentDay = 0;
  const milestones: GovernanceFlow['timeline']['milestones'] = [];
  
  // Proposal preparation
  milestones.push({
    name: 'proposal_submission',
    day: currentDay,
    description: `Proposal submitted with ${proposalRequirements.burnAmount} burn and ${proposalRequirements.cosponsors.minimum} co-sponsors`
  });
  
  // Discussion period
  currentDay += discussionPeriod.minimumDays;
  milestones.push({
    name: 'discussion_complete',
    day: currentDay,
    description: 'Discussion period ends, proposal finalized'
  });
  
  // Voting period
  currentDay += votingMechanism.votingPeriod;
  milestones.push({
    name: 'voting_complete',
    day: currentDay,
    description: 'Voting period ends, results announced'
  });
  
  // Execution delay
  currentDay += executionRules.executionDelay;
  milestones.push({
    name: 'execution_begins',
    day: currentDay,
    description: 'Execution phase begins'
  });
  
  // Phased execution milestones
  if (executionRules.phases) {
    for (const phase of executionRules.phases) {
      currentDay += phase.timeframe;
      milestones.push({
        name: `phase_${phase.name}_complete`,
        day: currentDay,
        description: `${phase.description} completed`
      });
    }
  }
  
  return {
    totalDuration: currentDay,
    milestones
  };
}