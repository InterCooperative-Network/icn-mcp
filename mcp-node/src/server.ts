#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'node:fs/promises';
import { accessSync } from 'node:fs';
import path from 'node:path';

import { generateToolManifest } from './manifest.js';
import { icnGetArchitecture } from './tools/icn_get_architecture.js';
import { icnGetInvariants } from './tools/icn_get_invariants.js';
import { icnCheckPolicy } from './tools/icn_check_policy.js';
import { icnGetTaskContext } from './tools/icn_get_task_context.js';
import { icnGetSimilarPrs } from './tools/icn_get_similar_prs.js';
import { icnSuggestApproach } from './tools/icn_suggest_approach.js';
import { 
  icnStartWorkflow, 
  icnGetNextStep, 
  icnCheckpoint, 
  icnListWorkflowTemplates,
  icnGetWorkflowState,
  icnWorkflow
} from './tools/icn_workflow.js';
import { icnExtractPrinciples } from './tools/icn_extract_principles.js';
import { icnBuildContext } from './tools/icn_build_context.js';
import { icnLearnFromFeedback } from './tools/icn_learn_from_feedback.js';
import { icnSynthesizeSpec } from './tools/icn_synthesize_spec.js';
import { icnCheckInvariants } from './tools/icn_check_invariants.js';
import { icnValidateImplementation } from './tools/icn_validate_implementation.js';
import { icnGenerateTests } from './tools/icn_generate_tests.js';
import { icnSimulateEconomy } from './tools/icn_simulate_economy.js';
import { icnBuildFormula } from './tools/icn_build_formula.js';
import { icnEconomicAdvice } from './tools/icn_economic_advice.js';
import { icnOrchestleSettlement } from './tools/icn_orchestrate_settlement.js';
import { icnBuildGovernanceFlow } from './tools/icn_build_governance_flow.js';
import { icnAdviseVoting } from './tools/icn_advise_voting.js';
import { icnManageSortition } from './tools/icn_manage_sortition.js';
import { icnBuildPolicy } from './tools/icn_build_policy.js';

class ICNMCPServer {
  private server: Server;
  private healthCheckInterval?: ReturnType<typeof setInterval>;

