import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppStoreConnectClient } from '../api/client.js';
import type {
  CiMacOsVersion,
  CiWorkflowAction,
  CiXcodeVersion,
  ScmRepository,
  WorkflowIncludedResource,
} from '../api/types.js';
import { parseIdentifier } from '../utils/identifiers.js';
import { errorResponse, jsonResponse } from '../utils/tool-response.js';

/**
 * Register discovery tools.
 */
export function registerDiscoveryTools(
  server: McpServer,
  client: AppStoreConnectClient,
): void {
  server.registerTool(
    'list_products',
    {
      description:
        'List Xcode Cloud products available to the configured App Store Connect account.',
      inputSchema: {
        limit: z.number().int().positive().max(200).optional(),
      },
    },
    async ({ limit }: { limit?: number }) => {
      try {
        const products = await client.products.list(limit);

        return jsonResponse({
          products: products.map((product) => ({
            id: product.id,
            name: product.attributes.name,
            productType: product.attributes.productType,
            createdDate: product.attributes.createdDate,
          })),
        });
      } catch (error) {
        return errorResponse(error);
      }
    },
  );

  server.registerTool(
    'list_workflows',
    {
      description: 'List workflows for a given Xcode Cloud product.',
      inputSchema: {
        productId: z.string(),
        limit: z.number().int().positive().max(200).optional(),
      },
    },
    async ({ productId, limit }: { productId: string; limit?: number }) => {
      try {
        const workflows = await client.workflows.listForProduct(
          parseIdentifier(productId, 'product'),
          limit,
        );

        return jsonResponse({
          workflows: workflows.map((workflow) => ({
            id: workflow.id,
            name: workflow.attributes.name,
            description: workflow.attributes.description,
            isEnabled: workflow.attributes.isEnabled,
            clean: workflow.attributes.clean,
            containerFilePath: workflow.attributes.containerFilePath,
            lastModifiedDate: workflow.attributes.lastModifiedDate,
          })),
        });
      } catch (error) {
        return errorResponse(error);
      }
    },
  );

  server.registerTool(
    'get_workflow_details',
    {
      description:
        'Retrieve detailed Xcode Cloud workflow configuration, including environment, start conditions, actions, and enabled state.',
      inputSchema: {
        workflowId: z.string(),
      },
    },
    async ({ workflowId }: { workflowId: string }) => {
      try {
        const workflowIdentifier = parseIdentifier(workflowId, 'workflow');
        const { workflow, included } = await client.workflows.getById(workflowIdentifier);
        const repository = findIncludedResource<ScmRepository>(
          included,
          workflow.relationships?.repository?.data?.id,
          'scmRepositories',
        );
        const xcodeVersion = findIncludedResource<CiXcodeVersion>(
          included,
          workflow.relationships?.xcodeVersion?.data?.id,
          'ciXcodeVersions',
        );
        const macOsVersion = findIncludedResource<CiMacOsVersion>(
          included,
          workflow.relationships?.macOsVersion?.data?.id,
          'ciMacOsVersions',
        );
        const actions = workflow.attributes.actions ?? [];

        return jsonResponse({
          workflow: {
            id: workflow.id,
            general: {
              name: workflow.attributes.name,
              description: workflow.attributes.description ?? null,
              isEnabled: workflow.attributes.isEnabled,
              isLockedForEditing: workflow.attributes.isLockedForEditing ?? null,
              clean: workflow.attributes.clean,
              containerFilePath: workflow.attributes.containerFilePath,
              lastModifiedDate: workflow.attributes.lastModifiedDate,
            },
            environment: {
              repository: repository
                ? {
                    id: repository.id,
                    ownerName: repository.attributes.ownerName ?? null,
                    repositoryName: repository.attributes.repositoryName ?? null,
                    scmProvider: repository.attributes.scmProvider ?? null,
                    defaultBranch: repository.attributes.defaultBranch ?? null,
                    httpCloneUrl: repository.attributes.httpCloneUrl ?? null,
                    sshCloneUrl: repository.attributes.sshCloneUrl ?? null,
                  }
                : null,
              xcodeVersion: xcodeVersion
                ? {
                    id: xcodeVersion.id,
                    name: xcodeVersion.attributes.name ?? null,
                    version: xcodeVersion.attributes.version ?? null,
                    supportedTestDestinations:
                      xcodeVersion.attributes.testDestinations?.length ?? 0,
                  }
                : null,
              macOsVersion: macOsVersion
                ? {
                    id: macOsVersion.id,
                    name: macOsVersion.attributes.name ?? null,
                    version: macOsVersion.attributes.version ?? null,
                  }
                : null,
            },
            startConditions: {
              branch: workflow.attributes.branchStartCondition ?? null,
              manualBranch: workflow.attributes.manualBranchStartCondition ?? null,
              pullRequest: workflow.attributes.pullRequestStartCondition ?? null,
              manualPullRequest:
                workflow.attributes.manualPullRequestStartCondition ?? null,
              scheduled: workflow.attributes.scheduledStartCondition ?? null,
              tag: workflow.attributes.tagStartCondition ?? null,
              manualTag: workflow.attributes.manualTagStartCondition ?? null,
            },
            actions: actions.map(formatWorkflowAction),
            postActions: [],
            postActionsNote:
              'The App Store Connect workflow payload did not expose separate post-actions, so this field is empty unless Apple adds that data.',
          },
        });
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}

function findIncludedResource<TResource extends WorkflowIncludedResource>(
  resources: WorkflowIncludedResource[],
  identifier: string | undefined,
  type: TResource['type'],
): TResource | undefined {
  if (!identifier) {
    return undefined;
  }

  return resources.find(
    (resource): resource is TResource =>
      resource.id === identifier && resource.type === type,
  );
}

function formatWorkflowAction(action: CiWorkflowAction) {
  return {
    name: action.name,
    actionType: action.actionType,
    platform: action.platform ?? null,
    scheme: action.scheme ?? null,
    destination: action.destination ?? null,
    buildDistributionAudience: action.buildDistributionAudience ?? null,
    isRequiredToPass: action.isRequiredToPass ?? null,
    testConfiguration: action.testConfiguration
      ? {
          kind: action.testConfiguration.kind ?? null,
          testPlanName: action.testConfiguration.testPlanName ?? null,
          testDestinations: action.testConfiguration.testDestinations ?? [],
        }
      : null,
  };
}
