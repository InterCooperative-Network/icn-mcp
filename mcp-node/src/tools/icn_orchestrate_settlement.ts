import { nanoid } from 'nanoid';

export interface Organization {
  /** Organization ID */
  id: string;
  /** Organization name */
  name: string;
  /** Organization type */
  type: 'cooperative' | 'federation' | 'individual' | 'collective';
  /** Trust score (0-1) */
  trustScore: number;
  /** Settlement preferences */
  preferences: {
    /** Minimum settlement amount */
    minSettlementAmount: number;
    /** Preferred settlement frequency (hours) */
    preferredFrequency: number;
    /** Maximum exposure limit */
    maxExposure: number;
  };
}

export interface Transaction {
  /** Transaction ID */
  id: string;
  /** From organization */
  from: string;
  /** To organization */
  to: string;
  /** Amount */
  amount: number;
  /** Currency/token type */
  currency: 'tokens' | 'credits' | 'cc';
  /** Transaction timestamp */
  timestamp: Date;
  /** Transaction type */
  type: 'trade' | 'service' | 'transfer' | 'levy' | 'fee';
  /** Settlement status */
  settlementStatus: 'pending' | 'included' | 'settled' | 'disputed';
  /** Additional metadata */
  metadata?: Record<string, any>;
}

export interface ExchangeRate {
  /** From currency */
  from: string;
  /** To currency */
  to: string;
  /** Exchange rate */
  rate: number;
  /** Rate timestamp */
  timestamp: Date;
  /** Rate confidence (0-1) */
  confidence: number;
}

