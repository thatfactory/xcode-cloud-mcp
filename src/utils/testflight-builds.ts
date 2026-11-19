import { z } from 'zod';
import type { BuildsClient } from '../api/resources/builds.js';
import { buildPlatforms } from '../api/types.js';
import type {
  AppStoreBuild,
  BuildPlatform,
  CiBuildRun,
  PrereleaseVersion,
  ScmGitReference,
} from '../api/types.js';

export const fullCommitSha = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i;

export function sourceRefId(run: CiBuildRun): string | null {
  const reference = run.relationships?.sourceBranchOrTag?.data;
  return reference?.type === 'scmGitReferences' && reference.id ? reference.id : null;
}

export function buildRunProvenance(
  run: CiBuildRun,
  included: ReadonlyArray<{ type: string; id: string } | ScmGitReference>,
) {
  const referenceId = sourceRefId(run);
  const reference = included.find(
    (resource): resource is ScmGitReference =>
      resource.type === 'scmGitReferences' && resource.id === referenceId,
  );
  const { canonicalName, kind } = reference?.attributes ?? {};
  const prefix = kind === 'BRANCH' ? 'refs/heads/' : kind === 'TAG' ? 'refs/tags/' : null;
  const sourceRef = prefix && canonicalName?.startsWith(prefix) && canonicalName.length > prefix.length
    ? canonicalName
    : null;
  const sha = run.attributes?.sourceCommit?.commitSha;

  return {
    sourceCommitSha: sha && fullCommitSha.test(sha) ? sha : null,
    sourceRef,
    sourceRefId: referenceId,
    sourceRefKind: sourceRef ? kind ?? null : null,
    isPullRequestBuild: run.attributes?.isPullRequestBuild ?? null,
    startReason: run.attributes?.startReason ?? null,
  };
}

interface LookupOptions {
  buildRunId: string;
  workflowId: string;
  appId: string;
  platforms: BuildPlatform[];
  expectedSourceRef?: string;
  expectedSourceCommitSha?: string;
}

const handoffStatus = z.enum(['ready', 'pending', 'blocked']);
const platformSchema = z.enum(buildPlatforms);

export const testFlightBuildLookupOutput = z.object({
  status: handoffStatus,
  buildRun: z.object({
    id: z.string(),
    workflowId: z.string(),
    executionProgress: z.string().nullable(),
    completionStatus: z.string().nullable(),
    sourceCommitSha: z.string().nullable(),
    sourceRef: z.string().nullable(),
    sourceRefId: z.string().nullable(),
    sourceRefKind: z.enum(['BRANCH', 'TAG']).nullable(),
    isPullRequestBuild: z.boolean().nullable(),
    startReason: z.string().nullable(),
  }),
  appId: z.string(),
  platforms: z.array(z.object({
    platform: platformSchema,
    status: handoffStatus,
    reasons: z.array(z.string()),
    build: z.object({
      id: z.string(),
      platform: platformSchema,
      marketingVersion: z.string(),
      buildNumber: z.string(),
      processingState: z.literal('VALID'),
      buildAudienceType: z.literal('APP_STORE_ELIGIBLE'),
      expired: z.literal(false),
    }).optional(),
  })),
});

type TestFlightBuildLookup = z.infer<typeof testFlightBuildLookupOutput>;
type PlatformResult = TestFlightBuildLookup['platforms'][number];
type BuildEvidence = NonNullable<PlatformResult['build']>;

type RunState =
  | { status: 'ready' }
  | { status: 'pending' | 'blocked'; reason: string };

type LinkedBuild =
  | { status: 'eligible'; platform: BuildPlatform; build: BuildEvidence }
  | {
    status: 'pending' | 'unverified' | 'ineligible';
    platform?: BuildPlatform;
    reason: string;
  };

