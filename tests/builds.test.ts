import test from 'node:test';
import assert from 'node:assert/strict';
import type { AuthManager } from '../src/api/auth.js';
import { BuildsClient } from '../src/api/resources/builds.js';
import type { CiBuildRun } from '../src/api/types.js';

const createdBuildRun: CiBuildRun = {
  type: 'ciBuildRuns',
  id: 'created-build',
  attributes: {
    number: 73,
    createdDate: '2026-09-26T12:00:00Z',
    executionProgress: 'PENDING',
    isPullRequestBuild: false,
  },
};

test('start creates one minimal build run request', async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), init });
    return Response.json({ data: createdBuildRun }, { status: 201 });
  };

  try {
    const client = new BuildsClient(fakeAuth(), 'https://example.com');
    const result = await client.start({ workflowId: 'workflow-1' });

    assert.equal(result.id, 'created-build');
    assert.equal(requests.length, 1);
    assert.equal(requests[0]?.url, 'https://example.com/v1/ciBuildRuns');
    assert.equal(requests[0]?.init?.method, 'POST');
    assert.deepEqual(JSON.parse(String(requests[0]?.init?.body)), {
      data: {
        type: 'ciBuildRuns',
        attributes: {},
        relationships: {
          workflow: {
            data: { type: 'ciWorkflows', id: 'workflow-1' },
          },
        },
      },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('start includes every optional input and preserves clean false', async () => {
  let requestBody: unknown;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body));
    return Response.json({ data: createdBuildRun }, { status: 201 });
  };

  try {
    const client = new BuildsClient(fakeAuth(), 'https://example.com');
    await client.start({
      workflowId: 'workflow-1',
      clean: false,
      sourceBranchOrTagId: 'reference-1',
      pullRequestId: 'pull-request-1',
      buildRunId: 'prior-build-1',
    });

    assert.deepEqual(requestBody, {
      data: {
        type: 'ciBuildRuns',
        attributes: { clean: false },
        relationships: {
          workflow: {
            data: { type: 'ciWorkflows', id: 'workflow-1' },
          },
          sourceBranchOrTag: {
            data: { type: 'scmGitReferences', id: 'reference-1' },
          },
          pullRequest: {
            data: { type: 'scmPullRequests', id: 'pull-request-1' },
          },
          buildRun: {
            data: { type: 'ciBuildRuns', id: 'prior-build-1' },
          },
        },
      },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('start reports Apple errors without retrying', async () => {
  let requestCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    requestCount += 1;
    return Response.json(
      {
        errors: [
          {
            status: '409',
            code: 'ENTITY_ERROR',
            title: 'Conflict',
            detail: 'The build cannot be started.',
          },
        ],
      },
      { status: 409 },
    );
  };

  try {
    const client = new BuildsClient(fakeAuth(), 'https://example.com');
    await assert.rejects(
      client.start({ workflowId: 'workflow-1' }),
      /API Error \(409\): Conflict: The build cannot be started\./,
    );
    assert.equal(requestCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function fakeAuth(): AuthManager {
  return {
    getToken: () => 'test-token',
  } as AuthManager;
}
