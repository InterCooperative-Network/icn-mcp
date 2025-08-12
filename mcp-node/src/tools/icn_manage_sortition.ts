import { nanoid } from 'nanoid';

export interface SortitionRequest {
  /** Requirements for the role/position */
  roleRequirements: {
    /** Role title and description */
    title: string;
    description: string;
    /** Required skills or qualifications */
    requiredSkills: string[];
    /** Preferred experience */
    preferredExperience?: string[];
    /** Time commitment */
    timeCommitment: {
      duration: number; // in days
      hoursPerWeek: number;
    };
    /** Compensation or incentives */
    compensation?: {
      type: 'tokens' | 'credits' | 'cc' | 'recognition';
      amount?: number;
    };
  };
  /** Pool of eligible members */
  eligibleMembers: EligibleMember[];
  /** Selection constraints */
  constraints: {
    /** Number of positions to fill */
    positions: number;
    /** Diversity requirements */
    diversityRequirements?: DiversityRequirement[];
    /** Exclusion rules */
    exclusions?: ExclusionRule[];
    /** Weighting preferences */
    weightingPreferences?: WeightingPreference[];
  };
  /** Selection parameters */
  parameters: {
    /** Random seed for reproducibility */
    randomSeed?: string;
    /** Use cryptographic randomness */
    cryptographicRandom: boolean;
    /** Allow replacements if selected members decline */
    allowReplacements: boolean;
    /** Maximum selection attempts */
    maxAttempts?: number;
  };
}

export interface EligibleMember {
  /** Member identifier */
  id: string;
  /** Basic member information */
  info: {
    name: string;
    organization?: string;
    location?: string;
    joinDate: Date;
  };
  /** Participation history */
  participationHistory: {
    /** Previous sortition selections */
    previousSelections: number;
    /** Last selection date */
    lastSelected?: Date;
    /** Participation rate in past selections */
    participationRate: number; // 0-1
    /** Performance scores from past roles */
    performanceScores: number[]; // 0-1 scale
  };
  /** Skills and qualifications */
  qualifications: {
    /** Verified skills */
    skills: string[];
    /** Experience areas */
    experience: string[];
    /** Education/certifications */
    credentials?: string[];
    /** Self-assessed expertise levels */
    expertiseLevels: Record<string, number>; // 0-1 scale
  };
  /** Demographic attributes */
  demographics: {
    /** Age group */
    ageGroup?: 'young' | 'middle' | 'senior';
    /** Gender identity */
    gender?: string;
    /** Geographic region */
    region?: string;
    /** Organizational type */
    organizationType?: 'cooperative' | 'individual' | 'collective' | 'federation';
  };
  /** Availability and constraints */
  availability: {
    /** Currently available for selection */
    available: boolean;
    /** Availability start date */
    availableFrom?: Date;
    /** Availability end date */
    availableUntil?: Date;
    /** Time zone */
    timeZone?: string;
    /** Maximum concurrent commitments */
    maxCommitments?: number;
    /** Current active commitments */
    currentCommitments: number;
  };
  /** Trust and reputation */
  reputation: {
    /** Trust score from network */
    trustScore: number; // 0-1
    /** Reputation scores by category */
    categoryScores: Record<string, number>;
    /** Endorsements from other members */
    endorsements: string[];
  };
}

export interface DiversityRequirement {
  /** Attribute to diversify on */
  attribute: keyof EligibleMember['demographics'];
  /** Minimum representation requirement */
  minRepresentation?: number;
  /** Maximum representation limit */
  maxRepresentation?: number;
  /** Target distribution */
  targetDistribution?: Record<string, number>;
}

export interface ExclusionRule {
  /** Rule description */
  description: string;
  /** Exclusion type */
  type: 'cooldown' | 'conflict_of_interest' | 'capacity' | 'qualification';
  /** Rule parameters */
  parameters: Record<string, any>;
}

export interface WeightingPreference {
  /** Attribute to weight */
  attribute: string;
  /** Weight factor (1.0 = neutral, >1.0 = preferred, <1.0 = discouraged) */
  weight: number;
  /** Weighting function */
  function: 'linear' | 'exponential' | 'logarithmic' | 'threshold';
  /** Additional parameters for weighting function */
  parameters?: Record<string, any>;
}

