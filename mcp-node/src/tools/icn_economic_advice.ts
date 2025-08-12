export interface EconomicMechanism {
  /** Mechanism name */
  name: string;
  /** Mechanism description */
  description: string;
  /** Key parameters */
  parameters: Record<string, number | string | boolean>;
  /** Target outcomes */
  targetOutcomes: string[];
}

export interface EconomicAdviceRequest {
  /** Economic mechanism or parameter to analyze */
  mechanism: EconomicMechanism;
  /** Current economic context */
  context?: {
    /** Current network size */
    networkSize?: number;
    /** Average wealth per participant */
    averageWealth?: number;
    /** Current Gini coefficient */
    currentGini?: number;
    /** Token velocity */
    tokenVelocity?: number;
    /** CC generation rate */
    ccGenerationRate?: number;
  };
  /** Specific concerns to address */
  concerns?: string[];
}

export interface ImpactAnalysis {
  /** Impact category */
  category: 'wealth_distribution' | 'participation' | 'velocity' | 'stability' | 'governance';
  /** Impact direction */
  direction: 'positive' | 'negative' | 'neutral';
  /** Impact magnitude (0-1) */
  magnitude: number;
  /** Explanation of the impact */
  explanation: string;
  /** Time horizon for impact */
  timeHorizon: 'immediate' | 'short_term' | 'medium_term' | 'long_term';
}

export interface EconomicWarning {
  /** Warning severity */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Warning type */
  type: 'capture_risk' | 'hoarding_incentive' | 'inequality_increase' | 'participation_barrier' | 'instability_risk';
  /** Warning message */
  message: string;
  /** Recommended actions */
  recommendations: string[];
}

export interface ParameterSuggestion {
  /** Parameter name */
  parameter: string;
  /** Current value */
  currentValue: number | string | boolean;
  /** Suggested value */
  suggestedValue: number | string | boolean;
  /** Reasoning for suggestion */
  reasoning: string;
  /** Expected impact */
  expectedImpact: string;
  /** Confidence in suggestion (0-1) */
  confidence: number;
}

export interface HistoricalCase {
  /** Case name */
  name: string;
  /** Similar mechanism description */
  mechanism: string;
  /** Outcome */
  outcome: 'success' | 'partial_success' | 'failure';
  /** Key lessons */
  lessons: string[];
  /** Relevance to current mechanism (0-1) */
  relevance: number;
}

export interface EconomicAdviceResponse {
  /** Overall assessment */
  assessment: {
    /** Overall score (0-1, higher is better) */
    score: number;
    /** Key strengths */
    strengths: string[];
    /** Main concerns */
    concerns: string[];
    /** Recommendation */
    recommendation: 'proceed' | 'modify' | 'reconsider' | 'reject';
  };
  /** Detailed impact analysis */
  impacts: ImpactAnalysis[];
  /** Warnings about potential issues */
  warnings: EconomicWarning[];
  /** Parameter optimization suggestions */
  parameterSuggestions: ParameterSuggestion[];
  /** Similar historical cases */
  historicalCases: HistoricalCase[];
  /** ICN-specific considerations */
  icnConsiderations: {
    /** Alignment with ICN invariants */
    invariantAlignment: Array<{
      invariant: string;
      aligned: boolean;
      explanation: string;
    }>;
    /** Impact on dual economy balance */
    dualEconomyImpact: string;
    /** Democratic governance implications */
    governanceImpact: string;
  };
}

/**
 * Analyze economic mechanisms and provide advice on implementations
 */
export async function icnEconomicAdvice(request: EconomicAdviceRequest): Promise<EconomicAdviceResponse> {
  const { mechanism, context = {}, concerns = [] } = request;
  
  // Analyze impacts across different dimensions
  const impacts = analyzeImpacts(mechanism, context);
  
  // Identify potential warnings and risks
  const warnings = identifyWarnings(mechanism, context, concerns);
  
  // Generate parameter suggestions
  const parameterSuggestions = generateParameterSuggestions(mechanism, context, impacts, warnings);
  
  // Find relevant historical cases
  const historicalCases = findHistoricalCases(mechanism);
  
  // Analyze ICN-specific considerations
  const icnConsiderations = analyzeICNConsiderations(mechanism, context);
  
  // Generate overall assessment
  const assessment = generateAssessment(impacts, warnings, parameterSuggestions, icnConsiderations);
  
  return {
    assessment,
    impacts,
    warnings,
    parameterSuggestions,
    historicalCases,
    icnConsiderations
  };
}

