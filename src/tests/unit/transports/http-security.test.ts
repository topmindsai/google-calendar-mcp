import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isLocalhostOrigin, validateBearerToken } from '../../../transports/http.js';
import type http from 'http';

describe('isLocalhostOrigin', () => {
  describe('valid localhost origins', () => {
    it('should accept http://localhost', () => {
      expect(isLocalhostOrigin('http://localhost')).toBe(true);
    });

    it('should accept http://localhost:3000', () => {
      expect(isLocalhostOrigin('http://localhost:3000')).toBe(true);
    });

    it('should accept https://localhost', () => {
      expect(isLocalhostOrigin('https://localhost')).toBe(true);
    });

    it('should accept https://localhost:8080', () => {
      expect(isLocalhostOrigin('https://localhost:8080')).toBe(true);
    });

    it('should accept http://127.0.0.1', () => {
      expect(isLocalhostOrigin('http://127.0.0.1')).toBe(true);
    });

    it('should accept http://127.0.0.1:3000', () => {
      expect(isLocalhostOrigin('http://127.0.0.1:3000')).toBe(true);
    });

    it('should accept https://127.0.0.1', () => {
      expect(isLocalhostOrigin('https://127.0.0.1')).toBe(true);
    });
  });

  describe('subdomain bypass attempts (security critical)', () => {
    it('should reject localhost.attacker.com', () => {
      expect(isLocalhostOrigin('http://localhost.attacker.com')).toBe(false);
    });

    it('should reject localhost.evil.com:3000', () => {
      expect(isLocalhostOrigin('http://localhost.evil.com:3000')).toBe(false);
    });

    it('should reject 127.0.0.1.attacker.com', () => {
      expect(isLocalhostOrigin('http://127.0.0.1.attacker.com')).toBe(false);
    });

    it('should reject localhostevil.com', () => {
      expect(isLocalhostOrigin('http://localhostevil.com')).toBe(false);
    });

    it('should reject subdomain.localhost.attacker.com', () => {
      expect(isLocalhostOrigin('http://subdomain.localhost.attacker.com')).toBe(false);
    });
  });

  describe('other invalid origins', () => {
    it('should reject external domains', () => {
      expect(isLocalhostOrigin('http://example.com')).toBe(false);
    });

    it('should reject external domains with localhost in path', () => {
      expect(isLocalhostOrigin('http://example.com/localhost')).toBe(false);
    });

    it('should reject invalid URLs', () => {
      expect(isLocalhostOrigin('not-a-url')).toBe(false);
    });

    it('should reject empty strings', () => {
      expect(isLocalhostOrigin('')).toBe(false);
    });

    it('should reject other loopback addresses', () => {
      // Only exact 127.0.0.1 is allowed, not other loopback addresses
      expect(isLocalhostOrigin('http://127.0.0.2')).toBe(false);
    });
  });
});

describe('validateBearerToken', () => {
  const originalEnv = process.env.MCP_AUTH_TOKEN;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.MCP_AUTH_TOKEN;
    } else {
      process.env.MCP_AUTH_TOKEN = originalEnv;
    }
  });

  function makeRequest(headers: Record<string, string> = {}): http.IncomingMessage {
    return { headers } as unknown as http.IncomingMessage;
  }

  describe('when MCP_AUTH_TOKEN is not set', () => {
    beforeEach(() => {
      delete process.env.MCP_AUTH_TOKEN;
    });

    it('should return true (no auth required)', () => {
      expect(validateBearerToken(makeRequest())).toBe(true);
    });

    it('should return true even without Authorization header', () => {
      expect(validateBearerToken(makeRequest())).toBe(true);
    });
  });

  describe('when MCP_AUTH_TOKEN is set', () => {
    beforeEach(() => {
      process.env.MCP_AUTH_TOKEN = 'my-secret-token';
    });

    it('should accept valid Bearer token', () => {
      const req = makeRequest({ authorization: 'Bearer my-secret-token' });
      expect(validateBearerToken(req)).toBe(true);
    });

    it('should accept raw token (no Bearer prefix)', () => {
      const req = makeRequest({ authorization: 'my-secret-token' });
      expect(validateBearerToken(req)).toBe(true);
    });

    it('should reject missing Authorization header', () => {
      const req = makeRequest();
      expect(validateBearerToken(req)).toBe(false);
    });

    it('should reject invalid token', () => {
      const req = makeRequest({ authorization: 'Bearer wrong-token' });
      expect(validateBearerToken(req)).toBe(false);
    });

    it('should reject empty Authorization header', () => {
      const req = makeRequest({ authorization: '' });
      expect(validateBearerToken(req)).toBe(false);
    });

    it('should reject Bearer with extra whitespace', () => {
      const req = makeRequest({ authorization: 'Bearer  my-secret-token' });
      expect(validateBearerToken(req)).toBe(false);
    });

    it('should be case-sensitive for token value', () => {
      const req = makeRequest({ authorization: 'Bearer MY-SECRET-TOKEN' });
      expect(validateBearerToken(req)).toBe(false);
    });
  });
});
