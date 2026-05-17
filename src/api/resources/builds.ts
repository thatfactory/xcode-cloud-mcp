import { BaseAPIClient } from '../base-client.js';
import type { CiBuildAction, CiBuildRun } from '../types.js';

/**
 * Build run endpoints.
 */
export class BuildsClient extends BaseAPIClient {
  /**
   * Get a build run by id.
   */
  async getById(buildRunId: string): Promise<CiBuildRun> {
    const response = await this.get<CiBuildRun>(`/v1/ciBuildRuns/${buildRunId}`);
    return response.data;
  }

  /**
   * List all build runs for a workflow, paginating through all results.
   */
  async listForWorkflow(workflowId: string): Promise<CiBuildRun[]> {
    return this.listAll<CiBuildRun>(
      `/v1/ciWorkflows/${workflowId}/buildRuns`,
      { limit: '200' },
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