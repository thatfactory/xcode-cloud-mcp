import { gunzipSync } from 'node:zlib';
import { unzipSync } from 'fflate';

export interface LogSummary {
  summary: {
    parsedArtifactCount: number;
    errorHighlightCount: number;
    warningHighlightCount: number;
  };
  highlights: string[];
  excerpt: string;
}

/**
 * Extract text from an artifact buffer when the artifact is text-like.
 */
export function extractTextFromArtifact(
  fileName: string,
  data: Uint8Array,
): string | null {
  if (data.length === 0) {
    return null;
  }

  const lowercasedFileName = fileName.toLowerCase();

  if (lowercasedFileName.endsWith('.gz')) {
    return decodeTextBuffer(gunzipSync(data));
  }

  if (lowercasedFileName.endsWith('.zip')) {
    const archiveEntries = unzipSync(data);
    const extractedSections: string[] = [];

    for (const [entryName, entryData] of Object.entries(archiveEntries)) {
      if (!isTextLikeFile(entryName) && !isProbablyText(entryData)) {
        continue;
      }

      const decodedEntry = decodeTextBuffer(entryData);

      if (!decodedEntry) {
        continue;
      }

      extractedSections.push(`===== ${entryName} =====\n${decodedEntry}`);
    }

    return extractedSections.length > 0 ? extractedSections.join('\n\n') : null;
  }

  if (!isTextLikeFile(lowercasedFileName) && !isProbablyText(data)) {
    return null;
  }

  return decodeTextBuffer(data);
}

/**
 * Summarize parsed log texts into highlights and an excerpt.
 */
export function summarizeLogTexts(
  parsedLogTexts: string[],
  maxCharacters: number,
): LogSummary {
  const normalizedMaxCharacters = Math.max(500, maxCharacters);
  const highlightSet = new Set<string>();
  let warningHighlightCount = 0;
  let errorHighlightCount = 0;

  for (const parsedLogText of parsedLogTexts) {
    for (const line of parsedLogText.split(/\r?\n/)) {
      const normalizedLine = line.trim();

      if (!normalizedLine) {
        continue;
      }

      if (isErrorLine(normalizedLine)) {
        errorHighlightCount += 1;
        if (highlightSet.size < 20) {
          highlightSet.add(normalizedLine);
        }
        continue;
      }

      if (isWarningLine(normalizedLine)) {
        warningHighlightCount += 1;
        if (highlightSet.size < 20) {
          highlightSet.add(normalizedLine);
        }
      }
    }
  }

  const combinedText = parsedLogTexts.join('\n\n');
  const excerpt = combinedText.slice(0, normalizedMaxCharacters);

  return {
    summary: {
      parsedArtifactCount: parsedLogTexts.length,
      errorHighlightCount,
      warningHighlightCount,
    },
    highlights: [...highlightSet],
    excerpt,
  };
}

function decodeTextBuffer(buffer: Uint8Array): string | null {
  try {
    const decodedText = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
    const normalizedText = decodedText.replace(/\0/g, '').trim();
    return normalizedText.length > 0 ? normalizedText : null;
  } catch {
    return null;
  }
}

function isTextLikeFile(fileName: string): boolean {
  return [
    '.log',
    '.txt',
    '.json',
    '.xml',
    '.xcresultsummary',
    '.html',
    '.md',
    '.yml',
    '.yaml',
  ].some((extension) => fileName.endsWith(extension));
}

function isProbablyText(buffer: Uint8Array): boolean {
  const inspectedBuffer = buffer.slice(0, 2048);

  if (inspectedBuffer.length === 0) {
    return false;
  }

  let suspiciousByteCount = 0;

  for (const value of inspectedBuffer) {
    const isAllowedControlCharacter = value === 9 || value === 10 || value === 13;
    const isPrintableCharacter = value >= 32 && value <= 126;

    if (!isAllowedControlCharacter && !isPrintableCharacter) {
      suspiciousByteCount += 1;
    }
  }

  return suspiciousByteCount / inspectedBuffer.length < 0.15;
}

function isErrorLine(line: string): boolean {
  return /error:|fatal error|failed\b|test case .* failed|uncaught/i.test(line);
}

function isWarningLine(line: string): boolean {
  return /warning:/i.test(line);
}