function analyzeImpacts(mechanism: EconomicMechanism, _context: Record<string, any>): ImpactAnalysis[] {
  const impacts: ImpactAnalysis[] = [];
  
  // Analyze wealth distribution impact
  impacts.push(analyzeWealthDistributionImpact(mechanism, context));
  
  // Analyze participation impact
  impacts.push(analyzeParticipationImpact(mechanism, context));
  
  // Analyze velocity impact
  impacts.push(analyzeVelocityImpact(mechanism, context));
  
  // Analyze stability impact
  impacts.push(analyzeStabilityImpact(mechanism, context));
  
  // Analyze governance impact
  impacts.push(analyzeGovernanceImpact(mechanism, context));
  
  return impacts.filter(impact => impact.magnitude > 0.1); // Only include significant impacts
}

function analyzeWealthDistributionImpact(mechanism: EconomicMechanism, _context: Record<string, any>): ImpactAnalysis {
  const { name, parameters } = mechanism;
  const _ = context.currentGini || 0.3;
  
  let direction: ImpactAnalysis['direction'] = 'neutral';
  let magnitude = 0.1;
  let explanation = 'Minimal impact on wealth distribution';
  
  // Analyze based on mechanism type
  if (name.toLowerCase().includes('levy') || name.toLowerCase().includes('tax')) {
    const rate = extractNumericParameter(parameters, ['rate', 'levy_rate', 'tax_rate']);
    if (rate > 0.2) {
      direction = 'positive';
      magnitude = Math.min(0.8, rate * 2);
      explanation = `Progressive levy of ${(rate * 100).toFixed(1)}% should reduce wealth concentration`;
    } else if (rate > 0) {
      direction = 'positive';
      magnitude = 0.3;
      explanation = `Moderate levy rate may provide minor improvement in distribution`;
    }
  } else if (name.toLowerCase().includes('demurrage')) {
    const rate = extractNumericParameter(parameters, ['demurrage_rate', 'rate']);
    if (rate > 0.005) {
      direction = 'positive';
      magnitude = 0.6;
      explanation = `Demurrage rate of ${(rate * 100).toFixed(2)}% should discourage hoarding and improve distribution`;
    }
  } else if (name.toLowerCase().includes('reward') || name.toLowerCase().includes('incentive')) {
    // Check if rewards are progressive or regressive
    const baseAmount = extractNumericParameter(parameters, ['base_amount', 'amount']);
    const isProgressive = Object.keys(parameters).some(key => 
      key.includes('progressive') || key.includes('scaling') || key.includes('factor')
    );
    
    if (isProgressive) {
      direction = 'positive';
      magnitude = 0.4;
      explanation = 'Progressive reward structure should help reduce inequality';
    } else if (baseAmount > 0) {
      direction = 'negative';
      magnitude = 0.3;
      explanation = 'Flat rewards may increase inequality if high earners benefit more';
    }
  }
  
  return {
    category: 'wealth_distribution',
    direction,
    magnitude,
    explanation,
    timeHorizon: 'medium_term'
  };
}

