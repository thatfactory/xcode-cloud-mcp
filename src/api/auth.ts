import jwt from 'jsonwebtoken';

export interface AuthConfig {
  keyId: string;
  issuerId: string;
  privateKey: string;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

/**
 * Generate and cache App Store Connect JWT credentials.
 */
export class AuthManager {
  private readonly config: AuthConfig;
  private cachedToken: CachedToken | null = null;

  constructor(config: AuthConfig) {
    this.config = config;
  }

  /**
   * Return a valid token, reusing a cached token until close to expiration.
   */
  getToken(): string {
    const currentTimestamp = Math.floor(Date.now() / 1000);

    if (this.cachedToken && this.cachedToken.expiresAt > currentTimestamp + 60) {
      return this.cachedToken.token;
    }

    const expiresAt = currentTimestamp + 20 * 60;
    const token = jwt.sign(
      {
        iss: this.config.issuerId,
        iat: currentTimestamp,
        exp: expiresAt,
        aud: 'appstoreconnect-v1',
      },
      this.config.privateKey,
      {
        algorithm: 'ES256',
        header: {
          alg: 'ES256',
          kid: this.config.keyId,
          typ: 'JWT',
        },
      },
    );

    this.cachedToken = {
      token,
      expiresAt,
    };

    return token;
  }
}
