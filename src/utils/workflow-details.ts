import type {
  CiMacOsVersion,
  CiWorkflow,
  CiWorkflowAction,
  CiXcodeVersion,
  ScmRepository,
  WorkflowIncludedResource,
} from '../api/types.js';

/**
 * Format a workflow and its included resources for MCP responses.
 */
export function formatWorkflowDetailsResponse(
  workflow: CiWorkflow,
  included: WorkflowIncludedResource[],
) {
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

  return {
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
  };
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
