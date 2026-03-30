import { BaseAPIClient } from '../base-client.js';
import type { CiArtifact } from '../types.js';

export interface GroupedArtifacts {
  logs: CiArtifact[];
  archives: CiArtifact[];
  screenshots: CiArtifact[];
  videos: CiArtifact[];
  resultBundles: CiArtifact[];
  testProducts: CiArtifact[];
  other: CiArtifact[];
}

/**
 * Artifact endpoints.
 */
export class ArtifactsClient extends BaseAPIClient {
  /**
   * List artifacts for a build action.
   */
  async listForBuildAction(buildActionId: string): Promise<GroupedArtifacts> {
    const response = await this.get<CiArtifact[]>(
      `/v1/ciBuildActions/${buildActionId}/artifacts`,
    );

    return groupArtifactsByType(response.data);
  }

  /**
   * Download a build artifact.
   */
  async downloadArtifact(downloadUrl: string): Promise<Uint8Array> {
    return this.download(downloadUrl);
  }
}

/**
 * Group artifacts by App Store Connect file type.
 */
export function groupArtifactsByType(artifacts: CiArtifact[]): GroupedArtifacts {
  const groupedArtifacts: GroupedArtifacts = {
    logs: [],
    archives: [],
    screenshots: [],
    videos: [],
    resultBundles: [],
    testProducts: [],
    other: [],
  };

  for (const artifact of artifacts) {
    switch (artifact.attributes.fileType) {
      case 'LOG':
      case 'LOG_BUNDLE':
        groupedArtifacts.logs.push(artifact);
        break;
      case 'ARCHIVE':
      case 'XCODEBUILD_ARCHIVE':
        groupedArtifacts.archives.push(artifact);
        break;
      case 'SCREENSHOT':
        groupedArtifacts.screenshots.push(artifact);
        break;
      case 'VIDEO':
        groupedArtifacts.videos.push(artifact);
        break;
      case 'RESULT_BUNDLE':
        groupedArtifacts.resultBundles.push(artifact);
        break;
      case 'TEST_PRODUCTS':
        groupedArtifacts.testProducts.push(artifact);
        break;
      default:
        groupedArtifacts.other.push(artifact);
    }
  }

  return groupedArtifacts;
}

/**
 * Merge grouped artifact collections from multiple build actions.
 */
export function mergeGroupedArtifacts(
  groupedArtifactCollections: GroupedArtifacts[],
): GroupedArtifacts {
  const mergedArtifacts: GroupedArtifacts = {
    logs: [],
    archives: [],
    screenshots: [],
    videos: [],
    resultBundles: [],
    testProducts: [],
    other: [],
  };

  for (const groupedArtifacts of groupedArtifactCollections) {
    mergedArtifacts.logs.push(...groupedArtifacts.logs);
    mergedArtifacts.archives.push(...groupedArtifacts.archives);
    mergedArtifacts.screenshots.push(...groupedArtifacts.screenshots);
    mergedArtifacts.videos.push(...groupedArtifacts.videos);
    mergedArtifacts.resultBundles.push(...groupedArtifacts.resultBundles);
    mergedArtifacts.testProducts.push(...groupedArtifacts.testProducts);
    mergedArtifacts.other.push(...groupedArtifacts.other);
  }

  return mergedArtifacts;
}
