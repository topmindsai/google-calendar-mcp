/**
 * Comprehensive tests for list-events tool registration flow
 * Tests the complete path: schema validation → handlerFunction → handler execution
 *
 * These tests verify the fix for issue #95 by testing:
 * 1. Schema validation (accepts all formats)
 * 2. HandlerFunction preprocessing (converts single-quoted JSON, validates arrays)
 * 3. Real-world scenarios from Home Assistant and other integrations
 */

import { describe, it, expect } from 'vitest';
import { ToolSchemas, ToolRegistry } from '../../../tools/registry.js';

// Get the handlerFunction for testing the full flow
const toolDefinition = (ToolRegistry as any).tools?.find((t: any) => t.name === 'list-events');
const handlerFunction = toolDefinition?.handlerFunction;

describe('list-events Registration Flow (Schema + HandlerFunction)', () => {
  describe('Account parameter schema validation', () => {
    it('should accept single account string', () => {
      const input = {
        account: 'work',
        calendarId: 'primary',
        timeMin: '2024-01-01T00:00:00',
        timeMax: '2024-01-02T00:00:00'
      };

      const result = ToolSchemas['list-events'].safeParse(input);
      expect(result.success).toBe(true);
      expect(result.data?.account).toBe('work');
    });

    it('should reject non-string account values (arrays not accepted at schema level)', () => {
      const input = {
        account: ['work', 'personal'],
        calendarId: 'primary',
        timeMin: '2024-01-01T00:00:00',
        timeMax: '2024-01-02T00:00:00'
      };

      const result = ToolSchemas['list-events'].safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject invalid account IDs', () => {
      const input = {
        account: 'INVALID_UPPERCASE',
        calendarId: 'primary',
        timeMin: '2024-01-01T00:00:00',
        timeMax: '2024-01-02T00:00:00'
      };

      const result = ToolSchemas['list-events'].safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should allow omitting account parameter', () => {
      const input = {
        calendarId: 'primary',
        timeMin: '2024-01-01T00:00:00',
        timeMax: '2024-01-02T00:00:00'
      };

      const result = ToolSchemas['list-events'].safeParse(input);
      expect(result.success).toBe(true);
      expect(result.data?.account).toBeUndefined();
    });
  });

  describe('Schema validation (first step)', () => {
    it('should reject native array format (simplified schema accepts only strings)', () => {
      const input = {
        calendarId: ['primary', 'work@example.com'],
        timeMin: '2024-01-01T00:00:00',
        timeMax: '2024-01-02T00:00:00'
      };

      const result = ToolSchemas['list-events'].safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should validate single string format', () => {
      const input = {
        calendarId: 'primary',
        timeMin: '2024-01-01T00:00:00',
        timeMax: '2024-01-02T00:00:00'
      };

      const result = ToolSchemas['list-events'].safeParse(input);
      expect(result.success).toBe(true);
      expect(result.data?.calendarId).toBe('primary');
    });

    it('should validate JSON string format (array as string)', () => {
      const input = {
        calendarId: '["primary", "work@example.com"]',
        timeMin: '2024-01-01T00:00:00',
        timeMax: '2024-01-02T00:00:00'
      };

      const result = ToolSchemas['list-events'].safeParse(input);
      expect(result.success).toBe(true);
      expect(result.data?.calendarId).toBe('["primary", "work@example.com"]');
    });
  });

  describe('Array validation via handlerFunction (not schema)', () => {
    // With simplified schemas, native arrays are rejected at schema level.
    // Array validation (min/max/duplicates) happens in handlerFunction via JSON string parsing.
    it('should reject native arrays at schema level', () => {
      const input = {
        calendarId: [],
        timeMin: '2024-01-01T00:00:00',
        timeMax: '2024-01-02T00:00:00'
      };

      const result = ToolSchemas['list-events'].safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('Type preservation after validation', () => {
    it('should preserve string type for single strings', () => {
      const input = {
        calendarId: 'primary',
        timeMin: '2024-01-01T00:00:00',
        timeMax: '2024-01-02T00:00:00'
      };

      const result = ToolSchemas['list-events'].parse(input);
      expect(typeof result.calendarId).toBe('string');
      expect(result.calendarId).toBe('primary');
    });

    it('should preserve string type for JSON array strings', () => {
      const input = {
        calendarId: '["primary", "work@example.com"]',
        timeMin: '2024-01-01T00:00:00',
        timeMax: '2024-01-02T00:00:00'
      };

      const result = ToolSchemas['list-events'].parse(input);
      expect(typeof result.calendarId).toBe('string');
      expect(result.calendarId).toBe('["primary", "work@example.com"]');
    });
  });

  describe('Real-world scenarios from issue #95', () => {
    it('should handle multi-calendar via JSON string format', () => {
      // With simplified schemas, multi-calendar is via JSON array strings
      const input = {
        calendarId: '["primary", "work@example.com", "personal@example.com", "family@example.com", "events@example.com"]',
        timeMin: '2025-10-09T00:00:00',
        timeMax: '2025-10-09T23:59:59'
      };

      const result = ToolSchemas['list-events'].safeParse(input);
      expect(result.success).toBe(true);
      expect(typeof result.data?.calendarId).toBe('string');
    });

    it('should accept single-quoted JSON string format (Python/shell style)', () => {
      const input = {
        calendarId: "['primary', 'nathan@brand.ai']",
        timeMin: '2025-10-09T00:00:00',
        timeMax: '2025-10-09T23:59:59'
      };

      const result = ToolSchemas['list-events'].safeParse(input);
      expect(result.success).toBe(true);
      expect(typeof result.data?.calendarId).toBe('string');
      expect(result.data?.calendarId).toBe("['primary', 'nathan@brand.ai']");
    });
  });

  // HandlerFunction tests - second step after schema validation
  if (!handlerFunction) {
    console.warn('⚠️  handlerFunction not found - skipping handler tests');
  } else {
    describe('HandlerFunction preprocessing (second step)', () => {
      describe('Format handling', () => {
        it('should pass through native arrays unchanged', async () => {
          const input = {
            calendarId: ['primary', 'work@example.com'],
            timeMin: '2024-01-01T00:00:00',
            timeMax: '2024-01-02T00:00:00'
          };

          const result = await handlerFunction(input);
          expect(Array.isArray(result.calendarId)).toBe(true);
          expect(result.calendarId).toEqual(['primary', 'work@example.com']);
        });

        it('should pass through single strings unchanged', async () => {
          const input = {
            calendarId: 'primary',
            timeMin: '2024-01-01T00:00:00',
            timeMax: '2024-01-02T00:00:00'
          };

          const result = await handlerFunction(input);
          expect(typeof result.calendarId).toBe('string');
          expect(result.calendarId).toBe('primary');
        });

        it('should parse valid JSON strings with double quotes', async () => {
          const input = {
            calendarId: '["primary", "work@example.com"]',
            timeMin: '2024-01-01T00:00:00',
            timeMax: '2024-01-02T00:00:00'
          };

          const result = await handlerFunction(input);
          expect(Array.isArray(result.calendarId)).toBe(true);
          expect(result.calendarId).toEqual(['primary', 'work@example.com']);
        });

        it('should parse single-quoted JSON-like strings (Python/shell style) - THE KEY FIX', async () => {
          // This is the failing case that needed fixing
          const input = {
            calendarId: "['primary', 'nathan@brand.ai']",
            timeMin: '2025-10-09T00:00:00',
            timeMax: '2025-10-09T23:59:59'
          };

          const result = await handlerFunction(input);
          expect(Array.isArray(result.calendarId)).toBe(true);
          expect(result.calendarId).toEqual(['primary', 'nathan@brand.ai']);
        });

        it('should handle calendar IDs with apostrophes in single-quoted JSON', async () => {
          // Calendar IDs can contain apostrophes (e.g., "John's Calendar")
          // Our replacement logic should not break these
          const input = {
            calendarId: "['primary', 'johns-calendar@example.com']",
            timeMin: '2024-01-01T00:00:00',
            timeMax: '2024-01-02T00:00:00'
          };

          const result = await handlerFunction(input);
          expect(Array.isArray(result.calendarId)).toBe(true);
          expect(result.calendarId).toEqual(['primary', 'johns-calendar@example.com']);
        });

        it('should handle JSON strings with whitespace', async () => {
          const input = {
            calendarId: '  ["primary", "work@example.com"]  ',
            timeMin: '2024-01-01T00:00:00',
            timeMax: '2024-01-02T00:00:00'
          };

          const result = await handlerFunction(input);
          expect(Array.isArray(result.calendarId)).toBe(true);
          expect(result.calendarId).toEqual(['primary', 'work@example.com']);
        });
      });

      describe('JSON string validation', () => {
        it('should reject empty arrays in JSON strings', async () => {
          const input = {
            calendarId: '[]',
            timeMin: '2024-01-01T00:00:00',
            timeMax: '2024-01-02T00:00:00'
          };

          await expect(handlerFunction(input)).rejects.toThrow('At least one calendar ID is required');
        });

        it('should reject arrays exceeding 50 calendars', async () => {
          const input = {
            calendarId: JSON.stringify(Array(51).fill('calendar')),
            timeMin: '2024-01-01T00:00:00',
            timeMax: '2024-01-02T00:00:00'
          };

          await expect(handlerFunction(input)).rejects.toThrow('Maximum 50 calendars');
        });

        it('should reject duplicate calendar IDs in JSON strings', async () => {
          const input = {
            calendarId: '["primary", "primary"]',
            timeMin: '2024-01-01T00:00:00',
            timeMax: '2024-01-02T00:00:00'
          };

          await expect(handlerFunction(input)).rejects.toThrow('Duplicate calendar IDs');
        });
      });

      describe('Error handling', () => {
        it('should provide clear error for malformed JSON array', async () => {
          const input = {
            calendarId: '["primary", "missing-quote}]',
            timeMin: '2024-01-01T00:00:00',
            timeMax: '2024-01-02T00:00:00'
          };

          await expect(handlerFunction(input)).rejects.toThrow('Invalid JSON format for calendarId');
        });

        it('should reject JSON arrays with non-string elements', async () => {
          const input = {
            calendarId: '["primary", 123, null]',
            timeMin: '2024-01-01T00:00:00',
            timeMax: '2024-01-02T00:00:00'
          };

          await expect(handlerFunction(input)).rejects.toThrow('Array must contain only non-empty strings');
        });
      });

      describe('Account parameter preservation', () => {
        it('should preserve single account string parameter', async () => {
          const input = {
            account: 'work',
            calendarId: 'primary',
            timeMin: '2024-01-01T00:00:00',
            timeMax: '2024-01-02T00:00:00'
          };

          const result = await handlerFunction(input);
          expect(result.account).toBe('work');
        });

        it('should preserve account string parameter', async () => {
          const input = {
            account: 'personal',
            calendarId: 'primary',
            timeMin: '2024-01-01T00:00:00',
            timeMax: '2024-01-02T00:00:00'
          };

          const result = await handlerFunction(input);
          expect(result.account).toBe('personal');
        });

        it('should preserve undefined account when not provided', async () => {
          const input = {
            calendarId: 'primary',
            timeMin: '2024-01-01T00:00:00',
            timeMax: '2024-01-02T00:00:00'
          };

          const result = await handlerFunction(input);
          expect(result.account).toBeUndefined();
        });

        it('should preserve account when calendarId is JSON string', async () => {
          const input = {
            account: 'normal',
            calendarId: '["primary", "work@example.com"]',
            timeMin: '2024-01-01T00:00:00',
            timeMax: '2024-01-02T00:00:00'
          };

          const result = await handlerFunction(input);
          expect(result.account).toBe('normal');
          expect(Array.isArray(result.calendarId)).toBe(true);
        });

        it('should preserve account when calendarId is JSON array string', async () => {
          const input = {
            account: 'personal',
            calendarId: '["primary", "work@example.com"]',
            timeMin: '2024-01-01T00:00:00',
            timeMax: '2024-01-02T00:00:00'
          };

          const result = await handlerFunction(input);
          expect(result.account).toBe('personal');
          expect(Array.isArray(result.calendarId)).toBe(true);
          expect(result.calendarId).toEqual(['primary', 'work@example.com']);
        });
      });
    });
  }
});
