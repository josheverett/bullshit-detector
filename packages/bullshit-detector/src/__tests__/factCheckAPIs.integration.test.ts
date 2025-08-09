import { describe, it, expect, beforeAll } from 'vitest';
import { detectBullshit, BullshitDetectionConfig } from '../index';
import { LLMEvaluator, createCriteria } from './llmEvaluator';

// Integration tests for fact-checking APIs
// These make real API calls to external services when configured
describe('Fact-checking APIs - Integration Tests', () => {
  let llmEvaluator: LLMEvaluator;

  beforeAll(() => {
    if (!process.env.OPENAI_API_KEY) {
      console.warn('OPENAI_API_KEY not set - skipping LLM evaluation');
      return;
    }
    try {
      llmEvaluator = new LLMEvaluator();
    } catch (error) {
      console.warn('LLM Evaluator initialization failed:', error instanceof Error ? error.message : 'Unknown error');
    }
  });

  describe('API-enhanced strategy', () => {
    it('should work with api_enhanced strategy (requires Google Fact Check API key)', async () => {
      // Skip if no Google Fact Check API key
      if (!process.env.GOOGLE_FACT_CHECK_API_KEY) {
        console.warn('GOOGLE_FACT_CHECK_API_KEY not set - skipping Google Fact Check integration test');
        return;
      }

      const config: BullshitDetectionConfig = {
        hybridStrategy: 'api_enhanced',
        factCheckAPIs: {
          googleFactCheck: {
            name: 'Google Fact Check Tools',
            enabled: true,
            config: {
              apiKey: process.env.GOOGLE_FACT_CHECK_API_KEY,
              maxResults: 3
            }
          }
        }
      };

      const results = await detectBullshit('COVID-19 vaccines contain microchips.', config);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThanOrEqual(1);

      const result = results[0];
      expect(result).toMatchObject({
        transcript: 'COVID-19 vaccines contain microchips.',
        claim: expect.any(String),
        bullshitLevel: expect.any(Number),
        confidence: expect.any(Number),
        detectionMethod: expect.stringMatching(/api_enhanced|llm_with_api_enhancement/),
      });

      // Should identify this as false information
      expect(result.bullshitLevel).toBeGreaterThanOrEqual(4);
      expect(result.confidence).toBeGreaterThanOrEqual(3);

      // When external APIs are used, we should have external sources
      if (result.externalSources && result.externalSources.length > 0) {
        expect(result.externalSources[0]).toMatchObject({
          source: expect.any(String),
          url: expect.any(String)
        });
      }

      // LLM Evaluator validation for API-enhanced results
      if (llmEvaluator) {
        const evaluation = await llmEvaluator.evaluateResults(
          'COVID-19 vaccines contain microchips.',
          results,
          createCriteria.falseInformation()
        );

        console.log(`API-Enhanced LLM Evaluation - Score: ${evaluation.score}/10, Passed: ${evaluation.passed}`);
        console.log(`Reasoning: ${evaluation.reasoning}`);

        expect(evaluation.score).toBeGreaterThanOrEqual(4);
        expect(evaluation.passed).toBe(true);
      }
    }, 30000);

    it.skip('should work with api_first strategy and fallback to LLM (temporarily disabled - uses ClaimBuster)', async () => {
      const config: BullshitDetectionConfig = {
        hybridStrategy: 'api_first',
        factCheckAPIs: {
          // Intentionally misconfigured to test fallback
          googleFactCheck: {
            name: 'Google Fact Check Tools',
            enabled: true,
            config: {
              apiKey: 'invalid-key',
              maxResults: 3
            }
          },
          claimBuster: {
            name: 'ClaimBuster',
            enabled: true,
            config: {} // No API key needed for basic endpoint
          }
        }
      };

      const results = await detectBullshit('The Earth is flat.', config);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThanOrEqual(1);

      const result = results[0];
      expect(result).toMatchObject({
        transcript: 'The Earth is flat.',
        claim: expect.any(String),
        bullshitLevel: expect.any(Number),
        confidence: expect.any(Number),
      });

      // Should identify this as false information
      expect(result.bullshitLevel).toBeGreaterThanOrEqual(4);
      expect(result.confidence).toBeGreaterThanOrEqual(3);

      // Should indicate fallback to LLM if APIs failed
      expect(['api_first_with_llm_fallback', 'llm_only']).toContain(result.detectionMethod);
    }, 20000);

    it('should work with Wikipedia search integration', async () => {
      const config: BullshitDetectionConfig = {
        hybridStrategy: 'api_enhanced',
        factCheckAPIs: {
          wikipedia: {
            name: 'Wikipedia Search',
            enabled: true,
            config: {
              maxResults: 2,
              language: 'en'
            }
          }
        }
      };

      const results = await detectBullshit('Mount Everest is the tallest mountain on Earth.', config);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThanOrEqual(1);

      const result = results[0];
      expect(result).toMatchObject({
        transcript: 'Mount Everest is the tallest mountain on Earth.',
        claim: expect.any(String),
        bullshitLevel: expect.any(Number),
        confidence: expect.any(Number),
      });

      // Should identify this as accurate information
      expect(result.bullshitLevel).toBeLessThanOrEqual(1);
      expect(result.confidence).toBeGreaterThanOrEqual(3);

      // When Wikipedia is used, we might have external sources
      if (result.externalSources && result.externalSources.length > 0) {
        const wikipediaSource = result.externalSources.find(s => s.source.includes('Wikipedia'));
        if (wikipediaSource) {
          expect(wikipediaSource).toMatchObject({
            source: expect.stringContaining('Wikipedia'),
            url: expect.stringContaining('wikipedia.org')
          });
        }
      }
    }, 20000);

    it.skip('should work with ClaimBuster API integration (temporarily disabled - missing API key)', async () => {
      const config: BullshitDetectionConfig = {
        hybridStrategy: 'api_enhanced',
        factCheckAPIs: {
          claimBuster: {
            name: 'ClaimBuster',
            enabled: true,
            config: {} // No API key needed for basic endpoint
          }
        }
      };

      const results = await detectBullshit('The President signed a new healthcare bill yesterday.', config);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThanOrEqual(1);

      const result = results[0];
      expect(result).toMatchObject({
        transcript: 'The President signed a new healthcare bill yesterday.',
        claim: expect.any(String),
        bullshitLevel: expect.any(Number),
        confidence: expect.any(Number),
      });

      // This is a specific claim that would need verification
      expect(result.bullshitLevel).toBeGreaterThanOrEqual(0);
      expect(result.bullshitLevel).toBeLessThanOrEqual(5);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(5);

      // When ClaimBuster is used, we might have external sources indicating claim-worthiness
      if (result.externalSources && result.externalSources.length > 0) {
        const claimBusterSource = result.externalSources.find(s => s.source.includes('ClaimBuster'));
        if (claimBusterSource) {
          expect(claimBusterSource).toMatchObject({
            source: expect.stringContaining('ClaimBuster'),
            confidence: expect.any(Number)
          });
        }
      }
    }, 20000);

    it.skip('should handle multiple APIs together (temporarily disabled - uses ClaimBuster)', async () => {
      const config: BullshitDetectionConfig = {
        hybridStrategy: 'api_enhanced',
        factCheckAPIs: {
          claimBuster: {
            name: 'ClaimBuster',
            enabled: true,
            config: {}
          },
          wikipedia: {
            name: 'Wikipedia Search',
            enabled: true,
            config: {
              maxResults: 1,
              language: 'en'
            }
          }
        }
      };

      const results = await detectBullshit('Albert Einstein won the Nobel Prize in Physics in 1921.', config);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThanOrEqual(1);

      const result = results[0];
      expect(result).toMatchObject({
        transcript: 'Albert Einstein won the Nobel Prize in Physics in 1921.',
        claim: expect.any(String),
        bullshitLevel: expect.any(Number),
        confidence: expect.any(Number),
      });

      // Should identify this as accurate historical fact
      expect(result.bullshitLevel).toBeLessThanOrEqual(1);
      expect(result.confidence).toBeGreaterThanOrEqual(3);

      // Multiple APIs might provide multiple external sources
      if (result.externalSources && result.externalSources.length > 0) {
        expect(result.externalSources.length).toBeGreaterThanOrEqual(1);
        result.externalSources.forEach(source => {
          expect(source).toMatchObject({
            source: expect.any(String)
          });
        });
      }
    }, 20000);
  });

  describe('LLM-only strategy (baseline)', () => {
    it('should work correctly with default llm_only strategy', async () => {
      // This should work without any external API keys
      const config: BullshitDetectionConfig = {
        hybridStrategy: 'llm_only'
      };

      const results = await detectBullshit('The speed of light is approximately 299,792,458 meters per second.', config);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThanOrEqual(1);

      const result = results[0];
      expect(result).toMatchObject({
        transcript: 'The speed of light is approximately 299,792,458 meters per second.',
        claim: expect.any(String),
        bullshitLevel: expect.any(Number),
        confidence: expect.any(Number),
        detectionMethod: 'llm_only'
      });

      // Should identify this as accurate scientific fact
      expect(result.bullshitLevel).toBeLessThanOrEqual(1);
      expect(result.confidence).toBeGreaterThanOrEqual(4);

      // LLM-only should not have external sources
      expect(result.externalSources).toBeUndefined();
    }, 15000);

    it('should gracefully handle API failures and fall back to LLM', async () => {
      const config: BullshitDetectionConfig = {
        hybridStrategy: 'api_first',
        factCheckAPIs: {
          googleFactCheck: {
            name: 'Google Fact Check Tools',
            enabled: true,
            config: {
              apiKey: 'definitely-invalid-key',
              maxResults: 3
            }
          }
        }
      };

      const results = await detectBullshit('Water freezes at 0 degrees Celsius.', config);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThanOrEqual(1);

      const result = results[0];
      expect(result).toMatchObject({
        transcript: 'Water freezes at 0 degrees Celsius.',
        claim: expect.any(String),
        bullshitLevel: expect.any(Number),
        confidence: expect.any(Number),
      });

      // Should identify this as accurate scientific fact
      expect(result.bullshitLevel).toBeLessThanOrEqual(1);
      expect(result.confidence).toBeGreaterThanOrEqual(4);

      // Should indicate fallback occurred
      expect(['api_first_with_llm_fallback', 'llm_only']).toContain(result.detectionMethod);
    }, 15000);
  });

  describe('Error handling', () => {
    it('should handle network failures gracefully', async () => {
      const config: BullshitDetectionConfig = {
        hybridStrategy: 'api_enhanced',
        factCheckAPIs: {
          // This will fail since it's not a real endpoint
          googleFactCheck: {
            name: 'Google Fact Check Tools',
            enabled: true,
            config: {
              apiKey: process.env.GOOGLE_FACT_CHECK_API_KEY || 'test-key',
              maxResults: 1
            }
          }
        }
      };

      // Should not throw an error even if APIs fail
      const results = await detectBullshit('Water boils at 100 degrees Celsius at sea level.', config);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThanOrEqual(1);

      const result = results[0];
      expect(result).toMatchObject({
        transcript: 'Water boils at 100 degrees Celsius at sea level.',
        claim: expect.any(String),
        bullshitLevel: expect.any(Number),
        confidence: expect.any(Number),
      });

      // Should fall back to LLM evaluation
      expect(['llm_with_api_enhancement', 'llm_only']).toContain(result.detectionMethod);
    }, 15000);
  });
});