import { describe, it, expect, beforeAll } from 'vitest';
import { detectBullshit, OpenAIMessage, BullshitDetector, BullshitDetectionConfig } from '../index';
import { LLMEvaluator, createCriteria } from './llmEvaluator';

// Integration tests - these make real API calls to OpenAI
// They require OPENAI_API_KEY to be set in environment
describe('detectBullshit - Integration Tests', () => {
  // Skip tests if no API key is available
  const skipIfNoApiKey = process.env.OPENAI_API_KEY ? describe : describe.skip;
  
  let llmEvaluator: LLMEvaluator;

  skipIfNoApiKey('Live API calls', () => {
    beforeAll(() => {
      if (!process.env.OPENAI_API_KEY) {
        console.warn('OPENAI_API_KEY not set - skipping integration tests');
      }
      try {
        llmEvaluator = new LLMEvaluator();
      } catch (error) {
        console.warn('LLM Evaluator initialization failed:', error instanceof Error ? error.message : 'Unknown error');
        console.warn('Tests will run without LLM evaluation');
      }
    });

    describe('String input integration tests', () => {
      it('should correctly identify accurate scientific fact', async () => {
        const inputClaim = 'Water boils at 100 degrees Celsius at sea level.';
        const results = await detectBullshit(inputClaim);

        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBeGreaterThanOrEqual(1);
        
        const result = results[0];
        expect(result).toMatchObject({
          transcript: inputClaim,
          bullshitLevel: expect.any(Number),
          confidence: expect.any(Number),
          claim: expect.any(String),
          summary: expect.any(String),
          reasoning: expect.any(String),
          truth: expect.any(String),
        });

        // Should have low bullshit level for accurate fact
        expect(result.bullshitLevel).toBeLessThanOrEqual(2);
        expect(result.confidence).toBeGreaterThanOrEqual(3);

        // Validate numeric ranges
        expect(result.bullshitLevel).toBeGreaterThanOrEqual(0);
        expect(result.bullshitLevel).toBeLessThanOrEqual(5);
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(5);

        // LLM Evaluator validation
        if (llmEvaluator) {
          const evaluation = await llmEvaluator.evaluateResults(
            inputClaim, 
            results, 
            createCriteria.truthfulClaim()
          );
          
          console.log(`LLM Evaluation - Score: ${evaluation.score}/10, Passed: ${evaluation.passed}`);
          console.log(`Reasoning: ${evaluation.reasoning}`);
          if (evaluation.suggestions) {
            console.log(`Suggestions: ${evaluation.suggestions}`);
          }
          
          // Test should pass according to LLM evaluator (with some tolerance for edge cases)
          expect(evaluation.score).toBeGreaterThanOrEqual(4);
          expect(evaluation.passed).toBe(true);
        }
      }, 25000);

      it('should correctly identify false information', async () => {
        const inputClaim = 'The sun revolves around the Earth.';
        const results = await detectBullshit(inputClaim);

        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBeGreaterThanOrEqual(1);
        
        const result = results[0];
        expect(result).toMatchObject({
          transcript: inputClaim,
          bullshitLevel: expect.any(Number),
          confidence: expect.any(Number),
          claim: expect.any(String),
          summary: expect.any(String),
          reasoning: expect.any(String),
          truth: expect.any(String),
        });

        // Should have high bullshit level for false information
        expect(result.bullshitLevel).toBeGreaterThanOrEqual(3);
        expect(result.confidence).toBeGreaterThanOrEqual(3);

        // Validate numeric ranges
        expect(result.bullshitLevel).toBeGreaterThanOrEqual(0);
        expect(result.bullshitLevel).toBeLessThanOrEqual(5);
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(5);

        // LLM Evaluator validation
        if (llmEvaluator) {
          const evaluation = await llmEvaluator.evaluateResults(
            inputClaim, 
            results, 
            createCriteria.falseInformation()
          );
          
          console.log(`LLM Evaluation - Score: ${evaluation.score}/10, Passed: ${evaluation.passed}`);
          console.log(`Reasoning: ${evaluation.reasoning}`);
          if (evaluation.suggestions) {
            console.log(`Suggestions: ${evaluation.suggestions}`);
          }
          
          // Test should pass according to LLM evaluator
          expect(evaluation.score).toBeGreaterThanOrEqual(4);
          expect(evaluation.passed).toBe(true);
        }
      }, 25000);

      it('should handle ambiguous or opinion-based statements', async () => {
        const inputClaim = 'Pizza is the best food in the world.';
        const results = await detectBullshit(inputClaim);

        // Opinion statements might not have factual claims, so array could be empty or have subjective evaluation
        expect(Array.isArray(results)).toBe(true);
        
        if (results.length > 0) {
          const result = results[0];
          expect(result).toMatchObject({
            transcript: inputClaim,
            bullshitLevel: expect.any(Number),
            confidence: expect.any(Number),
            claim: expect.any(String),
            summary: expect.any(String),
            reasoning: expect.any(String),
            truth: expect.any(String),
          });

          // Should have reasonable confidence bounds for subjective statements
          expect(result.bullshitLevel).toBeGreaterThanOrEqual(0);
          expect(result.bullshitLevel).toBeLessThanOrEqual(5);
          expect(result.confidence).toBeGreaterThanOrEqual(0);
          expect(result.confidence).toBeLessThanOrEqual(5);

          // LLM Evaluator validation for ambiguous statements
          if (llmEvaluator) {
            const evaluation = await llmEvaluator.evaluateResults(
              inputClaim, 
              results, 
              createCriteria.ambiguousStatement()
            );
            
            console.log(`LLM Evaluation - Score: ${evaluation.score}/10, Passed: ${evaluation.passed}`);
            console.log(`Reasoning: ${evaluation.reasoning}`);
            
            // Should be more lenient for opinion-based statements
            expect(evaluation.score).toBeGreaterThanOrEqual(3);
            expect(evaluation.passed).toBe(true);
          }
        } else if (llmEvaluator) {
          // If no results, evaluate the empty array response
          const evaluation = await llmEvaluator.evaluateResults(inputClaim, results, {});
          console.log(`LLM Evaluation (no results) - Score: ${evaluation.score}/10, Passed: ${evaluation.passed}`);
          console.log(`Reasoning: ${evaluation.reasoning}`);
          
          // Empty results might be acceptable for pure opinion statements
          expect(evaluation.score).toBeGreaterThanOrEqual(2);
        }
      }, 25000);

      it('should handle complex statements with multiple claims', async () => {
        const inputClaim = 'Einstein developed the theory of relativity in 1905, and he also invented the telephone.';
        const results = await detectBullshit(inputClaim);

        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBeGreaterThanOrEqual(1); // Should detect at least one factual claim
        
        // Should have multiple claims detected (Einstein + relativity + telephone invention)
        expect(results.length).toBeGreaterThanOrEqual(2);
        
        results.forEach(result => {
          expect(result).toMatchObject({
            transcript: expect.stringContaining('Einstein'),
            bullshitLevel: expect.any(Number),
            confidence: expect.any(Number),
            claim: expect.any(String),
            summary: expect.any(String),
            reasoning: expect.any(String),
            truth: expect.any(String),
          });

          // Validate numeric ranges
          expect(result.bullshitLevel).toBeGreaterThanOrEqual(0);
          expect(result.bullshitLevel).toBeLessThanOrEqual(5);
          expect(result.confidence).toBeGreaterThanOrEqual(0);
          expect(result.confidence).toBeLessThanOrEqual(5);
        });

        // At least one result should have high bullshit level (telephone claim)
        const hasFalseClaim = results.some(r => r.bullshitLevel >= 3);
        expect(hasFalseClaim).toBe(true);

        // LLM Evaluator validation for multiple claims
        if (llmEvaluator) {
          const evaluation = await llmEvaluator.evaluateResults(
            inputClaim, 
            results, 
            { allowableVariance: 1 }
          );
          
          console.log(`LLM Evaluation (${results.length} claims) - Score: ${evaluation.score}/10, Passed: ${evaluation.passed}`);
          console.log(`Reasoning: ${evaluation.reasoning}`);
          
          // Should correctly identify both true and false claims
          expect(evaluation.score).toBeGreaterThanOrEqual(4);
          expect(evaluation.passed).toBe(true);
        }
      }, 25000);
    });

    describe('OpenAI message input integration tests', () => {
      it('should process conversation context correctly', async () => {
        const messages: OpenAIMessage[] = [
          { role: 'user', content: 'Tell me about historical events.' },
          { role: 'assistant', content: 'I can help with historical information. What specific period interests you?' },
          { role: 'user', content: 'World War II ended in 1945.' }
        ];

        const results = await detectBullshit(messages);

        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBeGreaterThanOrEqual(1);
        
        const result = results[0];
        expect(result).toMatchObject({
          transcript: 'World War II ended in 1945.',
          bullshitLevel: expect.any(Number),
          confidence: expect.any(Number),
          claim: expect.any(String),
          summary: expect.any(String),
          reasoning: expect.any(String),
          truth: expect.any(String),
        });

        // Should have low bullshit level for accurate historical fact
        expect(result.bullshitLevel).toBeLessThanOrEqual(2);
        expect(result.confidence).toBeGreaterThanOrEqual(3);

        // Validate numeric ranges
        expect(result.bullshitLevel).toBeGreaterThanOrEqual(0);
        expect(result.bullshitLevel).toBeLessThanOrEqual(5);
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(5);
      }, 15000);

      it('should handle false claims in conversation context', async () => {
        const messages: OpenAIMessage[] = [
          { role: 'user', content: 'What do you know about space?' },
          { role: 'assistant', content: 'I can share information about space and astronomy.' },
          { role: 'user', content: 'Mars is closer to the sun than Mercury.' }
        ];

        const results = await detectBullshit(messages);

        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBeGreaterThanOrEqual(1);
        
        const result = results[0];
        expect(result).toMatchObject({
          transcript: 'Mars is closer to the sun than Mercury.',
          bullshitLevel: expect.any(Number),
          confidence: expect.any(Number),
          claim: expect.any(String),
          summary: expect.any(String),
          reasoning: expect.any(String),
          truth: expect.any(String),
        });

        // Should have high bullshit level for false astronomical fact
        expect(result.bullshitLevel).toBeGreaterThanOrEqual(3);
        expect(result.confidence).toBeGreaterThanOrEqual(3);

        // Validate numeric ranges
        expect(result.bullshitLevel).toBeGreaterThanOrEqual(0);
        expect(result.bullshitLevel).toBeLessThanOrEqual(5);
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(5);
      }, 15000);

      it('should handle conversation with no clear factual claims', async () => {
        const messages: OpenAIMessage[] = [
          { role: 'user', content: 'Hello, how are you?' },
          { role: 'assistant', content: 'Hello! I\'m doing well, thank you for asking.' },
          { role: 'user', content: 'That\'s great to hear!' }
        ];

        const results = await detectBullshit(messages);

        // Social conversation might not have factual claims, so array could be empty
        expect(Array.isArray(results)).toBe(true);
        
        if (results.length > 0) {
          const result = results[0];
          expect(result).toMatchObject({
            transcript: expect.any(String),
            bullshitLevel: expect.any(Number),
            confidence: expect.any(Number),
            claim: expect.any(String),
            summary: expect.any(String),
            reasoning: expect.any(String),
            truth: expect.any(String),
          });

          // Should have low bullshit level and possibly lower confidence for non-factual content
          expect(result.bullshitLevel).toBeLessThanOrEqual(2);

          // Validate numeric ranges
          expect(result.bullshitLevel).toBeGreaterThanOrEqual(0);
          expect(result.bullshitLevel).toBeLessThanOrEqual(5);
          expect(result.confidence).toBeGreaterThanOrEqual(0);
          expect(result.confidence).toBeLessThanOrEqual(5);
        }
      }, 15000);

      it('should work with custom configuration', async () => {
        const config: BullshitDetectionConfig = {
          model: 'gpt-4o-mini', // Use same model but different config
          temperature: 0.2,
          maxTokens: 800
        };

        const results = await detectBullshit('The Great Wall of China is visible from space.', config);

        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBeGreaterThanOrEqual(1);
        
        const result = results[0];
        expect(result).toMatchObject({
          transcript: expect.stringContaining('Great Wall'),
          bullshitLevel: expect.any(Number),
          confidence: expect.any(Number),
          claim: expect.any(String),
          summary: expect.any(String),
          reasoning: expect.any(String),
          truth: expect.any(String),
        });

        // This is a common myth - should have moderate to high bullshit level
        expect(result.bullshitLevel).toBeGreaterThanOrEqual(2);

        // Validate numeric ranges
        expect(result.bullshitLevel).toBeGreaterThanOrEqual(0);
        expect(result.bullshitLevel).toBeLessThanOrEqual(5);
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(5);
      }, 15000);
    });

    describe('Legacy class interface integration tests', () => {
      it('should work with BullshitDetector class', async () => {
        const detector = new BullshitDetector({
          maxStatements: 1,
          confidenceThreshold: 3
        });

        const result = await detector.evaluateClaim('The capital of France is Paris.');

        expect(result).toMatchObject({
          claim: expect.any(String),
          bullshitLevel: expect.any(Number),
          confidence: expect.any(Number),
          reasoning: expect.any(String),
          truth: expect.any(String),
        });

        // Should have low bullshit level for accurate geographical fact
        expect(result.bullshitLevel).toBeLessThanOrEqual(1);
        expect(result.confidence).toBeGreaterThanOrEqual(4);

        // Validate numeric ranges
        expect(result.bullshitLevel).toBeGreaterThanOrEqual(0);
        expect(result.bullshitLevel).toBeLessThanOrEqual(5);
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(5);
      }, 15000);

      it('should work with analyzeTranscript method', async () => {
        const detector = new BullshitDetector();

        const results = await detector.analyzeTranscript('Gravity makes objects fall towards Earth.');

        expect(Array.isArray(results)).toBe(true);
        expect(results).toHaveLength(1);
        expect(results[0]).toMatchObject({
          claim: expect.any(String),
          bullshitLevel: expect.any(Number),
          confidence: expect.any(Number),
          reasoning: expect.any(String),
          truth: expect.any(String),
        });

        // Should have low bullshit level for accurate physics fact
        expect(results[0].bullshitLevel).toBeLessThanOrEqual(1);
        expect(results[0].confidence).toBeGreaterThanOrEqual(4);

        // Validate numeric ranges
        expect(results[0].bullshitLevel).toBeGreaterThanOrEqual(0);
        expect(results[0].bullshitLevel).toBeLessThanOrEqual(5);
        expect(results[0].confidence).toBeGreaterThanOrEqual(0);
        expect(results[0].confidence).toBeLessThanOrEqual(5);
      }, 15000);
    });

    describe('Error handling integration tests', () => {
      it('should handle API errors gracefully', async () => {
        // Temporarily remove API key to test error handling
        const originalApiKey = process.env.OPENAI_API_KEY;
        delete process.env.OPENAI_API_KEY;

        try {
          await expect(detectBullshit('test')).rejects.toThrow('OPENAI_API_KEY environment variable is required');
        } finally {
          // Restore API key
          process.env.OPENAI_API_KEY = originalApiKey;
        }
      });
    });
  });
});