/** Resolve a TestFlight handoff using the run's own App Store Connect relationships. */
export async function getBuildRunTestFlightBuilds(
  client: BuildsClient,
  options: LookupOptions,
): Promise<TestFlightBuildLookup> {
  const { buildRunId, workflowId, appId, platforms, expectedSourceRef, expectedSourceCommitSha } = options;
  const { data: run, included = [] } = await client.getWithProvenance(buildRunId);
  if (run.type !== 'ciBuildRuns' || run.id !== buildRunId) {
    throw new Error('App Store Connect returned a different build run than requested.');
  }
  const workflow = run.relationships?.workflow?.data;
  if (workflow?.type !== 'ciWorkflows' || workflow.id !== workflowId) {
    throw new Error('The build run does not link to the expected workflow.');
  }

  let provenance = buildRunProvenance(run, included);
  if (expectedSourceRef !== undefined) {
    const startReason = provenance.startReason;
    const pullRequest = run.relationships?.pullRequest?.data;
    if (provenance.isPullRequestBuild !== false || pullRequest ||
        startReason === 'PULL_REQUEST_OPEN' || startReason === 'PULL_REQUEST_UPDATE') {
      throw new Error('Branch provenance requires a verified non-pull-request run.');
    }
    if (provenance.sourceCommitSha?.toLowerCase() !== expectedSourceCommitSha?.toLowerCase() ||
        !provenance.sourceCommitSha) {
      throw new Error('The build run does not have the expected source commit SHA.');
    }
  }
  if (!provenance.sourceRef && provenance.sourceRefId) {
    const reference = await client.getGitReference(provenance.sourceRefId);
    provenance = buildRunProvenance(run, [reference]);
  }
  if (expectedSourceRef !== undefined &&
      (provenance.sourceRefKind !== 'BRANCH' || provenance.sourceRef !== expectedSourceRef)) {
    throw new Error('The build run does not have the expected canonical source branch.');
  }

  const executionProgress = run.attributes?.executionProgress ?? null;
  const completionStatus = run.attributes?.completionStatus ?? null;
  const runState = getRunState(executionProgress, completionStatus);
  let results: PlatformResult[];
  if (runState.status === 'ready') {
    const builds = await readLinkedBuilds(client, buildRunId, appId);
    results = platforms.map((platform) => assessPlatform(platform, builds));
  } else {
    const { status, reason } = runState;
    results = platforms.map((platform) => ({ platform, status, reasons: [reason] }));
  }

  const status = results.some((result) => result.status === 'blocked') ? 'blocked'
    : results.some((result) => result.status === 'pending') ? 'pending'
    : 'ready';
  return {
    status,
    buildRun: { id: buildRunId, workflowId, executionProgress, completionStatus, ...provenance },
    appId,
    platforms: results,
  };
}

async function readLinkedBuilds(client: BuildsClient, buildRunId: string, appId: string) {
  const linked = await client.listLinkedBuilds(buildRunId);
  const versions = prereleaseVersions(linked.included);
  const fallbacks = new Map<string, LinkedBuild>();
  const results: LinkedBuild[] = [];
  for (const build of linked.data) {
    let result = assessLinkedBuild(build, appId, versions);
    if (result.status === 'unverified' && build.type === 'builds' && build.id) {
      const existing = fallbacks.get(build.id);
      if (existing) {
        result = existing;
      } else {
        const detail = await client.getLinkedBuildDetails(build.id);
        if (detail.data.type !== 'builds' || detail.data.id !== build.id) {
          throw new Error('App Store Connect returned a different build than the run linked.');
        }
        result = assessLinkedBuild(detail.data, appId, prereleaseVersions(detail.included ?? []));
        fallbacks.set(build.id, result);
      }
    }
    results.push(result);
  }
  return results;
}

function prereleaseVersions(included: ReadonlyArray<{ type: string; id: string }>) {
  const versions = included.filter(
    (resource): resource is PrereleaseVersion => resource.type === 'preReleaseVersions',
  );
  return new Map(versions.map((version) => [version.id, version]));
}

