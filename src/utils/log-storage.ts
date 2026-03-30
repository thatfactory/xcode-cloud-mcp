import { mkdir, rm, writeFile } from 'node:fs/promises';
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

/**
 * Download log artifacts, persist them locally, and return extracted text when available.
 */
export async function storeLogArtifacts(
  client: AppStoreConnectClient,
  buildRunId: string,
  artifacts: CiArtifact[],
): Promise<StoredLogs> {
  const directoryPath = path.join(tmpdir(), 'xcode-cloud-mcp', 'build-logs', buildRunId);
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
