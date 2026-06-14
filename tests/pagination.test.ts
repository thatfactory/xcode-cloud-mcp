import test from 'node:test';
import assert from 'node:assert/strict';
import { BaseAPIClient } from '../src/api/base-client.js';
import type { APIResponse } from '../src/api/types.js';

/**
 * Testable subclass that overrides request() to return mock data
 * without making real HTTP calls. Since both get() and listAll()
 * (for subsequent pages) call request(), this is the single point
 * of interception needed.
 */
class TestableClient extends BaseAPIClient {
  private responses: APIResponse<unknown[]>[] = [];
  private callIndex = 0;

  constructor(responses: APIResponse<unknown[]>[]) {
    super(
      {
        keyId: 'test',
        issuerId: 'test',
        privateKey: '-----BEGIN EC PRIVATE KEY-----\nMHQCAQEEIOBR1JO5H6GH5RF2U8DT0SP9UAXKKO7H5JF7E6U3L2VJoAcGBSuBBAAi\nZW2CAQBEAPnJ5VqvF2i0QzY3N7Y4C7Q3L8KM0N9QF2L8GK5V0Y5H2X1D4W7R9T6M\n-----END EC PRIVATE KEY-----',
      },
      'https://api.appstoreconnect.apple.com',
    );
    this.responses = responses;
  }

  protected override async request<TData, TIncluded = never>(
    _url: string,
    _init?: RequestInit,
  ): Promise<APIResponse<TData, TIncluded>> {
    const response = this.responses[this.callIndex] as unknown as APIResponse<TData, TIncluded>;
    this.callIndex++;
    return response;
  }

  public async testListAll(path: string, params?: Record<string, string>, maxItems?: number): Promise<unknown[]> {
    return this.listAll(path, params, maxItems);
  }
}

test('listAll collects items from a single page with no next link', async () => {
  const client = new TestableClient([
    {
      data: [{ id: '1' }, { id: '2' }],
      links: { self: 'https://api.appstoreconnect.apple.com/v1/test' },
    },
  ]);

  const result = await client.testListAll('/v1/test');

  assert.equal(result.length, 2);
  assert.equal((result[0] as { id: string }).id, '1');
  assert.equal((result[1] as { id: string }).id, '2');
});

test('listAll follows pagination links across multiple pages', async () => {
  const client = new TestableClient([
    {
      data: [{ id: '1' }, { id: '2' }],
      links: {
        self: 'https://api.appstoreconnect.apple.com/v1/test?limit=200',
        next: 'https://api.appstoreconnect.apple.com/v1/test?cursor=page2&limit=200',
      },
    },
    {
      data: [{ id: '3' }, { id: '4' }],
      links: {
        self: 'https://api.appstoreconnect.apple.com/v1/test?cursor=page2&limit=200',
        next: 'https://api.appstoreconnect.apple.com/v1/test?cursor=page3&limit=200',
      },
    },
    {
      data: [{ id: '5' }],
      links: { self: 'https://api.appstoreconnect.apple.com/v1/test?cursor=page3&limit=200' },
    },
  ]);

  const result = await client.testListAll('/v1/test');

  assert.equal(result.length, 5);
  assert.deepEqual(
    result.map((item) => (item as { id: string }).id),
    ['1', '2', '3', '4', '5'],
  );
});

test('listAll rejects pagination links on unexpected origins', async () => {
  const client = new TestableClient([
    {
      data: [{ id: '1' }],
      links: {
        self: 'https://api.appstoreconnect.apple.com/v1/test?limit=200',
        next: 'https://evil.example.test/v1/test?cursor=page2&limit=200',
      },
    },
  ]);

  await assert.rejects(
    () => client.testListAll('/v1/test'),
    {
      message:
        'Unexpected pagination origin: https://evil.example.test. Expected https://api.appstoreconnect.apple.com.',
    },
  );
});

test('listAll returns empty array when first page has empty data', async () => {
  const client = new TestableClient([
    {
      data: [],
      links: { self: 'https://api.appstoreconnect.apple.com/v1/test' },
    },
  ]);

  const result = await client.testListAll('/v1/test');

  assert.equal(result.length, 0);
});

test('listAll respects maxItems limit and stops pagination early', async () => {
  const client = new TestableClient([
    {
      data: [{ id: '1' }, { id: '2' }, { id: '3' }],
      links: {
        self: 'https://api.appstoreconnect.apple.com/v1/test?limit=200',
        next: 'https://api.appstoreconnect.apple.com/v1/test?cursor=page2&limit=200',
      },
    },
    {
      data: [{ id: '4' }, { id: '5' }],
      links: {
        self: 'https://api.appstoreconnect.apple.com/v1/test?cursor=page2&limit=200',
        next: 'https://api.appstoreconnect.apple.com/v1/test?cursor=page3&limit=200',
      },
    },
    {
      data: [{ id: '6' }],
      links: { self: 'https://api.appstoreconnect.apple.com/v1/test?cursor=page3&limit=200' },
    },
  ]);

  // Request only 4 items — should stop after page 2 (3+2=5 >= 4)
  const result = await client.testListAll('/v1/test', undefined, 4);

  assert.equal(result.length, 4);
  assert.deepEqual(
    result.map((item) => (item as { id: string }).id),
    ['1', '2', '3', '4'],
  );
});

test('listAll with maxItems larger than available items returns all items', async () => {
  const client = new TestableClient([
    {
      data: [{ id: '1' }, { id: '2' }],
      links: { self: 'https://api.appstoreconnect.apple.com/v1/test' },
    },
  ]);

  const result = await client.testListAll('/v1/test', undefined, 100);

  assert.equal(result.length, 2);
});

test('listAll handles two pages correctly', async () => {
  const client = new TestableClient([
    {
      data: [{ id: 'a' }],
      links: {
        self: 'https://api.appstoreconnect.apple.com/v1/test',
        next: 'https://api.appstoreconnect.apple.com/v1/test?cursor=2',
      },
    },
    {
      data: [{ id: 'b' }],
      links: { self: 'https://api.appstoreconnect.apple.com/v1/test?cursor=2' },
    },
  ]);

  const result = await client.testListAll('/v1/test');

  assert.equal(result.length, 2);
  assert.deepEqual(
    result.map((item) => (item as { id: string }).id),
    ['a', 'b'],
  );
});