function getRunState(
  progress: CiBuildRun['attributes']['executionProgress'] | null,
  completion: CiBuildRun['attributes']['completionStatus'],
): RunState {
  switch (completion) {
    case 'FAILED':
    case 'ERRORED':
      return { status: 'blocked', reason: 'run_failed' };
    case 'CANCELED':
      return { status: 'blocked', reason: 'run_canceled' };
    case 'SKIPPED':
      return { status: 'blocked', reason: 'run_skipped' };
    case 'SUCCEEDED':
      if (progress === 'COMPLETE') return { status: 'ready' };
      break;
    case undefined:
    case null:
      if (progress === 'PENDING' || progress === 'RUNNING') {
        return { status: 'pending', reason: 'run_in_progress' };
      }
  }
  return { status: 'blocked', reason: 'unknown_run_state' };
}

function assessLinkedBuild(
  build: AppStoreBuild,
  appId: string,
  versions: ReadonlyMap<string, PrereleaseVersion>,
): LinkedBuild {
  if (build.type !== 'builds' || !build.id) {
    return { status: 'unverified', reason: 'unverified_build' };
  }
  const release = build.relationships?.preReleaseVersion?.data;
  const version = release?.type === 'preReleaseVersions' ? versions.get(release.id)?.attributes : undefined;
  const platform = version?.platform && buildPlatforms.includes(version.platform)
    ? version.platform
    : undefined;
  const app = build.relationships?.app?.data;
  if (app?.type !== 'apps' || !app.id) {
    return { status: 'unverified', platform, reason: 'unverified_app' };
  }
  if (app.id !== appId) {
    return { status: 'ineligible', platform, reason: 'wrong_app' };
  }
  if (!platform || !version?.version) {
    return { status: 'unverified', platform, reason: 'unverified_prerelease_version' };
  }

  const { version: buildNumber, expired, processingState, buildAudienceType } = build.attributes ?? {};
  if (expired === true) return { status: 'ineligible', platform, reason: 'expired' };
  if (buildAudienceType === 'INTERNAL_ONLY') {
    return { status: 'ineligible', platform, reason: 'internal_only' };
  }
  if (processingState === 'PROCESSING') {
    return { status: 'pending', platform, reason: 'build_processing' };
  }
  if (processingState === 'FAILED' || processingState === 'INVALID') {
    return { status: 'ineligible', platform, reason: 'build_processing_failed' };
  }
  if (processingState !== 'VALID' || buildAudienceType !== 'APP_STORE_ELIGIBLE' ||
      expired !== false || !buildNumber) {
    return { status: 'unverified', platform, reason: 'unknown_build_state' };
  }
  return {
    status: 'eligible',
    platform,
    build: {
      id: build.id,
      platform,
      marketingVersion: version.version,
      buildNumber,
      processingState,
      buildAudienceType,
      expired,
    },
  };
}

function assessPlatform(platform: BuildPlatform, builds: LinkedBuild[]): PlatformResult {
  const eligible = new Map<string, BuildEvidence>();
  const reasons = new Set<string>();
  let pending = false;
  let unverified = false;
  for (const build of builds) {
    if (build.platform !== undefined && build.platform !== platform) continue;
    if (build.status === 'eligible') {
      eligible.set(build.build.id, build.build);
    } else {
      reasons.add(build.reason);
      pending ||= build.status === 'pending';
      unverified ||= build.status === 'unverified';
    }
  }

  if (eligible.size > 1) reasons.add('ambiguous_builds');
  if (eligible.size > 1 || unverified) {
    return { platform, status: 'blocked', reasons: [...reasons] };
  }
  if (pending) return { platform, status: 'pending', reasons: [...reasons] };
  const build = eligible.values().next().value;
  if (build) return { platform, status: 'ready', reasons: [...reasons], build };
  if (reasons.size) return { platform, status: 'blocked', reasons: [...reasons] };
  return { platform, status: 'pending', reasons: ['build_not_linked'] };
}
