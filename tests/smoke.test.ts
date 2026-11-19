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
    'cleanup_saved_logs',
    'configure_manual_release_candidate',
    'get_build_issues',
    'get_build_logs',
    'get_build_run_testflight_builds',
    'get_failed_tests',
    'get_test_artifacts',
    'get_test_results',
    'get_workflow_details',
    'list_build_runs',
    'list_products',
    'list_workflows',
    'materialize_build_logs',
    'set_workflow_enabled',
    'start_build',
    'update_workflow_actions',
    'update_workflow_general',
    'update_workflow_start_conditions',
  ]);

  const invalidPreset = await client.callTool({
    name: 'configure_manual_release_candidate',
    arguments: { workflowId: 'workflow-1', scheme: 'App', branch: 'main', buildDistributionAudience: null },
  });
  assert.equal(invalidPreset.isError, true);
  const invalidAction = await client.callTool({
    name: 'update_workflow_actions',
    arguments: { workflowId: 'workflow-1', actions: [{ name: 'Archive', actionType: 'ARCHIVE', buildDistributionAudience: 'TYPO' }] },
  });
  assert.equal(invalidAction.isError, true);
  const invalidStart = await client.callTool({
    name: 'start_build',
    arguments: { workflowId: '   ' },
  });
  assert.equal(invalidStart.isError, true);
  const unexpectedStartInput = await client.callTool({
    name: 'start_build',
    arguments: { workflowId: 'workflow-1', unexpected: true },
  });
  assert.equal(unexpectedStartInput.isError, true);

  const lookupTool = tools.tools.find((tool) => tool.name === 'get_build_run_testflight_builds');
  assert.equal(lookupTool?.annotations?.readOnlyHint, true);
  assert.equal(lookupTool?.outputSchema?.type, 'object');
  const lookupArguments = {
    buildRunId: 'run-1',
    workflowId: 'workflow-1',
    appId: 'app-1',
    platforms: ['IOS', 'TV_OS'],
  };
  for (const invalidArguments of [
    { ...lookupArguments, expectedSourceRef: 'refs/heads/main' },
    { ...lookupArguments, expectedSourceCommitSha: 'deadbeef' },
    { ...lookupArguments, expectedSourceCommitSha: 'a'.repeat(40) },
    { ...lookupArguments, platforms: ['IOS', 'IOS'] },
    { ...lookupArguments, platforms: ['TVOS'] },
    { ...lookupArguments, platforms: [] },
  ]) {
    const invalidLookup = await client.callTool({
      name: 'get_build_run_testflight_builds',
      arguments: invalidArguments,
    });
    assert.equal(invalidLookup.isError, true);
    assert.match(JSON.stringify(invalidLookup.content), /Input validation error/);
  }

  await client.close();
});
