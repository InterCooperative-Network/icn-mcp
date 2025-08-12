# ICN Governance Tools

This document provides runnable examples for the ICN governance tools that understand democratic processes at multiple scales and can guide implementation of voting, delegation, and decision systems.

## Overview

The ICN governance tools provide comprehensive support for:
- **Governance Flow Building**: Complete workflows from proposal to execution
- **Voting Mechanism Advisory**: Optimal voting system recommendations 
- **Sortition Management**: Fair random selection with constraints
- **Policy Object Building**: Structured policies with conflict detection

## Governance Flow Builder (`icnBuildGovernanceFlow`)

Builds complete governance flows from proposal to execution with support for constitutional, budget, policy, operational, and emergency decisions.

### Example: Global Constitutional Change

```typescript
import { icnBuildGovernanceFlow } from './src/tools/icn_build_governance_flow.js';

const result = await icnBuildGovernanceFlow({
  decisionType: 'constitutional',
  scope: 'global',
  context: 'Update voting threshold requirements for federation-level decisions'
});

console.log('Governance Flow Result:', JSON.stringify(result, null, 2));
```

**Sample Output:**
```json
{
  "id": "governance-flow-constitutional-global-1704067200000",
  "context": {
    "decisionType": "constitutional",
    "scope": "global", 
    "description": "Update voting threshold requirements for federation-level decisions"
  },
  "process": {
    "proposalRequirements": {
      "burnAmount": 1000,
      "format": {
        "requiredSections": ["summary", "rationale", "implementation", "impact_analysis", "legal_analysis", "precedent_review", "migration_plan"],
        "maxLength": 10000,
        "metadata": ["author", "category", "urgency", "affected_parties", "expert_review", "public_comment_summary"]
      },
      "cosponsors": {
        "minimum": 10,
        "diversityRequirements": ["geographic_distribution", "organizational_diversity", "stakeholder_representation"]
      }
    },
    "discussionPeriod": {
      "minimumDays": 30,
      "phases": [
        {
          "name": "initial_review",
          "duration": 9,
          "activities": ["technical_review", "impact_assessment", "clarification_requests"],
          "requirements": ["expert_input", "stakeholder_identification"]
        },
        {
          "name": "public_discussion", 
          "duration": 15,
          "activities": ["public_comment", "community_forums", "working_groups"],
          "requirements": ["broad_participation", "diverse_viewpoints"]
        },
        {
          "name": "revision_period",
          "duration": 6,
          "activities": ["proposal_amendments", "consensus_building", "final_review"],
          "requirements": ["incorporated_feedback", "final_documentation"]
        }
      ]
    },
    "votingMechanism": {
      "type": "hybrid",
      "votingPeriod": 14,
      "quorum": {
        "minimumParticipation": 0.6,
        "calculationMethod": "eligible_voters",
        "specialRequirements": ["stakeholder_representation"]
      },
      "delegation": {
        "maxChainLength": 3,
        "revocationRules": ["24_hour_notice", "immediate_emergency"],
        "expertiseWeighting": false
      },
      "sortition": {
        "selectionCriteria": ["participation_history", "stake_in_outcome", "expertise_relevance"],
        "sampleSize": 100,
        "stratification": ["geographic", "organizational", "expertise"]
      }
    },
    "decisionThreshold": {
      "type": "supermajority",
      "percentage": 75,
      "conditions": ["supermajority_required", "no_single_organization_veto", "federation_approval_required"],
      "fallbacks": [
        {
          "condition": "quorum_not_met_first_attempt",
          "mechanism": "extended_voting_period",
          "threshold": "qualified_majority_60_percent"
        },
        {
          "condition": "multiple_failed_attempts", 
          "mechanism": "consensus_building_process",
          "threshold": "agreement_seeking"
        }
      ]
    },
    "executionRules": {
      "type": "phased",
      "executionDelay": 30,
      "requiredApprovals": ["legal_review", "implementation_plan_approval", "federation_coordination"],
      "appeals": {
        "appealPeriod": 14,
        "appealThreshold": 0.1,
        "process": ["formal_objection", "review_committee", "appeal_decision"]
      }
    }
  },
  "timeline": {
    "totalDuration": 194,
    "milestones": [
      {
        "name": "proposal_submission",
        "day": 0,
        "description": "Proposal submitted with 1000 burn and 10 co-sponsors"
      },
      {
        "name": "discussion_complete",
        "day": 30,
        "description": "Discussion period ends, proposal finalized"
      },
      {
        "name": "voting_complete", 
        "day": 44,
        "description": "Voting period ends, results announced"
      },
      {
        "name": "execution_begins",
        "day": 74,
        "description": "Execution phase begins"
      }
    ]
  }
}
```

## Voting Mechanism Advisor (`icnAdviseVoting`)

Analyzes governance scenarios and recommends optimal voting mechanisms with the new machine-readable schema.

### Example: Budget Allocation Decision

