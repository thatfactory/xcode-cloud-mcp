import { AuthManager } from './auth.js';
import type { APIErrorResponse, APIResponse } from './types.js';

const API_BASE_URL = 'https://api.appstoreconnect.apple.com';

/**
 * Shared HTTP client for App Store Connect endpoints.
 */
export class BaseAPIClient {
  protected readonly auth: AuthManager;
  protected readonly baseUrl: string;

  constructor(auth: AuthManager, baseUrl: string = API_BASE_URL) {
    this.auth = auth;
    this.baseUrl = baseUrl;
  }

  protected async get<TData>(
    path: string,
    params?: Record<string, string>,
  ): Promise<APIResponse<TData>> {
    const url = new URL(path, this.baseUrl);

    for (const [key, value] of Object.entries(params ?? {})) {
      url.searchParams.set(key, value);
    }

    return this.request<TData>(url.toString());
  }

  protected async download(url: string): Promise<Uint8Array> {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.auth.getToken()}`,
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to download artifact: ${response.status} ${response.statusText}`,
      );
    }

    return new Uint8Array(await response.arrayBuffer());
  }

  private async request<TData>(url: string): Promise<APIResponse<TData>> {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.auth.getToken()}`,
        'Content-Type': 'application/json',
      },
    });

    const contentType = response.headers.get('content-type') ?? '';

    if (!contentType.includes('application/json')) {
      throw new Error(
        `Unexpected response type from App Store Connect: ${contentType || 'unknown'}`,
      );
    }

    const payload = (await response.json()) as APIResponse<TData> | APIErrorResponse;

    if (!response.ok) {
      const apiErrorResponse = payload as APIErrorResponse;
      const message = apiErrorResponse.errors
        .map((error) => `${error.title}: ${error.detail}`)
        .join('; ');

      throw new Error(`API Error (${response.status}): ${message}`);
    }

    return payload as APIResponse<TData>;
  }
}
