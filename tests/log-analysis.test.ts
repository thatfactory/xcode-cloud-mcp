import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { zipSync } from 'fflate';
import {
  extractTextFromArtifact,
  summarizeLogTexts,
} from '../src/utils/log-analysis.js';

test('extractTextFromArtifact reads plain text', () => {
  const text = extractTextFromArtifact(
    'build.log',
    new TextEncoder().encode('warning: something\nerror: broken'),
  );

  assert.equal(text, 'warning: something\nerror: broken');
});

test('extractTextFromArtifact reads gzip content', () => {
  const text = extractTextFromArtifact(
    'build.log.gz',
    gzipSync('warning: compressed'),
  );

  assert.equal(text, 'warning: compressed');
});

test('extractTextFromArtifact reads zip content', () => {
  const text = extractTextFromArtifact(
    'logs.zip',
    zipSync({
      'a.log': new TextEncoder().encode('error: zipped failure'),
      'b.bin': new Uint8Array([0, 1, 2, 3]),
    }),
  );

  assert.match(text ?? '', /error: zipped failure/);
});

test('summarizeLogTexts counts warnings and errors', () => {
  const summary = summarizeLogTexts(
    ['warning: watch out\nerror: broken\ntest case Example failed'],
    2000,
  );

  assert.equal(summary.summary.parsedArtifactCount, 1);
  assert.equal(summary.summary.warningHighlightCount, 1);
  assert.equal(summary.summary.errorHighlightCount, 2);
  assert.match(summary.excerpt, /warning: watch out/);
});
