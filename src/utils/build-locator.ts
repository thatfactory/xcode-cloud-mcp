import type { AppStoreConnectClient } from '../api/client.js';
import type { CiBuildRun } from '../api/types.js';
import { parseIdentifier } from './identifiers.js';

export type BuildSelector = 'latest' | 'latestFailing';

export interface BuildLocatorInput {
  buildRunId?: string;
  workflowId?: string;
  buildNumber?: number;
  buildSelector?: BuildSelector;
}

/**
 * Validate the allowed build locator combinations.
 */
export function validateBuildLocator(input: BuildLocatorInput): BuildLocatorInput {
  const hasBuildRunId = input.buildRunId !== undefined;
  const hasWorkflowId = input.workflowId !== undefined;
  const hasBuildNumber = input.buildNumber !== undefined;
  const hasBuildSelector = input.buildSelector !== undefined;

  if (hasBuildRunId) {
    if (hasWorkflowId || hasBuildNumber || hasBuildSelector) {
      throw new Error(
        'Provide either buildRunId or workflowId with buildNumber/buildSelector, not both.',
      );
    }

    return {
      buildRunId: parseIdentifier(input.buildRunId!, 'build-run'),
    };
  }

  if (!hasWorkflowId) {
    throw new Error(
      'Provide buildRunId, or workflowId with buildNumber/buildSelector.',
    );
  }

  if (hasBuildNumber === hasBuildSelector) {
    throw new Error(
      'Provide exactly one of buildNumber or buildSelector when workflowId is used.',
    );
  }

  return {
    workflowId: parseIdentifier(input.workflowId!, 'workflow'),
    ...(hasBuildNumber ? { buildNumber: input.buildNumber } : {}),
    ...(hasBuildSelector ? { buildSelector: input.buildSelector } : {}),
  };
}

/**
 * Resolve a build locator into a concrete build run.
 */
export async function resolveBuildLocator(
  client: AppStoreConnectClient,
  input: BuildLocatorInput,
): Promise<CiBuildRun> {
  const locator = validateBuildLocator(input);

  if (locator.buildRunId) {
    return client.builds.getById(locator.buildRunId);
  }

  const buildRuns = sortBuildRuns(
    await client.builds.listForWorkflow(locator.workflowId!, 100),
  );

  if (locator.buildNumber !== undefined) {
    const matchingBuildRun = buildRuns.find(
      (buildRun) => buildRun.attributes.number === locator.buildNumber,
    );

    if (!matchingBuildRun) {
      throw new Error(
        `No build run found for workflow ${locator.workflowId} with build number ${locator.buildNumber}.`,
      );
    }

    return matchingBuildRun;
  }

  if (locator.buildSelector === 'latestFailing') {
    const latestFailingBuildRun = buildRuns.find((buildRun) =>
      isFailureStatus(buildRun.attributes.completionStatus),
    );

    if (!latestFailingBuildRun) {
      throw new Error(
        `No failing build runs found for workflow ${locator.workflowId}.`,
      );
    }

    return latestFailingBuildRun;
  }

  const latestBuildRun = buildRuns[0];

  if (!latestBuildRun) {
    throw new Error(`No build runs found for workflow ${locator.workflowId}.`);
  }

  return latestBuildRun;
}

/**
 * Sort build runs from newest to oldest.
 */
export function sortBuildRuns(buildRuns: CiBuildRun[]): CiBuildRun[] {
  return [...buildRuns].sort((leftBuildRun, rightBuildRun) => {
    if (leftBuildRun.attributes.number !== rightBuildRun.attributes.number) {
      return rightBuildRun.attributes.number - leftBuildRun.attributes.number;
    }

    return (
      new Date(rightBuildRun.attributes.createdDate).getTime() -
      new Date(leftBuildRun.attributes.createdDate).getTime()
    );
  });
}

/**
 * Return true when a completion status should be treated as failing.
 */
export function isFailureStatus(
  status: CiBuildRun['attributes']['completionStatus'],
): boolean {
  return status === 'FAILED' || status === 'ERRORED';
}