export interface SelectionResult {
  /** Selection process ID */
  selectionId: string;
  /** Selected members */
  selectedMembers: Array<{
    member: EligibleMember;
    selectionScore: number;
    selectionReason: string;
    positionAssigned?: string;
  }>;
  /** Replacement candidates (if requested) */
  replacements: Array<{
    member: EligibleMember;
    selectionScore: number;
    priority: number;
  }>;
  /** Selection process details */
  processDetails: {
    /** Total eligible pool size */
    totalEligible: number;
    /** Number after applying constraints */
    constrainedPool: number;
    /** Selection method used */
    selectionMethod: string;
    /** Random seed used */
    randomSeed: string;
    /** Diversity metrics achieved */
    diversityMetrics: Record<string, any>;
    /** Selection statistics */
    statistics: SelectionStatistics;
  };
  /** Justification for selections */
  justification: {
    /** Overall selection rationale */
    overallRationale: string;
    /** Individual selection justifications */
    individualJustifications: Array<{
      memberId: string;
      justification: string;
      scoringFactors: Record<string, number>;
    }>;
    /** Diversity balance explanation */
    diversityJustification: string;
    /** Constraint satisfaction summary */
    constraintSatisfaction: Array<{
      constraint: string;
      satisfied: boolean;
      explanation: string;
    }>;
  };
  /** Warnings and recommendations */
  warnings: string[];
  /** Next steps and follow-up actions */
  nextSteps: string[];
}

export interface SelectionStatistics {
  /** Average trust score of selected members */
  averageTrustScore: number;
  /** Average participation rate */
  averageParticipationRate: number;
  /** Skill coverage analysis */
  skillCoverage: Record<string, number>;
  /** Demographic representation */
  demographicRepresentation: Record<string, Record<string, number>>;
  /** Selection fairness metrics */
  fairnessMetrics: {
    /** Gini coefficient for selection probability */
    selectionGiniCoefficient: number;
    /** Distribution of previous selections */
    previousSelectionDistribution: Record<number, number>;
  };
}

/**
 * Manage fair random selection with constraints for sortition processes
 */
export async function icnManageSortition(request: SortitionRequest): Promise<SelectionResult> {
  // Generate selection ID
  const selectionId = nanoid();
  
  // Validate and filter eligible pool
  const filteredPool = filterEligiblePool(request.eligibleMembers, request.roleRequirements, request.constraints);
  
  // Apply weighting based on preferences
  const weightedPool = applyWeighting(filteredPool, request.constraints.weightingPreferences || []);
  
  // Perform selection using cryptographic randomness
  const selectedMembers = performSelection(
    weightedPool, 
    request.constraints.positions,
    request.parameters
  );
  
  // Select replacement candidates
  const replacements = selectReplacements(
    weightedPool,
    selectedMembers,
    request.parameters.allowReplacements ? Math.min(5, request.constraints.positions * 2) : 0
  );
  
  // Generate process details and statistics
  const processDetails = generateProcessDetails(
    request,
    filteredPool,
    weightedPool,
    selectedMembers
  );
  
  // Generate justifications
  const justification = generateJustification(
    request,
    selectedMembers,
    processDetails
  );
  
  // Identify warnings and next steps
  const warnings = identifyWarnings(request, selectedMembers, processDetails);
  const nextSteps = generateNextSteps(request, selectedMembers);
  
  return {
    selectionId,
    selectedMembers,
    replacements,
    processDetails,
    justification,
    warnings,
    nextSteps
  };
}

function filterEligiblePool(
  members: EligibleMember[], 
  roleRequirements: SortitionRequest['roleRequirements'],
  constraints: SortitionRequest['constraints']
): EligibleMember[] {
  return members.filter(member => {
    // Check availability
    if (!member.availability.available) {
      return false;
    }
    
    // Check capacity constraints
    if (member.availability.maxCommitments && 
        member.availability.currentCommitments >= member.availability.maxCommitments) {
      return false;
    }
    
    // Check required skills
    const hasRequiredSkills = roleRequirements.requiredSkills.every(skill =>
      member.qualifications.skills.includes(skill)
    );
    if (!hasRequiredSkills) {
      return false;
    }
    
    // Apply exclusion rules
    for (const exclusion of constraints.exclusions || []) {
      if (isExcluded(member, exclusion)) {
        return false;
      }
    }
    
    return true;
  });
}

