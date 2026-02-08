import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('loadCredentials with GOOGLE_OAUTH_CREDENTIALS_JSON', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    // Restore env
    process.env = { ...originalEnv };
  });

  it('should load credentials from GOOGLE_OAUTH_CREDENTIALS_JSON env var (installed format)', async () => {
    const creds = {
      installed: {
        client_id: 'test-client-id',
        client_secret: 'test-client-secret',
        redirect_uris: ['http://localhost:3000/oauth2callback']
      }
    };
    process.env.GOOGLE_OAUTH_CREDENTIALS_JSON = JSON.stringify(creds);

    const { loadCredentials } = await import('../../../auth/client.js');
    const result = await loadCredentials();

    expect(result.client_id).toBe('test-client-id');
    expect(result.client_secret).toBe('test-client-secret');
  });

  it('should load credentials from GOOGLE_OAUTH_CREDENTIALS_JSON env var (direct format)', async () => {
    const creds = {
      client_id: 'direct-client-id',
      client_secret: 'direct-client-secret'
    };
    process.env.GOOGLE_OAUTH_CREDENTIALS_JSON = JSON.stringify(creds);

    const { loadCredentials } = await import('../../../auth/client.js');
    const result = await loadCredentials();

    expect(result.client_id).toBe('direct-client-id');
    expect(result.client_secret).toBe('direct-client-secret');
  });

  it('should reject invalid JSON in GOOGLE_OAUTH_CREDENTIALS_JSON', async () => {
    process.env.GOOGLE_OAUTH_CREDENTIALS_JSON = 'not-valid-json';

    const { loadCredentials } = await import('../../../auth/client.js');
    await expect(loadCredentials()).rejects.toThrow();
  });

  it('should reject credentials without client_id or client_secret', async () => {
    process.env.GOOGLE_OAUTH_CREDENTIALS_JSON = JSON.stringify({ foo: 'bar' });

    const { loadCredentials } = await import('../../../auth/client.js');
    await expect(loadCredentials()).rejects.toThrow('Invalid credentials format');
  });
});