export interface NetPosition {
  /** Organization ID */
  organizationId: string;
  /** Net amounts by currency */
  netAmounts: Record<string, number>;
  /** Gross exposure */
  grossExposure: number;
  /** Credit limit usage */
  creditLimitUsage: number;
  /** Settlement priority */
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export interface SettlementEvent {
  /** Settlement event ID */
  id: string;
  /** Settlement batch ID */
  batchId: string;
  /** From organization */
  from: string;
  /** To organization */
  to: string;
  /** Settlement amount */
  amount: number;
  /** Settlement currency */
  currency: string;
  /** Exchange rate used */
  exchangeRate?: number;
  /** Included transactions */
  transactions: string[];
  /** Settlement timestamp */
  timestamp: Date;
  /** Settlement status */
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'disputed';
}

export interface Dispute {
  /** Dispute ID */
  id: string;
  /** Related settlement event */
  settlementEventId: string;
  /** Disputing organization */
  disputingOrg: string;
  /** Dispute type */
  type: 'amount_mismatch' | 'missing_transaction' | 'rate_dispute' | 'unauthorized' | 'other';
  /** Dispute description */
  description: string;
  /** Evidence */
  evidence?: string[];
  /** Dispute status */
  status: 'open' | 'investigating' | 'resolved' | 'escalated';
  /** Resolution */
  resolution?: {
    action: 'adjustment' | 'reversal' | 'partial_credit' | 'no_action';
    amount?: number;
    reasoning: string;
  };
}

export interface SettlementOptimization {
  /** Total transactions to settle */
  totalTransactions: number;
  /** Net settlement events generated */
  settlementEvents: number;
  /** Reduction ratio */
  reductionRatio: number;
  /** Settlement efficiency score */
  efficiencyScore: number;
  /** Estimated cost savings */
  costSavings: number;
}

export interface OrchestrationRequest {
  /** Transactions to settle */
  transactions: Transaction[];
  /** Participating organizations */
  organizations: Organization[];
  /** Exchange rates */
  exchangeRates?: ExchangeRate[];
  /** Settlement preferences */
  preferences?: {
    /** Force settlement even if below minimums */
    forceSettlement?: boolean;
    /** Maximum settlement delay (hours) */
    maxDelay?: number;
    /** Netting algorithm */
    nettingAlgorithm?: 'simple' | 'multilateral' | 'optimized';
    /** Dispute resolution */
    disputeResolution?: 'automatic' | 'manual' | 'democratic';
  };
}

export interface OrchestrationResponse {
  /** Settlement batch ID */
  batchId: string;
  /** Net positions calculated */
  netPositions: NetPosition[];
  /** Settlement events to execute */
  settlementEvents: SettlementEvent[];
  /** Optimization metrics */
  optimization: SettlementOptimization;
  /** Warnings and issues */
  warnings: string[];
  /** Disputes detected */
  disputes: Dispute[];
  /** Settlement summary */
  summary: {
    /** Total amount settled by currency */
    totalAmounts: Record<string, number>;
    /** Number of organizations involved */
    organizationsCount: number;
    /** Estimated settlement time */
    estimatedTime: string;
    /** Settlement cost */
    estimatedCost: number;
  };
}

/**
 * Orchestrate settlement of inter-organizational transactions
 */
export async function icnOrchestleSettlement(request: OrchestrationRequest): Promise<OrchestrationResponse> {
  const { transactions, organizations, exchangeRates = [], preferences = {} } = request;
  const batchId = nanoid();
  
  // Validate transactions and organizations
  const warnings = validateSettlementInputs(transactions, organizations);
  
  // Filter transactions ready for settlement
  const settleableTransactions = filterSettleableTransactions(transactions, organizations, preferences);
  
  // Calculate net positions
  const netPositions = calculateNetPositions(settleableTransactions, organizations, exchangeRates);
  
  // Generate settlement events using chosen algorithm
  const settlementEvents = generateSettlementEvents(
    netPositions, 
    organizations, 
    batchId,
    preferences.nettingAlgorithm || 'multilateral'
  );
  
  // Detect potential disputes
  const disputes = detectDisputes(settleableTransactions, settlementEvents, organizations);
  
  // Calculate optimization metrics
  const optimization = calculateOptimization(settleableTransactions, settlementEvents);
  
  // Generate summary
  const summary = generateSettlementSummary(settlementEvents, organizations);
  
  return {
    batchId,
    netPositions,
    settlementEvents,
    optimization,
    warnings,
    disputes,
    summary
  };
}

function validateSettlementInputs(
  transactions: Transaction[], 
  organizations: Organization[]
): string[] {
  const warnings: string[] = [];
  const orgIds = new Set(organizations.map(org => org.id));
  
  // Check for orphaned transactions
  const orphanedTransactions = transactions.filter(tx => 
    !orgIds.has(tx.from) || !orgIds.has(tx.to)
  );
  
  if (orphanedTransactions.length > 0) {
    warnings.push(`${orphanedTransactions.length} transactions reference unknown organizations`);
  }
  
  // Check for old transactions
  const now = new Date();
  const oldTransactions = transactions.filter(tx => 
    (now.getTime() - tx.timestamp.getTime()) > 30 * 24 * 60 * 60 * 1000 // 30 days
  );
  
  if (oldTransactions.length > 0) {
    warnings.push(`${oldTransactions.length} transactions are older than 30 days`);
  }
  
  // Check for low trust organizations with high exposure
  const highExposureOrgs = organizations.filter(org => 
    org.trustScore < 0.5 && org.preferences.maxExposure > 10000
  );
  
  if (highExposureOrgs.length > 0) {
    warnings.push(`${highExposureOrgs.length} low-trust organizations have high exposure limits`);
  }
  
  return warnings;
}

function filterSettleableTransactions(
  transactions: Transaction[],
  organizations: Organization[],
  preferences: OrchestrationRequest['preferences'] = {}
): Transaction[] {
  const now = new Date();
  const maxDelay = preferences.maxDelay || 24; // Default 24 hours
  
  return transactions.filter(tx => {
    // Only settle pending transactions
    if (tx.settlementStatus !== 'pending') return false;
    
    // Check if transaction is old enough or force settlement is enabled
    const ageHours = (now.getTime() - tx.timestamp.getTime()) / (1000 * 60 * 60);
    if (!preferences.forceSettlement && ageHours < 1) return false; // Wait at least 1 hour
    
    // Don't settle very old transactions without review
    if (ageHours > maxDelay && !preferences.forceSettlement) return false;
    
    // Check organization preferences
    const fromOrg = organizations.find(org => org.id === tx.from);
    const toOrg = organizations.find(org => org.id === tx.to);
    
    if (!fromOrg || !toOrg) return false;
    
    // Check minimum settlement amounts
    if (!preferences.forceSettlement) {
      if (tx.amount < fromOrg.preferences.minSettlementAmount ||
          tx.amount < toOrg.preferences.minSettlementAmount) {
        return false;
      }
    }
    
    return true;
  });
}

function calculateNetPositions(
  transactions: Transaction[],
  organizations: Organization[],
  _exchangeRates: ExchangeRate[]
): NetPosition[] {
  const positions = new Map<string, NetPosition>();
  
  // Initialize positions for all organizations
  for (const org of organizations) {
    positions.set(org.id, {
      organizationId: org.id,
      netAmounts: {},
      grossExposure: 0,
      creditLimitUsage: 0,
      priority: 'medium'
    });
  }
  
  // Process each transaction
  for (const tx of transactions) {
    const fromPos = positions.get(tx.from);
    const toPos = positions.get(tx.to);
    
    if (!fromPos || !toPos) continue;
    
    // Update net amounts
    fromPos.netAmounts[tx.currency] = (fromPos.netAmounts[tx.currency] || 0) - tx.amount;
    toPos.netAmounts[tx.currency] = (toPos.netAmounts[tx.currency] || 0) + tx.amount;
    
    // Update gross exposure
    fromPos.grossExposure += tx.amount;
    toPos.grossExposure += tx.amount;
  }
  
  // Calculate priorities and credit usage
  for (const [orgId, position] of positions) {
    const org = organizations.find(o => o.id === orgId);
    if (!org) continue;
    
    // Calculate total exposure in base currency
    const totalExposure = Object.values(position.netAmounts).reduce((sum, amount) => 
      sum + Math.abs(amount), 0
    );
    
    // Set priority based on exposure and trust
    if (totalExposure > org.preferences.maxExposure * 0.8) {
      position.priority = 'urgent';
    } else if (totalExposure > org.preferences.maxExposure * 0.5) {
      position.priority = 'high';
    } else if (org.trustScore < 0.3) {
      position.priority = 'high';
    }
    
    // Calculate credit limit usage
    position.creditLimitUsage = totalExposure / org.preferences.maxExposure;
  }
  
  return Array.from(positions.values());
}

function generateSettlementEvents(
  netPositions: NetPosition[],
  organizations: Organization[],
  batchId: string,
  algorithm: 'simple' | 'multilateral' | 'optimized'
): SettlementEvent[] {
  switch (algorithm) {
    case 'simple':
      return generateSimpleSettlement(netPositions, organizations, batchId);
    case 'multilateral':
      return generateMultilateralSettlement(netPositions, organizations, batchId);
    case 'optimized':
      return generateOptimizedSettlement(netPositions, organizations, batchId);
    default:
      return generateMultilateralSettlement(netPositions, organizations, batchId);
  }
}

function generateSimpleSettlement(
  netPositions: NetPosition[],
  organizations: Organization[],
  batchId: string
): SettlementEvent[] {
  const events: SettlementEvent[] = [];
  
  // Simple bilateral settlement - each organization settles with each other
  for (let i = 0; i < netPositions.length; i++) {
    for (let j = i + 1; j < netPositions.length; j++) {
      const pos1 = netPositions[i];
      const pos2 = netPositions[j];
      
      // Find common currencies
      const currencies = new Set([
        ...Object.keys(pos1.netAmounts),
        ...Object.keys(pos2.netAmounts)
      ]);
      
      for (const currency of currencies) {
        const amount1 = pos1.netAmounts[currency] || 0;
        const amount2 = pos2.netAmounts[currency] || 0;
        
        // Determine settlement direction and amount
        let settlementAmount = 0;
        let fromOrg = '';
        let toOrg = '';
        
        if (amount1 > 0 && amount2 < 0) {
          settlementAmount = Math.min(amount1, Math.abs(amount2));
          fromOrg = pos2.organizationId;
          toOrg = pos1.organizationId;
        } else if (amount1 < 0 && amount2 > 0) {
          settlementAmount = Math.min(Math.abs(amount1), amount2);
          fromOrg = pos1.organizationId;
          toOrg = pos2.organizationId;
        }
        
        if (settlementAmount > 0) {
          events.push({
            id: nanoid(),
            batchId,
            from: fromOrg,
            to: toOrg,
            amount: settlementAmount,
            currency,
            transactions: [], // Would be populated with actual transaction IDs
            timestamp: new Date(),
            status: 'pending'
          });
        }
      }
    }
  }
  
  return events;
}

function generateMultilateralSettlement(
  netPositions: NetPosition[],
  organizations: Organization[],
  batchId: string
): SettlementEvent[] {
  const events: SettlementEvent[] = [];
  
  // Group by currency and find optimal netting
  const currencies = new Set(
    netPositions.flatMap(pos => Object.keys(pos.netAmounts))
  );
  
  for (const currency of currencies) {
    const creditors: Array<{ orgId: string; amount: number }> = [];
    const debtors: Array<{ orgId: string; amount: number }> = [];
    
    // Separate creditors and debtors
    for (const pos of netPositions) {
      const amount = pos.netAmounts[currency] || 0;
      if (amount > 0) {
        creditors.push({ orgId: pos.organizationId, amount });
      } else if (amount < 0) {
        debtors.push({ orgId: pos.organizationId, amount: Math.abs(amount) });
      }
    }
    
    // Sort by amount (largest first)
    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);
    
    // Match creditors with debtors
    let creditorIndex = 0;
    let debtorIndex = 0;
    
    while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
      const creditor = creditors[creditorIndex];
      const debtor = debtors[debtorIndex];
      
      const settlementAmount = Math.min(creditor.amount, debtor.amount);
      
      events.push({
        id: nanoid(),
        batchId,
        from: debtor.orgId,
        to: creditor.orgId,
        amount: settlementAmount,
        currency,
        transactions: [],
        timestamp: new Date(),
        status: 'pending'
      });
      
      // Update remaining amounts
      creditor.amount -= settlementAmount;
      debtor.amount -= settlementAmount;
      
      // Move to next if current is settled
      if (creditor.amount === 0) creditorIndex++;
      if (debtor.amount === 0) debtorIndex++;
    }
  }
  
  return events;
}

