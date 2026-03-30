import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppStoreConnectClient } from '../api/client.js';
import { parseIdentifier } from '../utils/identifiers.js';
import { errorResponse, jsonResponse } from '../utils/tool-response.js';

/**
 * Register discovery tools.
 */
export function registerDiscoveryTools(
  server: McpServer,
  client: AppStoreConnectClient,
): void {
  server.registerTool(
    'list_products',
    {
      description:
        'List Xcode Cloud products available to the configured App Store Connect account.',
      inputSchema: {
        limit: z.number().int().positive().max(200).optional(),
      },
    },
    async ({ limit }: { limit?: number }) => {
      try {
        const products = await client.products.list(limit);

        return jsonResponse({
          products: products.map((product) => ({
            id: product.id,
            name: product.attributes.name,
            productType: product.attributes.productType,
            createdDate: product.attributes.createdDate,
          })),
        });
      } catch (error) {
        return errorResponse(error);
      }
    },
  );

  server.registerTool(
    'list_workflows',
    {
      description: 'List workflows for a given Xcode Cloud product.',
      inputSchema: {
        productId: z.string(),
        limit: z.number().int().positive().max(200).optional(),
      },
    },
    async ({ productId, limit }: { productId: string; limit?: number }) => {
      try {
        const workflows = await client.workflows.listForProduct(
          parseIdentifier(productId, 'product'),
          limit,
        );

        return jsonResponse({
          workflows: workflows.map((workflow) => ({
            id: workflow.id,
            name: workflow.attributes.name,
            description: workflow.attributes.description,
            isEnabled: workflow.attributes.isEnabled,
            clean: workflow.attributes.clean,
            containerFilePath: workflow.attributes.containerFilePath,
            lastModifiedDate: workflow.attributes.lastModifiedDate,
          })),
        });
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
