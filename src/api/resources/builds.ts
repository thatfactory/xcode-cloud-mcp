import { BaseAPIClient } from '../base-client.js';
import type { CiBuildRun } from '../types.js';

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
}
