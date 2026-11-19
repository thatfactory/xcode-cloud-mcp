import { BaseAPIClient } from '../base-client.js';
import type {
  AppStoreBuild,
  CiBuildAction,
  CiBuildRun,
  CiBuildRunCreateRequest,
  CiBuildRunStartOptions,
  CiWorkflow,
  PrereleaseVersion,
  ScmGitReference,
} from '../types.js';

type BuildIncludedResource = PrereleaseVersion | { type: 'apps'; id: string };

const testFlightBuildFields = {
  include: 'app,preReleaseVersion',
  'fields[apps]': 'bundleId',
  'fields[builds]': 'version,expired,processingState,buildAudienceType,app,preReleaseVersion',
  'fields[preReleaseVersions]': 'platform,version',
};

/**
 * Build run endpoints.
 */
export class BuildsClient extends BaseAPIClient {
  static readonly buildLocatorScanLimit = 2000;

  /**
   * Start exactly one Xcode Cloud build run.
   */
  async start(options: CiBuildRunStartOptions): Promise<CiBuildRun> {
    const attributes: CiBuildRunCreateRequest['data']['attributes'] = {};
    if (options.clean !== undefined) {
      attributes.clean = options.clean;
    }

    const relationships: CiBuildRunCreateRequest['data']['relationships'] = {
      workflow: {
        data: {
          type: 'ciWorkflows',
          id: options.workflowId,
        },
      },
    };

    if (options.sourceBranchOrTagId !== undefined) {
      relationships.sourceBranchOrTag = {
        data: {
          type: 'scmGitReferences',
          id: options.sourceBranchOrTagId,
        },
      };
    }

    if (options.pullRequestId !== undefined) {
      relationships.pullRequest = {
        data: {
          type: 'scmPullRequests',
          id: options.pullRequestId,
        },
      };
    }

    if (options.buildRunId !== undefined) {
      relationships.buildRun = {
        data: {
          type: 'ciBuildRuns',
          id: options.buildRunId,
        },
      };
    }

    const request: CiBuildRunCreateRequest = {
      data: {
        type: 'ciBuildRuns',
        attributes,
        relationships,
      },
    };
    const response = await this.post<CiBuildRun, CiBuildRunCreateRequest>(
      '/v1/ciBuildRuns',
      request,
    );

    return response.data;
  }

  /**
   * Get a build run by id.
   */
  async getById(buildRunId: string): Promise<CiBuildRun> {
    const response = await this.get<CiBuildRun>(`/v1/ciBuildRuns/${buildRunId}`);
    return response.data;
  }

  /** Read the workflow and source linkage alongside the exact build run. */
  async getWithProvenance(buildRunId: string) {
    return this.get<CiBuildRun, CiWorkflow | ScmGitReference>(
      `/v1/ciBuildRuns/${encodeURIComponent(buildRunId)}`,
      { include: 'workflow,sourceBranchOrTag' },
    );
  }

  async getGitReference(referenceId: string): Promise<ScmGitReference> {
    const response = await this.get<ScmGitReference>(
      `/v1/scmGitReferences/${encodeURIComponent(referenceId)}`,
    );
    return response.data;
  }

  /** Scan a bounded number of runs with their source references. */
  async listWithProvenance(workflowId: string, scanLimit: number) {
    return this.listAllWithIncluded<CiBuildRun, ScmGitReference>(
      `/v1/ciWorkflows/${encodeURIComponent(workflowId)}/buildRuns`,
      { include: 'sourceBranchOrTag', sort: '-number', limit: String(Math.min(scanLimit, 200)) },
      scanLimit,
    );
  }

  /** Read only the App Store Connect builds explicitly linked to this run. */
  async listLinkedBuilds(buildRunId: string) {
    return this.listAllWithIncluded<AppStoreBuild, BuildIncludedResource>(
      `/v1/ciBuildRuns/${encodeURIComponent(buildRunId)}/builds`,
      { ...testFlightBuildFields, limit: '200' },
    );
  }

  /** Hydrate an exact linked build when the run endpoint omits build evidence. */
  async getLinkedBuildDetails(buildId: string) {
    return this.get<AppStoreBuild, BuildIncludedResource>(
      `/v1/builds/${encodeURIComponent(buildId)}`,
      testFlightBuildFields,
    );
  }

  /**
   * List build runs for a workflow, paginating through all results.
   * Optionally limit the total number of build runs returned.
   */
  async listForWorkflow(workflowId: string, limit?: number): Promise<CiBuildRun[]> {
    return this.listAll<CiBuildRun>(
      `/v1/ciWorkflows/${workflowId}/buildRuns`,
      { limit: '200' },
      limit,
    );
  }

  /**
   * Find a build run with a specific build number for a workflow.
   */
  async findByNumberForWorkflow(
    workflowId: string,
    buildNumber: number,
    maxItems: number = BuildsClient.buildLocatorScanLimit,
  ): Promise<CiBuildRun | undefined> {
    return this.findInList<CiBuildRun>(
      `/v1/ciWorkflows/${workflowId}/buildRuns`,
      (buildRun) => buildRun.attributes.number === buildNumber,
      { limit: '200' },
      maxItems,
    );
  }

  /**
   * Find the latest failing build run for a workflow.
   */
  async findLatestFailingForWorkflow(
    workflowId: string,
    maxItems: number = BuildsClient.buildLocatorScanLimit,
  ): Promise<CiBuildRun | undefined> {
    return this.findInList<CiBuildRun>(
      `/v1/ciWorkflows/${workflowId}/buildRuns`,
      (buildRun) =>
        buildRun.attributes.completionStatus === 'FAILED' ||
        buildRun.attributes.completionStatus === 'ERRORED',
      { limit: '200' },
      maxItems,
    );
  }

  /**
   * List build actions for a build run.
   */
  async getActions(buildRunId: string): Promise<CiBuildAction[]> {
    const response = await this.get<CiBuildAction[]>(
      `/v1/ciBuildRuns/${buildRunId}/actions`,
    );

    return response.data;
  }
}