function analyzeParticipationImpact(mechanism: EconomicMechanism, _context: Record<string, any>): ImpactAnalysis {
  const { name, parameters } = mechanism;
  const _ = context.networkSize || 100;
  
  let direction: ImpactAnalysis['direction'] = 'neutral';
  let magnitude = 0.1;
  let explanation = 'Minimal impact on participation';
  
  if (name.toLowerCase().includes('barrier') || name.toLowerCase().includes('fee')) {
    const amount = extractNumericParameter(parameters, ['fee', 'amount', 'cost']);
    const averageWealth = context.averageWealth || 1000;
    const relativeBarrier = amount / averageWealth;
    
    if (relativeBarrier > 0.1) {
      direction = 'negative';
      magnitude = Math.min(0.9, relativeBarrier * 5);
      explanation = `High participation barrier (${(relativeBarrier * 100).toFixed(1)}% of average wealth) may exclude participants`;
    } else if (relativeBarrier > 0.05) {
      direction = 'negative';
      magnitude = 0.4;
      explanation = 'Moderate participation barrier may limit some participants';
    }
  } else if (name.toLowerCase().includes('reward') || name.toLowerCase().includes('incentive')) {
    const amount = extractNumericParameter(parameters, ['amount', 'reward']);
    if (amount > 0) {
      direction = 'positive';
      magnitude = 0.5;
      explanation = 'Participation rewards should encourage greater network engagement';
    }
  } else if (name.toLowerCase().includes('cc') && name.toLowerCase().includes('generation')) {
    direction = 'positive';
    magnitude = 0.7;
    explanation = 'CC generation mechanism encourages infrastructure participation';
  }
  
  return {
    category: 'participation',
    direction,
    magnitude,
    explanation,
    timeHorizon: 'short_term'
  };
}

function analyzeVelocityImpact(mechanism: EconomicMechanism, _context: Record<string, any>): ImpactAnalysis {
  const { name, parameters } = mechanism;
  const _ = context.tokenVelocity || 0.5;
  
  let direction: ImpactAnalysis['direction'] = 'neutral';
  let magnitude = 0.1;
  let explanation = 'Minimal impact on token velocity';
  
  if (name.toLowerCase().includes('demurrage')) {
    const rate = extractNumericParameter(parameters, ['demurrage_rate', 'rate']);
    if (rate > 0.001) {
      direction = 'positive';
      magnitude = Math.min(0.8, rate * 200);
      explanation = `Demurrage rate of ${(rate * 100).toFixed(3)}% should increase token circulation`;
    }
  } else if (name.toLowerCase().includes('saving') || name.toLowerCase().includes('storage')) {
    const incentive = extractNumericParameter(parameters, ['interest', 'reward', 'rate']);
    if (incentive > 0.02) {
      direction = 'negative';
      magnitude = 0.6;
      explanation = 'High savings incentives may reduce token velocity';
    }
  } else if (name.toLowerCase().includes('transaction') && name.toLowerCase().includes('fee')) {
    const fee = extractNumericParameter(parameters, ['fee', 'rate']);
    if (fee > 0.01) {
      direction = 'negative';
      magnitude = Math.min(0.7, fee * 50);
      explanation = `Transaction fees of ${(fee * 100).toFixed(2)}% may discourage circulation`;
    }
  }
  
  return {
    category: 'velocity',
    direction,
    magnitude,
    explanation,
    timeHorizon: 'short_term'
  };
}

function analyzeStabilityImpact(mechanism: EconomicMechanism, _context: Record<string, any>): ImpactAnalysis {
  const { name, parameters } = mechanism;
  
  let direction: ImpactAnalysis['direction'] = 'neutral';
  let magnitude = 0.2;
  let explanation = 'Moderate impact on system stability';
  
  // Check for stability-enhancing mechanisms
  if (name.toLowerCase().includes('settlement') || name.toLowerCase().includes('clearing')) {
    direction = 'positive';
    magnitude = 0.6;
    explanation = 'Settlement mechanisms improve system stability and reduce counterparty risk';
  } else if (name.toLowerCase().includes('reserve') || name.toLowerCase().includes('buffer')) {
    direction = 'positive';
    magnitude = 0.5;
    explanation = 'Reserve mechanisms provide stability buffer against volatility';
  }
  
  // Check for potentially destabilizing factors
  const hasVolatileParameters = Object.values(parameters).some(value => 
    typeof value === 'number' && (value > 1.5 || value < 0.1)
  );
  
  if (hasVolatileParameters) {
    direction = direction === 'positive' ? 'neutral' : 'negative';
    magnitude = Math.max(magnitude, 0.4);
    explanation += ' However, extreme parameter values may introduce volatility';
  }
  
  return {
    category: 'stability',
    direction,
    magnitude,
    explanation,
    timeHorizon: 'medium_term'
  };
}