function generateOptimizedSettlement(
  netPositions: NetPosition[],
  organizations: Organization[],
  batchId: string
): SettlementEvent[] {
  // Start with multilateral settlement
  let events = generateMultilateralSettlement(netPositions, organizations, batchId);
  
  // Apply optimizations
  events = optimizeByTrust(events, organizations);
  events = optimizeByPriority(events, netPositions);
  events = consolidateSmallAmounts(events);
  
  return events;
}

function optimizeByTrust(events: SettlementEvent[], organizations: Organization[]): SettlementEvent[] {
  const orgTrust = new Map(organizations.map(org => [org.id, org.trustScore]));
  
  // Prioritize settlements involving high-trust organizations
  return events.sort((a, b) => {
    const trustA = Math.min(orgTrust.get(a.from) || 0, orgTrust.get(a.to) || 0);
    const trustB = Math.min(orgTrust.get(b.from) || 0, orgTrust.get(b.to) || 0);
    return trustB - trustA; // Higher trust first
  });
}

function optimizeByPriority(events: SettlementEvent[], netPositions: NetPosition[]): SettlementEvent[] {
  const priorityMap = new Map(netPositions.map(pos => [pos.organizationId, pos.priority]));
  const priorityScore = { urgent: 4, high: 3, medium: 2, low: 1 };
  
  return events.sort((a, b) => {
    const scoreA = Math.max(
      priorityScore[priorityMap.get(a.from) || 'medium'],
      priorityScore[priorityMap.get(a.to) || 'medium']
    );
    const scoreB = Math.max(
      priorityScore[priorityMap.get(b.from) || 'medium'],
      priorityScore[priorityMap.get(b.to) || 'medium']
    );
    return scoreB - scoreA; // Higher priority first
  });
}

