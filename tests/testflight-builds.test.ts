import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import type { AuthManager } from '../src/api/auth.js';
import { AppStoreConnectClient } from '../src/api/client.js';
import { registerBuildRunTools } from '../src/tools/build-runs.js';

const origin = 'https://api.appstoreconnect.apple.com';
const workflowPath = '/v1/ciWorkflows/workflow-1/buildRuns';
const runPath = '/v1/ciBuildRuns/run-1';
const buildsPath = runPath + '/builds';
const referencePath = '/v1/scmGitReferences/reference-1';
const sha = 'a'.repeat(40);
const ref = 'refs/heads/release';
const request = {
  buildRunId: 'xcode-cloud://build-run/run-1',
  workflowId: 'xcode-cloud://workflow/workflow-1',
  appId: 'app-1',
  platforms: ['IOS', 'TV_OS'],
  expectedSourceRef: ref,
  expectedSourceCommitSha: sha.toUpperCase(),
};

function buildRun() {
  return {
    type: 'ciBuildRuns',
    id: 'run-1',
    attributes: {
      number: 73,
      executionProgress: 'COMPLETE',
      completionStatus: 'SUCCEEDED',
      isPullRequestBuild: false,
      startReason: 'GIT_REF_CHANGE',
      sourceCommit: { commitSha: sha, message: 'Private commit message', webUrl: 'https://private.example' },
    },
    relationships: {
      workflow: { data: { type: 'ciWorkflows', id: 'workflow-1' } },
      sourceBranchOrTag: { data: { type: 'scmGitReferences', id: 'reference-1' } },
    },
  };
}

const reference = {
  type: 'scmGitReferences',
  id: 'reference-1',
  attributes: { canonicalName: ref, kind: 'BRANCH' },
};

function prerelease(platform: string, id = platform) {
  return { type: 'preReleaseVersions', id, attributes: { platform, version: '2.1' } };
}

function build(id: string, platform: string, attributes: Record<string, unknown> = {}, appId = 'app-1') {
  return {
    type: 'builds',
    id,
    attributes: { version: '44', processingState: 'VALID', buildAudienceType: 'APP_STORE_ELIGIBLE', expired: false, ...attributes },
    relationships: {
      app: { data: { type: 'apps', id: appId } },
      preReleaseVersion: { data: { type: 'preReleaseVersions', id: platform } },
    },
  };
}

test('resolves exact iOS and tvOS builds across Apple pages, safely repeating reads', async (t) => {
  const { lookup, calls } = toolsFixture(t, (url) => {
    if (url.pathname === runPath) return { data: buildRun(), included: [reference] };
    assert.equal(url.pathname, buildsPath);
    if (url.searchParams.get('cursor')) {
      return {
        data: [build('tv-build', 'TV_OS'), build('ios-build', 'IOS')],
        included: [prerelease('TV_OS')],
      };
    }
    return {
      data: [build('ios-build', 'IOS')],
      included: [{ type: 'apps', id: 'IOS', attributes: { version: 'wrong-type' } }, prerelease('IOS')],
      links: { next: origin + buildsPath + '?cursor=2' },
    };
  });
  const result = await lookup(request);
  assert.deepEqual(await lookup(request), result);
  assert.equal(result.status, 'ready');
  assert.deepEqual(result.buildRun, {
    id: 'run-1', workflowId: 'workflow-1',
    executionProgress: 'COMPLETE', completionStatus: 'SUCCEEDED',
    sourceCommitSha: sha, sourceRef: ref, sourceRefId: 'reference-1',
    sourceRefKind: 'BRANCH', isPullRequestBuild: false, startReason: 'GIT_REF_CHANGE',
  });
  assert.deepEqual(result.platforms, [
    { platform: 'IOS', status: 'ready', reasons: [], build: expectedBuild('ios-build', 'IOS') },
    { platform: 'TV_OS', status: 'ready', reasons: [], build: expectedBuild('tv-build', 'TV_OS') },
  ]);
  assert.doesNotMatch(JSON.stringify(result), /Private commit message|private\.example/);
  assert.deepEqual(calls.map((url) => url.pathname), [
    runPath, buildsPath, buildsPath, runPath, buildsPath, buildsPath,
  ]);
  assert.equal(calls[0]?.searchParams.get('include'), 'workflow,sourceBranchOrTag');
  assert.equal(calls[1]?.searchParams.get('include'), 'app,preReleaseVersion');
});