function analyzeGovernanceImpact(mechanism: EconomicMechanism, _context: Record<string, any>): ImpactAnalysis {
  const { name, parameters, description } = mechanism;
  
  let direction: ImpactAnalysis['direction'] = 'neutral';
  let magnitude = 0.1;
  let explanation = 'Minimal governance implications';
  
  // Check for democratic elements
  const isDemocratic = description.toLowerCase().includes('democratic') || 
                      description.toLowerCase().includes('consensus') ||
                      Object.keys(parameters).some(key => key.includes('vote') || key.includes('consensus'));
  
  if (isDemocratic) {
    direction = 'positive';
    magnitude = 0.7;
    explanation = 'Mechanism includes democratic decision-making elements';
  }
  
  // Check for concentration of power
  const hasOwnership = Object.keys(parameters).some(key => 
    key.includes('owner') || key.includes('admin') || key.includes('controller')
  );
  
  if (hasOwnership) {
    direction = 'negative';
    magnitude = 0.8;
    explanation = 'Centralized control elements may undermine democratic governance';
  }
  
  // Check for transparency
  const isTransparent = description.toLowerCase().includes('transparent') ||
                       description.toLowerCase().includes('auditable') ||
                       description.toLowerCase().includes('open');
  
  if (isTransparent && direction !== 'negative') {
    direction = 'positive';
    magnitude = Math.max(magnitude, 0.4);
    explanation = explanation + (explanation.includes('democratic') ? ' with transparency' : 'Transparent mechanism supports good governance');
  }
  
  return {
    category: 'governance',
    direction,
    magnitude,
    explanation,
    timeHorizon: 'long_term'
  };
}

function identifyWarnings(
  mechanism: EconomicMechanism, 
  context: Record<string, any>,
  concerns: string[]
): EconomicWarning[] {
  const warnings: EconomicWarning[] = [];
  
  // Check for capture risks
  warnings.push(...identifyCaptureRisks(mechanism, context));
  
  // Check for hoarding incentives
  warnings.push(...identifyHoardingRisks(mechanism, context));
  
  // Check for inequality increases
  warnings.push(...identifyInequalityRisks(mechanism, context));
  
  // Check for participation barriers
  warnings.push(...identifyParticipationBarriers(mechanism, context));
  
  // Check for instability risks
  warnings.push(...identifyInstabilityRisks(mechanism, context));
  
  // Address specific concerns
  warnings.push(...addressSpecificConcerns(mechanism, context, concerns));
  
  return warnings;
}

function identifyCaptureRisks(mechanism: EconomicMechanism, _context: Record<string, any>): EconomicWarning[] {
  const warnings: EconomicWarning[] = [];
  const { name, parameters, description } = mechanism;
  
  // Check for centralized control
  const hasCentralizedControl = Object.keys(parameters).some(key => 
    key.includes('admin') || key.includes('owner') || key.includes('controller')
  ) || description.toLowerCase().includes('centralized');
  
  if (hasCentralizedControl) {
    warnings.push({
      severity: 'high',
      type: 'capture_risk',
      message: 'Mechanism includes centralized control elements that could be captured',
      recommendations: [
        'Implement multi-signature controls',
        'Add democratic oversight mechanisms',
        'Include time delays for critical changes',
        'Establish transparent governance processes'
      ]
    });
  }
  
  // Check for high influence parameters
  const highInfluenceRate = extractNumericParameter(parameters, ['rate', 'multiplier', 'factor']);
  if (highInfluenceRate > 2.0) {
    warnings.push({
      severity: 'medium',
      type: 'capture_risk',
      message: 'High-impact parameters could be manipulated if governance is captured',
      recommendations: [
        'Add parameter bounds and validation',
        'Require supermajority for parameter changes',
        'Implement gradual parameter adjustment mechanisms'
      ]
    });
  }
  
  return warnings;
}

