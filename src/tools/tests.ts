import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppStoreConnectClient } from '../api/client.js';
import type { CiArtifact } from '../api/types.js';
import {
  resolveBuildLocator,
  type BuildSelector,
} from '../utils/build-locator.js';
import { collectBuildRunArtifacts } from '../utils/build-artifacts.js';
import {
  summarizeLogTexts,
} from '../utils/log-analysis.js';
import { storeLogArtifacts } from '../utils/log-storage.js';
import { errorResponse, jsonResponse } from '../utils/tool-response.js';

interface BuildLookupInput {
  buildRunId?: string;
  workflowId?: string;
  buildNumber?: number;
  buildSelector?: BuildSelector;
}

/**
 * Register test summary and artifact tools.
 */
export function registerTestTools(
  server: McpServer,
  client: AppStoreConnectClient,
): void {
  server.registerTool(
    'get_test_results',
    {
      description:
        'Resolve a build and return build-level test summary information plus result bundle metadata.',
      inputSchema: buildLookupSchema(),
    },
    async (input: BuildLookupInput) => {
      try {
        const buildRun = await resolveBuildLocator(client, input);
        const groupedArtifacts = await collectBuildRunArtifacts(client, buildRun.id);
        const storedLogs = await storeLogArtifacts(
          client,
          buildRun.id,
          groupedArtifacts.logs,
        );
        const logSummary = summarizeLogTexts(storedLogs.parsedLogTexts, 2000);

        return jsonResponse({
          buildRun: {
            id: buildRun.id,
            number: buildRun.attributes.number,
            workflowId: buildRun.relationships?.workflow?.data.id,
            completionStatus: buildRun.attributes.completionStatus,
          },
          issueCounts: buildRun.attributes.issueCounts ?? {
            analyzerWarnings: 0,
            errors: 0,
            testFailures: 0,
            warnings: 0,
          },
          resultBundles: groupedArtifacts.resultBundles.map(formatArtifact),
          savedLogsDirectory: storedLogs.directoryPath,
          savedLogs: storedLogs.savedLogFiles,
          summary: {
            parsedLogArtifactCount: logSummary.summary.parsedArtifactCount,
            errorHighlightCount: logSummary.summary.errorHighlightCount,
            warningHighlightCount: logSummary.summary.warningHighlightCount,
          },
          failedTests: logSummary.failedTests,
          highlights: logSummary.highlights,
        });
      } catch (error) {
        return errorResponse(error);
      }
    },
  );

  server.registerTool(
    'get_test_artifacts',
    {
      description:
        'Resolve a build and return metadata plus download URLs for UI test artifacts and result bundles.',
      inputSchema: buildLookupSchema(),
    },
    async (input: BuildLookupInput) => {
      try {
        const buildRun = await resolveBuildLocator(client, input);
        const groupedArtifacts = await collectBuildRunArtifacts(client, buildRun.id);

        return jsonResponse({
          buildRun: {
            id: buildRun.id,
            number: buildRun.attributes.number,
            workflowId: buildRun.relationships?.workflow?.data.id,
          },
          screenshots: groupedArtifacts.screenshots.map(formatArtifact),
          videos: groupedArtifacts.videos.map(formatArtifact),
          resultBundles: groupedArtifacts.resultBundles.map(formatArtifact),
          testProducts: groupedArtifacts.testProducts.map(formatArtifact),
        });
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}

function buildLookupSchema() {
  return {
    buildRunId: z.string().optional(),
    workflowId: z.string().optional(),
    buildNumber: z.number().int().positive().optional(),
    buildSelector: z.enum(['latest', 'latestFailing']).optional(),
  };
}

function formatArtifact(artifact: CiArtifact) {
  return {
    id: artifact.id,
    fileName: artifact.attributes.fileName,
    fileSize: artifact.attributes.fileSize,
    downloadUrl: artifact.attributes.downloadUrl,
  };
}