test('reads the exact linked ref when its included attributes are unavailable', async (t) => {
  const { lookup, calls } = toolsFixture(t, (url) => {
    if (url.pathname === runPath) {
      return {
        data: buildRun(),
        included: [
          { type: 'scmGitReferences', id: 'reference-1' },
          { ...reference, id: 'unrelated-reference' },
        ],
      };
    }
    if (url.pathname === referencePath) return { data: reference };
    assert.equal(url.pathname, buildsPath);
    return { data: [], included: [] };
  });
  const result = await lookup(request);
  assert.equal(result.buildRun.sourceRef, ref);
  assert.equal(result.status, 'pending');
  assert.deepEqual(result.platforms.map((item: { reasons: string[] }) => item.reasons), [
    ['build_not_linked'], ['build_not_linked'],
  ]);
  assert.deepEqual(calls.map((url) => url.pathname), [runPath, referencePath, buildsPath]);
});

test('hydrates sparse linked builds by ID when Apple omits app and platform evidence', async (t) => {
  const { lookup, calls } = toolsFixture(t, (url) => {
    switch (url.pathname) {
      case runPath:
        return { data: buildRun(), included: [reference] };
      case buildsPath:
        return {
          data: ['ios-build', 'tv-build'].map((id) => ({
            type: 'builds', id,
            attributes: { version: null, processingState: null, buildAudienceType: null, expired: null },
            relationships: { app: { data: null }, preReleaseVersion: { data: null } },
          })),
          included: [],
        };
      case '/v1/builds/ios-build':
        return { data: build('ios-build', 'IOS'), included: [prerelease('IOS')] };
      case '/v1/builds/tv-build':
        return { data: build('tv-build', 'TV_OS'), included: [prerelease('TV_OS')] };
      default:
        assert.fail(`Unexpected read of ${url.pathname}`);
    }
  });
  const result = await lookup(request);
  assert.equal(result.status, 'ready');
  assert.deepEqual(result.platforms.map((item: { build: unknown }) => item.build), [
    expectedBuild('ios-build', 'IOS'), expectedBuild('tv-build', 'TV_OS'),
  ]);
  assert.deepEqual(calls.map((url) => url.pathname), [
    runPath, buildsPath, '/v1/builds/ios-build', '/v1/builds/tv-build',
  ]);
});

test('rejects fallback details for a build ID outside the run', async (t) => {
  const { invoke } = toolsFixture(t, (url) => {
    if (url.pathname === runPath) return { data: buildRun(), included: [reference] };
    if (url.pathname === buildsPath) {
      return { data: [{ type: 'builds', id: 'linked-build' }] };
    }
    assert.equal(url.pathname, '/v1/builds/linked-build');
    return { data: build('other-build', 'IOS'), included: [prerelease('IOS')] };
  });
  const result = await invoke('get_build_run_testflight_builds', request);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /different build than the run linked/);
});

test('rejects a different run, workflow, SHA, branch, ref kind or PR before fetching builds', async (t) => {
  const wrongRun = { ...buildRun(), id: 'run-2' };
  const wrongWorkflow = buildRun();
  wrongWorkflow.relationships.workflow.data.id = 'workflow-2';
  const wrongSha = buildRun();
  wrongSha.attributes.sourceCommit.commitSha = 'b'.repeat(40);
  const isPullRequest = buildRun();
  isPullRequest.attributes.isPullRequestBuild = true;
  const cases = [
    { run: wrongRun, error: /different build run/ },
    { run: wrongWorkflow, error: /expected workflow/ },
    { run: wrongSha, error: /expected source commit SHA/ },
    { included: { ...reference, attributes: { canonicalName: 'refs/heads/main', kind: 'BRANCH' } }, error: /expected canonical source branch/ },
    { included: { ...reference, attributes: { canonicalName: 'refs/tags/release', kind: 'TAG' } }, error: /expected canonical source branch/ },
    { run: isPullRequest, error: /non-pull-request run/ },
  ];
  for (const { run, included, error } of cases) {
    await t.test(error.source, async (t) => {
      const { invoke, calls } = toolsFixture(t, (url) => {
        assert.equal(url.pathname, runPath);
        return { data: run ?? buildRun(), included: [included ?? reference] };
      });
      const result = await invoke('get_build_run_testflight_builds', request);
      assert.equal(result.isError, true);
      assert.match(result.content[0]!.text, error);
      assert.equal(calls.length, 1);
    });
  }
});