function isExcluded(member: EligibleMember, rule: ExclusionRule): boolean {
  switch (rule.type) {
    case 'cooldown': {
      if (member.participationHistory.lastSelected) {
        const daysSinceLastSelection = (Date.now() - member.participationHistory.lastSelected.getTime()) / (1000 * 60 * 60 * 24);
        const cooldownDays = rule.parameters.days || 365;
        return daysSinceLastSelection < cooldownDays;
      }
      return false;
    }
      
    case 'conflict_of_interest': {
      const conflictOrgs = rule.parameters.organizations || [];
      return conflictOrgs.includes(member.info.organization);
    }
      
    case 'capacity': {
      const maxCommitments = rule.parameters.maxConcurrentCommitments || 3;
      return member.availability.currentCommitments >= maxCommitments;
    }
      
    case 'qualification': {
      const requiredScore = rule.parameters.minQualificationScore || 0.5;
      const avgScore = member.participationHistory.performanceScores.reduce((a, b) => a + b, 0) / 
                      member.participationHistory.performanceScores.length || 0;
      return avgScore < requiredScore;
    }
      
    default:
      return false;
  }
}

function applyWeighting(
  members: EligibleMember[], 
  weightingPreferences: WeightingPreference[]
): Array<{ member: EligibleMember; weight: number }> {
  return members.map(member => {
    let totalWeight = 1.0;
    
    for (const preference of weightingPreferences) {
      const weight = calculateWeight(member, preference);
      totalWeight *= weight;
    }
    
    return { member, weight: totalWeight };
  });
}

function calculateWeight(member: EligibleMember, preference: WeightingPreference): number {
  let value: number;
  
  // Extract value based on attribute
  switch (preference.attribute) {
    case 'participationHistory':
      value = member.participationHistory.participationRate;
      break;
    case 'trustScore':
      value = member.reputation.trustScore;
      break;
    case 'previousSelections': {
      // Inverse weighting for fairness - fewer previous selections get higher weight
      const maxSelections = 10; // Reasonable upper bound
      value = 1 - (member.participationHistory.previousSelections / maxSelections);
      value = Math.max(0.1, value); // Minimum weight
      break;
    }
    case 'performanceScore':
      value = member.participationHistory.performanceScores.reduce((a, b) => a + b, 0) / 
              member.participationHistory.performanceScores.length || 0.5;
      break;
    default:
      value = 0.5; // Neutral default
  }
  
  // Apply weighting function
  switch (preference.function) {
    case 'linear':
      return 1 + (value - 0.5) * (preference.weight - 1) * 2;
    case 'exponential':
      return Math.pow(preference.weight, value);
    case 'logarithmic':
      return 1 + Math.log(1 + value * (preference.weight - 1));
    case 'threshold': {
      const threshold = preference.parameters?.threshold || 0.5;
      return value >= threshold ? preference.weight : 1.0;
    }
    default:
      return preference.weight;
  }
}

function performSelection(
  weightedPool: Array<{ member: EligibleMember; weight: number }>,
  positions: number,
  parameters: SortitionRequest['parameters']
): Array<{ member: EligibleMember; selectionScore: number; selectionReason: string }> {
  // Use cryptographic randomness if requested
  const rng = parameters.cryptographicRandom ? 
    () => crypto.getRandomValues(new Uint32Array(1))[0] / 0xFFFFFFFF :
    () => Math.random();
  
  // Set seed for reproducibility if provided
  if (parameters.randomSeed && !parameters.cryptographicRandom) {
    // Simple seeded random for non-cryptographic case
    let seed = hashCode(parameters.randomSeed);
    Math.random = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
  }
  
  const selected: Array<{ member: EligibleMember; selectionScore: number; selectionReason: string }> = [];
  const remaining = [...weightedPool];
  
  for (let i = 0; i < positions && remaining.length > 0; i++) {
    // Calculate weighted selection probabilities
    const totalWeight = remaining.reduce((sum, item) => sum + item.weight, 0);
    const randomValue = rng() * totalWeight;
    
    let cumulativeWeight = 0;
    let selectedIndex = 0;
    
    for (let j = 0; j < remaining.length; j++) {
      cumulativeWeight += remaining[j].weight;
      if (randomValue <= cumulativeWeight) {
        selectedIndex = j;
        break;
      }
    }
    
    const selectedItem = remaining[selectedIndex];
    selected.push({
      member: selectedItem.member,
      selectionScore: selectedItem.weight,
      selectionReason: generateSelectionReason(selectedItem.member, selectedItem.weight)
    });
    
    // Remove selected member from remaining pool
    remaining.splice(selectedIndex, 1);
  }
  
  return selected;
}