  constructor() {
    this.server = new Server(
      {
        name: 'icn-mcp',
        version: '0.0.1',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupResourceHandlers();
    this.setupErrorHandling();
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = generateToolManifest();
      return { tools };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      // Timeout wrapper for tool execution
      const executeWithTimeout = async <T>(fn: () => Promise<T>, timeoutMs: number = 30000): Promise<T> => {
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error(`Tool execution timeout after ${timeoutMs}ms`));
          }, timeoutMs);

          fn()
            .then(resolve)
            .catch(reject)
            .finally(() => clearTimeout(timeout));
        });
      };

      try {
        switch (name) {
          case 'icn_get_architecture': {
            const task = typeof args?.task === 'string' ? args.task : undefined;
            const result = await executeWithTimeout(() => icnGetArchitecture(task));
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'icn_get_invariants': {
            const result = await executeWithTimeout(() => icnGetInvariants());
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'icn_check_policy': {
            if (!args?.changeset || !Array.isArray(args.changeset)) {
              throw new Error('changeset parameter is required and must be an array');
            }
            const actor = typeof args.actor === 'string' ? args.actor : undefined;
            const result = await executeWithTimeout(() => icnCheckPolicy({
              changeset: args.changeset as string[],
              actor,
            }));
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'icn_get_task_context': {
            if (!args?.taskId || typeof args.taskId !== 'string') {
              throw new Error('taskId parameter is required and must be a string');
            }
            const result = await executeWithTimeout(() => icnGetTaskContext({ taskId: args.taskId as string }));
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'icn_get_similar_prs': {
            if (!args?.description || typeof args.description !== 'string') {
              throw new Error('description parameter is required and must be a string');
            }
            const files = Array.isArray(args.files) ? args.files : undefined;
            const limit = typeof args.limit === 'number' ? args.limit : undefined;
            const result = await executeWithTimeout(() => icnGetSimilarPrs({
              description: args.description as string,
              files,
              limit
            }));
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'icn_suggest_approach': {
            if (!args?.task_description || typeof args.task_description !== 'string') {
              throw new Error('task_description parameter is required and must be a string');
            }
            const files_to_modify = Array.isArray(args.files_to_modify) ? args.files_to_modify : undefined;
            const constraints = Array.isArray(args.constraints) ? args.constraints : undefined;
            const context = typeof args.context === 'string' ? args.context : undefined;
            const result = await executeWithTimeout(() => icnSuggestApproach({
              task_description: args.task_description as string,
              files_to_modify,
              constraints,
              context
            }));
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'icn_start_workflow': {
            if (!args?.templateId || typeof args.templateId !== 'string') {
              throw new Error('templateId parameter is required and must be a string');
            }
            const initialData = typeof args.initialData === 'object' && args.initialData !== null ? args.initialData : {};
            const result = await executeWithTimeout(() => icnStartWorkflow({
              templateId: args.templateId as string,
              initialData
            }));
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'icn_get_next_step': {
            if (!args?.workflowId || typeof args.workflowId !== 'string') {
              throw new Error('workflowId parameter is required and must be a string');
            }
            const result = await executeWithTimeout(() => icnGetNextStep({
              workflowId: args.workflowId as string
            }));
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'icn_checkpoint': {
            if (!args?.workflowId || typeof args.workflowId !== 'string') {
              throw new Error('workflowId parameter is required and must be a string');
            }
            if (!args?.stepId || typeof args.stepId !== 'string') {
              throw new Error('stepId parameter is required and must be a string');
            }
            if (!args?.data || typeof args.data !== 'object') {
              throw new Error('data parameter is required and must be an object');
            }
            const notes = typeof args.notes === 'string' ? args.notes : undefined;
            const completeStep = typeof args.completeStep === 'boolean' ? args.completeStep : false;
            const result = await executeWithTimeout(() => icnCheckpoint({
              workflowId: args.workflowId as string,
              stepId: args.stepId as string,
              data: args.data as Record<string, any>,
              notes,
              completeStep
            }));
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'icn_list_workflow_templates': {
            const result = await executeWithTimeout(() => icnListWorkflowTemplates());
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'icn_get_workflow_state': {
            if (!args?.workflowId || typeof args.workflowId !== 'string') {
              throw new Error('workflowId parameter is required and must be a string');
            }
            const result = await executeWithTimeout(() => icnGetWorkflowState({
              workflowId: args.workflowId as string
            }));
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'icn_workflow': {
            if (!args?.intent || typeof args.intent !== 'string') {
              throw new Error('intent parameter is required and must be a string');
            }
            const context = typeof args.context === 'string' ? args.context : undefined;
            const constraints = Array.isArray(args.constraints) ? args.constraints : undefined;
            const actor = typeof args.actor === 'string' ? args.actor : undefined;
            
            const result = await executeWithTimeout(() => icnWorkflow({
              intent: args.intent as string,
              context,
              constraints,
              actor
            }), 60000); // 60 second timeout for orchestration
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'icn_extract_principles': {
            const content = typeof args?.content === 'string' ? args.content : undefined;
            const filePath = typeof args?.filePath === 'string' ? args.filePath : undefined;
            const types = Array.isArray(args?.types) ? args.types : undefined;
            const minConfidence = typeof args?.minConfidence === 'number' ? args.minConfidence : undefined;
            
            const result = await executeWithTimeout(() => icnExtractPrinciples({
              content,
              filePath,
              types,
              minConfidence
            }));
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'icn_build_context': {
            if (!args?.query || typeof args.query !== 'string') {
              throw new Error('query parameter is required and must be a string');
            }
            const maxResults = typeof args.maxResults === 'number' ? args.maxResults : undefined;
            const includeExamples = typeof args.includeExamples === 'boolean' ? args.includeExamples : undefined;
            const includeWarnings = typeof args.includeWarnings === 'boolean' ? args.includeWarnings : undefined;
            const focusAreas = Array.isArray(args.focusAreas) ? args.focusAreas : undefined;
            
            const result = await executeWithTimeout(() => icnBuildContext({
              query: args.query as string,
              maxResults,
              includeExamples,
              includeWarnings,
              focusAreas
            }));
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'icn_learn_from_feedback': {
            if (!args?.type || typeof args.type !== 'string') {
              throw new Error('type parameter is required and must be a string');
            }
            if (!args?.context || typeof args.context !== 'object') {
              throw new Error('context parameter is required and must be an object');
            }
            if (!args?.feedback || typeof args.feedback !== 'object') {
              throw new Error('feedback parameter is required and must be an object');
            }
            
            const metadata = typeof args.metadata === 'object' && args.metadata !== null && 'source' in args.metadata
              ? args.metadata as any : { source: 'mcp-server' };
            
            const result = await executeWithTimeout(() => icnLearnFromFeedback({
              type: args.type as any,
              context: args.context as any,
              feedback: args.feedback as any,
              metadata
            }));
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'icn_synthesize_spec': {
            if (!args?.surface || typeof args.surface !== 'string') {
              throw new Error('surface parameter is required and must be a string');
            }
            const result = await executeWithTimeout(() => icnSynthesizeSpec({
              surface: args.surface as string
            }));
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'icn_check_invariants': {
            const code = typeof args?.code === 'string' ? args.code : undefined;
            const design = typeof args?.design === 'string' ? args.design : undefined;
            const description = typeof args?.description === 'string' ? args.description : undefined;
            
            if (!code && !design && !description) {
              throw new Error('At least one of code, design, or description must be provided');
            }
            
            const result = await executeWithTimeout(() => icnCheckInvariants({
              code,
              design,
              description
            }));
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'icn_validate_implementation': {
            if (!args?.code || typeof args.code !== 'string') {
              throw new Error('code parameter is required and must be a string');
            }
            const surface = typeof args.surface === 'string' ? args.surface : undefined;
            const description = typeof args.description === 'string' ? args.description : undefined;
            
            const result = await executeWithTimeout(() => icnValidateImplementation({
              code: args.code as string,
              surface,
              description
            }));
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'icn_generate_tests': {
            if (!args?.component || typeof args.component !== 'string') {
              throw new Error('component parameter is required and must be a string');
            }
            const surface = typeof args.surface === 'string' ? args.surface : undefined;
            const requirements = Array.isArray(args.requirements) ? args.requirements : undefined;
            const description = typeof args.description === 'string' ? args.description : undefined;
            
            const result = await executeWithTimeout(() => icnGenerateTests({
              component: args.component as string,
              surface,
              requirements,
              description
            }));
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'icn_simulate_economy': {
            if (!args?.parameters || typeof args.parameters !== 'object') {
              throw new Error('parameters parameter is required and must be an object');
            }
            const participantBehaviors = Array.isArray(args.participantBehaviors) ? args.participantBehaviors : undefined;
            
            const result = await executeWithTimeout(() => icnSimulateEconomy({
              parameters: args.parameters as any,
              participantBehaviors
            }));
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'icn_build_formula': {
            if (!args?.description || typeof args.description !== 'string') {
              throw new Error('description parameter is required and must be a string');
            }
            const context = typeof args.context === 'string' ? args.context : undefined;
            const outputType = typeof args.outputType === 'string' ? args.outputType as any : undefined;
            const knownVariables = Array.isArray(args.knownVariables) ? args.knownVariables : undefined;
            
            const result = await executeWithTimeout(() => icnBuildFormula({
              description: args.description as string,
              context,
              outputType,
              knownVariables
            }));
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'icn_economic_advice': {
            if (!args?.mechanism || typeof args.mechanism !== 'object') {
              throw new Error('mechanism parameter is required and must be an object');
            }
            const context = typeof args.context === 'object' && args.context !== null ? args.context : undefined;
            const concerns = Array.isArray(args.concerns) ? args.concerns : undefined;
            
            const result = await executeWithTimeout(() => icnEconomicAdvice({
              mechanism: args.mechanism as any,
              context,
              concerns
            }));
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'icn_orchestrate_settlement': {
            if (!args?.transactions || !Array.isArray(args.transactions)) {
              throw new Error('transactions parameter is required and must be an array');
            }
            if (!args?.organizations || !Array.isArray(args.organizations)) {
              throw new Error('organizations parameter is required and must be an array');
            }
            const exchangeRates = Array.isArray(args.exchangeRates) ? args.exchangeRates : undefined;
            const preferences = typeof args.preferences === 'object' && args.preferences !== null ? args.preferences : undefined;
            
            // Convert timestamp strings to Date objects
            const transactions = args.transactions.map((tx: any) => ({
              ...tx,
              timestamp: new Date(tx.timestamp)
            }));
            
            const processedExchangeRates = exchangeRates?.map((rate: any) => ({
              ...rate,
              timestamp: new Date(rate.timestamp)
            }));
            
            const result = await executeWithTimeout(() => icnOrchestleSettlement({
              transactions,
              organizations: args.organizations as any,
              exchangeRates: processedExchangeRates,
              preferences
            }));
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'icn_build_governance_flow': {
            if (!args?.decisionType || typeof args.decisionType !== 'string') {
              throw new Error('decisionType parameter is required and must be a string');
            }
            if (!args?.scope || typeof args.scope !== 'string') {
              throw new Error('scope parameter is required and must be a string');
            }
            const context = typeof args.context === 'string' ? args.context : undefined;
            
            const result = await executeWithTimeout(() => icnBuildGovernanceFlow({
              decisionType: args.decisionType as any,
              scope: args.scope as any,
              context
            }));
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'icn_advise_voting': {
            if (!args?.scenario || typeof args.scenario !== 'object') {
              throw new Error('scenario parameter is required and must be an object');
            }
            if (!args?.goals || typeof args.goals !== 'object') {
              throw new Error('goals parameter is required and must be an object');
            }
            
            const result = await executeWithTimeout(() => icnAdviseVoting(
              args.scenario as any,
              args.goals as any
            ));
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'icn_manage_sortition': {
            if (!args?.roleRequirements || typeof args.roleRequirements !== 'object') {
              throw new Error('roleRequirements parameter is required and must be an object');
            }
            if (!args?.eligibleMembers || !Array.isArray(args.eligibleMembers)) {
              throw new Error('eligibleMembers parameter is required and must be an array');
            }
            if (!args?.constraints || typeof args.constraints !== 'object') {
              throw new Error('constraints parameter is required and must be an object');
            }
            if (!args?.parameters || typeof args.parameters !== 'object') {
              throw new Error('parameters parameter is required and must be an object');
            }
            
            // Convert date strings to Date objects for eligible members
            const eligibleMembers = args.eligibleMembers.map((member: any) => ({
              ...member,
              info: {
                ...member.info,
                joinDate: new Date(member.info.joinDate)
              },
              participationHistory: {
                ...member.participationHistory,
                lastSelected: member.participationHistory.lastSelected ? 
                  new Date(member.participationHistory.lastSelected) : undefined
              },
              availability: {
                ...member.availability,
                availableFrom: member.availability.availableFrom ?
                  new Date(member.availability.availableFrom) : undefined,
                availableUntil: member.availability.availableUntil ?
                  new Date(member.availability.availableUntil) : undefined
              }
            }));
            
            const result = await executeWithTimeout(() => icnManageSortition({
              roleRequirements: args.roleRequirements as any,
              eligibleMembers,
              constraints: args.constraints as any,
              parameters: args.parameters as any
            }));
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'icn_build_policy': {
            if (!args?.description || typeof args.description !== 'string') {
              throw new Error('description parameter is required and must be a string');
            }
            if (!args?.category || typeof args.category !== 'string') {
              throw new Error('category parameter is required and must be a string');
            }
            if (!args?.scope || typeof args.scope !== 'object') {
              throw new Error('scope parameter is required and must be an object');
            }
            if (!args?.stakeholders || typeof args.stakeholders !== 'object') {
              throw new Error('stakeholders parameter is required and must be an object');
            }
            
            const constraints = typeof args.constraints === 'object' && args.constraints !== null ? 
              args.constraints : {};
            
            const result = await executeWithTimeout(() => icnBuildPolicy({
              description: args.description as string,
              category: args.category as any,
              scope: args.scope as any,
              stakeholders: args.stakeholders as any,
              constraints
            }));
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: errorMessage }, null, 2),
            },
          ],
          isError: true,
        };
      }
    });
  }

  private setupResourceHandlers() {
    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const resources = await this.listResources();
      return { resources };
    });

    // Handle resource reads
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      const contents = await this.readResource(uri);
      return { contents };
    });
  }

  private async listResources() {
    const resources = [];
    
    try {
      // Add documentation resources
      const docsRoot = this.getDocsRoot();
      
      // Architecture documentation
      const archDir = path.join(docsRoot, 'architecture');
      try {
        const archFiles = await fs.readdir(archDir);
        for (const file of archFiles) {
          if (file.endsWith('.md')) {
            resources.push({
              uri: `icn://docs/architecture/${file}`,
              name: `Architecture: ${file}`,
              description: `ICN architecture documentation from ${file}`,
              mimeType: 'text/markdown'
            });
          }
        }
      } catch (error) {
        // Directory might not exist, continue
      }

      // Invariants documentation
      const invariantsDir = path.join(docsRoot, 'invariants');
      try {
        const invFiles = await fs.readdir(invariantsDir);
        for (const file of invFiles) {
          if (file.endsWith('.md')) {
            resources.push({
              uri: `icn://docs/invariants/${file}`,
              name: `Invariants: ${file}`,
              description: `ICN system invariants from ${file}`,
              mimeType: 'text/markdown'
            });
          }
        }
      } catch (error) {
        // Directory might not exist, continue
      }

      // Policy rules
      const policyPath = this.getPolicyRulesPath();
      try {
        await fs.access(policyPath);
        resources.push({
          uri: `icn://policy/rules.json`,
          name: 'Policy Rules',
          description: 'ICN policy rules configuration for access control and code review requirements',
          mimeType: 'application/json'
        });
      } catch (error) {
        // File might not exist, continue
      }

      // CODEOWNERS file
      const codeownersPath = path.join(this.getRepoRoot(), 'CODEOWNERS');
      try {
        await fs.access(codeownersPath);
        resources.push({
          uri: `icn://CODEOWNERS`,
          name: 'CODEOWNERS',
          description: 'GitHub CODEOWNERS file specifying code ownership and review requirements',
          mimeType: 'text/plain'
        });
      } catch (error) {
        // File might not exist, continue
      }

      // Recent logs (placeholder - in a real implementation this would read actual logs)
      resources.push({
        uri: `icn://logs/recent`,
        name: 'Recent Logs',
        description: 'Recent system and task execution logs for debugging',
        mimeType: 'text/plain'
      });

    } catch (error) {
      console.error('[MCP Resources] Error listing resources:', error);
    }

    return resources;
  }

  private async readResource(uri: string) {
    try {
      if (uri.startsWith('icn://docs/architecture/')) {
        const filename = uri.replace('icn://docs/architecture/', '');
        const filePath = path.join(this.getDocsRoot(), 'architecture', filename);
        const content = await fs.readFile(filePath, 'utf-8');
        return [{
          uri,
          mimeType: 'text/markdown',
          text: content
        }];
      }

      if (uri.startsWith('icn://docs/invariants/')) {
        const filename = uri.replace('icn://docs/invariants/', '');
        const filePath = path.join(this.getDocsRoot(), 'invariants', filename);
        const content = await fs.readFile(filePath, 'utf-8');
        return [{
          uri,
          mimeType: 'text/markdown',
          text: content
        }];
      }

      if (uri === 'icn://policy/rules.json') {
        const content = await fs.readFile(this.getPolicyRulesPath(), 'utf-8');
        return [{
          uri,
          mimeType: 'application/json',
          text: content
        }];
      }

      if (uri === 'icn://CODEOWNERS') {
        const content = await fs.readFile(path.join(this.getRepoRoot(), 'CODEOWNERS'), 'utf-8');
        return [{
          uri,
          mimeType: 'text/plain',
          text: content
        }];
      }

      if (uri === 'icn://logs/recent') {
        // In a real implementation, this would read actual logs
        // For now, return a placeholder
        const content = 'Recent logs placeholder - implement actual log reading based on your logging infrastructure';
        return [{
          uri,
          mimeType: 'text/plain',
          text: content
        }];
      }

      throw new Error(`Resource not found: ${uri}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error reading resource';
      return [{
        uri,
        mimeType: 'text/plain',
        text: `Error reading resource: ${errorMessage}`
      }];
    }
  }

  private getRepoRoot(): string {
    // Try to find the repo root by looking for package.json or .git
    let current = process.cwd();
    
    while (current !== path.dirname(current)) {
      try {
        const packageJson = path.join(current, 'package.json');
        const gitDir = path.join(current, '.git');
        
        // Use accessSync to check existence
        try {
          accessSync(packageJson);
          return current;
        } catch {
          try {
            accessSync(gitDir);
            return current;
          } catch {
            // Continue searching if neither exists
          }
        }
      } catch (error) {
        // Continue searching
      }
      current = path.dirname(current);
    }
    
    // Fallback to current working directory
    return process.cwd();
  }

  private getDocsRoot(): string {
    return path.join(this.getRepoRoot(), 'docs');
  }

  private getPolicyRulesPath(): string {
    return path.join(this.getRepoRoot(), 'mcp-server', 'policy.rules.json');
  }

  private setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    // Handle process signals gracefully
    process.on('SIGINT', async () => {
      console.error('[MCP] Received SIGINT, shutting down gracefully...');
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }
      await this.server.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.error('[MCP] Received SIGTERM, shutting down gracefully...');
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }
      await this.server.close();
      process.exit(0);
    });

    // Handle broken pipes and stdio errors
    process.stdin.on('error', (error) => {
      console.error('[MCP] stdin error:', error);
      // If stdin is broken, we can't receive messages, so exit
      process.exit(1);
    });

    process.stdout.on('error', (error) => {
      console.error('[MCP] stdout error:', error);
      // If stdout is broken, we can't send responses, so exit
      process.exit(1);
    });

    // Handle unexpected exits
    process.on('uncaughtException', (error) => {
      console.error('[MCP] Uncaught exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('[MCP] Unhandled rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    
    // Enhanced transport error handling
    transport.onclose = () => {
      console.error('[MCP] Transport connection closed');
      // Exit gracefully when transport closes
      process.exit(0);
    };

    transport.onerror = (error) => {
      console.error('[MCP] Transport error:', error);
      // Log the error but don't immediately exit - let the transport try to recover
      // If it's a critical error (like broken pipe), the transport will close and trigger onclose
    };

    try {
      // Set a timeout for connection establishment
      const connectionTimeout = setTimeout(() => {
        console.error('[MCP] Connection timeout after 30 seconds');
        process.exit(1);
      }, 30000);

      await this.server.connect(transport);
      clearTimeout(connectionTimeout);
      
      console.error('ICN MCP Server running on stdio');
      
      // Keep the process alive and handle any connection issues
      this.healthCheckInterval = setInterval(() => {
        // Periodic health check - if stdin/stdout are closed, we should exit
        if (process.stdin.destroyed || process.stdout.destroyed) {
          console.error('[MCP] Stdio streams destroyed, exiting...');
          process.exit(1);
        }
      }, 10000); // Check every 10 seconds
      
    } catch (error) {
      console.error('[MCP] Failed to connect transport:', error);
      process.exit(1);
    }
  }
}

// Start the server
const server = new ICNMCPServer();
server.run().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});