test('distinguishes running or failed runs from a completed upload', async (t) => {
  const cases = [
    ['RUNNING', null, 'pending', 'run_in_progress'],
    ['COMPLETE', 'FAILED', 'blocked', 'run_failed'],
    ['COMPLETE', 'CANCELED', 'blocked', 'run_canceled'],
    ['COMPLETE', 'UNRECOGNIZED', 'blocked', 'unknown_run_state'],
  ] as const;
  for (const [executionProgress, completionStatus, status, reason] of cases) {
    await t.test(reason, async (t) => {
      const run = buildRun();
      const { lookup, calls } = toolsFixture(t, (url) => {
        assert.equal(url.pathname, runPath);
        return { data: { ...run, attributes: { ...run.attributes, executionProgress, completionStatus } }, included: [reference] };
      });
      const result = await lookup(request);
      assert.equal(result.status, status);
      assert.deepEqual(result.platforms, request.platforms.map((platform) => ({ platform, status, reasons: [reason] })));
      assert.equal(calls.length, 1);
    });
  }
});

test('classifies delayed upload, ineligible builds, missing evidence and ambiguity without exposing their IDs', async (t) => {
  const ios = build('ios-build', 'IOS');
  const tv = build('tv-build', 'TV_OS');
  const cases = [
    { builds: [ios], status: 'pending', reason: 'build_not_linked' },
    { builds: [ios, build(tv.id, 'TV_OS', { processingState: 'PROCESSING', buildAudienceType: undefined })], status: 'pending', reason: 'build_processing' },
    { builds: [ios, build(tv.id, 'TV_OS', { buildAudienceType: 'INTERNAL_ONLY' })], status: 'blocked', reason: 'internal_only' },
    { builds: [ios, build(tv.id, 'TV_OS', { expired: true })], status: 'blocked', reason: 'expired' },
    { builds: [ios, build(tv.id, 'TV_OS', { processingState: 'UNRECOGNIZED' })], status: 'blocked', reason: 'unknown_build_state' },
    { builds: [ios, build(tv.id, 'TV_OS', { buildAudienceType: undefined })], status: 'blocked', reason: 'unknown_build_state' },
    { builds: [ios, build(tv.id, 'TV_OS', {}, 'different-app')], status: 'blocked', reason: 'wrong_app' },
    { builds: [ios, build(tv.id, 'bad-version-id')], status: 'blocked', reason: 'unverified_prerelease_version' },
    { builds: [ios, tv, build('other-tv-build', 'TV_OS')], status: 'blocked', reason: 'ambiguous_builds' },
  ];
  for (const { builds, status, reason } of cases) {
    await t.test(reason, async (t) => {
      const included = [prerelease('IOS'), prerelease('TV_OS')];
      const { lookup } = toolsFixture(t, (url) => {
        if (url.pathname === runPath) return { data: buildRun(), included: [reference] };
        if (url.pathname === buildsPath) return { data: builds, included };
        assert.equal(url.pathname, '/v1/builds/tv-build');
        return { data: builds.find((build) => build.id === 'tv-build'), included };
      });
      const result = await lookup(request);
      assert.equal(result.status, status);
      assert.deepEqual(result.platforms[1], { platform: 'TV_OS', status, reasons: [reason] });
      assert.doesNotMatch(JSON.stringify(result), /tv-build/);
    });
  }
});

