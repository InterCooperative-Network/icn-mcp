import { nanoid } from 'nanoid';

export interface EconomicParameters {
  /** Number of simulation steps */
  steps: number;
  /** Number of nodes/participants */
  nodeCount: number;
  /** CC generation rate per node per step */
  ccGenerationRate: number;
  /** Initial token distribution per participant */
  initialTokens: number;
  /** Demurrage rate per step (decay factor for idle tokens) */
  demurrageRate: number;
  /** Federation levy rate on cooperative surplus */
  federationLevyRate: number;
  /** Settlement frequency (every N steps) */
  settlementFrequency: number;
  /** Trust weight distribution (affects CC earning) */
  trustWeights?: number[];
}

export interface ParticipantBehavior {
  /** Participant ID */
  id: string;
  /** Infrastructure contribution level (0-1) */
  infrastructureContribution: number;
  /** Economic activity level (0-1) */
  activityLevel: number;
  /** Token velocity preference (0-1, higher = more spending) */
  tokenVelocity: number;
  /** Trust score from network */
  trustScore: number;
}

export interface EconomicSnapshot {
  /** Simulation step */
  step: number;
  /** Total CC in circulation */
  totalCC: number;
  /** Total tokens in circulation */
  totalTokens: number;
  /** Average token velocity */
  averageVelocity: number;
  /** Gini coefficient for wealth distribution */
  giniCoefficient: number;
  /** Federation levy collected this step */
  federationLevy: number;
  /** Participants state */
  participants: Array<{
    id: string;
    ccBalance: number;
    tokenBalance: number;
    trustScore: number;
  }>;
}

export interface SimulationResult {
  /** Simulation ID */
  simulationId: string;
  /** Input parameters */
  parameters: EconomicParameters;
  /** Time series of economic snapshots */
  timeSeries: EconomicSnapshot[];
  /** Equilibrium analysis */
  equilibrium: {
    /** Whether equilibrium was reached */
    reached: boolean;
    /** Step at which equilibrium was detected */
    stepReached?: number;
    /** Final state values */
    finalState: {
      totalCC: number;
      totalTokens: number;
      averageVelocity: number;
      giniCoefficient: number;
    };
  };
  /** Economic warnings and insights */
  warnings: string[];
  /** Performance metrics */
  metrics: {
    /** CC earning efficiency */
    ccEfficiency: number;
    /** Token circulation health */
    circulationHealth: number;
    /** Wealth concentration risk */
    concentrationRisk: number;
  };
}

export interface SimulateEconomyRequest {
  parameters: EconomicParameters;
  participantBehaviors?: ParticipantBehavior[];
}

/**
 * Simulate ICN's dual economy with CC and token dynamics
 */
export async function icnSimulateEconomy(request: SimulateEconomyRequest): Promise<SimulationResult> {
  const { parameters, participantBehaviors } = request;
  const simulationId = nanoid();
  
  // Initialize participants
  const participants = initializeParticipants(parameters, participantBehaviors);
  
  // Run simulation
  const timeSeries: EconomicSnapshot[] = [];
  const warnings: string[] = [];
  
  for (let step = 0; step < parameters.steps; step++) {
    // Generate CC based on infrastructure contribution and trust
    generateCC(participants, parameters, step);
    
    // Apply demurrage to idle tokens
    applyDemurrage(participants, parameters);
    
    // Simulate economic activity (token flows)
    simulateActivity(participants, parameters);
    
    // Collect federation levy
    const federationLevy = collectFederationLevy(participants, parameters);
    
    // Settlement processing
    if (step % parameters.settlementFrequency === 0 && step > 0) {
      processSettlement(participants);
    }
    
    // Create snapshot
    const snapshot = createSnapshot(step, participants, federationLevy);
    timeSeries.push(snapshot);
    
    // Check for warnings
    warnings.push(...analyzeWarnings(snapshot, parameters));
  }
  
  // Analyze equilibrium
  const equilibrium = analyzeEquilibrium(timeSeries);
  
  // Calculate metrics
  const metrics = calculateMetrics(timeSeries, parameters);
  
  return {
    simulationId,
    parameters,
    timeSeries,
    equilibrium,
    warnings: [...new Set(warnings)], // Remove duplicates
    metrics
  };
}