```typescript
import { icnAdviseVoting } from './src/tools/icn_advise_voting.js';

const scenario = {
  description: 'Annual federation budget allocation across cooperatives',
  participantCount: 500,
  context: {
    decisionType: 'allocation',
    scope: 'federation',
    urgency: 'medium'
  },
  participants: {
    expertiseLevels: 'varied',
    stakeDistribution: 'proportional', 
    trustNetwork: 'moderate_trust'
  },
  constraints: {
    legitimacyRequirements: ['broad_participation', 'transparency'],
    fairnessCriteria: ['preference_intensity', 'equal_voice']
  }
};

const goals = {
  objectives: ['fairness', 'efficiency', 'participation'],
  weights: { fairness: 0.9, efficiency: 0.6, participation: 0.8 },
  successCriteria: ['optimal_allocation', 'stakeholder_satisfaction']
};

const advice = await icnAdviseVoting(scenario, goals);
console.log('Voting Advice:', JSON.stringify(advice, null, 2));
```

**Sample Output (VotingAdvice Schema):**
```json
{
  "primary": {
    "mechanism": "quadratic",
    "params": {
      "creditAllocation": "equal",
      "costFunction": "quadratic", 
      "maxVotesPerOption": 22,
      "revealThreshold": 0.1
    }
  },
  "alternatives": [
    {
      "mechanism": "liquid",
      "params": {
        "maxDelegationChain": 3,
        "revocationPeriod": 24,
        "expertiseWeighting": false,
        "transparentDelegation": true
      },
      "whenPreferable": "Better when: Leverages expertise through delegation, Efficient decision-making through delegation"
    }
  ],
  "tradeoffs": [
    "Participation vs Expertise: Maximize direct participation",
    "Speed vs Deliberation: Thorough deliberation", 
    "Simplicity vs Sophistication: Sophisticated mechanisms"
  ],
  "risks": [
    "Scaling challenges with medium groups",
    "Knowledge asymmetries between participants"
  ],
  "manipulationVectors": [
    "Vote Buying",
    "Identity Manipulation"
  ],
  "requiredResources": {
    "engineeringDays": 18,
    "opsHours": 240,
    "infraNotes": [
      "Secure voting platform deployment",
      "Identity verification system",
      "Vote privacy mechanisms", 
      "Results auditing system",
      "Voting credit allocation",
      "Quadratic cost calculation"
    ]
  },
  "timelineEstimateDays": 30,
  "rationale": [
    "Selected Quadratic Voting based on scenario requirements",
    "Suitability score: 0.78"
  ],
  "confidence": 0.78
}
```

## Sortition Pool Manager (`icnManageSortition`)

Manages fair random selection with sophisticated constraints, weighting, and fairness analysis.

### Example: Audit Committee Selection

```typescript
import { icnManageSortition } from './src/tools/icn_manage_sortition.js';

const memberPool = [
  {
    id: 'member1',
    info: { name: 'Alice Chen', joinDate: new Date('2023-01-15') },
    participationHistory: {
      previousSelections: 1,
      participationRate: 0.85,
      performanceScores: [0.9, 0.88, 0.92]
    },
    qualifications: { 
      skills: ['accounting', 'auditing', 'governance'],
      expertiseLevels: { accounting: 0.9, auditing: 0.85, governance: 0.7 }
    },
    availability: { available: true, currentCommitments: 2 },
    reputation: { 
      trustScore: 0.92,
      categoryScores: { financial: 0.88, governance: 0.75 },
      endorsements: [
        { fromMemberId: 'coop_lead_1', weight: 1.5 },
        { fromMemberId: 'finance_expert_2', weight: 2.0 }
      ]
    },
    demographics: { region: 'north', organizationType: 'cooperative' }
  },
  // ... more members
];

const selection = await icnManageSortition({
  roleRequirements: {
    title: 'Audit Committee Member',
    description: 'Review financial transparency and compliance',
    requiredSkills: ['accounting', 'auditing'],
    categories: ['financial'],
    timeCommitment: { duration: 180, hoursPerWeek: 4 }
  },
  eligibleMembers: memberPool,
  constraints: {
    positions: 5,
    diversityRequirements: [
      { 
        attribute: 'region',
        minRepresentation: 0.2
      }
    ]
  },
  parameters: { 
    cryptographicRandom: true, 
    allowReplacements: true 
  },
  weights: {
    expertise: 0.4,
    category: 0.3, 
    endorsements: 0.15,
    trust: 0.1,
    participation: 0.05
  },
  fairness: {
    maxGini: 0.5,
    requireDiversity: true,
    diversityAttributes: ['region', 'organizationType'],
    maxRepeatRate: 0.3
  },
  rngSeed: 'audit-2024-q1-selection'
});

console.log('Selection Result:', JSON.stringify(selection, null, 2));
```

