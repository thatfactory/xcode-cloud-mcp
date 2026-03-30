import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppStoreConnectClient } from '../api/client.js';
import type { CiArtifact } from '../api/types.js';
import {
  resolveBuildLocator,
  type BuildSelector,
} from '../utils/build-locator.js';
import { collectBuildRunArtifacts } from '../utils/build-artifacts.js';
import { summarizeLogTexts } from '../utils/log-analysis.js';
import {
  cleanupSavedLogs,
  removeSavedLogsForBuildRun,
  storeLogArtifacts,
} from '../utils/log-storage.js';
import { errorResponse, jsonResponse } from '../utils/tool-response.js';

interface BuildLookupInput {
  buildRunId?: string;
  workflowId?: string;
  buildNumber?: number;
  buildSelector?: BuildSelector;
}

/**
 * Register build issue and log tools.
 */
export function registerResultTools(
  server: McpServer,
  client: AppStoreConnectClient,
): void {
  server.registerTool(
    'get_build_issues',
    {
      description:
        'Resolve a build and return build identity plus issue counts from Xcode Cloud.',
      inputSchema: buildLookupSchema(),
    },
    async (input: BuildLookupInput) => {
      try {
        const buildRun = await resolveBuildLocator(client, input);

        return jsonResponse({
          buildRun: formatBuildRun(buildRun),
          issueCounts: buildRun.attributes.issueCounts ?? defaultIssueCounts(),
        });
      } catch (error) {
        return errorResponse(error);
      }
    },
  );

  server.registerTool(
    'get_build_logs',
    {
      description:
        'Resolve a build, download text-like log artifacts, save them under a temporary local directory, and return a compact summary with failed tests, highlights, and saved log paths that local agents can inspect with grep or cat.',
      inputSchema: {
        ...buildLookupSchema(),
        maxCharacters: z.number().int().positive().max(100_000).optional(),
      },
    },
    async (input: BuildLookupInput & { maxCharacters?: number }) => {
      try {
        const buildRun = await resolveBuildLocator(client, input);
        const groupedArtifacts = await collectBuildRunArtifacts(client, buildRun.id);
        const maxCharacters = Math.min(input.maxCharacters ?? 2000, 4000);
        const storedLogs = await storeLogArtifacts(
          client,
          buildRun.id,
          groupedArtifacts.logs,
        );
        const logSummary = summarizeLogTexts(
          storedLogs.parsedLogTexts,
          maxCharacters,
        );

        return jsonResponse({
          buildRun: formatBuildRun(buildRun),
          issueCounts: buildRun.attributes.issueCounts ?? defaultIssueCounts(),
          artifacts: groupedArtifacts.logs.map(formatArtifact),
          savedLogsDirectory: storedLogs.directoryPath,
          savedLogs: storedLogs.savedLogFiles,
          summary: logSummary.summary,
          failedTests: logSummary.failedTests,
          highlights: logSummary.highlights,
          excerpt: logSummary.excerpt,
        });
      } catch (error) {
        return errorResponse(error);
      }
    },
  );

  server.registerTool(
    'materialize_build_logs',
    {
      description:
        'Resolve a build, download and extract text-like log artifacts into a local temporary directory, and return saved file paths for grep or cat based investigation.',
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

        return jsonResponse({
          buildRun: formatBuildRun(buildRun),
          artifacts: groupedArtifacts.logs.map(formatArtifact),
          savedLogsDirectory: storedLogs.directoryPath,
          savedLogs: storedLogs.savedLogFiles,
        });
      } catch (error) {
        return errorResponse(error);
      }
    },
  );

  server.registerTool(
    'cleanup_saved_logs',
    {
      description:
        'Remove saved local log directories either for one build run or for all directories older than a retention window.',
      inputSchema: {
        buildRunId: z.string().optional(),
        maxAgeHours: z.number().positive().max(24 * 30).optional(),
      },
    },
    async ({
      buildRunId,
      maxAgeHours,
    }: {
      buildRunId?: string;
      maxAgeHours?: number;
    }) => {
      try {
        if (buildRunId) {
          const cleanupResult = await removeSavedLogsForBuildRun(buildRunId);

          return jsonResponse(cleanupResult);
        }

        const cleanupResult = await cleanupSavedLogs({ maxAgeHours });

        return jsonResponse(cleanupResult);
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

function defaultIssueCounts() {
  return {
    analyzerWarnings: 0,
    errors: 0,
    testFailures: 0,
    warnings: 0,
  };
}

function formatBuildRun(buildRun: Awaited<ReturnType<typeof resolveBuildLocator>>) {
  return {
    id: buildRun.id,
    workflowId: buildRun.relationships?.workflow?.data.id,
    number: buildRun.attributes.number,
    executionProgress: buildRun.attributes.executionProgress,
    completionStatus: buildRun.attributes.completionStatus,
    createdDate: buildRun.attributes.createdDate,
    startedDate: buildRun.attributes.startedDate,
    finishedDate: buildRun.attributes.finishedDate,
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