function initializeParticipants(
  parameters: EconomicParameters, 
  behaviors?: ParticipantBehavior[]
): ParticipantBehavior[] {
  const participants: ParticipantBehavior[] = [];
  
  for (let i = 0; i < parameters.nodeCount; i++) {
    const providedBehavior = behaviors?.[i];
    
    participants.push({
      id: providedBehavior?.id || `node-${i}`,
      infrastructureContribution: providedBehavior?.infrastructureContribution || Math.random(),
      activityLevel: providedBehavior?.activityLevel || Math.random(),
      tokenVelocity: providedBehavior?.tokenVelocity || Math.random(),
      trustScore: providedBehavior?.trustScore || parameters.trustWeights?.[i] || Math.random()
    });
  }
  
  return participants;
}

function generateCC(participants: ParticipantBehavior[], parameters: EconomicParameters, _step: number): void {
  for (const participant of participants) {
    // CC generation = base rate * infrastructure contribution * trust score
    const ccGenerated = parameters.ccGenerationRate * 
                       participant.infrastructureContribution * 
                       participant.trustScore;
    
    // Store CC in participant (extends the interface implicitly)
    (participant as any).ccBalance = ((participant as any).ccBalance || 0) + ccGenerated;
  }
}

function applyDemurrage(participants: ParticipantBehavior[], parameters: EconomicParameters): void {
  for (const participant of participants) {
    const p = participant as any;
    if (p.tokenBalance > 0) {
      // Apply demurrage to idle tokens
      const idleTokens = p.tokenBalance * (1 - participant.tokenVelocity);
      const demurrageAmount = idleTokens * parameters.demurrageRate;
      p.tokenBalance = Math.max(0, (p.tokenBalance || parameters.initialTokens) - demurrageAmount);
    }
  }
}

function simulateActivity(participants: ParticipantBehavior[], parameters: EconomicParameters): void {
  // Simple economic activity simulation
  for (let i = 0; i < participants.length; i++) {
    const participant = participants[i] as any;
    const activityLevel = participants[i].activityLevel;
    
    // Initialize tokens if not set
    if (participant.tokenBalance === undefined) {
      participant.tokenBalance = parameters.initialTokens;
    }
    
    // Simulate token spending based on activity level and velocity
    const spendAmount = participant.tokenBalance * 
                       participants[i].tokenVelocity * 
                       activityLevel * 0.1; // 10% max spend per step
    
    participant.tokenBalance -= spendAmount;
    
    // Redistribute spent tokens to other participants (simplified market)
    const recipients = participants.filter((_, idx) => idx !== i);
    const perRecipient = spendAmount / recipients.length;
    
    recipients.forEach(recipient => {
      (recipient as any).tokenBalance = ((recipient as any).tokenBalance || parameters.initialTokens) + perRecipient;
    });
  }
}

function collectFederationLevy(participants: ParticipantBehavior[], parameters: EconomicParameters): number {
  let totalLevy = 0;
  
  for (const participant of participants) {
    const p = participant as any;
    const tokenBalance = p.tokenBalance || parameters.initialTokens;
    
    // Progressive levy on surplus above average
    const averageBalance = parameters.initialTokens;
    const surplus = Math.max(0, tokenBalance - averageBalance);
    
    if (surplus > 0) {
      const levy = surplus * parameters.federationLevyRate;
      p.tokenBalance = tokenBalance - levy;
      totalLevy += levy;
    }
  }
  
  return totalLevy;
}

function processSettlement(participants: ParticipantBehavior[]): void {
  // Simplified settlement: redistribute some tokens to balance network
  const totalTokens = participants.reduce((sum, p) => sum + ((p as any).tokenBalance || 0), 0);
  const averageTokens = totalTokens / participants.length;
  
  // Small rebalancing towards average (settlement effect)
  for (const participant of participants) {
    const p = participant as any;
    const current = p.tokenBalance || 0;
    const adjustment = (averageTokens - current) * 0.05; // 5% adjustment towards average
    p.tokenBalance = current + adjustment;
  }
}

