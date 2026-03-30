import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isFailureStatus,
  resolveBuildLocator,
  sortBuildRuns,
  validateBuildLocator,
} from '../src/utils/build-locator.js';
import type { AppStoreConnectClient } from '../src/api/client.js';
import type { CiBuildRun } from '../src/api/types.js';

const buildRuns: CiBuildRun[] = [
  createBuildRun('run-1', 1, 'SUCCEEDED', '2026-03-30T09:00:00Z'),
  createBuildRun('run-2', 2, 'FAILED', '2026-03-30T10:00:00Z'),
  createBuildRun('run-3', 3, 'ERRORED', '2026-03-30T11:00:00Z'),
];

test('validateBuildLocator accepts buildRunId only', () => {
  const locator = validateBuildLocator({
    buildRunId: 'xcode-cloud://build-run/run-123',
  });

  assert.deepEqual(locator, {
    buildRunId: 'run-123',
  });
});

test('validateBuildLocator accepts workflowId with build number', () => {
  const locator = validateBuildLocator({
    workflowId: 'xcode-cloud://workflow/wf-1',
    buildNumber: 42,
  });

  assert.deepEqual(locator, {
    workflowId: 'wf-1',
    buildNumber: 42,
  });
});

test('validateBuildLocator rejects mixed lookup modes', () => {
  assert.throws(
    () =>
      validateBuildLocator({
        buildRunId: 'run-1',
        workflowId: 'wf-1',
      }),
    {
      message:
        'Provide either buildRunId or workflowId with buildNumber/buildSelector, not both.',
    },
  );
});

test('sortBuildRuns returns newest build first', () => {
  assert.deepEqual(
    sortBuildRuns(buildRuns).map((buildRun) => buildRun.id),
    ['run-3', 'run-2', 'run-1'],
  );
});

test('resolveBuildLocator resolves a concrete build number', async () => {
  const client = createClientMock();

  const buildRun = await resolveBuildLocator(client, {
    workflowId: 'wf-1',
    buildNumber: 2,
  });

  assert.equal(buildRun.id, 'run-2');
});

test('resolveBuildLocator resolves latest failing build', async () => {
  const client = createClientMock();

  const buildRun = await resolveBuildLocator(client, {
    workflowId: 'wf-1',
    buildSelector: 'latestFailing',
  });

  assert.equal(buildRun.id, 'run-3');
});

test('isFailureStatus matches failed and errored runs only', () => {
  assert.equal(isFailureStatus('FAILED'), true);
  assert.equal(isFailureStatus('ERRORED'), true);
  assert.equal(isFailureStatus('SUCCEEDED'), false);
  assert.equal(isFailureStatus('CANCELED'), false);
});

function createClientMock(): AppStoreConnectClient {
  return {
    builds: {
      getById: async (buildRunId: string) =>
        buildRuns.find((buildRun) => buildRun.id === buildRunId)!,
      listForWorkflow: async () => buildRuns,
    },
  } as unknown as AppStoreConnectClient;
}

function createBuildRun(
  id: string,
  number: number,
  completionStatus: CiBuildRun['attributes']['completionStatus'],
  createdDate: string,
): CiBuildRun {
  return {
    id,
    type: 'ciBuildRuns',
    attributes: {
      number,
      createdDate,
      executionProgress: 'COMPLETE',
      completionStatus,
      isPullRequestBuild: false,
      issueCounts: {
        analyzerWarnings: 0,
        errors: completionStatus === 'SUCCEEDED' ? 0 : 1,
        testFailures: completionStatus === 'SUCCEEDED' ? 0 : 2,
        warnings: 1,
      },
    },
    relationships: {
      workflow: {
        data: {
          type: 'ciWorkflows',
          id: 'wf-1',
        },
      },
    },
  };
}