function identifyHoardingRisks(mechanism: EconomicMechanism, _context: Record<string, any>): EconomicWarning[] {
  const warnings: EconomicWarning[] = [];
  const { name, parameters } = mechanism;
  
  // Check for savings incentives without circulation incentives
  const hasInterest = extractNumericParameter(parameters, ['interest', 'yield', 'return']) > 0;
  const hasDemurrage = extractNumericParameter(parameters, ['demurrage', 'decay']) > 0;
  
  if (hasInterest && !hasDemurrage) {
    warnings.push({
      severity: 'medium',
      type: 'hoarding_incentive',
      message: 'Interest rewards without circulation incentives may encourage hoarding',
      recommendations: [
        'Add demurrage mechanism for idle tokens',
        'Implement participation requirements for interest',
        'Consider progressive interest rates that decrease with balance size'
      ]
    });
  }
  
  // Check for high transaction costs
  const transactionCost = extractNumericParameter(parameters, ['fee', 'cost', 'charge']);
  if (transactionCost > 0.02) {
    warnings.push({
      severity: 'medium',
      type: 'hoarding_incentive',
      message: 'High transaction costs may discourage circulation and encourage hoarding',
      recommendations: [
        'Reduce transaction fees',
        'Implement fee rebates for frequent users',
        'Consider distance-based or volume-based fee structures'
      ]
    });
  }
  
  return warnings;
}

function identifyInequalityRisks(mechanism: EconomicMechanism, _context: Record<string, any>): EconomicWarning[] {
  const warnings: EconomicWarning[] = [];
  const { name, parameters } = mechanism;
  const _ = context.currentGini || 0.3;
  
  // Check for regressive mechanisms
  const hasFixedCosts = Object.keys(parameters).some(key => 
    key.includes('fee') || key.includes('cost') || key.includes('minimum')
  );
  
  if (hasFixedCosts) {
    const cost = extractNumericParameter(parameters, ['fee', 'cost', 'minimum']);
    const averageWealth = context.averageWealth || 1000;
    
    if (cost / averageWealth > 0.05) {
      warnings.push({
        severity: 'high',
        type: 'inequality_increase',
        message: 'Fixed costs represent high percentage of average wealth, creating regressive effects',
        recommendations: [
          'Implement progressive fee structures',
          'Add wealth-based fee adjustments',
          'Provide fee subsidies for low-wealth participants'
        ]
      });
    }
  }
  
  // Check for wealth-multiplying mechanisms
  const hasWealthMultiplier = mechanism.description.toLowerCase().includes('compound') ||
                             mechanism.description.toLowerCase().includes('accumul') ||
                             Object.keys(parameters).some(key => key.includes('multiplier'));
  
  if (hasWealthMultiplier && currentGini > 0.4) {
    warnings.push({
      severity: 'medium',
      type: 'inequality_increase',
      message: 'Wealth-multiplying mechanisms may worsen existing inequality',
      recommendations: [
        'Add progressive caps on multiplier effects',
        'Implement wealth redistribution mechanisms',
        'Consider flat rather than percentage-based rewards'
      ]
    });
  }
  
  return warnings;
}

function identifyParticipationBarriers(mechanism: EconomicMechanism, _context: Record<string, any>): EconomicWarning[] {
  const warnings: EconomicWarning[] = [];
  const { parameters } = mechanism;
  const averageWealth = context.averageWealth || 1000;
  
  // Check for high entry requirements
  const entryRequirement = extractNumericParameter(parameters, ['minimum', 'deposit', 'stake', 'bond']);
  if (entryRequirement > averageWealth * 0.2) {
    warnings.push({
      severity: 'high',
      type: 'participation_barrier',
      message: `Entry requirement of ${entryRequirement} is high relative to average wealth`,
      recommendations: [
        'Reduce minimum requirements',
        'Implement graduated entry levels',
        'Provide community lending for entry requirements',
        'Allow collective participation options'
      ]
    });
  }
  
  // Check for complex requirements
  const parameterCount = Object.keys(parameters).length;
  if (parameterCount > 8) {
    warnings.push({
      severity: 'low',
      type: 'participation_barrier',
      message: 'Complex mechanism with many parameters may be difficult to understand',
      recommendations: [
        'Simplify mechanism design',
        'Provide clear documentation and examples',
        'Implement user-friendly interfaces',
        'Offer educational resources'
      ]
    });
  }
  
  return warnings;
}