function selectReplacements(
  weightedPool: Array<{ member: EligibleMember; weight: number }>,
  selectedMembers: Array<{ member: EligibleMember; selectionScore: number; selectionReason: string }>,
  replacementCount: number
): Array<{ member: EligibleMember; selectionScore: number; priority: number }> {
  const selectedIds = new Set(selectedMembers.map(s => s.member.id));
  const remainingPool = weightedPool.filter(item => !selectedIds.has(item.member.id));
  
  // Sort remaining pool by weight (highest first)
  remainingPool.sort((a, b) => b.weight - a.weight);
  
  return remainingPool.slice(0, replacementCount).map((item, index) => ({
    member: item.member,
    selectionScore: item.weight,
    priority: index + 1
  }));
}

function generateSelectionReason(member: EligibleMember, weight: number): string {
  const reasons: string[] = [];
  
  if (weight > 1.2) {
    reasons.push('high qualifications and performance');
  }
  if (member.reputation.trustScore > 0.8) {
    reasons.push('excellent trust score');
  }
  if (member.participationHistory.participationRate > 0.8) {
    reasons.push('strong participation history');
  }
  if (member.participationHistory.previousSelections === 0) {
    reasons.push('first-time selection for fairness');
  }
  
  if (reasons.length === 0) {
    return 'random selection from qualified pool';
  }
  
  return `Selected for: ${reasons.join(', ')}`;
}

function generateProcessDetails(
  request: SortitionRequest,
  filteredPool: EligibleMember[],
  weightedPool: Array<{ member: EligibleMember; weight: number }>,
  selectedMembers: Array<{ member: EligibleMember; selectionScore: number; selectionReason: string }>
): SelectionResult['processDetails'] {
  const statistics = calculateStatistics(selectedMembers, filteredPool);
  
  const diversityMetrics: Record<string, any> = {};
  for (const requirement of request.constraints.diversityRequirements || []) {
    diversityMetrics[requirement.attribute as string] = calculateDiversityMetric(
      selectedMembers.map(s => s.member),
      requirement
    );
  }
  
  return {
    totalEligible: request.eligibleMembers.length,
    constrainedPool: filteredPool.length,
    selectionMethod: 'weighted_random_sortition',
    randomSeed: request.parameters.randomSeed || 'system_generated',
    diversityMetrics,
    statistics
  };
}

