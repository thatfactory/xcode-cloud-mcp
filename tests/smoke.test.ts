import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('server starts over stdio and exposes the expected tools', async () => {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['--import', 'tsx', 'src/index.ts'],
    cwd: process.cwd(),
    env: {
      ...process.env,
      APPSTORE_CONNECT_API_KEY_ID: 'dummy-key-id',
      APPSTORE_CONNECT_API_ISSUER_ID: 'dummy-issuer-id',
      APPSTORE_CONNECT_API_KEY_CONTENT:
        '-----BEGIN PRIVATE KEY-----\\ndummy\\n-----END PRIVATE KEY-----',
    },
  });

  const client = new Client(
    {
      name: 'xcode-cloud-mcp-smoke-test',
      version: '0.1.0',
    },
    {
      capabilities: {},
    },
  );

  await client.connect(transport);
  const tools = await client.listTools();
  const toolNames = tools.tools.map((tool) => tool.name).sort();

  assert.deepEqual(toolNames, [
    'get_build_issues',
    'get_build_logs',
    'get_test_artifacts',
    'get_test_results',
    'list_build_runs',
    'list_products',
    'list_workflows',
  ]);

  await client.close();
});
