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

const identifierSchema = z.string().trim().min(1);

/**
 * Register build run listing tools.
 */
export function registerBuildRunTools(
  server: McpServer,
  client: AppStoreConnectClient,
): void {
  server.registerTool(
    'start_build',
    {
      title: 'Start Xcode Cloud Build',
      description:
        "Start exactly one new Xcode Cloud build through Apple's public App Store Connect API. Each successful invocation creates a new build run, and repeating the same call can create another build. Individual build-run cancellation is not supported by Apple's public API.",
      inputSchema: {
        workflowId: identifierSchema,
        clean: z
          .boolean()
          .optional()
          .describe('Override clean-build behavior for this run only.'),
        sourceBranchOrTagId: identifierSchema
          .optional()
          .describe(
            'App Store Connect scmGitReferences resource ID, not a branch or tag name.',
          ),
        pullRequestId: identifierSchema
          .optional()
          .describe(
            'App Store Connect scmPullRequests resource ID, not a pull-request number.',
          ),
        buildRunId: identifierSchema
          .optional()
          .describe(
            'Optional prior build-run ID or xcode-cloud://build-run URI.',
          ),
      },
      annotations: {
        readOnlyHint: false,
        idempotentHint: false,
        openWorldHint: true,
        destructiveHint: false,
      },
    },
    async ({
      workflowId,
      clean,
      sourceBranchOrTagId,
      pullRequestId,
      buildRunId,
    }: {
      workflowId: string;
      clean?: boolean;
      sourceBranchOrTagId?: string;
      pullRequestId?: string;
      buildRunId?: string;
    }) => {
      try {
        const parsedWorkflowId = parseIdentifier(workflowId, 'workflow');
        const buildRun = await client.builds.start({
          workflowId: parsedWorkflowId,
          clean,
          sourceBranchOrTagId,
          pullRequestId,
          buildRunId:
            buildRunId === undefined
              ? undefined
              : parseIdentifier(buildRunId, 'build-run'),
        });

        return jsonResponse({
          operation: {
            type: 'start_build',
            applied: true,
          },
          buildRun: {
            id: buildRun.id,
            workflowId:
              buildRun.relationships?.workflow?.data.id ?? parsedWorkflowId,
            number: buildRun.attributes.number,
            executionProgress: buildRun.attributes.executionProgress,
            completionStatus: buildRun.attributes.completionStatus,
            createdDate: buildRun.attributes.createdDate,
            startedDate: buildRun.attributes.startedDate,
            finishedDate: buildRun.attributes.finishedDate,
            isPullRequestBuild: buildRun.attributes.isPullRequestBuild,
            sourceCommit: buildRun.attributes.sourceCommit,
          },
        });
      } catch (error) {
        return errorResponse(error);
      }
    },
  );

  server.registerTool(
    'list_build_runs',
    {
      description:
        'List recent build runs for a workflow, optionally filtered by outcome. Automatically paginates through build runs. Use limit to cap the number of results returned.',
      inputSchema: {
        workflowId: z.string(),
        status: z.enum(['all', 'failed', 'pending', 'running', 'succeeded']).optional(),
        limit: z.number().int().min(1).max(500).optional().describe('Maximum number of build runs to return. Defaults to 20 if not specified.'),
      },
    },
    async ({
      workflowId,
      status,
      limit,
    }: {
      workflowId: string;
      status?: BuildRunStatusFilter;
      limit?: number;
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