function calculateStatistics(
  selectedMembers: Array<{ member: EligibleMember; selectionScore: number; selectionReason: string }>,
  eligiblePool: EligibleMember[]
): SelectionStatistics {
  const members = selectedMembers.map(s => s.member);
  
  const averageTrustScore = members.reduce((sum, m) => sum + m.reputation.trustScore, 0) / members.length;
  const averageParticipationRate = members.reduce((sum, m) => sum + m.participationHistory.participationRate, 0) / members.length;
  
  // Calculate skill coverage
  const allSkills = new Set(eligiblePool.flatMap(m => m.qualifications.skills));
  const skillCoverage: Record<string, number> = {};
  for (const skill of allSkills) {
    const membersWithSkill = members.filter(m => m.qualifications.skills.includes(skill)).length;
    skillCoverage[skill] = membersWithSkill / members.length;
  }
  
  // Calculate demographic representation
  const demographicRepresentation: Record<string, Record<string, number>> = {};
  const demographics = ['ageGroup', 'gender', 'region', 'organizationType'] as const;
  
  for (const demo of demographics) {
    demographicRepresentation[demo] = {};
    const values = members.map(m => m.demographics[demo]).filter(v => v !== undefined);
    const valueCounts = values.reduce((acc, val) => {
      acc[val!] = (acc[val!] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    for (const [value, count] of Object.entries(valueCounts)) {
      demographicRepresentation[demo][value] = count / members.length;
    }
  }
  
  // Calculate fairness metrics
  const selectionCounts = eligiblePool.map(m => m.participationHistory.previousSelections);
  const selectionGiniCoefficient = calculateGiniCoefficient(selectionCounts);
  
  const previousSelectionDistribution = selectionCounts.reduce((acc, count) => {
    acc[count] = (acc[count] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);
  
  return {
    averageTrustScore,
    averageParticipationRate,
    skillCoverage,
    demographicRepresentation,
    fairnessMetrics: {
      selectionGiniCoefficient,
      previousSelectionDistribution
    }
  };
}

function calculateDiversityMetric(members: EligibleMember[], requirement: DiversityRequirement): any {
  const attribute = requirement.attribute;
  const values = members.map(m => m.demographics[attribute]).filter(v => v !== undefined);
  
  const distribution = values.reduce((acc, val) => {
    acc[val!] = (acc[val!] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  // Convert to percentages
  const total = values.length;
  const percentages = Object.entries(distribution).reduce((acc, [key, count]) => {
    acc[key] = count / total;
    return acc;
  }, {} as Record<string, number>);
  
  return {
    distribution: percentages,
    meetsMinRequirement: requirement.minRepresentation ? 
      Object.values(percentages).every(p => p >= requirement.minRepresentation!) : true,
    meetsMaxRequirement: requirement.maxRepresentation ?
      Object.values(percentages).every(p => p <= requirement.maxRepresentation!) : true
  };
}

function generateJustification(
  request: SortitionRequest,
  selectedMembers: Array<{ member: EligibleMember; selectionScore: number; selectionReason: string }>,
  processDetails: SelectionResult['processDetails']
): SelectionResult['justification'] {
  const overallRationale = `Selected ${selectedMembers.length} members through weighted random sortition from pool of ${processDetails.constrainedPool} eligible candidates. Selection balanced fairness, qualifications, and diversity requirements.`;
  
  const individualJustifications = selectedMembers.map(selected => ({
    memberId: selected.member.id,
    justification: selected.selectionReason,
    scoringFactors: {
      trustScore: selected.member.reputation.trustScore,
      participationRate: selected.member.participationHistory.participationRate,
      selectionWeight: selected.selectionScore,
      previousSelections: selected.member.participationHistory.previousSelections
    }
  }));
  
  let diversityJustification = 'Diversity requirements: ';
  if (request.constraints.diversityRequirements && request.constraints.diversityRequirements.length > 0) {
    const satisfiedRequirements = request.constraints.diversityRequirements.map(req => {
      const metric = processDetails.diversityMetrics[req.attribute as string];
      return `${req.attribute}: ${metric.meetsMinRequirement && metric.meetsMaxRequirement ? 'satisfied' : 'partially satisfied'}`;
    });
    diversityJustification += satisfiedRequirements.join(', ');
  } else {
    diversityJustification += 'none specified';
  }
  
  const constraintSatisfaction = [];
  
  // Check diversity constraints
  for (const requirement of request.constraints.diversityRequirements || []) {
    const metric = processDetails.diversityMetrics[requirement.attribute as string];
    constraintSatisfaction.push({
      constraint: `Diversity requirement for ${requirement.attribute}`,
      satisfied: metric.meetsMinRequirement && metric.meetsMaxRequirement,
      explanation: metric.meetsMinRequirement && metric.meetsMaxRequirement ?
        'Diversity targets met' : 'Diversity targets partially met due to pool constraints'
    });
  }
  
  return {
    overallRationale,
    individualJustifications,
    diversityJustification,
    constraintSatisfaction
  };
}

function identifyWarnings(
  request: SortitionRequest,
  _selectedMembers: Array<{ member: EligibleMember; selectionScore: number; selectionReason: string }>,
  processDetails: SelectionResult['processDetails']
): string[] {
  const warnings: string[] = [];
  
  // Check if pool was very small
  if (processDetails.constrainedPool < request.constraints.positions * 3) {
    warnings.push('Small eligible pool may limit selection quality and diversity');
  }
  
  // Check if diversity requirements couldn't be fully met
  for (const requirement of request.constraints.diversityRequirements || []) {
    const metric = processDetails.diversityMetrics[requirement.attribute as string];
    if (!metric.meetsMinRequirement || !metric.meetsMaxRequirement) {
      warnings.push(`Diversity requirement for ${requirement.attribute} could not be fully satisfied`);
    }
  }
  
  // Check for potential bias in selection
  const avgTrustScore = processDetails.statistics.averageTrustScore;
  if (avgTrustScore > 0.9) {
    warnings.push('Selected members have unusually high trust scores - check for potential bias');
  }
  
  // Check for fairness issues
  const giniCoefficient = processDetails.statistics.fairnessMetrics.selectionGiniCoefficient;
  if (giniCoefficient > 0.6) {
    warnings.push('High inequality in previous selection distribution detected');
  }
  
  return warnings;
}

function generateNextSteps(
  request: SortitionRequest,
  _selectedMembers: Array<{ member: EligibleMember; selectionScore: number; selectionReason: string }>
): string[] {
  const nextSteps: string[] = [];
  
  nextSteps.push('Contact selected members to confirm availability and acceptance');
  nextSteps.push('Provide role orientation and training materials');
  nextSteps.push('Schedule initial meetings and establish communication channels');
  
  if (request.parameters.allowReplacements) {
    nextSteps.push('Maintain contact with replacement candidates in case of declinations');
  }
  
  nextSteps.push('Begin performance tracking for future selection algorithm improvement');
  nextSteps.push('Collect feedback on selection process for continuous improvement');
  
  return nextSteps;
}

// Utility functions
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
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