function createSnapshot(
  step: number, 
  participants: ParticipantBehavior[], 
  federationLevy: number
): EconomicSnapshot {
  const totalCC = participants.reduce((sum, p) => sum + ((p as any).ccBalance || 0), 0);
  const totalTokens = participants.reduce((sum, p) => sum + ((p as any).tokenBalance || 0), 0);
  
  const velocities = participants.map(p => p.tokenVelocity);
  const averageVelocity = velocities.reduce((sum, v) => sum + v, 0) / velocities.length;
  
  const giniCoefficient = calculateGini(participants.map(p => (p as any).tokenBalance || 0));
  
  return {
    step,
    totalCC,
    totalTokens,
    averageVelocity,
    giniCoefficient,
    federationLevy,
    participants: participants.map(p => ({
      id: p.id,
      ccBalance: (p as any).ccBalance || 0,
      tokenBalance: (p as any).tokenBalance || 0,
      trustScore: p.trustScore
    }))
  };
}

function calculateGini(values: number[]): number {
  if (values.length === 0) return 0;
  
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  
  if (sum === 0) return 0;
  
  let index = 0;
  for (let i = 0; i < n; i++) {
    index += (i + 1) * sorted[i];
  }
  
  return (2 * index) / (n * sum) - (n + 1) / n;
}

function analyzeWarnings(snapshot: EconomicSnapshot, parameters: EconomicParameters): string[] {
  const warnings: string[] = [];
  
  // High wealth concentration
  if (snapshot.giniCoefficient > 0.7) {
    warnings.push(`High wealth concentration detected (Gini: ${snapshot.giniCoefficient.toFixed(3)})`);
  }
  
  // Low token velocity
  if (snapshot.averageVelocity < 0.3) {
    warnings.push(`Low token velocity may indicate hoarding (velocity: ${snapshot.averageVelocity.toFixed(3)})`);
  }
  
  // Deflation risk
  if (snapshot.totalTokens < parameters.initialTokens * parameters.nodeCount * 0.8) {
    warnings.push(`Token supply decline may indicate excessive demurrage or levies`);
  }
  
  return warnings;
}

function analyzeEquilibrium(timeSeries: EconomicSnapshot[]): {
  reached: boolean;
  stepReached?: number;
  finalState: {
    totalCC: number;
    totalTokens: number;
    averageVelocity: number;
    giniCoefficient: number;
  };
} {
  if (timeSeries.length < 10) {
    const final = timeSeries[timeSeries.length - 1];
    return {
      reached: false,
      finalState: {
        totalCC: final.totalCC,
        totalTokens: final.totalTokens,
        averageVelocity: final.averageVelocity,
        giniCoefficient: final.giniCoefficient
      }
    };
  }
  
  // Check for equilibrium in last 20% of simulation
  const checkPoints = Math.floor(timeSeries.length * 0.2);
  const recentSeries = timeSeries.slice(-checkPoints);
  
  // Calculate variance in key metrics
  const tokenVariance = calculateVariance(recentSeries.map(s => s.totalTokens));
  const velocityVariance = calculateVariance(recentSeries.map(s => s.averageVelocity));
  
  const equilibriumReached = tokenVariance < 100 && velocityVariance < 0.01;
  
  const final = timeSeries[timeSeries.length - 1];
  return {
    reached: equilibriumReached,
    stepReached: equilibriumReached ? timeSeries.length - checkPoints : undefined,
    finalState: {
      totalCC: final.totalCC,
      totalTokens: final.totalTokens,
      averageVelocity: final.averageVelocity,
      giniCoefficient: final.giniCoefficient
    }
  };
}

function calculateVariance(values: number[]): number {
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
}

function calculateMetrics(timeSeries: EconomicSnapshot[], parameters: EconomicParameters): {
  ccEfficiency: number;
  circulationHealth: number;
  concentrationRisk: number;
} {
  const final = timeSeries[timeSeries.length - 1];
  
  // CC efficiency: How well CC generation matches infrastructure contribution
  const ccEfficiency = Math.min(1, final.totalCC / (parameters.nodeCount * parameters.ccGenerationRate * parameters.steps));
  
  // Circulation health: Based on token velocity and distribution
  const circulationHealth = Math.min(1, final.averageVelocity * (1 - final.giniCoefficient));
  
  // Concentration risk: Based on Gini coefficient and trends
  const concentrationRisk = final.giniCoefficient;
  
  return {
    ccEfficiency,
    circulationHealth,
    concentrationRisk
  };
}