**Sample Output with New Fields:**
```json
{
  "selectionId": "sel_abc123def456",
  "selectedMembers": [
    {
      "member": { /* member object */ },
      "selectionScore": 0.847,
      "selectionReason": "Selected for: high composite qualifications, excellent trust score, limited previous selections"
    }
  ],
  "metrics": {
    "gini": 0.421,
    "diversityCoverage": {
      "region": 0.8,
      "organizationType": 0.6
    },
    "repeatRates": {
      "member1": 0.25,
      "member3": 0.33
    }
  },
  "fairness": {
    "thresholdsMet": true,
    "diversityAchieved": true, 
    "score": 0.85,
    "issues": []
  },
  "rng": {
    "seedUsed": "audit-2024-q1-selection",
    "draws": 12,
    "method": "cryptographic"
  },
  "explanations": [
    "Applied weighted selection algorithm with weights: expertise=0.40, category=0.30, endorsements=0.15, trust=0.10, participation=0.05",
    "Used softmax probability distribution to ensure balanced selection from weighted pool", 
    "Applied Gini coefficient constraint of 0.5 to limit selection inequality",
    "Required diversity coverage across attributes: region, organizationType",
    "Selected 5 members through cryptographically-seeded deterministic random process"
  ]
}
```

## Policy Object Builder (`icnBuildPolicy`)

Creates structured policy objects with validation, conflict detection, and temporal scope support.

### Example: Time-Bounded Emergency Policy

```typescript
import { icnBuildPolicy } from './src/tools/icn_build_policy.js';

const policy = await icnBuildPolicy({
  description: 'Emergency response coordination during natural disasters',
  category: 'operational',
  scope: {
    geographic: 'regional',
    organizational: ['emergency_response_teams', 'local_cooperatives'],
    temporal: {
      startDate: '2024-06-01T00:00:00Z',
      durationDays: 90
    }
  },
  stakeholders: {
    primary: ['emergency_coordinators', 'local_representatives'],
    secondary: ['affected_communities'],
    consultationRequired: ['emergency_services', 'regional_authorities']
  },
  constraints: {
    legal: ['emergency_powers_act_compliance'],
    technical: ['communication_system_integration'],
    resource: ['emergency_fund_allocation']
  }
});

console.log('Policy Object:', JSON.stringify(policy, null, 2));
```

**Sample Output with Temporal Conflict Detection:**
```json
{
  "metadata": {
    "id": "policy-operational-abc123",
    "title": "Regional Operational Policy: Emergency response coordination during natural disasters",
    "description": "Emergency response coordination during natural disasters",
    "category": "operational",
    "created": "2024-01-01T12:00:00.000Z",
    "currentVersion": "1.0.0",
    "status": "draft"
  },
  "conflicts": {
    "conflicts": [
      {
        "policyId": "temp-policy-1",
        "type": "overlap",
        "description": "Temporal overlap detected with operational policy",
        "severity": "moderate", 
        "resolution": "Adjust effective dates or merge policies",
        "temporalOverlap": ["2024-06-11T00:00:00.000Z", "2024-08-30T00:00:00.000Z"]
      }
    ],
    "dependencies": [],
    "impacts": []
  },
  "scope": {
    "applicability": {
      "subjects": ["emergency_coordinators", "local_representatives"],
      "contexts": ["general_operations"],
      "conditions": ["technical_feasibility_confirmed", "resource_availability_verified"],
      "jurisdictions": ["regional", "emergency_response_teams", "local_cooperatives"]
    }
  }
}
```

## Integration Examples

### Complete Governance Workflow

```typescript
// 1. Build governance flow for the decision
const governanceFlow = await icnBuildGovernanceFlow({
  decisionType: 'policy',
  scope: 'federation',
  context: 'New resource sharing protocol'
});

// 2. Get voting mechanism advice
const votingAdvice = await icnAdviseVoting(scenario, goals);

// 3. If sortition is recommended, select committee
if (votingAdvice.primary.mechanism === 'sortition') {
  const committee = await icnManageSortition({
    roleRequirements: {
      title: 'Resource Protocol Committee',
      requiredSkills: ['resource_management', 'protocol_design']
    },
    eligibleMembers: memberPool,
    constraints: { positions: 7 }
  });
}

// 4. Create the actual policy object
const policy = await icnBuildPolicy({
  description: 'Resource sharing protocol implementation',
  category: 'operational',
  scope: { geographic: 'federation', organizational: ['all_cooperatives'] }
});
```

## Testing and Validation

All governance tools include comprehensive test coverage and maintain ICN invariants:

```bash
# Run governance tools tests
npm run -w mcp-node test -- test/governance-tools.test.ts

# Current test count: 21 tests covering:
# - Sortition fairness and weighting
# - Voting mechanism selection and delegation analysis  
# - Policy temporal scope and conflict detection
# - Governance flow fallback mechanisms
# - ICN democratic governance invariants
# - Non-transferable CC enforcement
```

## Error Handling and Edge Cases

The tools handle various edge cases and provide detailed error information:

- **Invalid temporal scopes**: Automatic validation and correction
- **Delegation cycles**: Detection and breaking with warnings
- **Fairness threshold violations**: Iterative repair with transparency
- **Low participation scenarios**: Fallback mechanisms and adaptation guidance
- **Conflict detection**: Comprehensive analysis including temporal overlaps

For complete API documentation and advanced usage patterns, see the [API Reference](./api-reference.md).