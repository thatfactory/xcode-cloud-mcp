import test from 'node:test';
import assert from 'node:assert/strict';
import type { AppStoreConnectClient } from '../src/api/client.js';
import type {
  CiArtifact,
  CiBuildAction,
  CiBuildRun,
  CiProduct,
  CiWorkflow,
} from '../src/api/types.js';
import { registerBuildRunTools } from '../src/tools/build-runs.js';
import { registerDiscoveryTools } from '../src/tools/discovery.js';
import { registerResultTools } from '../src/tools/results.js';
import { registerTestTools } from '../src/tools/tests.js';

type ToolHandler = (
  arguments_: Record<string, unknown>,
) => Promise<{
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}>;

test('registered tools expose product, workflow, and build data', async () => {
  const registry = new Map<string, ToolHandler>();
  const server = {
    registerTool: (
      name: string,
      _config: unknown,
      callback: ToolHandler,
    ): void => {
      registry.set(name, callback);
    },
  };

  const product: CiProduct = {
    id: 'product-1',
    type: 'ciProducts',
    attributes: {
      name: 'Demo App',
      createdDate: '2026-03-30T10:00:00Z',
      productType: 'APP',
    },
  };

  const workflow: CiWorkflow = {
    id: 'workflow-1',
    type: 'ciWorkflows',
    attributes: {
      name: 'CI',
      description: 'Build and test',
      isEnabled: true,
      clean: false,
      containerFilePath: 'Demo.xcodeproj',
      lastModifiedDate: '2026-03-30T11:00:00Z',
    },
  };

  const buildRun: CiBuildRun = {
    id: 'build-1',
    type: 'ciBuildRuns',
    attributes: {
      number: 42,
      createdDate: '2026-03-30T12:00:00Z',
      executionProgress: 'COMPLETE',
      completionStatus: 'FAILED',
      isPullRequestBuild: false,
      issueCounts: {
        analyzerWarnings: 0,
        errors: 1,
        testFailures: 2,
        warnings: 1,
      },
    },
    relationships: {
      workflow: {
        data: {
          type: 'ciWorkflows',
          id: 'workflow-1',
        },
      },
    },
  };

  const logArtifact = createArtifact('artifact-1', 'build.log', 'LOG');
  const screenshotArtifact = createArtifact(
    'artifact-2',
    'screenshot.png',
    'SCREENSHOT',
  );
  const buildAction: CiBuildAction = {
    id: 'action-1',
    type: 'ciBuildActions',
    attributes: {
      actionType: 'TEST',
      executionProgress: 'COMPLETE',
      name: 'Tests',
      completionStatus: 'FAILED',
      isRequiredToPass: true,
    },
  };

  const client = {
    products: {
      list: async () => [product],
    },
    workflows: {
      listForProduct: async () => [workflow],
    },
    builds: {
      getById: async () => buildRun,
      listForWorkflow: async () => [buildRun],
      getActions: async () => [buildAction],
    },
    artifacts: {
      listForBuildAction: async () => ({
        logs: [logArtifact],
        archives: [],
        screenshots: [screenshotArtifact],
        videos: [],
        resultBundles: [],
        testProducts: [],
        other: [],
      }),
      downloadArtifact: async () =>
        new TextEncoder().encode('warning: watch out\nerror: broken'),
    },
  } as unknown as AppStoreConnectClient;

  registerDiscoveryTools(server as never, client);
  registerBuildRunTools(server as never, client);
  registerResultTools(server as never, client);
  registerTestTools(server as never, client);

  const listProducts = registry.get('list_products');
  const listBuildRuns = registry.get('list_build_runs');
  const getBuildLogs = registry.get('get_build_logs');
  const materializeBuildLogs = registry.get('materialize_build_logs');
  const getFailedTests = registry.get('get_failed_tests');
  const getTestArtifacts = registry.get('get_test_artifacts');
  const cleanupSavedLogs = registry.get('cleanup_saved_logs');

  assert.ok(listProducts);
  assert.ok(listBuildRuns);
  assert.ok(getBuildLogs);
  assert.ok(materializeBuildLogs);
  assert.ok(getFailedTests);
  assert.ok(getTestArtifacts);
  assert.ok(cleanupSavedLogs);

  const productsPayload = parsePayload(await listProducts!({}));
  const buildsPayload = parsePayload(
    await listBuildRuns!({ workflowId: 'workflow-1' }),
  );
  const logsPayload = parsePayload(
    await getBuildLogs!({ workflowId: 'workflow-1', buildSelector: 'latest' }),
  );
  const materializedLogsPayload = parsePayload(
    await materializeBuildLogs!({
      workflowId: 'workflow-1',
      buildSelector: 'latest',
    }),
  );
  const failedTestsPayload = parsePayload(
    await getFailedTests!({
      workflowId: 'workflow-1',
      buildSelector: 'latest',
    }),
  );
  const artifactsPayload = parsePayload(
    await getTestArtifacts!({
      workflowId: 'workflow-1',
      buildSelector: 'latest',
    }),
  );
  const cleanupPayload = parsePayload(await cleanupSavedLogs!({ maxAgeHours: 1 }));

  assert.equal(productsPayload.products[0].id, 'product-1');
  assert.equal(buildsPayload.buildRuns[0].number, 42);
  assert.equal(logsPayload.summary.errorHighlightCount, 1);
  assert.equal(Array.isArray(materializedLogsPayload.savedLogs), true);
  assert.equal(Array.isArray(failedTestsPayload.failedTests), true);
  assert.equal(artifactsPayload.screenshots[0].id, 'artifact-2');
  assert.equal(Array.isArray(cleanupPayload.removedDirectories), true);
});

function parsePayload(result: {
  content: Array<{ type: string; text: string }>;
}): any {
  assert.equal(result.content[0]?.type, 'text');
  return JSON.parse(result.content[0]!.text);
}

function createArtifact(
  id: string,
  fileName: string,
  fileType: CiArtifact['attributes']['fileType'],
): CiArtifact {
  return {
    id,
    type: 'ciArtifacts',
    attributes: {
      fileName,
      fileType,
      downloadUrl: `https://example.com/${id}`,
      fileSize: 100,
    },
  };
}
