import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AppStoreConnectClient } from '../api/client.js';
import type { CiArtifact } from '../api/types.js';
import { extractTextFromArtifact } from './log-analysis.js';

export interface SavedLogFile {
  artifactId: string;
  fileName: string;
  downloadUrl?: string;
  rawPath: string;
  textPath?: string;
}

export interface StoredLogs {
  directoryPath: string;
  parsedLogTexts: string[];
  savedLogFiles: SavedLogFile[];
}

const DEFAULT_LOG_RETENTION_HOURS = 24;

/**
 * Return the root directory used for materialized log files.
 */
export function getSavedLogsRootDirectory(
  baseDirectory: string = tmpdir(),
): string {
  return path.join(baseDirectory, 'xcode-cloud-mcp', 'build-logs');
}

/**
 * Download log artifacts, persist them locally, and return extracted text when available.
 */
export async function storeLogArtifacts(
  client: AppStoreConnectClient,
  buildRunId: string,
  artifacts: CiArtifact[],
  options?: {
    baseDirectory?: string;
    retentionHours?: number;
  },
): Promise<StoredLogs> {
  const rootDirectory = getSavedLogsRootDirectory(options?.baseDirectory);
  await cleanupSavedLogs({
    rootDirectory,
    maxAgeHours: options?.retentionHours ?? DEFAULT_LOG_RETENTION_HOURS,
  });

  const directoryPath = path.join(rootDirectory, buildRunId);
  await rm(directoryPath, { recursive: true, force: true });
  await mkdir(directoryPath, { recursive: true });

  const parsedLogTexts: string[] = [];
  const savedLogFiles: SavedLogFile[] = [];

  for (const artifact of artifacts) {
    const downloadUrl = artifact.attributes.downloadUrl;

    if (!downloadUrl) {
      continue;
    }

    try {
      const artifactBytes = await client.artifacts.downloadArtifact(downloadUrl);
      const safeBaseName = sanitizeFileName(artifact.attributes.fileName);
      const rawPath = path.join(directoryPath, safeBaseName);
      await writeFile(rawPath, artifactBytes);

      const savedLogFile: SavedLogFile = {
        artifactId: artifact.id,
        fileName: artifact.attributes.fileName,
        downloadUrl,
        rawPath,
      };

      const extractedText = extractTextFromArtifact(
        artifact.attributes.fileName,
        artifactBytes,
      );

      if (extractedText) {
        const textPath = path.join(directoryPath, `${safeBaseName}.txt`);
        await writeFile(textPath, extractedText, 'utf8');
        savedLogFile.textPath = textPath;
        parsedLogTexts.push(extractedText);
      }

      savedLogFiles.push(savedLogFile);
    } catch {
      continue;
    }
  }

  return {
    directoryPath,
    parsedLogTexts,
    savedLogFiles,
  };
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[\\/:\s]+/g, '-');
}

/**
 * Remove materialized logs for one build run.
 */
export async function removeSavedLogsForBuildRun(
  buildRunId: string,
  options?: {
    baseDirectory?: string;
  },
): Promise<{ removedDirectory: string; removed: boolean }> {
  const directoryPath = path.join(
    getSavedLogsRootDirectory(options?.baseDirectory),
    buildRunId,
  );

  const removed = await removeDirectoryIfPresent(directoryPath);

  return {
    removedDirectory: directoryPath,
    removed,
  };
}

/**
 * Remove old materialized log directories under the saved logs root.
 */
export async function cleanupSavedLogs(options?: {
  rootDirectory?: string;
  baseDirectory?: string;
  maxAgeHours?: number;
}): Promise<{
  rootDirectory: string;
  removedDirectories: string[];
}> {
  const rootDirectory =
    options?.rootDirectory ??
    getSavedLogsRootDirectory(options?.baseDirectory);
  const maxAgeHours = options?.maxAgeHours ?? DEFAULT_LOG_RETENTION_HOURS;
  const maxAgeMilliseconds = Math.max(1, maxAgeHours) * 60 * 60 * 1000;
  const removedDirectories: string[] = [];

  try {
    const entries = await readdir(rootDirectory, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const directoryPath = path.join(rootDirectory, entry.name);
      const directoryStats = await stat(directoryPath);
      const modifiedAgeMilliseconds =
        Date.now() - directoryStats.mtime.getTime();

      if (modifiedAgeMilliseconds < maxAgeMilliseconds) {
        continue;
      }

      await rm(directoryPath, { recursive: true, force: true });
      removedDirectories.push(directoryPath);
    }
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    if (nodeError.code !== 'ENOENT') {
      throw error;
    }
  }

  return {
    rootDirectory,
    removedDirectories,
  };
}

async function removeDirectoryIfPresent(directoryPath: string): Promise<boolean> {
  try {
    await rm(directoryPath, { recursive: true, force: false });
    return true;
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    if (nodeError.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
}