function identifyInstabilityRisks(mechanism: EconomicMechanism, _context: Record<string, any>): EconomicWarning[] {
  const warnings: EconomicWarning[] = [];
  const { parameters } = mechanism;
  
  // Check for feedback loops
  const hasMultipliers = Object.keys(parameters).some(key => 
    key.includes('multiplier') || key.includes('factor') || key.includes('amplifier')
  );
  
  if (hasMultipliers) {
    const multiplier = extractNumericParameter(parameters, ['multiplier', 'factor', 'amplifier']);
    if (multiplier > 2.0) {
      warnings.push({
        severity: 'medium',
        type: 'instability_risk',
        message: 'High multiplier values may create unstable feedback loops',
        recommendations: [
          'Add dampening mechanisms',
          'Implement circuit breakers for extreme values',
          'Use gradual adjustment rather than immediate full effect',
          'Monitor and adjust multipliers based on system behavior'
        ]
      });
    }
  }
  
  // Check for extreme parameter values
  const extremeValues = Object.values(parameters).filter(value => 
    typeof value === 'number' && (value > 10 || value < 0.01)
  );
  
  if (extremeValues.length > 0) {
    warnings.push({
      severity: 'low',
      type: 'instability_risk',
      message: 'Extreme parameter values may cause unpredictable system behavior',
      recommendations: [
        'Validate parameter ranges against simulation results',
        'Implement gradual rollout of extreme parameters',
        'Add monitoring and automatic adjustment mechanisms'
      ]
    });
  }
  
  return warnings;
}

function addressSpecificConcerns(
  mechanism: EconomicMechanism, 
  context: Record<string, any>,
  concerns: string[]
): EconomicWarning[] {
  const warnings: EconomicWarning[] = [];
  
  for (const concern of concerns) {
    const concernLower = concern.toLowerCase();
    
    if (concernLower.includes('fairness') || concernLower.includes('equity')) {
      warnings.push({
        severity: 'medium',
        type: 'inequality_increase',
        message: `Fairness concern: ${concern}`,
        recommendations: [
          'Implement progressive mechanisms',
          'Add wealth distribution monitoring',
          'Consider impact on different participant groups'
        ]
      });
    } else if (concernLower.includes('participation') || concernLower.includes('access')) {
      warnings.push({
        severity: 'medium',
        type: 'participation_barrier',
        message: `Participation concern: ${concern}`,
        recommendations: [
          'Lower barriers to entry',
          'Provide educational resources',
          'Implement community support mechanisms'
        ]
      });
    }
  }
  
  return warnings;
}

function generateParameterSuggestions(
  mechanism: EconomicMechanism,
  context: Record<string, any>,
  impacts: ImpactAnalysis[],
  warnings: EconomicWarning[]
): ParameterSuggestion[] {
  const suggestions: ParameterSuggestion[] = [];
  const { parameters } = mechanism;
  
  // Suggest improvements based on impacts and warnings
  for (const [paramName, currentValue] of Object.entries(parameters)) {
    if (typeof currentValue === 'number') {
      const suggestion = generateParameterSuggestion(paramName, currentValue, impacts, warnings, context);
      if (suggestion) {
        suggestions.push(suggestion);
      }
    }
  }
  
  return suggestions;
}

