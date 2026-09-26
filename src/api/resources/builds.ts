import { BaseAPIClient } from '../base-client.js';
import type {
  CiBuildAction,
  CiBuildRun,
  CiBuildRunCreateRequest,
  CiBuildRunStartOptions,
} from '../types.js';

/**
 * Build run endpoints.
 */
export class BuildsClient extends BaseAPIClient {
  static readonly buildLocatorScanLimit = 2000;

  /**
   * Start exactly one Xcode Cloud build run.
   */
  async start(options: CiBuildRunStartOptions): Promise<CiBuildRun> {
    const attributes: CiBuildRunCreateRequest['data']['attributes'] = {};
    if (options.clean !== undefined) {
      attributes.clean = options.clean;
    }

    const relationships: CiBuildRunCreateRequest['data']['relationships'] = {
      workflow: {
        data: {
          type: 'ciWorkflows',
          id: options.workflowId,
        },
      },
    };

    if (options.sourceBranchOrTagId !== undefined) {
      relationships.sourceBranchOrTag = {
        data: {
          type: 'scmGitReferences',
          id: options.sourceBranchOrTagId,
        },
      };
    }

    if (options.pullRequestId !== undefined) {
      relationships.pullRequest = {
        data: {
          type: 'scmPullRequests',
          id: options.pullRequestId,
        },
      };
    }

    if (options.buildRunId !== undefined) {
      relationships.buildRun = {
        data: {
          type: 'ciBuildRuns',
          id: options.buildRunId,
        },
      };
    }

    const request: CiBuildRunCreateRequest = {
      data: {
        type: 'ciBuildRuns',
        attributes,
        relationships,
      },
    };
    const response = await this.post<CiBuildRun, CiBuildRunCreateRequest>(
      '/v1/ciBuildRuns',
      request,
    );

    return response.data;
  }

  /**
   * Get a build run by id.
   */
  async getById(buildRunId: string): Promise<CiBuildRun> {
    const response = await this.get<CiBuildRun>(`/v1/ciBuildRuns/${buildRunId}`);
    return response.data;
  }

  /**
   * List build runs for a workflow, paginating through all results.
   * Optionally limit the total number of build runs returned.
   */
  async listForWorkflow(workflowId: string, limit?: number): Promise<CiBuildRun[]> {
    return this.listAll<CiBuildRun>(
      `/v1/ciWorkflows/${workflowId}/buildRuns`,
      { limit: '200' },
      limit,
    );
  }

  /**
   * Find a build run with a specific build number for a workflow.
   */
  async findByNumberForWorkflow(
    workflowId: string,
    buildNumber: number,
    maxItems: number = BuildsClient.buildLocatorScanLimit,
  ): Promise<CiBuildRun | undefined> {
    return this.findInList<CiBuildRun>(
      `/v1/ciWorkflows/${workflowId}/buildRuns`,
      (buildRun) => buildRun.attributes.number === buildNumber,
      { limit: '200' },
      maxItems,
    );
  }

  /**
   * Find the latest failing build run for a workflow.
   */
  async findLatestFailingForWorkflow(
    workflowId: string,
    maxItems: number = BuildsClient.buildLocatorScanLimit,
  ): Promise<CiBuildRun | undefined> {
    return this.findInList<CiBuildRun>(
      `/v1/ciWorkflows/${workflowId}/buildRuns`,
      (buildRun) =>
        buildRun.attributes.completionStatus === 'FAILED' ||
        buildRun.attributes.completionStatus === 'ERRORED',
      { limit: '200' },
      maxItems,
    );
  }

  /**
   * List build actions for a build run.
   */
  async getActions(buildRunId: string): Promise<CiBuildAction[]> {
    const response = await this.get<CiBuildAction[]>(
      `/v1/ciBuildRuns/${buildRunId}/actions`,
    );

    return response.data;
  }
}
