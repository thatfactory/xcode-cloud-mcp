import { BaseAPIClient } from '../base-client.js';
import type { CiProduct } from '../types.js';

/**
 * Product endpoints.
 */
export class ProductsClient extends BaseAPIClient {
  /**
   * List all Xcode Cloud products, paginating through all results.
   */
  async list(): Promise<CiProduct[]> {
    return this.listAll<CiProduct>('/v1/ciProducts', { limit: '200' });
  }
}