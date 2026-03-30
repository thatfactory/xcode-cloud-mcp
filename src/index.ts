#!/usr/bin/env node

import 'dotenv/config';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { AuthManager } from './api/auth.js';
import { AppStoreConnectClient } from './api/client.js';
import { loadEnvironment } from './env.js';
import { registerBuildRunTools } from './tools/build-runs.js';
import { registerDiscoveryTools } from './tools/discovery.js';
import { registerResultTools } from './tools/results.js';
import { registerTestTools } from './tools/tests.js';

/**
 * Create and configure the MCP server.
 */
export function createServer(): McpServer {
  const environment = loadEnvironment();
  const auth = new AuthManager(environment);
  const client = new AppStoreConnectClient(auth);

  const server = new McpServer({
    name: 'Xcode Cloud MCP',
    version: '0.4.0',
  });

  registerDiscoveryTools(server, client);
  registerBuildRunTools(server, client);
  registerResultTools(server, client);
  registerTestTools(server, client);

  return server;
}

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Xcode Cloud MCP server started successfully');
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exit(1);
});