function generateParameterSuggestion(
  paramName: string,
  currentValue: number,
  impacts: ImpactAnalysis[],
  warnings: EconomicWarning[],
  context: Record<string, any>
): ParameterSuggestion | null {
  const paramLower = paramName.toLowerCase();
  
  // Suggest lower rates if causing negative impacts
  if ((paramLower.includes('rate') || paramLower.includes('fee')) && currentValue > 0.1) {
    const negativeImpacts = impacts.filter(i => i.direction === 'negative' && i.magnitude > 0.5);
    if (negativeImpacts.length > 0) {
      return {
        parameter: paramName,
        currentValue,
        suggestedValue: Math.max(0.01, currentValue * 0.5),
        reasoning: 'High rates are causing negative impacts on participation or velocity',
        expectedImpact: 'Should improve participation and reduce barriers',
        confidence: 0.7
      };
    }
  }
  
  // Suggest progressive adjustments for levy mechanisms
  if (paramLower.includes('levy') || paramLower.includes('tax')) {
    const inequalityWarnings = warnings.filter(w => w.type === 'inequality_increase');
    if (inequalityWarnings.length > 0 && currentValue < 0.3) {
      return {
        parameter: paramName,
        currentValue,
        suggestedValue: Math.min(0.3, currentValue * 1.5),
        reasoning: 'Higher progressive levy could help address inequality concerns',
        expectedImpact: 'Should improve wealth distribution',
        confidence: 0.6
      };
    }
  }
  
  // Suggest demurrage adjustments
  if (paramLower.includes('demurrage') && currentValue < 0.002) {
    const velocityImpacts = impacts.filter(i => i.category === 'velocity' && i.direction === 'negative');
    if (velocityImpacts.length > 0) {
      return {
        parameter: paramName,
        currentValue,
        suggestedValue: 0.002,
        reasoning: 'Higher demurrage rate could improve token circulation',
        expectedImpact: 'Should increase token velocity and reduce hoarding',
        confidence: 0.8
      };
    }
  }
  
  return null;
}

function findHistoricalCases(mechanism: EconomicMechanism): HistoricalCase[] {
  const cases: HistoricalCase[] = [];
  const { name, description } = mechanism;
  const mechLower = name.toLowerCase() + ' ' + description.toLowerCase();
  
  // Demurrage cases
  if (mechLower.includes('demurrage')) {
    cases.push({
      name: 'Freigeld (Silvio Gesell)',
      mechanism: 'Demurrage-based currency with holding fees',
      outcome: 'partial_success',
      lessons: [
        'Demurrage effectively increased circulation velocity',
        'Resistance from existing financial systems limited adoption',
        'Local implementations showed promising results'
      ],
      relevance: 0.8
    });
    
    cases.push({
      name: 'Wörgl Experiment (1932)',
      mechanism: 'Local currency with monthly demurrage stamps',
      outcome: 'success',
      lessons: [
        'Dramatic increase in economic activity',
        'Unemployment reduction and infrastructure improvement',
        'Shut down by central authorities, not economic failure'
      ],
      relevance: 0.9
    });
  }
  
  // Progressive taxation cases
  if (mechLower.includes('levy') || mechLower.includes('progressive') || mechLower.includes('tax')) {
    cases.push({
      name: 'Nordic Model',
      mechanism: 'Progressive taxation with strong social programs',
      outcome: 'success',
      lessons: [
        'High progressive taxes can coexist with strong economic growth',
        'Strong social safety net increases participation',
        'Democratic legitimacy essential for sustainability'
      ],
      relevance: 0.6
    });
  }
  
  // Participatory budgeting cases
  if (mechLower.includes('democratic') || mechLower.includes('governance') || mechLower.includes('voting')) {
    cases.push({
      name: 'Porto Alegre Participatory Budgeting',
      mechanism: 'Direct democratic control over municipal budget allocation',
      outcome: 'success',
      lessons: [
        'Democratic participation improved resource allocation',
        'Increased civic engagement and satisfaction',
        'Required significant institutional support'
      ],
      relevance: 0.7
    });
  }
  
  return cases;
}

