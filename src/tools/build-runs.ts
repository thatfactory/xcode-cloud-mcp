import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppStoreConnectClient } from '../api/client.js';
import type { CiBuildRun } from '../api/types.js';
import { parseIdentifier } from '../utils/identifiers.js';
import {
  isFailureStatus,
  sortBuildRuns,
} from '../utils/build-locator.js';
import { errorResponse, jsonResponse } from '../utils/tool-response.js';

type BuildRunStatusFilter = 'all' | 'failed' | 'pending' | 'running' | 'succeeded';

/**
 * Register build run listing tools.
 */
export function registerBuildRunTools(
  server: McpServer,
  client: AppStoreConnectClient,
): void {
  server.registerTool(
    'list_build_runs',
    {
      description:
        'List recent build runs for a workflow, optionally filtered by outcome.',
      inputSchema: {
        workflowId: z.string(),
        limit: z.number().int().positive().max(200).optional(),
        status: z.enum(['all', 'failed', 'pending', 'running', 'succeeded']).optional(),
      },
    },
    async ({
      workflowId,
      limit,
      status,
    }: {
      workflowId: string;
      limit?: number;
      status?: BuildRunStatusFilter;
    }) => {
      try {
        const buildRuns = sortBuildRuns(
          await client.builds.listForWorkflow(
            parseIdentifier(workflowId, 'workflow'),
            limit ?? 20,
          ),
        );

        return jsonResponse({
          buildRuns: filterBuildRuns(buildRuns, status ?? 'all').map(
            (buildRun) => ({
              id: buildRun.id,
              workflowId:
                buildRun.relationships?.workflow?.data.id ??
                parseIdentifier(workflowId, 'workflow'),
              number: buildRun.attributes.number,
              executionProgress: buildRun.attributes.executionProgress,
              completionStatus: buildRun.attributes.completionStatus,
              createdDate: buildRun.attributes.createdDate,
              startedDate: buildRun.attributes.startedDate,
              finishedDate: buildRun.attributes.finishedDate,
              issueCounts: buildRun.attributes.issueCounts,
            }),
          ),
        });
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}

function filterBuildRuns(
  buildRuns: CiBuildRun[],
  status: BuildRunStatusFilter,
): CiBuildRun[] {
  if (status === 'all') {
    return buildRuns;
  }

  if (status === 'failed') {
    return buildRuns.filter((buildRun) =>
      isFailureStatus(buildRun.attributes.completionStatus),
    );
  }

  if (status === 'pending') {
    return buildRuns.filter(
      (buildRun) => buildRun.attributes.executionProgress === 'PENDING',
    );
  }

  if (status === 'running') {
    return buildRuns.filter(
      (buildRun) => buildRun.attributes.executionProgress === 'RUNNING',
    );
  }

  return buildRuns.filter(
    (buildRun) => buildRun.attributes.completionStatus === 'SUCCEEDED',
  );
}