function consolidateSmallAmounts(events: SettlementEvent[]): SettlementEvent[] {
  const minAmount = 10; // Consolidate amounts below this threshold
  const consolidated: SettlementEvent[] = [];
  const small: SettlementEvent[] = [];
  
  for (const event of events) {
    if (event.amount >= minAmount) {
      consolidated.push(event);
    } else {
      small.push(event);
    }
  }
  
  // Group small amounts by currency and organization pairs
  const groups = new Map<string, SettlementEvent[]>();
  
  for (const event of small) {
    const key = `${event.from}-${event.to}-${event.currency}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(event);
  }
  
  // Consolidate groups that meet minimum threshold
  for (const [, groupEvents] of groups) {
    const totalAmount = groupEvents.reduce((sum, e) => sum + e.amount, 0);
    
    if (totalAmount >= minAmount) {
      const first = groupEvents[0];
      consolidated.push({
        ...first,
        id: nanoid(),
        amount: totalAmount,
        transactions: groupEvents.flatMap(e => e.transactions)
      });
    } else {
      // Keep individual small amounts if consolidation doesn't help
      consolidated.push(...groupEvents);
    }
  }
  
  return consolidated;
}

function detectDisputes(
  transactions: Transaction[],
  settlementEvents: SettlementEvent[],
  organizations: Organization[]
): Dispute[] {
  const disputes: Dispute[] = [];
  
  // Check for amount mismatches
  const transactionSums = new Map<string, Map<string, number>>();
  
  for (const tx of transactions) {
    const key = `${tx.from}-${tx.to}-${tx.currency}`;
    if (!transactionSums.has(key)) {
      transactionSums.set(key, new Map());
    }
    const currencyMap = transactionSums.get(key)!;
    currencyMap.set(tx.currency, (currencyMap.get(tx.currency) || 0) + tx.amount);
  }
  
  for (const event of settlementEvents) {
    const _key = `${event.from}-${event.to}-${event.currency}`;
    const expectedAmount = transactionSums.get(_key)?.get(event.currency) || 0;
    
    if (Math.abs(expectedAmount - event.amount) > 0.01) {
      disputes.push({
        id: nanoid(),
        settlementEventId: event.id,
        disputingOrg: event.to, // Receiving organization might dispute
        type: 'amount_mismatch',
        description: `Settlement amount ${event.amount} doesn't match expected ${expectedAmount}`,
        status: 'open'
      });
    }
  }
  
  // Check for unauthorized settlements (low trust organizations)
  for (const event of settlementEvents) {
    const fromOrg = organizations.find(org => org.id === event.from);
    
    if (fromOrg && fromOrg.trustScore < 0.3) {
      disputes.push({
        id: nanoid(),
        settlementEventId: event.id,
        disputingOrg: event.to,
        type: 'unauthorized',
        description: `Settlement from low-trust organization (trust: ${fromOrg.trustScore.toFixed(2)})`,
        status: 'open'
      });
    }
    
    // Check for large settlements that might be suspicious
    if (event.amount > 50000) {
      disputes.push({
        id: nanoid(),
        settlementEventId: event.id,
        disputingOrg: event.to,
        type: 'amount_mismatch',
        description: `Large settlement amount ${event.amount} may require additional verification`,
        status: 'open'
      });
    }
  }
  
  return disputes;
}

