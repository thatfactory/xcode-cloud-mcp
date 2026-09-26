import test from 'node:test';
import assert from 'node:assert/strict';
import type { AppStoreConnectClient } from '../src/api/client.js';
import type { CiBuildRunStartOptions } from '../src/api/types.js';
import { registerBuildRunTools } from '../src/tools/build-runs.js';

type ToolResult = {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
};

type ToolHandler = (arguments_: Record<string, unknown>) => Promise<ToolResult>;

test('start_build supports a workflow-only request', async () => {
  const { startBuild, starts } = fixture();
  const payload = parsePayload(await startBuild({ workflowId: 'workflow-1' }));

  assert.deepEqual(starts, [
    {
      workflowId: 'workflow-1',
      clean: undefined,
      sourceBranchOrTagId: undefined,
      pullRequestId: undefined,
      buildRunId: undefined,
    },
  ]);
  assert.equal(payload.operation.type, 'start_build');
  assert.equal(payload.buildRun.id, 'created-build');
  assert.equal(payload.buildRun.workflowId, 'workflow-1');
});

test('start_build converts API failures to MCP errors', async () => {
  const { startBuild, starts } = fixture(new Error('API unavailable'));
  const result = await startBuild({ workflowId: 'workflow-1' });

  assert.equal(starts.length, 1);
  assert.equal(result.isError, true);
  assert.match(result.content[0]?.text ?? '', /API unavailable/);
});

function fixture(startError?: Error): {
  startBuild: ToolHandler;
  starts: CiBuildRunStartOptions[];
} {
  const registry = new Map<string, ToolHandler>();
  const starts: CiBuildRunStartOptions[] = [];
  const server = {
    registerTool: (
      name: string,
      _config: unknown,
      callback: ToolHandler,
    ): void => {
      registry.set(name, callback);
    },
  };
  const client = {
    builds: {
      start: async (options: CiBuildRunStartOptions) => {
        starts.push(options);
        if (startError !== undefined) {
          throw startError;
        }

        return {
          type: 'ciBuildRuns' as const,
          id: 'created-build',
          attributes: {
            number: 1,
            createdDate: '2026-09-26T12:00:00Z',
            executionProgress: 'PENDING' as const,
            isPullRequestBuild: false,
          },
        };
      },
      listForWorkflow: async () => [],
    },
  } as unknown as AppStoreConnectClient;

  registerBuildRunTools(server as never, client);
  const startBuild = registry.get('start_build');
  assert.ok(startBuild);

  return { startBuild, starts };
}

function parsePayload(result: ToolResult): any {
  assert.equal(result.isError, undefined);
  assert.equal(result.content[0]?.type, 'text');
  return JSON.parse(result.content[0]!.text);
}
