import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppStoreConnectClient } from '../api/client.js';
import type { CiBuildRun } from '../api/types.js';
import { buildPlatforms } from '../api/types.js';
import { parseIdentifier } from '../utils/identifiers.js';
import {
  isFailureStatus,
  sortBuildRuns,
} from '../utils/build-locator.js';
import { errorResponse, jsonResponse } from '../utils/tool-response.js';
import {
  buildRunProvenance,
  fullCommitSha,
  getBuildRunTestFlightBuilds,
  testFlightBuildLookupOutput,
} from '../utils/testflight-builds.js';

type BuildRunStatusFilter = 'all' | 'failed' | 'pending' | 'running' | 'succeeded';

const identifierSchema = z.string().trim().min(1);
const commitShaSchema = z.string().trim().regex(fullCommitSha, 'Provide a full Git commit SHA.');
const readOnlyAnnotations = { readOnlyHint: true, idempotentHint: true, openWorldHint: true };

/**
 * Register build run tools.
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
              buildRun.relationships?.workflow?.data?.id ?? parsedWorkflowId,
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
        'Scan recent build runs for a workflow with source provenance. Optionally filter by outcome and full source commit SHA. The scan reports whether additional runs remain beyond the limit.',
      inputSchema: {
        workflowId: z.string(),
        status: z.enum(['all', 'failed', 'pending', 'running', 'succeeded']).optional(),
        limit: z.number().int().min(1).max(500).optional().describe('Maximum number of runs scanned before filtering. Defaults to 20.'),
        sourceCommitSha: commitShaSchema.optional(),
      },
      annotations: readOnlyAnnotations,
    },
    async ({ workflowId, status, limit, sourceCommitSha }) => {
      try {
        const parsedWorkflowId = parseIdentifier(workflowId, 'workflow');
        const { data, included, hasMore } = await client.builds.listWithProvenance(parsedWorkflowId, limit ?? 20);
        const provenance = new Map(data.map((run) => [run.id, buildRunProvenance(run, included)]));
        const expectedSha = sourceCommitSha?.toLowerCase();
        const buildRuns = filterBuildRuns(sortBuildRuns(data), status ?? 'all')
          .filter((run) => !expectedSha || provenance.get(run.id)?.sourceCommitSha?.toLowerCase() === expectedSha);

        return jsonResponse({
          buildRuns: buildRuns.map((buildRun) => ({
            id: buildRun.id,
            workflowId: buildRun.relationships?.workflow?.data?.id ?? parsedWorkflowId,
            number: buildRun.attributes.number,
            executionProgress: buildRun.attributes.executionProgress,
            completionStatus: buildRun.attributes.completionStatus,
            createdDate: buildRun.attributes.createdDate,
            startedDate: buildRun.attributes.startedDate,
            finishedDate: buildRun.attributes.finishedDate,
            issueCounts: buildRun.attributes.issueCounts,
            ...provenance.get(buildRun.id),
          })),
          scan: {
            scannedCount: data.length,
            hasMore,
            unverifiedSourceCount: data.filter((run) => !provenance.get(run.id)?.sourceCommitSha).length,
          },
        });
      } catch (error) {
        return errorResponse(error);
      }
    },
  );

  server.registerTool(
    'get_build_run_testflight_builds',
    {
      title: 'Resolve TestFlight Builds from an Xcode Cloud Run',
      description:
        'Verify an exact run, workflow and App Store Connect app, then look up the externally eligible builds linked to the run. For automatic handoff, supply both the expected canonical branch ref and full source commit SHA. Use build IDs only when the overall status is ready.',
      inputSchema: z.strictObject({
        buildRunId: identifierSchema.describe('Exact run ID or xcode-cloud://build-run URI.'),
        workflowId: identifierSchema.describe('Expected workflow ID or xcode-cloud://workflow URI.'),
        appId: identifierSchema.describe('Expected App Store Connect app resource ID.'),
        platforms: z.array(z.enum(buildPlatforms)).min(1).max(buildPlatforms.length)
          .refine((platforms) => new Set(platforms).size === platforms.length, 'Requested platforms must be distinct.'),
        expectedSourceRef: z.string().trim().regex(/^refs\/heads\/.+$/).optional(),
        expectedSourceCommitSha: commitShaSchema.optional(),
      }).refine(
        ({ expectedSourceRef, expectedSourceCommitSha }) =>
          (expectedSourceRef === undefined) === (expectedSourceCommitSha === undefined),
        'Provide both expectedSourceRef and expectedSourceCommitSha for branch verification.',
      ),
      outputSchema: testFlightBuildLookupOutput,
      annotations: readOnlyAnnotations,
    },
    async (input) => {
      try {
        const buildRunId = parseIdentifier(input.buildRunId, 'build-run');
        const workflowId = parseIdentifier(input.workflowId, 'workflow');
        if ([buildRunId, workflowId].some((id) => !id.trim() || id === '.' || id === '..')) {
          throw new Error('Provide exact build run and workflow resource IDs.');
        }
        const result = await getBuildRunTestFlightBuilds(client.builds, {
          ...input,
          buildRunId,
          workflowId,
        });
        return { ...jsonResponse(result), structuredContent: result };
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
