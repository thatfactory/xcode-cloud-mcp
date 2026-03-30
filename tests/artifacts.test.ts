import test from 'node:test';
import assert from 'node:assert/strict';
import { groupArtifactsByType } from '../src/api/resources/artifacts.js';
import type { CiArtifact } from '../src/api/types.js';

test('groupArtifactsByType classifies known artifact types', () => {
  const groupedArtifacts = groupArtifactsByType([
    createArtifact('1', 'LOG'),
    createArtifact('2', 'SCREENSHOT'),
    createArtifact('3', 'VIDEO'),
    createArtifact('4', 'RESULT_BUNDLE'),
    createArtifact('5', 'TEST_PRODUCTS'),
    createArtifact('6', 'ARCHIVE'),
  ]);

  assert.equal(groupedArtifacts.logs.length, 1);
  assert.equal(groupedArtifacts.screenshots.length, 1);
  assert.equal(groupedArtifacts.videos.length, 1);
  assert.equal(groupedArtifacts.resultBundles.length, 1);
  assert.equal(groupedArtifacts.testProducts.length, 1);
  assert.equal(groupedArtifacts.archives.length, 1);
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