test('SHA scans distinguish more pages, unverified source commits and an exhaustive no-match', async (t) => {
  const matchingRun = buildRun();
  const unverifiedRun = buildRun();
  unverifiedRun.id = 'unverified';
  unverifiedRun.attributes.sourceCommit.commitSha = 'a';
  const { list, calls } = toolsFixture(t, (url) => {
    assert.equal(url.pathname, workflowPath);
    if (url.searchParams.get('cursor')) return { data: [matchingRun], included: [reference] };
    assert.equal(url.searchParams.get('include'), 'sourceBranchOrTag');
    assert.equal(url.searchParams.get('sort'), '-number');
    return { data: [unverifiedRun], links: { next: origin + workflowPath + '?cursor=2' } };
  });
  assert.deepEqual(await list({ limit: 1, sourceCommitSha: sha }), {
    buildRuns: [], scan: { scannedCount: 1, hasMore: true, unverifiedSourceCount: 1 },
  });
  assert.equal(calls.length, 1);
  const match = await list({ limit: 2, sourceCommitSha: sha });
  assert.equal(match.buildRuns[0].sourceRef, ref);
  assert.equal(match.buildRuns[0].sourceCommitSha, sha);
  assert.equal(match.buildRuns[0].isPullRequestBuild, false);
  assert.equal(match.buildRuns[0].startReason, 'GIT_REF_CHANGE');
  assert.deepEqual(match.scan, { scannedCount: 2, hasMore: false, unverifiedSourceCount: 1 });
  assert.doesNotMatch(JSON.stringify(match), /Private commit message|private\.example/);
});

test('a limit inside the final Apple page still marks the SHA scan incomplete', async (t) => {
  const first = buildRun();
  first.attributes.sourceCommit.commitSha = 'b'.repeat(40);
  const second = buildRun();
  second.id = 'run-2';
  const { list } = toolsFixture(t, () => ({ data: [first, second], included: [reference] }));
  const truncated = await list({ limit: 1, sourceCommitSha: sha });
  assert.deepEqual(truncated, { buildRuns: [], scan: { scannedCount: 1, hasMore: true, unverifiedSourceCount: 0 } });
  const exhaustive = await list({ limit: 2, sourceCommitSha: 'c'.repeat(40) });
  assert.deepEqual(exhaustive, { buildRuns: [], scan: { scannedCount: 2, hasMore: false, unverifiedSourceCount: 0 } });
});

function expectedBuild(id: string, platform: string) {
  return {
    id, platform, marketingVersion: '2.1', buildNumber: '44',
    processingState: 'VALID', buildAudienceType: 'APP_STORE_ELIGIBLE', expired: false,
  };
}

type Handler = (input: Record<string, unknown>) => Promise<{
  isError?: boolean;
  content: { text: string }[];
  structuredContent?: unknown;
}>;

function toolsFixture(t: TestContext, respond: (url: URL) => unknown) {
  const calls: URL[] = [];
  const registry = new Map<string, Handler>();
  const server = {
    registerTool: (name: string, _config: unknown, callback: Handler) => registry.set(name, callback),
  };
  t.mock.method(globalThis, 'fetch', async (input: string, init: RequestInit) => {
    const url = new URL(input);
    calls.push(url);
    assert.equal(url.origin, origin);
    assert.equal(init.method ?? 'GET', 'GET');
    assert.equal(init.body, undefined);
    return Response.json(respond(url));
  });
  const auth = { getToken: () => 'mock-token' } as AuthManager;
  registerBuildRunTools(server as never, new AppStoreConnectClient(auth));
  const invoke = (tool: string, args: Record<string, unknown>) => registry.get(tool)!(args);
  const payload = async (tool: string, args: Record<string, unknown>) => {
    const response = await invoke(tool, args);
    assert.equal(response.isError, undefined, response.content[0]?.text);
    const data = JSON.parse(response.content[0]!.text);
    if (tool === 'get_build_run_testflight_builds') {
      assert.deepEqual(response.structuredContent, data);
    }
    return data;
  };
  return {
    calls,
    invoke,
    lookup: (args: Record<string, unknown>) => payload('get_build_run_testflight_builds', args),
    list: (args: Record<string, unknown>) => payload('list_build_runs', { workflowId: request.workflowId, ...args }),
  };
}
