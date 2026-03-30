import { BaseAPIClient } from '../base-client.js';
import type { CiWorkflow } from '../types.js';

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
}