function analyzeICNConsiderations(
  mechanism: EconomicMechanism,
  context: Record<string, any>
): EconomicAdviceResponse['icnConsiderations'] {
  const { name, description, parameters } = mechanism;
  
  // Check alignment with ICN invariants
  const invariantAlignment = [
    {
      invariant: 'CC must be non-transferable',
      aligned: !description.toLowerCase().includes('transfer cc') && !description.toLowerCase().includes('trade cc'),
      explanation: description.toLowerCase().includes('cc') ? 
        'Mechanism mentions CC - ensure it maintains non-transferability' :
        'Mechanism does not appear to affect CC transferability'
    },
    {
      invariant: 'Democratic governance required',
      aligned: description.toLowerCase().includes('democratic') || 
               description.toLowerCase().includes('consensus') ||
               description.toLowerCase().includes('voting'),
      explanation: description.toLowerCase().includes('democratic') ?
        'Mechanism includes democratic elements' :
        'Consider adding democratic oversight for parameter changes'
    },
    {
      invariant: 'No token-bought voting power',
      aligned: !description.toLowerCase().includes('token voting') && 
               !description.toLowerCase().includes('wealth voting'),
      explanation: 'Mechanism should not allow purchasing voting power with tokens'
    }
  ];
  
  // Analyze dual economy impact
  let dualEconomyImpact = 'Neutral impact on CC/token balance';
  if (description.toLowerCase().includes('cc') && description.toLowerCase().includes('token')) {
    dualEconomyImpact = 'Mechanism affects both CC and token economies - ensure proper separation';
  } else if (description.toLowerCase().includes('cc')) {
    dualEconomyImpact = 'Mechanism primarily affects CC economy - should maintain infrastructure incentives';
  } else if (description.toLowerCase().includes('token')) {
    dualEconomyImpact = 'Mechanism affects token economy - should support economic exchange';
  }
  
  // Analyze governance impact
  let governanceImpact = 'Limited governance implications';
  if (description.toLowerCase().includes('governance') || description.toLowerCase().includes('voting')) {
    governanceImpact = 'Direct governance mechanism - must ensure democratic participation';
  } else if (Object.keys(parameters).some(key => key.includes('admin') || key.includes('owner'))) {
    governanceImpact = 'Centralized control elements - consider democratic oversight';
  } else if (description.toLowerCase().includes('automatic') || description.toLowerCase().includes('algorithmic')) {
    governanceImpact = 'Algorithmic mechanism - ensure transparency and democratic parameter setting';
  }
  
  return {
    invariantAlignment,
    dualEconomyImpact,
    governanceImpact
  };
}

function generateAssessment(
  impacts: ImpactAnalysis[],
  warnings: EconomicWarning[],
  _parameterSuggestions: ParameterSuggestion[],
  _icnConsiderations: EconomicAdviceResponse['icnConsiderations']
): EconomicAdviceResponse['assessment'] {
  // Calculate overall score
  const positiveImpacts = impacts.filter(i => i.direction === 'positive');
  const negativeImpacts = impacts.filter(i => i.direction === 'negative');
  const criticalWarnings = warnings.filter(w => w.severity === 'critical' || w.severity === 'high');
  
  const positiveScore = positiveImpacts.reduce((sum, i) => sum + i.magnitude, 0) / impacts.length;
  const negativeScore = negativeImpacts.reduce((sum, i) => sum + i.magnitude, 0) / impacts.length;
  const warningPenalty = criticalWarnings.length * 0.2;
  
  const rawScore = Math.max(0, positiveScore - negativeScore - warningPenalty);
  const score = Math.min(1, rawScore);
  
  // Generate strengths
  const strengths: string[] = [];
  positiveImpacts.forEach(impact => {
    if (impact.magnitude > 0.5) {
      strengths.push(`${impact.category.replace('_', ' ')}: ${impact.explanation}`);
    }
  });
  
  // Generate concerns
  const concerns: string[] = [];
  negativeImpacts.forEach(impact => {
    if (impact.magnitude > 0.4) {
      concerns.push(`${impact.category.replace('_', ' ')}: ${impact.explanation}`);
    }
  });
  warnings.forEach(warning => {
    if (warning.severity === 'high' || warning.severity === 'critical') {
      concerns.push(warning.message);
    }
  });
  
  // Generate recommendation
  let recommendation: EconomicAdviceResponse['assessment']['recommendation'];
  if (score > 0.7 && criticalWarnings.length === 0) {
    recommendation = 'proceed';
  } else if (score > 0.5 && criticalWarnings.length <= 1) {
    recommendation = 'modify';
  } else if (score > 0.3) {
    recommendation = 'reconsider';
  } else {
    recommendation = 'reject';
  }
  
  return {
    score,
    strengths,
    concerns,
    recommendation
  };
}

function extractNumericParameter(parameters: Record<string, any>, keys: string[]): number {
  for (const key of keys) {
    for (const paramKey of Object.keys(parameters)) {
      if (paramKey.toLowerCase().includes(key)) {
        const value = parameters[paramKey];
        if (typeof value === 'number') {
          return value;
        }
      }
    }
  }
  return 0;
}