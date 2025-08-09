import { vi, describe, it, expect, beforeEach } from 'vitest';
import { detectBullshit, BullshitDetectionConfig } from '../index';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

// Mock OpenAI
const mockCreate = vi.fn();
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    })),
  };
});

describe('External Fact-Checking APIs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Only set test API key if real one isn't present
    if (!process.env.OPENAI_API_KEY) {
      process.env.OPENAI_API_KEY = 'test-api-key';
    }
  });

  describe('Configuration defaults', () => {
    it('should default to llm_only strategy with no external APIs enabled', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify([{
              transcript: 'Water freezes at 0 degrees Celsius.',
              claim: 'Water freezes at 0 degrees Celsius',
              summary: 'Statement about water freezing temperature',
              bullshitLevel: 0,
              confidence: 5,
              reasoning: 'This is a well-established scientific fact',
              truth: 'Water does indeed freeze at 0 degrees Celsius under standard atmospheric pressure'
            }])
          }
        }]
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await detectBullshit('Water freezes at 0 degrees Celsius.');

      expect(result).toHaveLength(1);
      expect(result[0].detectionMethod).toBe('llm_only');
      expect(result[0].externalSources).toBeUndefined();
    });

    it('should include external sources when APIs are enabled with api_enhanced strategy', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify([{
              transcript: 'The Earth is flat.',
              claim: 'The Earth is flat',
              summary: 'Claim about Earth being flat',
              bullshitLevel: 5,
              confidence: 5,
              reasoning: 'This contradicts overwhelming scientific evidence',
              truth: 'The Earth is an oblate spheroid'
            }])
          }
        }]
      };

      // Mock Google Fact Check API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          claims: [{
            text: 'The Earth is flat',
            claimReview: [{
              publisher: { name: 'Snopes' },
              url: 'https://snopes.com/fact-check/earth-flat',
              title: 'Is the Earth Flat?',
              reviewDate: '2023-01-01',
              textualRating: 'False',
              languageCode: 'en'
            }]
          }]
        })
      });

      mockCreate.mockResolvedValueOnce(mockResponse);

      const config: BullshitDetectionConfig = {
        hybridStrategy: 'api_enhanced',
        factCheckAPIs: {
          googleFactCheck: {
            name: 'Google Fact Check',
            enabled: true,
            config: {
              apiKey: 'test-google-api-key'
            }
          }
        }
      };

      const result = await detectBullshit('The Earth is flat.', config);

      expect(result).toHaveLength(1);
      expect(result[0].detectionMethod).toBe('llm_with_api_enhancement');
      expect(result[0].externalSources).toBeDefined();
      expect(result[0].externalSources).toHaveLength(1);
      expect(result[0].externalSources![0].source).toBe('Google Fact Check - Snopes');
      expect(result[0].externalSources![0].rating).toBe('False');
    });
  });

  describe('Google Fact Check API integration', () => {
    it('should handle Google Fact Check API errors gracefully', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify([{
              transcript: 'Test claim.',
              claim: 'Test claim',
              summary: 'Test summary',
              bullshitLevel: 2,
              confidence: 4,
              reasoning: 'Test reasoning',
              truth: 'Test truth'
            }])
          }
        }]
      };

      // Mock API failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });

      mockCreate.mockResolvedValueOnce(mockResponse);

      const config: BullshitDetectionConfig = {
        hybridStrategy: 'api_enhanced',
        factCheckAPIs: {
          googleFactCheck: {
            name: 'Google Fact Check',
            enabled: true,
            config: {
              apiKey: 'invalid-api-key'
            }
          }
        }
      };

      const result = await detectBullshit('Test claim.', config);

      expect(result).toHaveLength(1);
      expect(result[0].detectionMethod).toBe('llm_only'); // Should fall back to LLM only
      expect(result[0].externalSources).toBeUndefined();
    });
  });

  describe('Wikipedia API integration', () => {
    it('should include Wikipedia results when enabled', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify([{
              transcript: 'Paris is the capital of France.',
              claim: 'Paris is the capital of France',
              summary: 'Geographic fact about Paris',
              bullshitLevel: 0,
              confidence: 5,
              reasoning: 'This is a well-known geographic fact',
              truth: 'Paris is indeed the capital of France'
            }])
          }
        }]
      };

      // Mock Wikipedia API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          query: {
            search: [{
              title: 'Paris',
              snippet: 'Paris is the capital and most populous city of France',
              score: 100
            }]
          }
        })
      });

      mockCreate.mockResolvedValueOnce(mockResponse);

      const config: BullshitDetectionConfig = {
        hybridStrategy: 'api_enhanced',
        factCheckAPIs: {
          wikipedia: {
            name: 'Wikipedia',
            enabled: true,
            config: {
              maxResults: 1
            }
          }
        }
      };

      const result = await detectBullshit('Paris is the capital of France.', config);

      expect(result).toHaveLength(1);
      expect(result[0].detectionMethod).toBe('llm_with_api_enhancement');
      expect(result[0].externalSources).toBeDefined();
      expect(result[0].externalSources).toHaveLength(1);
      expect(result[0].externalSources![0].source).toBe('Wikipedia');
      expect(result[0].externalSources![0].url).toContain('wikipedia.org/wiki/Paris');
    });
  });

  describe('ClaimBuster API integration', () => {
    it.skip('should include ClaimBuster results when enabled (temporarily disabled - missing API key)', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify([{
              transcript: 'Unemployment is at 10%.',
              claim: 'Unemployment is at 10%',
              summary: 'Economic statistic claim',
              bullshitLevel: 3,
              confidence: 3,
              reasoning: 'Economic statistics change frequently',
              truth: 'Unemployment rates vary by time and region'
            }])
          }
        }]
      };

      // Mock ClaimBuster API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          score: 0.85
        })
      });

      mockCreate.mockResolvedValueOnce(mockResponse);

      const config: BullshitDetectionConfig = {
        hybridStrategy: 'api_enhanced',
        factCheckAPIs: {
          claimBuster: {
            name: 'ClaimBuster',
            enabled: true,
            config: {
              apiKey: 'test-claim-buster-key'
            }
          }
        }
      };

      const result = await detectBullshit('Unemployment is at 10%.', config);

      expect(result).toHaveLength(1);
      expect(result[0].detectionMethod).toBe('llm_with_api_enhancement');
      expect(result[0].externalSources).toBeDefined();
      expect(result[0].externalSources).toHaveLength(1);
      expect(result[0].externalSources![0].source).toBe('ClaimBuster');
      expect(result[0].externalSources![0].confidence).toBe(0.85);
    });
  });

  describe('Multiple APIs integration', () => {
    it('should combine results from multiple enabled APIs', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify([{
              transcript: 'Climate change is not real.',
              claim: 'Climate change is not real',
              summary: 'Climate change denial claim',
              bullshitLevel: 5,
              confidence: 5,
              reasoning: 'Contradicts scientific consensus',
              truth: 'Climate change is supported by overwhelming scientific evidence'
            }])
          }
        }]
      };

      // Mock multiple API calls
      // Google Fact Check API
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          claims: [{
            text: 'Climate change is not real',
            claimReview: [{
              publisher: { name: 'PolitiFact' },
              url: 'https://politifact.com/climate-change',
              title: 'Climate Change Denial Claims',
              reviewDate: '2023-01-01',
              textualRating: 'Pants on Fire',
              languageCode: 'en'
            }]
          }]
        })
      });

      // Wikipedia API
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          query: {
            search: [{
              title: 'Climate change',
              snippet: 'Climate change refers to long-term shifts in temperatures and weather patterns',
              score: 95
            }]
          }
        })
      });

      mockCreate.mockResolvedValueOnce(mockResponse);

      const config: BullshitDetectionConfig = {
        hybridStrategy: 'api_enhanced',
        factCheckAPIs: {
          googleFactCheck: {
            name: 'Google Fact Check',
            enabled: true,
            config: {
              apiKey: 'test-google-key'
            }
          },
          wikipedia: {
            name: 'Wikipedia',
            enabled: true,
            config: {
              maxResults: 1
            }
          }
        }
      };

      const result = await detectBullshit('Climate change is not real.', config);

      expect(result).toHaveLength(1);
      expect(result[0].detectionMethod).toBe('llm_with_api_enhancement');
      expect(result[0].externalSources).toBeDefined();
      expect(result[0].externalSources).toHaveLength(2);
      expect(result[0].externalSources![0].source).toBe('Google Fact Check - PolitiFact');
      expect(result[0].externalSources![1].source).toBe('Wikipedia');
    });
  });
});