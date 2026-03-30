import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, stat, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  cleanupSavedLogs,
  getSavedLogsRootDirectory,
  removeSavedLogsForBuildRun,
} from '../src/utils/log-storage.js';

test('cleanupSavedLogs removes directories older than retention', async () => {
  const baseDirectory = await mkdtemp(
    path.join(tmpdir(), 'xcode-cloud-mcp-cleanup-test-'),
  );
  const rootDirectory = getSavedLogsRootDirectory(baseDirectory);
  const staleDirectory = path.join(rootDirectory, 'stale-build');
  const freshDirectory = path.join(rootDirectory, 'fresh-build');

  await mkdir(staleDirectory, { recursive: true });
  await mkdir(freshDirectory, { recursive: true });

  const staleDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
  await utimes(staleDirectory, staleDate, staleDate);

  const cleanupResult = await cleanupSavedLogs({
    rootDirectory,
    maxAgeHours: 24,
  });

  assert.equal(cleanupResult.removedDirectories.includes(staleDirectory), true);
  await assert.rejects(stat(staleDirectory));
  await stat(freshDirectory);
});

test('removeSavedLogsForBuildRun removes one build directory', async () => {
  const baseDirectory = await mkdtemp(
    path.join(tmpdir(), 'xcode-cloud-mcp-remove-test-'),
  );
  const rootDirectory = getSavedLogsRootDirectory(baseDirectory);
  const buildRunId = 'build-123';
  const buildDirectory = path.join(rootDirectory, buildRunId);

  await mkdir(buildDirectory, { recursive: true });

  const removalResult = await removeSavedLogsForBuildRun(buildRunId, {
    baseDirectory,
  });

  assert.equal(removalResult.removed, true);
  assert.equal(removalResult.removedDirectory, buildDirectory);
  await assert.rejects(stat(buildDirectory));
});
