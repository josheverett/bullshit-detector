import { describe, it, expect } from 'vitest';
import {
  checkWithGoogleFactCheck,
  checkWithClaimBuster,
  searchWikipedia,
  GoogleFactCheckConfig,
  ClaimBusterConfig,
  WikipediaConfig
} from '../index';

describe('API Methods - Live Tests (Real API Calls)', () => {
  describe('checkWithGoogleFactCheck - Live', () => {
    it('should successfully call Google Fact Check API with valid key', async () => {
      // Skip if no API key
      if (!process.env.GOOGLE_FACT_CHECK_API_KEY) {
        console.warn('GOOGLE_FACT_CHECK_API_KEY not set - skipping live Google Fact Check test');
        return;
      }

      const config: GoogleFactCheckConfig = {
        apiKey: process.env.GOOGLE_FACT_CHECK_API_KEY,
        maxResults: 2
      };

      // This should NOT throw an error if API key is valid
      const result = await checkWithGoogleFactCheck('COVID-19 vaccines contain microchips', config);

      // Should return an array (may be empty if no fact checks found)
      expect(Array.isArray(result)).toBe(true);

      // If results found, validate structure
      if (result.length > 0) {
        const firstResult = result[0];
        expect(firstResult).toHaveProperty('text');
        expect(typeof firstResult.text).toBe('string');

        if (firstResult.claimReview && firstResult.claimReview.length > 0) {
          const review = firstResult.claimReview[0];
          expect(review).toHaveProperty('publisher');
          expect(review.publisher).toHaveProperty('name');
          expect(review).toHaveProperty('url');
          expect(review).toHaveProperty('textualRating');
        }
      }
    }, 10000);

    it('should return empty array with invalid API key (graceful handling)', async () => {
      const config: GoogleFactCheckConfig = {
        apiKey: 'definitely-invalid-api-key-12345',
        maxResults: 1
      };

      // With invalid API key, should return empty array (graceful error handling)
      const result = await checkWithGoogleFactCheck('test claim', config);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual([]);
    }, 10000);
  });

  describe.skip('checkWithClaimBuster - Live (disabled - API appears down)', () => {
    it('should successfully call ClaimBuster API without key', async () => {
      const config: ClaimBusterConfig = {};

      // ClaimBuster public endpoint should work without API key
      const result = await checkWithClaimBuster('The President signed a healthcare bill', config);

      expect(result).not.toBeNull();
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('claim');
      expect(typeof result!.score).toBe('number');
      expect(result!.score).toBeGreaterThanOrEqual(0);
      expect(result!.score).toBeLessThanOrEqual(1);
      expect(result!.claim).toBe('The President signed a healthcare bill');
    }, 15000);

    it('should handle ClaimBuster API errors appropriately', async () => {
      // Test with malformed request to trigger error
      const config: ClaimBusterConfig = {
        apiKey: 'invalid-key-that-might-cause-auth-error'
      };

      // This might throw or return null depending on ClaimBuster's error handling
      // We expect either a valid result or null (graceful handling)
      const result = await checkWithClaimBuster('test', config);

      // Should either succeed or return null (not throw unhandled errors)
      expect(result === null || (result && typeof result.score === 'number')).toBe(true);
    }, 15000);
  });

  describe('searchWikipedia - Live', () => {
    it('should successfully search Wikipedia', async () => {
      const config: WikipediaConfig = {
        maxResults: 2,
        language: 'en'
      };

      const result = await searchWikipedia('Albert Einstein', config);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(2);

      const firstResult = result[0];
      expect(firstResult).toHaveProperty('title');
      expect(firstResult).toHaveProperty('snippet');
      expect(firstResult).toHaveProperty('url');
      expect(firstResult).toHaveProperty('confidence');

      expect(typeof firstResult.title).toBe('string');
      expect(typeof firstResult.snippet).toBe('string');
      expect(typeof firstResult.url).toBe('string');
      expect(typeof firstResult.confidence).toBe('number');

      expect(firstResult.url).toContain('wikipedia.org');
      expect(firstResult.confidence).toBeGreaterThanOrEqual(0);
      expect(firstResult.confidence).toBeLessThanOrEqual(1);

      // Should not contain HTML tags in snippet
      expect(firstResult.snippet).not.toMatch(/<[^>]*>/);
    }, 10000);

    it('should handle different languages', async () => {
      const config: WikipediaConfig = {
        maxResults: 1,
        language: 'fr'
      };

      const result = await searchWikipedia('Paris', config);

      expect(Array.isArray(result)).toBe(true);

      if (result.length > 0) {
        expect(result[0].url).toContain('fr.wikipedia.org');
      }
    }, 10000);

    it('should handle invalid Wikipedia language gracefully', async () => {
      const config: WikipediaConfig = {
        maxResults: 1,
        language: 'invalid-language-code-xyz'
      };

      // This might fail or return empty results
      // We test that it doesn't throw unhandled errors
      await expect(async () => {
        const result = await searchWikipedia('test', config);
        expect(Array.isArray(result)).toBe(true);
      }).not.toThrow();
    }, 10000);
  });

  describe('Error handling with real network conditions', () => {
    it('should handle timeout scenarios', async () => {
      // Note: This test might be flaky depending on network conditions
      // It's mainly to ensure timeout handling works

      if (!process.env.GOOGLE_FACT_CHECK_API_KEY) {
        console.warn('Skipping timeout test - no API key');
        return;
      }

      const config: GoogleFactCheckConfig = {
        apiKey: process.env.GOOGLE_FACT_CHECK_API_KEY,
        maxResults: 1
      };

      // Use a very long query that might be slow
      const longQuery = 'This is a very long and complex claim about multiple topics that might take time to process and could potentially timeout or cause performance issues with the fact checking API service';

      // Should either succeed or fail gracefully (not hang)
      const result = await checkWithGoogleFactCheck(longQuery, config);
      expect(Array.isArray(result)).toBe(true);
    }, 20000);
  });
});
