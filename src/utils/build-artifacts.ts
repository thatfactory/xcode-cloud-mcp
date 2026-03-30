import type { AppStoreConnectClient } from '../api/client.js';
import {
  mergeGroupedArtifacts,
  type GroupedArtifacts,
} from '../api/resources/artifacts.js';

/**
 * Resolve all artifacts for a build run by aggregating artifacts from each build action.
 */
export async function collectBuildRunArtifacts(
  client: AppStoreConnectClient,
  buildRunId: string,
): Promise<GroupedArtifacts> {
  const buildActions = await client.builds.getActions(buildRunId);
  const groupedArtifactCollections = await Promise.all(
    buildActions.map((buildAction) =>
      client.artifacts.listForBuildAction(buildAction.id),
    ),
  );

  return mergeGroupedArtifacts(groupedArtifactCollections);
}
