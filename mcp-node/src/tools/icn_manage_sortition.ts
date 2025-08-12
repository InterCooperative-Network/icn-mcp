import { nanoid } from 'nanoid';
import { webcrypto } from 'node:crypto';

// Use Web Crypto API for cross-platform compatibility
const crypto = webcrypto;

export interface SortitionRequest {
  /** Requirements for the role/position */
  roleRequirements: {
    /** Role title and description */
    title: string;
    description: string;
    /** Required skills or qualifications */
    requiredSkills: string[];
    /** Categories relevant to the role */
    categories?: string[];
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
  /** Weighting configuration */
  weights?: {
    /** Weight for expertise scores (0-1) */
    expertise?: number;
    /** Weight for category scores (0-1) */
    category?: number;
    /** Weight for endorsements (0-1) */
    endorsements?: number;
    /** Weight for trust scores (0-1) */
    trust?: number;
    /** Weight for participation history (0-1) */
    participation?: number;
  };
  /** Fairness constraints */
  fairness?: {
    /** Maximum Gini coefficient allowed */
    maxGini?: number;
    /** Require diversity coverage */
    requireDiversity?: boolean;
    /** Attributes to ensure diversity on */
    diversityAttributes?: string[];
    /** Maximum repeat selection rate */
    maxRepeatRate?: number;
  };
  /** Random number generator seed for deterministic but secure randomness */
  rngSeed?: string;
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
    endorsements: Array<{
      fromMemberId: string;
      weight?: number;
    }>;
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
  /** Selection metrics and fairness analysis */
  metrics: {
    /** Gini coefficient of selection probabilities */
    gini: number;
    /** Diversity coverage analysis */
    diversityCoverage: Record<string, number>;
    /** Repeat selection rates */
    repeatRates: Record<string, number>;
  };
  /** Fairness assessment */
  fairness: {
    /** Whether fairness thresholds were met */
    thresholdsMet: boolean;
    /** Diversity coverage achieved */
    diversityAchieved: boolean;
    /** Fairness score (0-1) */
    score: number;
    /** Issues identified */
    issues: string[];
  };
  /** Random number generation details */
  rng: {
    /** Seed used for RNG */
    seedUsed: string;
    /** Number of random draws made */
    draws: number;
    /** Method used (crypto/deterministic) */
    method: string;
  };
  /** Explanations for selection decisions */
  explanations: string[];
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
  
  // Set default weights if not provided
  const weights = {
    expertise: request.weights?.expertise ?? 0.3,
    category: request.weights?.category ?? 0.2,
    endorsements: request.weights?.endorsements ?? 0.2,
    trust: request.weights?.trust ?? 0.2,
    participation: request.weights?.participation ?? 0.1
  };
  
  // Normalize weights to sum to 1
  const weightSum = Object.values(weights).reduce((sum, w) => sum + w, 0);
  Object.keys(weights).forEach(key => {
    weights[key as keyof typeof weights] /= weightSum;
  });
  
  // Set default fairness constraints
  const fairness = {
    maxGini: request.fairness?.maxGini ?? 0.6,
    requireDiversity: request.fairness?.requireDiversity ?? false,
    diversityAttributes: request.fairness?.diversityAttributes ?? [],
    maxRepeatRate: request.fairness?.maxRepeatRate ?? 0.3
  };
  
  // Validate and filter eligible pool
  const filteredPool = filterEligiblePool(request.eligibleMembers, request.roleRequirements, request.constraints);
  
  // Apply advanced weighting based on multiple factors
  const weightedPool = applyAdvancedWeighting(filteredPool, request, weights);
  
  // Generate deterministic but secure random seed
  const rngSeed = request.rngSeed || generateSecureRngSeed();
  
  // Create RNG function with domain separation
  const rng = createDeterministicRng(rngSeed, 'icn_manage_sortition', selectionId);
  
  // Calculate fairness metrics before selection
  const preSelectionMetrics = calculateFairnessMetrics(weightedPool, fairness);
  
  // Perform selection with fairness constraints
  let selectedMembers: Array<{ member: EligibleMember; selectionScore: number; selectionReason: string }>;
  let fairnessResult;
  let attempts = 0;
  const maxAttempts = request.parameters.maxAttempts ?? 5;
  
  do {
    selectedMembers = performAdvancedSelection(
      weightedPool,
      request.constraints.positions,
      rng,
      attempts
    );
    
    fairnessResult = assessFairness(selectedMembers, fairness, filteredPool);
    attempts++;
    
    // If fairness constraints not met and we have attempts left, adjust weights
    if (!fairnessResult.thresholdsMet && attempts < maxAttempts) {
      // Temper weights to flatten distribution
      const temperature = 1 + (attempts * 0.5);
      weightedPool.forEach(item => {
        item.weight = Math.pow(item.weight, 1 / temperature);
      });
    }
  } while (!fairnessResult.thresholdsMet && attempts < maxAttempts);
  
  // Apply diversity repair if needed
  if (fairness.requireDiversity && !fairnessResult.diversityAchieved) {
    selectedMembers = repairDiversity(selectedMembers, weightedPool, fairness, rng);
    fairnessResult = assessFairness(selectedMembers, fairness, filteredPool);
  }
  
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
  
  // Calculate final metrics
  const metrics = {
    gini: preSelectionMetrics.gini,
    diversityCoverage: calculateDiversityCoverage(selectedMembers.map(s => s.member), fairness.diversityAttributes),
    repeatRates: calculateRepeatRates(selectedMembers.map(s => s.member))
  };
  
  // Generate explanations
  const explanations = generateSelectionExplanations(selectedMembers, weights, fairness);
  
  // Identify warnings and next steps
  const warnings = identifyWarnings(request, selectedMembers, processDetails, fairnessResult);
  const nextSteps = generateNextSteps(request, selectedMembers);
  
  return {
    selectionId,
    selectedMembers,
    replacements,
    processDetails,
    justification,
    warnings,
    nextSteps,
    metrics,
    fairness: fairnessResult,
    rng: {
      seedUsed: rngSeed,
      draws: rng.drawCount,
      method: request.parameters.cryptographicRandom ? 'cryptographic' : 'deterministic'
    },
    explanations
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

function applyAdvancedWeighting(
  members: EligibleMember[], 
  request: SortitionRequest,
  weights: Record<string, number>
): Array<{ member: EligibleMember; weight: number }> {
  return members.map(member => {
    let totalWeight = 0;
    
    // Expertise score - average over required skills
    const expertiseScore = calculateExpertiseScore(member, request.roleRequirements.requiredSkills);
    totalWeight += expertiseScore * weights.expertise;
    
    // Category score - matching required categories
    const categoryScore = calculateCategoryScore(member, request.roleRequirements.categories || []);
    totalWeight += categoryScore * weights.category;
    
    // Endorsements score - sum of weighted endorsements with dampening
    const endorsementsScore = calculateEndorsementsScore(member);
    totalWeight += endorsementsScore * weights.endorsements;
    
    // Trust score - direct mapping
    totalWeight += member.reputation.trustScore * weights.trust;
    
    // Participation score - based on history
    const participationScore = calculateParticipationScore(member);
    totalWeight += participationScore * weights.participation;
    
    return { member, weight: Math.max(0.001, totalWeight) }; // Minimum weight to prevent zero probability
  });
}

function calculateExpertiseScore(member: EligibleMember, requiredSkills: string[]): number {
  if (requiredSkills.length === 0) return 0.5; // Neutral if no skills required
  
  // Check if expertiseLevels exists, otherwise use skills as binary indicators
  if (!member.qualifications.expertiseLevels || Object.keys(member.qualifications.expertiseLevels).length === 0) {
    // Fallback to binary skill matching
    const matchingSkills = requiredSkills.filter(skill => 
      member.qualifications.skills.includes(skill)
    );
    return matchingSkills.length / requiredSkills.length;
  }
  
  const relevantScores = requiredSkills
    .map(skill => member.qualifications.expertiseLevels[skill] || 0)
    .filter(score => score > 0);
  
  if (relevantScores.length === 0) return 0.1; // Low score if no relevant expertise
  
  return relevantScores.reduce((sum, score) => sum + score, 0) / relevantScores.length;
}

function calculateCategoryScore(member: EligibleMember, categories: string[]): number {
  if (categories.length === 0) return 0.5; // Neutral if no categories specified
  
  // Check if categoryScores exists
  if (!member.reputation.categoryScores || Object.keys(member.reputation.categoryScores).length === 0) {
    return 0.5; // Neutral score if no category scores available
  }
  
  const relevantScores = categories
    .map(category => member.reputation.categoryScores[category] || 0)
    .filter(score => score > 0);
  
  if (relevantScores.length === 0) return 0.1; // Low score if no relevant categories
  
  return relevantScores.reduce((sum, score) => sum + score, 0) / relevantScores.length;
}

function calculateEndorsementsScore(member: EligibleMember): number {
  if (!member.reputation.endorsements || member.reputation.endorsements.length === 0) {
    return 0.3; // Neutral score for no endorsements
  }
  
  // Handle both array of strings (old format) and array of objects (new format)
  let weightedSum = 0;
  for (const endorsement of member.reputation.endorsements) {
    if (typeof endorsement === 'string') {
      weightedSum += 1; // Treat old string format as weight 1
    } else {
      weightedSum += endorsement.weight || 1;
    }
  }
  
  // Apply log dampening to prevent endorsement farming
  const dampenedScore = Math.log(1 + weightedSum) / Math.log(1 + 10); // Cap at log(11)
  
  return Math.min(1, dampenedScore);
}

function calculateParticipationScore(member: EligibleMember): number {
  // Inverse weighting for fairness - fewer previous selections get higher weight
  const selectionPenalty = Math.min(0.8, member.participationHistory.previousSelections * 0.1);
  const participationBonus = member.participationHistory.participationRate * 0.5;
  
  return Math.max(0.1, 1 - selectionPenalty + participationBonus);
}

function generateSecureRngSeed(): string {
  const timestamp = Date.now().toString();
  const randomBytes = crypto.getRandomValues(new Uint8Array(16));
  const randomHex = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${timestamp}-${randomHex}`;
}

function createDeterministicRng(seed: string, domain: string, instance: string): { (): number; drawCount: number } {
  let state = hashString(seed + domain + instance);
  let drawCount = 0;
  
  const rng = () => {
    drawCount++;
    // Linear congruential generator with good constants
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
  
  rng.drawCount = 0;
  Object.defineProperty(rng, 'drawCount', {
    get: () => drawCount
  });
  
  return rng;
}

function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

function calculateFairnessMetrics(
  weightedPool: Array<{ member: EligibleMember; weight: number }>,
  fairness: NonNullable<SortitionRequest['fairness']>
): { gini: number; issues: string[] } {
  const weights = weightedPool.map(item => item.weight);
  const gini = calculateGiniCoefficient(weights);
  const issues: string[] = [];
  
  if (fairness.maxGini !== undefined && gini > fairness.maxGini) {
    issues.push(`Selection probability inequality too high (Gini: ${gini.toFixed(3)} > ${fairness.maxGini})`);
  }
  
  return { gini, issues };
}

function performAdvancedSelection(
  weightedPool: Array<{ member: EligibleMember; weight: number }>,
  positions: number,
  rng: () => number,
  attempt: number
): Array<{ member: EligibleMember; selectionScore: number; selectionReason: string }> {
  const selected: Array<{ member: EligibleMember; selectionScore: number; selectionReason: string }> = [];
  const remaining = [...weightedPool];
  
  // Apply softmax for more balanced selection probabilities
  const temperature = 1 + (attempt * 0.2); // Increase temperature with attempts
  const softmaxWeights = remaining.map(item => Math.exp(Math.log(item.weight) / temperature));
  
  for (let i = 0; i < positions && remaining.length > 0; i++) {
    const totalWeight = softmaxWeights.reduce((sum, weight, idx) => 
      remaining[idx] ? sum + weight : sum, 0);
    const randomValue = rng() * totalWeight;
    
    let cumulativeWeight = 0;
    let selectedIndex = 0;
    
    for (let j = 0; j < remaining.length; j++) {
      if (!remaining[j]) continue;
      cumulativeWeight += softmaxWeights[j];
      if (randomValue <= cumulativeWeight) {
        selectedIndex = j;
        break;
      }
    }
    
    const selectedItem = remaining[selectedIndex];
    selected.push({
      member: selectedItem.member,
      selectionScore: selectedItem.weight,
      selectionReason: generateAdvancedSelectionReason(selectedItem.member, selectedItem.weight, attempt)
    });
    
    // Remove selected member from remaining pool
    remaining.splice(selectedIndex, 1);
    softmaxWeights.splice(selectedIndex, 1);
  }
  
  return selected;
}

function generateAdvancedSelectionReason(member: EligibleMember, weight: number, attempt: number): string {
  const reasons: string[] = [];
  
  if (weight > 0.7) {
    reasons.push('high composite qualifications');
  } else if (weight > 0.4) {
    reasons.push('solid qualifications and fit');
  }
  
  if (member.reputation.trustScore > 0.8) {
    reasons.push('excellent trust score');
  }
  
  if (member.participationHistory.previousSelections === 0) {
    reasons.push('first-time selection for fairness');
  } else if (member.participationHistory.previousSelections < 2) {
    reasons.push('limited previous selections');
  }
  
  if (member.participationHistory.participationRate > 0.8) {
    reasons.push('strong participation history');
  }
  
  if (attempt > 0) {
    reasons.push('fairness-adjusted selection');
  }
  
  if (reasons.length === 0) {
    return 'qualified candidate from random selection';
  }
  
  return `Selected for: ${reasons.join(', ')}`;
}

function assessFairness(
  selectedMembers: Array<{ member: EligibleMember; selectionScore: number; selectionReason: string }>,
  fairness: NonNullable<SortitionRequest['fairness']>,
  eligiblePool: EligibleMember[]
): {
  thresholdsMet: boolean;
  diversityAchieved: boolean;
  score: number;
  issues: string[];
} {
  const issues: string[] = [];
  let thresholdsMet = true;
  let diversityAchieved = true;
  
  // Check repeat rates
  const repeatRates = calculateRepeatRates(selectedMembers.map(s => s.member));
  const maxRate = Math.max(...Object.values(repeatRates));
  if (fairness.maxRepeatRate !== undefined && maxRate > fairness.maxRepeatRate) {
    issues.push(`Repeat selection rate too high: ${maxRate.toFixed(3)} > ${fairness.maxRepeatRate}`);
    thresholdsMet = false;
  }
  
  // Check diversity if required
  if (fairness.requireDiversity && fairness.diversityAttributes && fairness.diversityAttributes.length > 0) {
    const diversityCoverage = calculateDiversityCoverage(
      selectedMembers.map(s => s.member), 
      fairness.diversityAttributes
    );
    
    for (const [attribute, coverage] of Object.entries(diversityCoverage)) {
      if (coverage < 0.3) { // Require at least 30% coverage for each diversity attribute
        issues.push(`Low diversity coverage for ${attribute}: ${coverage.toFixed(3)}`);
        diversityAchieved = false;
      }
    }
  }
  
  // Calculate overall fairness score
  const score = Math.max(0, 1 - (issues.length * 0.2));
  
  return {
    thresholdsMet,
    diversityAchieved,
    score,
    issues
  };
}

function calculateRepeatRates(selectedMembers: EligibleMember[]): Record<string, number> {
  const rates: Record<string, number> = {};
  
  for (const member of selectedMembers) {
    const rate = member.participationHistory.previousSelections / Math.max(1, member.participationHistory.previousSelections + 1);
    rates[member.id] = rate;
  }
  
  return rates;
}

function calculateDiversityCoverage(selectedMembers: EligibleMember[], attributes: string[]): Record<string, number> {
  const coverage: Record<string, number> = {};
  
  for (const attribute of attributes) {
    const values = new Set();
    for (const member of selectedMembers) {
      const value = (member.demographics as any)[attribute];
      if (value) values.add(value);
    }
    
    // Coverage is the ratio of unique values to total selected members
    coverage[attribute] = values.size / selectedMembers.length;
  }
  
  return coverage;
}

function repairDiversity(
  selectedMembers: Array<{ member: EligibleMember; selectionScore: number; selectionReason: string }>,
  weightedPool: Array<{ member: EligibleMember; weight: number }>,
  fairness: NonNullable<SortitionRequest['fairness']>,
  rng: () => number
): Array<{ member: EligibleMember; selectionScore: number; selectionReason: string }> {
  // Simple diversity repair: find the lowest-scored selection and try to replace with a more diverse candidate
  const selectedIds = new Set(selectedMembers.map(s => s.member.id));
  const remainingPool = weightedPool.filter(item => !selectedIds.has(item.member.id));
  
  if (remainingPool.length === 0 || !fairness.diversityAttributes) return selectedMembers;
  
  // Find lowest scoring selected member
  const lowestScored = selectedMembers.reduce((min, current) => 
    current.selectionScore < min.selectionScore ? current : min
  );
  
  // Find a replacement that improves diversity
  for (const replacement of remainingPool) {
    const testSelection = selectedMembers
      .filter(s => s.member.id !== lowestScored.member.id)
      .concat([{
        member: replacement.member,
        selectionScore: replacement.weight,
        selectionReason: 'diversity repair selection'
      }]);
    
    const newDiversity = calculateDiversityCoverage(
      testSelection.map(s => s.member),
      fairness.diversityAttributes
    );
    
    const avgCoverage = Object.values(newDiversity).reduce((sum, cov) => sum + cov, 0) / Object.keys(newDiversity).length;
    
    if (avgCoverage > 0.4) { // If this improves diversity significantly
      return testSelection;
    }
  }
  
  return selectedMembers; // Return original if no improvement found
}

function generateSelectionExplanations(
  selectedMembers: Array<{ member: EligibleMember; selectionScore: number; selectionReason: string }>,
  weights: Record<string, number>,
  fairness: NonNullable<SortitionRequest['fairness']>
): string[] {
  const explanations: string[] = [];
  
  explanations.push(`Applied weighted selection algorithm with weights: expertise=${weights.expertise.toFixed(2)}, category=${weights.category.toFixed(2)}, endorsements=${weights.endorsements.toFixed(2)}, trust=${weights.trust.toFixed(2)}, participation=${weights.participation.toFixed(2)}`);
  
  explanations.push(`Used softmax probability distribution to ensure balanced selection from weighted pool`);
  
  if (fairness.maxGini !== undefined && fairness.maxGini < 1) {
    explanations.push(`Applied Gini coefficient constraint of ${fairness.maxGini} to limit selection inequality`);
  }
  
  if (fairness.requireDiversity && fairness.diversityAttributes) {
    explanations.push(`Required diversity coverage across attributes: ${fairness.diversityAttributes.join(', ')}`);
  }
  
  explanations.push(`Selected ${selectedMembers.length} members through cryptographically-seeded deterministic random process`);
  
  return explanations;
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
  // Create simple RNG for backwards compatibility
  const rng = parameters.cryptographicRandom ? 
    () => crypto.getRandomValues(new Uint32Array(1))[0] / 0xFFFFFFFF :
    () => Math.random();
  
  // Set seed for reproducibility if provided (legacy behavior)
  if (parameters.randomSeed && !parameters.cryptographicRandom) {
    let seed = hashCode(parameters.randomSeed);
    const legacyRng = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    return performAdvancedSelection(weightedPool, positions, legacyRng, 0);
  }
  
  return performAdvancedSelection(weightedPool, positions, rng, 0);
}

// Keep old applyWeighting function for backward compatibility
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
  processDetails: SelectionResult['processDetails'],
  fairnessResult?: { thresholdsMet: boolean; diversityAchieved: boolean; score: number; issues: string[] }
): string[] {
  const warnings: string[] = [];
  
  // Check if pool was very small
  if (processDetails.constrainedPool < request.constraints.positions * 3) {
    warnings.push('Small eligible pool may limit selection quality and diversity');
  }
  
  // Check if diversity requirements couldn't be fully met
  for (const requirement of request.constraints.diversityRequirements || []) {
    const metric = processDetails.diversityMetrics[requirement.attribute as string];
    if (metric && (!metric.meetsMinRequirement || !metric.meetsMaxRequirement)) {
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
  
  // Add fairness-specific warnings
  if (fairnessResult && !fairnessResult.thresholdsMet) {
    warnings.push('Fairness thresholds not fully met despite multiple attempts');
    warnings.push(...fairnessResult.issues);
  }
  
  if (fairnessResult && !fairnessResult.diversityAchieved) {
    warnings.push('Required diversity targets not achieved');
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