function calculateOptimization(
  transactions: Transaction[],
  settlementEvents: SettlementEvent[]
): SettlementOptimization {
  const totalTransactions = transactions.length;
  const settlementEventsCount = settlementEvents.length;
  
  const reductionRatio = totalTransactions > 0 ? 
    (totalTransactions - settlementEventsCount) / totalTransactions : 0;
  
  const efficiencyScore = Math.min(1, Math.max(0, reductionRatio * 2)); // 0-1 scale
  
  // Estimate cost savings (simplified calculation)
  const avgTransactionCost = 5; // $5 per transaction
  const costSavings = (totalTransactions - settlementEventsCount) * avgTransactionCost;
  
  return {
    totalTransactions,
    settlementEvents: settlementEventsCount,
    reductionRatio,
    efficiencyScore,
    costSavings
  };
}

function generateSettlementSummary(
  settlementEvents: SettlementEvent[],
  _organizations: Organization[]
): OrchestrationResponse['summary'] {
  const totalAmounts: Record<string, number> = {};
  let estimatedCost = 0;
  
  for (const event of settlementEvents) {
    totalAmounts[event.currency] = (totalAmounts[event.currency] || 0) + event.amount;
    estimatedCost += 2; // $2 per settlement event
  }
  
  const organizationsCount = new Set([
    ...settlementEvents.map(e => e.from),
    ...settlementEvents.map(e => e.to)
  ]).size;
  
  // Estimate settlement time based on complexity
  const baseTime = 30; // 30 minutes base
  const complexityTime = settlementEvents.length * 2; // 2 minutes per event
  const totalMinutes = baseTime + complexityTime;
  
  const estimatedTime = totalMinutes < 60 ? 
    `${totalMinutes} minutes` : 
    `${Math.round(totalMinutes / 60 * 10) / 10} hours`;
  
  return {
    totalAmounts,
    organizationsCount,
    estimatedTime,
    estimatedCost
  };
}