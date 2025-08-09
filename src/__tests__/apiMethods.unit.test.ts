import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  checkWithGoogleFactCheck,
  checkWithClaimBuster,
  searchWikipedia,
  GoogleFactCheckConfig,
  ClaimBusterConfig,
  WikipediaConfig
} from '../index';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('API Methods - Direct Testing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkWithGoogleFactCheck', () => {
    const validConfig: GoogleFactCheckConfig = {
      apiKey: 'test-api-key',
      maxResults: 3
    };

    it('should successfully parse valid Google Fact Check response', async () => {
      const mockResponse = {
        claims: [
          {
            text: 'Test claim',
            claimReview: [{
              publisher: { name: 'Snopes' },
              url: 'https://snopes.com/test',
              title: 'Test Fact Check',
              reviewDate: '2023-01-01',
              textualRating: 'False',
              languageCode: 'en'
            }]
          }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await checkWithGoogleFactCheck('test claim', validConfig);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        text: 'Test claim',
        claimReview: expect.arrayContaining([
          expect.objectContaining({
            publisher: { name: 'Snopes' },
            textualRating: 'False'
          })
        ])
      });

      // Verify fetch was called with correct parameters
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('https://factchecktools.googleapis.com/v1alpha1/claims:search')
      );
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('query=test+claim'); // URLSearchParams uses + for spaces
      expect(calledUrl).toContain('key=test-api-key');
      expect(calledUrl).toContain('pageSize=3');
    });

    it('should return empty array on 4xx response (graceful handling)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden'
      });

      const result = await checkWithGoogleFactCheck('test claim', validConfig);
      expect(result).toEqual([]);
    });

    it('should return empty array on 5xx response (graceful handling)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      const result = await checkWithGoogleFactCheck('test claim', validConfig);
      expect(result).toEqual([]);
    });

    it('should handle response with no claims', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}) // No claims property
      });

      const result = await checkWithGoogleFactCheck('test claim', validConfig);
      expect(result).toEqual([]);
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await checkWithGoogleFactCheck('test claim', validConfig);
      expect(result).toEqual([]);
    });
  });

  describe('checkWithClaimBuster', () => {
    const validConfig: ClaimBusterConfig = {
      apiKey: 'test-claim-buster-key'
    };

    it('should successfully parse valid ClaimBuster response', async () => {
      const mockResponse = {
        score: 0.85
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await checkWithClaimBuster('test claim', validConfig);

      expect(result).toMatchObject({
        score: 0.85,
        claim: 'test claim'
      });

      // Verify fetch was called with correct parameters
      expect(mockFetch).toHaveBeenCalledWith(
        'https://idir.uta.edu/claimbuster/api/v2/score/text',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-api-key': 'test-claim-buster-key'
          }),
          body: JSON.stringify({ input_text: 'test claim' })
        })
      );
    });

    it('should work without API key', async () => {
      const mockResponse = {
        score: 0.75
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await checkWithClaimBuster('test claim', {});

      expect(result).toMatchObject({
        score: 0.75,
        claim: 'test claim'
      });

      // Verify no API key header was sent
      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers).not.toHaveProperty('x-api-key');
    });

    it('should return null on 4xx response (graceful handling)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });

      const result = await checkWithClaimBuster('test claim', validConfig);
      expect(result).toBeNull();
    });

    it('should handle response with no score', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}) // No score property
      });

      const result = await checkWithClaimBuster('test claim', validConfig);
      expect(result).toMatchObject({
        score: 0,
        claim: 'test claim'
      });
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await checkWithClaimBuster('test claim', validConfig);
      expect(result).toBeNull();
    });
  });

  describe('searchWikipedia', () => {
    const validConfig: WikipediaConfig = {
      maxResults: 2,
      language: 'en'
    };

    it('should successfully parse valid Wikipedia response', async () => {
      const mockResponse = {
        query: {
          search: [
            {
              title: 'Test Article',
              snippet: 'This is a <em>test</em> snippet with HTML'
            },
            {
              title: 'Another Article',
              snippet: 'Another snippet'
            }
          ]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await searchWikipedia('test query', validConfig);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        title: 'Test Article',
        snippet: 'This is a test snippet with HTML', // HTML tags should be removed
        url: 'https://en.wikipedia.org/wiki/Test%20Article',
        confidence: 0.9 // First result gets highest confidence
      });

      // Verify fetch was called with correct parameters
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('https://en.wikipedia.org/w/api.php');
      expect(calledUrl).toContain('srsearch=test+query'); // URLSearchParams uses + for spaces
      expect(calledUrl).toContain('srlimit=2');
    });

    it('should use default language when not specified', async () => {
      const mockResponse = {
        query: { search: [] }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      await searchWikipedia('test', {});

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('https://en.wikipedia.org/w/api.php');
    });

    it('should use specified language', async () => {
      const mockResponse = {
        query: { search: [] }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      await searchWikipedia('test', { language: 'fr' });

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('https://fr.wikipedia.org/w/api.php');
    });

    it('should return empty array on 4xx response (graceful handling)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      const result = await searchWikipedia('test query', validConfig);
      expect(result).toEqual([]);
    });

    it('should handle response with no search results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}) // No query property
      });

      const result = await searchWikipedia('test query', validConfig);
      expect(result).toEqual([]);
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await searchWikipedia('test query', validConfig);
      expect(result).toEqual([]);
    });

    it('should assign confidence based on result order', async () => {
      const mockResponse = {
        query: {
          search: [
            {
              title: 'First Article',
              snippet: 'First result'
            },
            {
              title: 'Second Article',
              snippet: 'Second result'
            }
          ]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await searchWikipedia('test', validConfig);

      expect(result[0].confidence).toBe(0.9); // First result gets highest confidence
      expect(result[1].confidence).toBe(0.8); // Second result gets lower confidence
    });
  });
});
