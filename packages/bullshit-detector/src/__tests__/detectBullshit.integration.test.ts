import { detectBullshit, OpenAIMessage, BullshitDetector } from '../index';

// Integration tests - these make real API calls to OpenAI
// They require OPENAI_API_KEY to be set in environment
describe('detectBullshit - Integration Tests', () => {
  // Skip tests if no API key is available
  const skipIfNoApiKey = process.env.OPENAI_API_KEY ? describe : describe.skip;

  skipIfNoApiKey('Live API calls', () => {
    beforeAll(() => {
      if (!process.env.OPENAI_API_KEY) {
        console.warn('OPENAI_API_KEY not set - skipping integration tests');
      }
    });

    describe('String input integration tests', () => {
      it('should correctly identify accurate scientific fact', async () => {
        const result = await detectBullshit('Water boils at 100 degrees Celsius at sea level.');

        expect(result).toMatchObject({
          transcript: 'Water boils at 100 degrees Celsius at sea level.',
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
      }, 15000);

      it('should correctly identify false information', async () => {
        const result = await detectBullshit('The sun revolves around the Earth.');

        expect(result).toMatchObject({
          transcript: 'The sun revolves around the Earth.',
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
      }, 15000);

      it('should handle ambiguous or opinion-based statements', async () => {
        const result = await detectBullshit('Pizza is the best food in the world.');

        expect(result).toMatchObject({
          transcript: 'Pizza is the best food in the world.',
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
      }, 15000);

      it('should handle complex statements with multiple claims', async () => {
        const result = await detectBullshit('Einstein developed the theory of relativity in 1905, and he also invented the telephone.');

        expect(result).toMatchObject({
          transcript: expect.stringContaining('Einstein'),
          bullshitLevel: expect.any(Number),
          confidence: expect.any(Number),
          claim: expect.any(String),
          summary: expect.any(String),
          reasoning: expect.any(String),
          truth: expect.any(String),
        });

        // Should identify the false claim about the telephone
        expect(result.bullshitLevel).toBeGreaterThanOrEqual(2);

        // Validate numeric ranges
        expect(result.bullshitLevel).toBeGreaterThanOrEqual(0);
        expect(result.bullshitLevel).toBeLessThanOrEqual(5);
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(5);
      }, 15000);
    });

    describe('OpenAI message input integration tests', () => {
      it('should process conversation context correctly', async () => {
        const messages: OpenAIMessage[] = [
          { role: 'user', content: 'Tell me about historical events.' },
          { role: 'assistant', content: 'I can help with historical information. What specific period interests you?' },
          { role: 'user', content: 'World War II ended in 1945.' }
        ];

        const result = await detectBullshit(messages);

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

        const result = await detectBullshit(messages);

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

        const result = await detectBullshit(messages);

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