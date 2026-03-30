import test from 'node:test';
import assert from 'node:assert/strict';
import { loadEnvironment } from '../src/env.js';

test('loadEnvironment reads primary env names', () => {
  const environment = loadEnvironment({
    APPSTORE_CONNECT_API_KEY_ID: 'key-id',
    APPSTORE_CONNECT_API_ISSUER_ID: 'issuer-id',
    APPSTORE_CONNECT_API_KEY_CONTENT: '"line-one\\nline-two"',
  });

  assert.equal(environment.keyId, 'key-id');
  assert.equal(environment.issuerId, 'issuer-id');
  assert.equal(environment.privateKey, 'line-one\nline-two');
});

test('loadEnvironment falls back to alias names', () => {
  const environment = loadEnvironment({
    APP_STORE_KEY_ID: 'alias-key',
    APP_STORE_ISSUER_ID: 'alias-issuer',
    APP_STORE_PRIVATE_KEY: 'alias-private-key',
  });

  assert.equal(environment.keyId, 'alias-key');
  assert.equal(environment.issuerId, 'alias-issuer');
  assert.equal(environment.privateKey, 'alias-private-key');
});

test('loadEnvironment prefers primary values over aliases', () => {
  const environment = loadEnvironment({
    APPSTORE_CONNECT_API_KEY_ID: 'primary-key',
    APP_STORE_KEY_ID: 'alias-key',
    APPSTORE_CONNECT_API_ISSUER_ID: 'primary-issuer',
    APP_STORE_ISSUER_ID: 'alias-issuer',
    APPSTORE_CONNECT_API_KEY_CONTENT: 'primary-key-content',
    APP_STORE_PRIVATE_KEY: 'alias-key-content',
  });

  assert.equal(environment.keyId, 'primary-key');
  assert.equal(environment.issuerId, 'primary-issuer');
  assert.equal(environment.privateKey, 'primary-key-content');
});

test('loadEnvironment throws a clear error when values are missing', () => {
  assert.throws(() => loadEnvironment({}), {
    message:
      'Missing required environment variables: APPSTORE_CONNECT_API_KEY_ID or APP_STORE_KEY_ID, APPSTORE_CONNECT_API_ISSUER_ID or APP_STORE_ISSUER_ID, APPSTORE_CONNECT_API_KEY_CONTENT or APP_STORE_PRIVATE_KEY',
  });
});
