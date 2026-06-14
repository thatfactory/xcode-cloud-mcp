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
  ): Promise<APIResponse<TData>>;
  protected async get<TData, TIncluded>(
    path: string,
    params?: Record<string, string>,
  ): Promise<APIResponse<TData, TIncluded>>;
  protected async get<TData, TIncluded>(
    path: string,
    params?: Record<string, string>,
  ): Promise<APIResponse<TData, TIncluded>> {
    const url = new URL(path, this.baseUrl);

    for (const [key, value] of Object.entries(params ?? {})) {
      url.searchParams.set(key, value);
    }

    return this.request<TData>(url.toString());
  }

  /**
   * Fetch all pages of a paginated list endpoint.
   * Follows `links.next` until no more pages are available.
   * If `maxItems` is provided, stops paginating once enough items are collected.
   */
  protected async listAll<TData>(
    path: string,
    params?: Record<string, string>,
    maxItems?: number,
  ): Promise<TData[]> {
    const allData: TData[] = [];

    let response = await this.get<TData>(path, params);
    if (Array.isArray(response.data)) {
      allData.push(...response.data);
    } else {
      return [response.data];
    }

    while (response.links?.next && (!maxItems || allData.length < maxItems)) {
      // The next URL is a full absolute URL from Apple's API
      // Use request() directly since the URL is already absolute
      response = await this.request<TData>(response.links.next);
      if (Array.isArray(response.data)) {
        allData.push(...response.data);
      }
    }

    if (maxItems && allData.length > maxItems) {
      return allData.slice(0, maxItems);
    }

    return allData;
  }

  protected async patch<TData, TBody>(
    path: string,
    body: TBody,
  ): Promise<APIResponse<TData>>;
  protected async patch<TData, TBody, TIncluded>(
    path: string,
    body: TBody,
  ): Promise<APIResponse<TData, TIncluded>>;
  protected async patch<TData, TBody, TIncluded>(
    path: string,
    body: TBody,
  ): Promise<APIResponse<TData, TIncluded>> {
    const url = new URL(path, this.baseUrl);

    return this.request<TData, TIncluded>(url.toString(), {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
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

  private async request<TData, TIncluded = never>(
    url: string,
    init?: RequestInit,
  ): Promise<APIResponse<TData, TIncluded>> {
    const response = await fetch(url, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
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

    const payload =
      (await response.json()) as APIResponse<TData, TIncluded> | APIErrorResponse;

    if (!response.ok) {
      const apiErrorResponse = payload as APIErrorResponse;
      const message = apiErrorResponse.errors
        .map((error) => `${error.title}: ${error.detail}`)
        .join('; ');

      throw new Error(`API Error (${response.status}): ${message}`);
    }

    return payload as APIResponse<TData, TIncluded>;
  }
}