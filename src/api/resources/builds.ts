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
   * List recent build runs for a workflow.
   */
  async listForWorkflow(workflowId: string, limit?: number): Promise<CiBuildRun[]> {
    const response = await this.get<CiBuildRun[]>(
      `/v1/ciWorkflows/${workflowId}/buildRuns`,
      {
        ...(limit ? { limit: String(limit) } : {}),
      },
    );

    return response.data;
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
