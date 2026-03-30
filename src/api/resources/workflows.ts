import { BaseAPIClient } from '../base-client.js';
import type { CiWorkflow, WorkflowIncludedResource } from '../types.js';

/**
 * Workflow endpoints.
 */
export class WorkflowsClient extends BaseAPIClient {
  /**
   * List workflows belonging to a product.
   */
  async listForProduct(productId: string, limit?: number): Promise<CiWorkflow[]> {
    const response = await this.get<CiWorkflow[]>(
      `/v1/ciProducts/${productId}/workflows`,
      {
        ...(limit ? { limit: String(limit) } : {}),
      },
    );

    return response.data;
  }

  /**
   * Fetch one workflow with repository and environment details.
   */
  async getById(
    workflowId: string,
  ): Promise<{
    included: WorkflowIncludedResource[];
    workflow: CiWorkflow;
  }> {
    const response = await this.get<CiWorkflow, WorkflowIncludedResource>(
      `/v1/ciWorkflows/${workflowId}`,
      {
        include: 'repository,xcodeVersion,macOsVersion',
      },
    );

    return {
      workflow: response.data,
      included: response.included ?? [],
    };
  }
}
