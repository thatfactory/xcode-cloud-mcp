import { BaseAPIClient } from '../base-client.js';
import type { CiBuildAction, CiBuildRun } from '../types.js';

/**
 * Build run endpoints.
 */
export class BuildsClient extends BaseAPIClient {
  static readonly buildLocatorScanLimit = 2000;

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
