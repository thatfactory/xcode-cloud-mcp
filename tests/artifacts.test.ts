import test from 'node:test';
import assert from 'node:assert/strict';
import {
  groupArtifactsByType,
  mergeGroupedArtifacts,
} from '../src/api/resources/artifacts.js';
import type { CiArtifact } from '../src/api/types.js';

test('groupArtifactsByType classifies known artifact types', () => {
  const groupedArtifacts = groupArtifactsByType([
    createArtifact('1', 'LOG'),
    createArtifact('2', 'LOG_BUNDLE'),
    createArtifact('3', 'SCREENSHOT'),
    createArtifact('4', 'VIDEO'),
    createArtifact('5', 'RESULT_BUNDLE'),
    createArtifact('6', 'TEST_PRODUCTS'),
    createArtifact('7', 'ARCHIVE'),
  ]);

  assert.equal(groupedArtifacts.logs.length, 2);
  assert.equal(groupedArtifacts.screenshots.length, 1);
  assert.equal(groupedArtifacts.videos.length, 1);
  assert.equal(groupedArtifacts.resultBundles.length, 1);
  assert.equal(groupedArtifacts.testProducts.length, 1);
  assert.equal(groupedArtifacts.archives.length, 1);
});

test('mergeGroupedArtifacts combines action artifact groups', () => {
  const mergedArtifacts = mergeGroupedArtifacts([
    groupArtifactsByType([
      createArtifact('1', 'LOG'),
      createArtifact('2', 'SCREENSHOT'),
    ]),
    groupArtifactsByType([
      createArtifact('3', 'LOG'),
      createArtifact('4', 'RESULT_BUNDLE'),
    ]),
  ]);

  assert.equal(mergedArtifacts.logs.length, 2);
  assert.equal(mergedArtifacts.screenshots.length, 1);
  assert.equal(mergedArtifacts.resultBundles.length, 1);
});

function createArtifact(
  id: string,
  fileType: CiArtifact['attributes']['fileType'],
): CiArtifact {
  return {
    id,
    type: 'ciArtifacts',
    attributes: {
      fileName: `${id}.txt`,
      fileType,
      downloadUrl: `https://example.com/${id}`,
    },
  };
}
