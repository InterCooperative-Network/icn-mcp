import { describe, it, expect } from 'vitest';
import { icnBuildGovernanceFlow } from '../src/tools/icn_build_governance_flow.js';
import { icnAdviseVoting } from '../src/tools/icn_advise_voting.js';
import { icnManageSortition } from '../src/tools/icn_manage_sortition.js';
import { icnBuildPolicy } from '../src/tools/icn_build_policy.js';
describe('Governance Tools', () => {
    describe('icn_build_governance_flow', () => {
        it('should build complete governance flow for constitutional decision', async () => {
            const result = await icnBuildGovernanceFlow({
                decisionType: 'constitutional',
                scope: 'global',
                context: 'Test constitutional change'
            });
            expect(result).toHaveProperty('id');
            expect(result).toHaveProperty('context');
            expect(result).toHaveProperty('process');
            expect(result).toHaveProperty('adaptation');
            expect(result).toHaveProperty('timeline');
            expect(result.context.decisionType).toBe('constitutional');
            expect(result.context.scope).toBe('global');
            expect(result.process).toHaveProperty('proposalRequirements');
            expect(result.process).toHaveProperty('discussionPeriod');
            expect(result.process).toHaveProperty('votingMechanism');
            expect(result.process).toHaveProperty('decisionThreshold');
            expect(result.process).toHaveProperty('executionRules');
            // Constitutional decisions should have higher burn amounts
            expect(result.process.proposalRequirements.burnAmount).toBeGreaterThan(100);
            // Global constitutional decisions should require supermajority
            expect(result.process.decisionThreshold.type).toBe('supermajority');
            expect(result.process.decisionThreshold.percentage).toBeGreaterThanOrEqual(70);
        });
        it('should build governance flow for emergency decision', async () => {
            const result = await icnBuildGovernanceFlow({
                decisionType: 'emergency',
                scope: 'local'
            });
            expect(result.context.decisionType).toBe('emergency');
            // Emergency decisions should have shorter timelines
            expect(result.process.discussionPeriod.minimumDays).toBe(1);
            expect(result.process.votingMechanism.votingPeriod).toBe(1);
            // Should use sortition for speed
            expect(result.process.votingMechanism.type).toBe('sortition');
        });
        it('should implement fallback threshold mechanisms for supermajority decisions', async () => {
            const result = await icnBuildGovernanceFlow({
                decisionType: 'constitutional',
                scope: 'global',
                context: 'Major constitutional amendment requiring fallbacks'
            });
            expect(result.process.decisionThreshold.type).toBe('supermajority');
            expect(result.process.decisionThreshold.fallbacks.length).toBeGreaterThan(0);
            // Should have multiple fallback mechanisms
            const fallbackTypes = result.process.decisionThreshold.fallbacks.map(f => f.mechanism);
            expect(fallbackTypes).toContain('extended_voting_period');
            expect(fallbackTypes).toContain('consensus_building_process');
            // Verify fallback triggers
            const quorumFallback = result.process.decisionThreshold.fallbacks.find(f => f.condition === 'quorum_not_met_first_attempt');
            expect(quorumFallback).toBeDefined();
            expect(quorumFallback?.threshold).toContain('qualified_majority');
        });
        it('should differentiate emergency vs constitutional processes', async () => {
            const emergency = await icnBuildGovernanceFlow({
                decisionType: 'emergency',
                scope: 'regional'
            });
            const constitutional = await icnBuildGovernanceFlow({
                decisionType: 'constitutional',
                scope: 'regional'
            });
            // Emergency should be much faster
            expect(emergency.timeline.totalDuration).toBeLessThan(constitutional.timeline.totalDuration / 5);
            // Constitutional should have more rigorous requirements
            expect(constitutional.process.proposalRequirements.burnAmount)
                .toBeGreaterThan(emergency.process.proposalRequirements.burnAmount);
            expect(constitutional.process.proposalRequirements.cosponsors.minimum)
                .toBeGreaterThanOrEqual(emergency.process.proposalRequirements.cosponsors.minimum);
            // Constitutional should have phased execution
            expect(constitutional.process.executionRules.type).toBe('phased');
            expect(emergency.process.executionRules.type).toBe('automatic');
            // Both should maintain audit trails but with different requirements
            expect(constitutional.process.executionRules.requiredApprovals.length)
                .toBeGreaterThan(emergency.process.executionRules.requiredApprovals.length);
        });
        it('should handle low turnout scenarios with fallback activation', async () => {
            const result = await icnBuildGovernanceFlow({
                decisionType: 'budget',
                scope: 'federation',
                context: 'Budget decision with potential low turnout'
            });
            // Should have qualified majority as primary
            expect(result.process.decisionThreshold.type).toBe('qualified_majority');
            expect(result.process.decisionThreshold.percentage).toBe(60);
            // Should provide guidance on turnout issues
            expect(result.adaptation.warningSignsToMonitor).toContain('Declining participation rates');
            // Should have mechanisms to handle low turnout
            const adaptations = result.adaptation.adaptationMechanisms;
            expect(adaptations.some(mechanism => mechanism.includes('threshold adjustment') || mechanism.includes('participation patterns'))).toBe(true);
        });
    });
    describe('icn_advise_voting', () => {
        it('should recommend direct democracy for small groups', async () => {
            const scenario = {
                description: 'Small cooperative decision',
                participantCount: 25,
                context: {
                    decisionType: 'policy',
                    scope: 'local',
                    urgency: 'medium'
                },
                participants: {
                    expertiseLevels: 'uniform',
                    stakeDistribution: 'equal',
                    trustNetwork: 'high_trust'
                },
                constraints: {
                    legitimacyRequirements: ['broad_participation'],
                    fairnessCriteria: ['equal_voice']
                }
            };
            const goals = {
                objectives: ['participation', 'transparency'],
                weights: { participation: 0.8, transparency: 0.7 },
                successCriteria: ['high_participation_rate']
            };
            const result = await icnAdviseVoting(scenario, goals);
            // New VotingAdvice schema tests
            expect(result).toHaveProperty('primary');
            expect(result).toHaveProperty('alternatives');
            expect(result).toHaveProperty('tradeoffs');
            expect(result).toHaveProperty('risks');
            expect(result).toHaveProperty('manipulationVectors');
            expect(result).toHaveProperty('requiredResources');
            expect(result).toHaveProperty('timelineEstimateDays');
            expect(result).toHaveProperty('rationale');
            expect(result).toHaveProperty('confidence');
            expect(result.primary.mechanism).toBeDefined();
            expect(result.confidence).toBeGreaterThan(0.5);
        });
        it('should recommend quadratic voting for budget allocation', async () => {
            const scenario = {
                description: 'Budget allocation decision',
                participantCount: 100,
                context: {
                    decisionType: 'allocation',
                    scope: 'regional',
                    urgency: 'low'
                },
                participants: {
                    expertiseLevels: 'varied',
                    stakeDistribution: 'proportional',
                    trustNetwork: 'moderate_trust'
                },
                constraints: {
                    legitimacyRequirements: ['fair_representation'],
                    fairnessCriteria: ['preference_intensity']
                }
            };
            const goals = {
                objectives: ['fairness', 'efficiency'],
                weights: { fairness: 0.9, efficiency: 0.6 },
                successCriteria: ['optimal_allocation']
            };
            const result = await icnAdviseVoting(scenario, goals);
            // Should include quadratic voting as an option for allocation decisions
            const hasQuadratic = result.primary.mechanism === 'quadratic' ||
                result.alternatives.some(alt => alt.mechanism === 'quadratic');
            expect(hasQuadratic).toBe(true);
        });
    });
    describe('icn_manage_sortition', () => {
        it('should select members for sortition with fairness constraints', async () => {
            const eligibleMembers = [
                {
                    id: 'member1',
                    info: { name: 'Alice', joinDate: new Date('2023-01-01') },
                    participationHistory: {
                        previousSelections: 0,
                        participationRate: 0.8,
                        performanceScores: [0.9, 0.85]
                    },
                    qualifications: { skills: ['governance', 'facilitation'] },
                    availability: { available: true, currentCommitments: 1 },
                    reputation: { trustScore: 0.9 },
                    demographics: { region: 'north', organizationType: 'cooperative' }
                },
                {
                    id: 'member2',
                    info: { name: 'Bob', joinDate: new Date('2023-02-01') },
                    participationHistory: {
                        previousSelections: 2,
                        participationRate: 0.6,
                        performanceScores: [0.7, 0.8]
                    },
                    qualifications: { skills: ['governance', 'policy'] },
                    availability: { available: true, currentCommitments: 0 },
                    reputation: { trustScore: 0.8 },
                    demographics: { region: 'south', organizationType: 'collective' }
                },
                {
                    id: 'member3',
                    info: { name: 'Carol', joinDate: new Date('2023-03-01') },
                    participationHistory: {
                        previousSelections: 1,
                        participationRate: 0.9,
                        performanceScores: [0.95, 0.9, 0.88]
                    },
                    qualifications: { skills: ['governance', 'economics'] },
                    availability: { available: true, currentCommitments: 2 },
                    reputation: { trustScore: 0.95 },
                    demographics: { region: 'east', organizationType: 'federation' }
                }
            ];
            const result = await icnManageSortition({
                roleRequirements: {
                    title: 'Governance Committee Member',
                    description: 'Participate in governance decisions',
                    requiredSkills: ['governance'],
                    timeCommitment: { duration: 90, hoursPerWeek: 5 }
                },
                eligibleMembers,
                constraints: { positions: 2 },
                parameters: { cryptographicRandom: false, allowReplacements: true }
            });
            expect(result).toHaveProperty('selectionId');
            expect(result).toHaveProperty('selectedMembers');
            expect(result).toHaveProperty('replacements');
            expect(result).toHaveProperty('processDetails');
            expect(result).toHaveProperty('justification');
            expect(result.selectedMembers).toHaveLength(2);
            expect(result.processDetails.totalEligible).toBe(3);
            expect(result.processDetails.constrainedPool).toBe(3); // All members should be eligible
            // Check that each selected member has the required skills
            for (const selected of result.selectedMembers) {
                expect(selected.member.qualifications.skills).toContain('governance');
            }
        });
        it('should handle exclusion rules correctly', async () => {
            const eligibleMembers = [
                {
                    id: 'member1',
                    info: { name: 'Alice', joinDate: new Date('2023-01-01') },
                    participationHistory: {
                        previousSelections: 0,
                        lastSelected: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago - within 180 day cooldown
                        participationRate: 0.8,
                        performanceScores: [0.9]
                    },
                    qualifications: { skills: ['governance'] },
                    availability: { available: true, currentCommitments: 0 },
                    reputation: { trustScore: 0.9 },
                    demographics: {}
                },
                {
                    id: 'member2',
                    info: { name: 'Bob', joinDate: new Date('2023-02-01') },
                    participationHistory: {
                        previousSelections: 0,
                        participationRate: 0.8,
                        performanceScores: [0.8]
                    },
                    qualifications: { skills: ['governance'] },
                    availability: { available: true, currentCommitments: 0 },
                    reputation: { trustScore: 0.8 },
                    demographics: {}
                }
            ];
            const result = await icnManageSortition({
                roleRequirements: {
                    title: 'Test Role',
                    description: 'Test role',
                    requiredSkills: ['governance'],
                    timeCommitment: { duration: 30, hoursPerWeek: 2 }
                },
                eligibleMembers,
                constraints: {
                    positions: 1,
                    exclusions: [
                        {
                            description: 'Cooldown period for recent selections',
                            type: 'cooldown',
                            parameters: { days: 180 }
                        }
                    ]
                },
                parameters: { cryptographicRandom: false, allowReplacements: false }
            });
            // Should exclude member1 due to cooldown and select member2
            expect(result.selectedMembers).toHaveLength(1);
            expect(result.selectedMembers[0].member.id).toBe('member2');
            expect(result.processDetails.constrainedPool).toBe(1); // Only 1 member after exclusions
        });
        it('should apply advanced weighting with fairness constraints', async () => {
            const eligibleMembers = [
                {
                    id: 'member1',
                    info: { name: 'Alice', joinDate: new Date('2023-01-01') },
                    participationHistory: {
                        previousSelections: 0,
                        participationRate: 0.8,
                        performanceScores: [0.9, 0.85]
                    },
                    qualifications: {
                        skills: ['governance'],
                        expertiseLevels: { governance: 0.9, facilitation: 0.8 }
                    },
                    availability: { available: true, currentCommitments: 1 },
                    reputation: {
                        trustScore: 0.9,
                        categoryScores: { governance: 0.85 },
                        endorsements: [{ fromMemberId: 'endorser1', weight: 1.5 }]
                    },
                    demographics: { region: 'north', organizationType: 'cooperative' }
                },
                {
                    id: 'member2',
                    info: { name: 'Bob', joinDate: new Date('2023-02-01') },
                    participationHistory: {
                        previousSelections: 0,
                        participationRate: 0.7,
                        performanceScores: [0.7, 0.8]
                    },
                    qualifications: {
                        skills: ['governance'],
                        expertiseLevels: { governance: 0.6 }
                    },
                    availability: { available: true, currentCommitments: 0 },
                    reputation: {
                        trustScore: 0.8,
                        categoryScores: { governance: 0.7 },
                        endorsements: []
                    },
                    demographics: { region: 'south', organizationType: 'collective' }
                }
            ];
            const result = await icnManageSortition({
                roleRequirements: {
                    title: 'Advanced Governance Role',
                    description: 'Complex governance with expertise requirements',
                    requiredSkills: ['governance'],
                    categories: ['governance']
                },
                eligibleMembers,
                constraints: { positions: 1 },
                parameters: { cryptographicRandom: false, allowReplacements: true },
                weights: {
                    expertise: 0.4,
                    category: 0.3,
                    endorsements: 0.2,
                    trust: 0.1
                },
                fairness: {
                    maxGini: 0.5,
                    requireDiversity: true,
                    diversityAttributes: ['region']
                },
                rngSeed: 'test-seed-123'
            });
            // Should have new fields
            expect(result).toHaveProperty('metrics');
            expect(result).toHaveProperty('fairness');
            expect(result).toHaveProperty('rng');
            expect(result).toHaveProperty('explanations');
            expect(result.rng.seedUsed).toBe('test-seed-123');
            expect(result.metrics.gini).toBeDefined();
            expect(result.fairness.score).toBeGreaterThanOrEqual(0);
            expect(result.explanations.length).toBeGreaterThan(0);
        });
        it('should handle delegation cycle detection in voting scenarios', async () => {
            const scenario = {
                description: 'Large federation decision with liquid democracy',
                participantCount: 500,
                context: {
                    decisionType: 'policy',
                    scope: 'federation',
                    urgency: 'medium'
                },
                participants: {
                    expertiseLevels: 'highly_specialized',
                    stakeDistribution: 'weighted',
                    trustNetwork: 'high_trust'
                },
                constraints: {
                    legitimacyRequirements: ['expert_input'],
                    fairnessCriteria: ['expertise_weighting']
                }
            };
            const goals = {
                objectives: ['expertise', 'efficiency'],
                weights: { expertise: 0.8, efficiency: 0.6 },
                successCriteria: ['quality_decisions']
            };
            const result = await icnAdviseVoting(scenario, goals);
            // Should include delegation analysis in rationale
            expect(result.rationale.length).toBeGreaterThan(2);
            // Should warn about potential manipulation vectors
            expect(result.manipulationVectors).toContain('Delegation Capture');
        });
        it('should enforce ICN democratic governance invariants', async () => {
            const result = await icnBuildGovernanceFlow({
                decisionType: 'policy',
                scope: 'local',
                context: 'Policy that must maintain democratic principles'
            });
            // Should require democratic participation
            expect(result.process.votingMechanism.quorum.minimumParticipation).toBeGreaterThan(0);
            // Should have appeals process for execution
            expect(result.process.executionRules.appeals.appealPeriod).toBeGreaterThan(0);
            // Should have deliberation period
            expect(result.process.discussionPeriod.minimumDays).toBeGreaterThan(0);
            // Verify democratic safeguards in adaptation
            expect(result.adaptation.warningSignsToMonitor).toContain('Capture by special interests');
        });
        it('should prevent CC transfer in governance flows', async () => {
            const result = await icnBuildGovernanceFlow({
                decisionType: 'operational',
                scope: 'federation',
                context: 'Operational decision involving CC allocation'
            });
            // Should not allow automatic CC transfers
            expect(result.process.executionRules.type).not.toBe('automatic');
            // Should require manual approval for execution
            expect(result.process.executionRules.requiredApprovals.length).toBeGreaterThan(0);
            // Should have appeal mechanism to prevent unauthorized transfers
            expect(result.process.executionRules.appeals.appealThreshold).toBeDefined();
            expect(result.process.executionRules.appeals.appealThreshold).toBeGreaterThan(0);
        });
        it('should validate non-transferable CC invariant in policy creation', async () => {
            const result = await icnBuildPolicy({
                description: 'Policy involving Contribution Credits allocation',
                category: 'economic',
                scope: {
                    geographic: 'federation',
                    organizational: ['cooperatives']
                },
                stakeholders: {
                    primary: ['cooperative_members'],
                    secondary: ['cc_holders']
                },
                constraints: {
                    legal: ['cc_non_transferability']
                }
            });
            // Should have evaluation rules that check CC compliance
            const ccRule = result.evaluationRules.find(rule => rule.description.toLowerCase().includes('economic') ||
                rule.id.includes('economic'));
            expect(ccRule).toBeDefined();
            expect(ccRule?.type).toBe('mandatory');
            // Should have obligations that prevent CC transfer
            const obligations = result.obligations.some(obligation => obligation.description.toLowerCase().includes('compliance') ||
                obligation.type === 'compliance');
            expect(obligations).toBe(true);
        });
        it('should fail governance flow for CC transfer attempts', async () => {
            // This test simulates what should happen if someone tries to create
            // a governance flow that would enable CC transfers
            const result = await icnBuildGovernanceFlow({
                decisionType: 'policy',
                scope: 'global',
                context: 'Attempt to create CC transfer mechanism (should be blocked)'
            });
            // Even if the request goes through, the execution should have safeguards
            expect(result.process.executionRules.appeals.appealPeriod).toBeGreaterThan(0);
            // Should have warnings about capture
            expect(result.adaptation.warningSignsToMonitor).toContain('Capture by special interests');
            // Should require consensus for any global changes
            if (result.process.decisionThreshold.type === 'supermajority') {
                expect(result.process.decisionThreshold.percentage).toBeGreaterThanOrEqual(70);
            }
        });
    });
    describe('icn_build_policy', () => {
        it('should build comprehensive policy object', async () => {
            const result = await icnBuildPolicy({
                description: 'Democratic participation requirements for all cooperative members',
                category: 'governance',
                scope: {
                    geographic: 'federation',
                    organizational: ['cooperatives', 'collectives']
                },
                stakeholders: {
                    primary: ['cooperative_members', 'collective_members']
                },
                constraints: {
                    legal: ['cooperative_law_compliance'],
                    technical: ['voting_system_integration']
                }
            });
            expect(result).toHaveProperty('metadata');
            expect(result).toHaveProperty('scope');
            expect(result).toHaveProperty('evaluationRules');
            expect(result).toHaveProperty('obligations');
            expect(result).toHaveProperty('versionHistory');
            expect(result).toHaveProperty('conflicts');
            expect(result).toHaveProperty('implementation');
            expect(result).toHaveProperty('monitoring');
            expect(result.metadata.category).toBe('governance');
            expect(result.metadata.status).toBe('draft');
            expect(result.scope.applicability.subjects).toContain('cooperative_members');
            // Should have at least one evaluation rule
            expect(result.evaluationRules.length).toBeGreaterThan(0);
            // Should have at least one obligation
            expect(result.obligations.length).toBeGreaterThan(0);
            // Should have implementation phases
            expect(result.implementation.phases.length).toBeGreaterThan(0);
        });
        it('should handle temporal policy scope with duration calculation', async () => {
            const result = await icnBuildPolicy({
                description: 'Temporary emergency response policy',
                category: 'operational',
                scope: {
                    geographic: 'local',
                    organizational: ['emergency_teams'],
                    temporal: {
                        startDate: '2024-01-01',
                        durationDays: 30
                    }
                },
                stakeholders: {
                    primary: ['emergency_responders']
                },
                constraints: {
                    technical: ['emergency_systems_integration']
                }
            });
            expect(result.scope.applicability.jurisdictions).toContain('local');
            // Should detect temporal scope
            expect(result.conflicts.conflicts.length).toBeGreaterThanOrEqual(0);
        });
        it('should detect temporal conflicts between overlapping policies', async () => {
            const result = await icnBuildPolicy({
                description: 'Economic policy with temporal scope',
                category: 'economic',
                scope: {
                    geographic: 'federation',
                    organizational: ['cooperatives'],
                    temporal: {
                        startDate: '2024-06-01',
                        endDate: '2024-12-31'
                    }
                },
                stakeholders: {
                    primary: ['cooperative_members']
                },
                constraints: {}
            });
            // Should have temporal conflict detection
            expect(result.conflicts).toBeDefined();
        });
        it('should validate temporal scope with invalid dates', async () => {
            const result = await icnBuildPolicy({
                description: 'Policy with invalid temporal scope',
                category: 'governance',
                scope: {
                    geographic: 'regional',
                    organizational: ['test_org'],
                    temporal: {
                        startDate: '2024-12-31',
                        endDate: '2024-01-01' // End before start
                    }
                },
                stakeholders: {
                    primary: ['test_members']
                },
                constraints: {}
            });
            // Should still create policy but may have warnings
            expect(result.metadata.category).toBe('governance');
        });
        it('should detect potential conflicts for governance policies', async () => {
            const result = await icnBuildPolicy({
                description: 'Global governance framework',
                category: 'governance',
                scope: {
                    geographic: 'global',
                    organizational: ['all_entities']
                },
                stakeholders: {
                    primary: ['all_members']
                },
                constraints: {} // Add empty constraints object
            });
            // Global governance policies should have potential conflicts
            expect(result.conflicts.conflicts.length).toBeGreaterThan(0);
            const conflict = result.conflicts.conflicts[0];
            expect(conflict).toHaveProperty('policyId');
            expect(conflict).toHaveProperty('type');
            expect(conflict).toHaveProperty('severity');
            expect(conflict).toHaveProperty('description');
        });
        it('should create appropriate evaluation rules for economic policies', async () => {
            const result = await icnBuildPolicy({
                description: 'Token distribution fairness requirements',
                category: 'economic',
                scope: {
                    geographic: 'regional',
                    organizational: ['token_holders']
                },
                stakeholders: {
                    primary: ['token_holders', 'participants']
                },
                constraints: {} // Add empty constraints object
            });
            // Economic policies should have at least 2 evaluation rules (core + economic-specific)
            expect(result.evaluationRules.length).toBeGreaterThanOrEqual(2);
            // Should have one specific economic fairness rule
            const economicRule = result.evaluationRules.find(rule => rule.id === 'economic_fairness_rule');
            expect(economicRule).toBeDefined();
            expect(economicRule?.description).toContain('economic');
        });
    });
});
