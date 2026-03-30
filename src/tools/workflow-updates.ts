import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppStoreConnectClient } from '../api/client.js';
import type { CiWorkflowAction } from '../api/types.js';
import { parseIdentifier } from '../utils/identifiers.js';
import { errorResponse, jsonResponse } from '../utils/tool-response.js';
import { formatWorkflowDetailsResponse } from '../utils/workflow-details.js';

const conditionSchema = z.record(z.string(), z.unknown()).nullable();

const actionSchema = z.object({
  name: z.string(),
  actionType: z.string(),
  destination: z.string().nullable().optional(),
  buildDistributionAudience: z.string().nullable().optional(),
  testConfiguration: z
    .object({
      kind: z.string().nullable().optional(),
      testPlanName: z.string().nullable().optional(),
      testDestinations: z
        .array(z.record(z.string(), z.unknown()))
        .nullable()
        .optional(),
    })
    .nullable()
    .optional(),
  scheme: z.string().nullable().optional(),
  platform: z.string().nullable().optional(),
  isRequiredToPass: z.boolean().nullable().optional(),
});

/**
 * Register workflow update tools.
 */
export function registerWorkflowUpdateTools(
  server: McpServer,
  client: AppStoreConnectClient,
): void {
  server.registerTool(
    'set_workflow_enabled',
    {
      description:
        'Explicitly enable or disable one Xcode Cloud workflow.',
      inputSchema: {
        workflowId: z.string(),
        enabled: z.boolean(),
      },
    },
    async ({ workflowId, enabled }: { enabled: boolean; workflowId: string }) => {
      try {
        const workflowIdentifier = parseIdentifier(workflowId, 'workflow');
        await client.workflows.setEnabled(workflowIdentifier, enabled);
        const updated = await client.workflows.getById(workflowIdentifier);

        return jsonResponse({
          operation: {
            applied: true,
            enabled,
            type: 'set_workflow_enabled',
          },
          ...formatWorkflowDetailsResponse(updated.workflow, updated.included),
        });
      } catch (error) {
        return errorResponse(error);
      }
    },
  );

  server.registerTool(
    'update_workflow_general',
    {
      description:
        'Explicitly update general workflow fields such as name, description, and clean build behavior.',
      inputSchema: {
        workflowId: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        clean: z.boolean().optional(),
      },
    },
    async ({
      workflowId,
      name,
      description,
      clean,
    }: {
      clean?: boolean;
      description?: string;
      name?: string;
      workflowId: string;
    }) => {
      try {
        if (
          name === undefined &&
          description === undefined &&
          clean === undefined
        ) {
          throw new Error(
            'Provide at least one of name, description, or clean.',
          );
        }

        const workflowIdentifier = parseIdentifier(workflowId, 'workflow');
        await client.workflows.updateGeneral(workflowIdentifier, {
          ...(clean !== undefined ? { clean } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(name !== undefined ? { name } : {}),
        });
        const updated = await client.workflows.getById(workflowIdentifier);

        return jsonResponse({
          operation: {
            applied: true,
            changedFields: [
              ...(name !== undefined ? ['name'] : []),
              ...(description !== undefined ? ['description'] : []),
              ...(clean !== undefined ? ['clean'] : []),
            ],
            type: 'update_workflow_general',
          },
          ...formatWorkflowDetailsResponse(updated.workflow, updated.included),
        });
      } catch (error) {
        return errorResponse(error);
      }
    },
  );

  server.registerTool(
    'update_workflow_start_conditions',
    {
      description:
        'Explicitly update workflow start conditions. Pass null to remove a condition.',
      inputSchema: {
        workflowId: z.string(),
        branchStartCondition: conditionSchema.optional(),
        manualBranchStartCondition: conditionSchema.optional(),
        pullRequestStartCondition: conditionSchema.optional(),
        manualPullRequestStartCondition: conditionSchema.optional(),
        scheduledStartCondition: conditionSchema.optional(),
        tagStartCondition: conditionSchema.optional(),
        manualTagStartCondition: conditionSchema.optional(),
      },
    },
    async (arguments_) => {
      try {
        const {
          workflowId,
          branchStartCondition,
          manualBranchStartCondition,
          pullRequestStartCondition,
          manualPullRequestStartCondition,
          scheduledStartCondition,
          tagStartCondition,
          manualTagStartCondition,
        } = arguments_ as {
          branchStartCondition?: Record<string, unknown> | null;
          manualBranchStartCondition?: Record<string, unknown> | null;
          manualPullRequestStartCondition?: Record<string, unknown> | null;
          manualTagStartCondition?: Record<string, unknown> | null;
          pullRequestStartCondition?: Record<string, unknown> | null;
          scheduledStartCondition?: Record<string, unknown> | null;
          tagStartCondition?: Record<string, unknown> | null;
          workflowId: string;
        };

        const changedFields = [
          ...(branchStartCondition !== undefined ? ['branchStartCondition'] : []),
          ...(manualBranchStartCondition !== undefined
            ? ['manualBranchStartCondition']
            : []),
          ...(pullRequestStartCondition !== undefined
            ? ['pullRequestStartCondition']
            : []),
          ...(manualPullRequestStartCondition !== undefined
            ? ['manualPullRequestStartCondition']
            : []),
          ...(scheduledStartCondition !== undefined
            ? ['scheduledStartCondition']
            : []),
          ...(tagStartCondition !== undefined ? ['tagStartCondition'] : []),
          ...(manualTagStartCondition !== undefined
            ? ['manualTagStartCondition']
            : []),
        ];

        if (changedFields.length === 0) {
          throw new Error('Provide at least one start condition to update.');
        }

        const workflowIdentifier = parseIdentifier(workflowId, 'workflow');
        await client.workflows.updateStartConditions(workflowIdentifier, {
          ...(branchStartCondition !== undefined
            ? { branchStartCondition }
            : {}),
          ...(manualBranchStartCondition !== undefined
            ? { manualBranchStartCondition }
            : {}),
          ...(pullRequestStartCondition !== undefined
            ? { pullRequestStartCondition }
            : {}),
          ...(manualPullRequestStartCondition !== undefined
            ? { manualPullRequestStartCondition }
            : {}),
          ...(scheduledStartCondition !== undefined
            ? { scheduledStartCondition }
            : {}),
          ...(tagStartCondition !== undefined ? { tagStartCondition } : {}),
          ...(manualTagStartCondition !== undefined
            ? { manualTagStartCondition }
            : {}),
        });
        const updated = await client.workflows.getById(workflowIdentifier);

        return jsonResponse({
          operation: {
            applied: true,
            changedFields,
            type: 'update_workflow_start_conditions',
          },
          ...formatWorkflowDetailsResponse(updated.workflow, updated.included),
        });
      } catch (error) {
        return errorResponse(error);
      }
    },
  );

  server.registerTool(
    'update_workflow_actions',
    {
      description:
        'Explicitly replace the full workflow actions array. This should be used only when the caller intends to send the final desired action list.',
      inputSchema: {
        workflowId: z.string(),
        actions: z.array(actionSchema),
      },
    },
    async ({
      workflowId,
      actions,
    }: {
      actions: Array<z.infer<typeof actionSchema>>;
      workflowId: string;
    }) => {
      try {
        const workflowIdentifier = parseIdentifier(workflowId, 'workflow');
        await client.workflows.updateActions(
          workflowIdentifier,
          actions.map(normalizeAction),
        );
        const updated = await client.workflows.getById(workflowIdentifier);

        return jsonResponse({
          operation: {
            actionCount: actions.length,
            applied: true,
            type: 'update_workflow_actions',
          },
          ...formatWorkflowDetailsResponse(updated.workflow, updated.included),
        });
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}

function normalizeAction(action: z.infer<typeof actionSchema>): CiWorkflowAction {
  return {
    name: action.name,
    actionType: action.actionType,
    destination: action.destination ?? null,
    buildDistributionAudience: action.buildDistributionAudience ?? null,
    testConfiguration: action.testConfiguration
      ? {
          kind: action.testConfiguration.kind ?? null,
          testPlanName: action.testConfiguration.testPlanName ?? null,
          testDestinations: action.testConfiguration.testDestinations ?? [],
        }
      : null,
    scheme: action.scheme ?? null,
    platform: action.platform ?? null,
    isRequiredToPass: action.isRequiredToPass ?? null,
  };
}
