import type { AuthConfig } from './api/auth.js';

const PRIMARY_ENV_NAMES = {
  keyId: 'APPSTORE_CONNECT_API_KEY_ID',
  issuerId: 'APPSTORE_CONNECT_API_ISSUER_ID',
  privateKey: 'APPSTORE_CONNECT_API_KEY_CONTENT',
} as const;

const ALIAS_ENV_NAMES = {
  keyId: 'APP_STORE_KEY_ID',
  issuerId: 'APP_STORE_ISSUER_ID',
  privateKey: 'APP_STORE_PRIVATE_KEY',
} as const;

export interface AppEnvironment extends AuthConfig {}

/**
 * Load and normalize App Store Connect credentials from the environment.
 */
export function loadEnvironment(env: NodeJS.ProcessEnv = process.env): AppEnvironment {
  const keyId = readValue(env, PRIMARY_ENV_NAMES.keyId, ALIAS_ENV_NAMES.keyId);
  const issuerId = readValue(
    env,
    PRIMARY_ENV_NAMES.issuerId,
    ALIAS_ENV_NAMES.issuerId,
  );
  const privateKey = readValue(
    env,
    PRIMARY_ENV_NAMES.privateKey,
    ALIAS_ENV_NAMES.privateKey,
  );

  const missingNames = [
    !keyId
      ? `${PRIMARY_ENV_NAMES.keyId} or ${ALIAS_ENV_NAMES.keyId}`
      : null,
    !issuerId
      ? `${PRIMARY_ENV_NAMES.issuerId} or ${ALIAS_ENV_NAMES.issuerId}`
      : null,
    !privateKey
      ? `${PRIMARY_ENV_NAMES.privateKey} or ${ALIAS_ENV_NAMES.privateKey}`
      : null,
  ].filter(Boolean);

  if (missingNames.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingNames.join(', ')}`,
    );
  }

  if (!keyId || !issuerId || !privateKey) {
    throw new Error('Environment validation failed unexpectedly.');
  }

  return {
    keyId: normalizeValue(keyId),
    issuerId: normalizeValue(issuerId),
    privateKey: normalizeValue(privateKey).replace(/\\n/g, '\n'),
  };
}

function readValue(
  env: NodeJS.ProcessEnv,
  primaryName: string,
  aliasName: string,
): string | undefined {
  return env[primaryName] ?? env[aliasName];
}

function normalizeValue(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, '');
}
