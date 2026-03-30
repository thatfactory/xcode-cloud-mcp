import { BaseAPIClient } from '../base-client.js';
import type { CiProduct } from '../types.js';

/**
 * Product endpoints.
 */
export class ProductsClient extends BaseAPIClient {
  /**
   * List Xcode Cloud products.
   */
  async list(limit?: number): Promise<CiProduct[]> {
    const response = await this.get<CiProduct[]>('/v1/ciProducts', {
      ...(limit ? { limit: String(limit) } : {}),
    });

    return response.data;
  }
}
