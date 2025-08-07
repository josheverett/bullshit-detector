import { jest } from '@jest/globals';
import { detectBullshit, OpenAIMessage, BullshitDetectionResult, BullshitDetectionConfig } from '../index';

// Mock OpenAI
const mockCreate = jest.fn();
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    })),
  };
});

describe('detectBullshit - Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-api-key';
  });

  describe('String input tests', () => {
    it('should detect accurate factual statement with low bullshit level', async () => {
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
      expect(result[0]).toEqual({
        transcript: 'Water freezes at 0 degrees Celsius.',
        claim: 'Water freezes at 0 degrees Celsius',
        summary: 'Statement about water freezing temperature',
        bullshitLevel: 0,
        confidence: 5,
        reasoning: 'This is a well-established scientific fact',
        truth: 'Water does indeed freeze at 0 degrees Celsius under standard atmospheric pressure'
      });

      // Verify OpenAI was called with correct parameters
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'o3',
        messages: [
          { role: 'system', content: expect.stringContaining('You are a fact-checking AI') },
          { role: 'user', content: 'Water freezes at 0 degrees Celsius.' }
        ],
        temperature: 0.1,
        max_tokens: 1500,
      });
    });

    it('should detect false information with high bullshit level', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify([{
              transcript: 'The Earth is flat and scientists are lying about it.',
              claim: 'The Earth is flat',
              summary: 'Claim about Earth being flat',
              bullshitLevel: 5,
              confidence: 5,
              reasoning: 'This contradicts overwhelming scientific evidence that Earth is spherical',
              truth: 'The Earth is an oblate spheroid, not flat, as proven by extensive scientific evidence'
            }])
          }
        }]
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await detectBullshit('The Earth is flat and scientists are lying about it.');

      expect(result).toHaveLength(1);
      expect(result[0].bullshitLevel).toBe(5);
      expect(result[0].confidence).toBe(5);
      expect(result[0].reasoning).toContain('contradicts overwhelming scientific evidence');
    });
  });

  describe('OpenAI message input tests', () => {
    it('should process OpenAI-formatted messages correctly', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify([{
              transcript: 'The moon landing was fake.',
              claim: 'The moon landing was fake',
              summary: 'Claim that moon landing was staged',
              bullshitLevel: 4,
              confidence: 4,
              reasoning: 'This is a well-debunked conspiracy theory with no credible evidence',
              truth: 'The Apollo moon landings were real, well-documented historical events'
            }])
          }
        }]
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const messages: OpenAIMessage[] = [
        { role: 'user', content: 'Did we really land on the moon?' },
        { role: 'assistant', content: 'Yes, the Apollo missions successfully landed on the moon.' },
        { role: 'user', content: 'The moon landing was fake.' }
      ];

      const result = await detectBullshit(messages);

      expect(result).toHaveLength(1);
      expect(result[0].bullshitLevel).toBe(4);
      expect(result[0].claim).toBe('The moon landing was fake');

      // Verify the messages were formatted correctly
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'o3',
        messages: [
          { role: 'system', content: expect.stringContaining('You are a fact-checking AI that analyzes conversations') },
          { role: 'user', content: 'Did we really land on the moon?' },
          { role: 'assistant', content: 'Yes, the Apollo missions successfully landed on the moon.' },
          { role: 'user', content: 'The moon landing was fake.' }
        ],
        temperature: 0.1,
        max_tokens: 1500,
      });
    });

    it('should handle empty message array', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify([])
          }
        }]
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await detectBullshit([]);
      expect(result).toEqual([]);
    });
  });

  describe('Error handling tests', () => {
    it('should throw error when OPENAI_API_KEY is missing', async () => {
      delete process.env.OPENAI_API_KEY;

      await expect(detectBullshit('test')).rejects.toThrow('OPENAI_API_KEY environment variable is required');
    });

    it('should throw error when OpenAI API call fails', async () => {
      mockCreate.mockRejectedValueOnce(new Error('API call failed'));

      await expect(detectBullshit('test')).rejects.toThrow('Bullshit detection failed: API call failed');
    });

    it('should throw error when response has no content', async () => {
      const mockResponse = {
        choices: [{
          message: {}
        }]
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      await expect(detectBullshit('test')).rejects.toThrow('No response content from OpenAI');
    });

    it('should throw error when response is not valid JSON', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'not valid json'
          }
        }]
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      await expect(detectBullshit('test')).rejects.toThrow('Failed to parse OpenAI response as JSON');
    });

    it('should throw error when response is missing required fields', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify([{
              transcript: 'test',
              // missing other required fields
            }])
          }
        }]
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      await expect(detectBullshit('test')).rejects.toThrow('Missing required field in response[0]');
    });

    it('should throw error when bullshitLevel is out of range', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify([{
              transcript: 'test',
              claim: 'test claim',
              summary: 'test summary',
              bullshitLevel: 10, // Invalid - should be 0-5
              confidence: 3,
              reasoning: 'test reasoning',
              truth: 'test truth'
            }])
          }
        }]
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      await expect(detectBullshit('test')).rejects.toThrow('Invalid bullshitLevel in response[0]: 10 (must be 0-5)');
    });

    it('should throw error when confidence is out of range', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify([{
              transcript: 'test',
              claim: 'test claim',
              summary: 'test summary',
              bullshitLevel: 3,
              confidence: -1, // Invalid - should be 0-5
              reasoning: 'test reasoning',
              truth: 'test truth'
            }])
          }
        }]
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      await expect(detectBullshit('test')).rejects.toThrow('Invalid confidence in response[0]: -1 (must be 0-5)');
    });
  });

  describe('Configuration tests', () => {
    it('should use custom configuration options', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify([{
              transcript: 'Test transcript',
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

      mockCreate.mockResolvedValueOnce(mockResponse);

      const config: BullshitDetectionConfig = {
        model: 'gpt-4o',
        temperature: 0.3,
        maxTokens: 2000
      };

      await detectBullshit('Test input', config);

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'gpt-4o',
        messages: expect.any(Array),
        temperature: 0.3,
        max_tokens: 2000,
      });
    });

    it('should handle multiple claims in response', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify([
              {
                transcript: 'The Earth is flat and water boils at 50C.',
                claim: 'The Earth is flat',
                summary: 'Claims about Earth and water',
                bullshitLevel: 5,
                confidence: 5,
                reasoning: 'Earth is spherical',
                truth: 'Earth is an oblate spheroid'
              },
              {
                transcript: 'The Earth is flat and water boils at 50C.',
                claim: 'Water boils at 50C',
                summary: 'Claims about Earth and water',
                bullshitLevel: 4,
                confidence: 5,
                reasoning: 'Water boils at 100C at standard pressure',
                truth: 'Water boils at 100 degrees Celsius at standard atmospheric pressure'
              }
            ])
          }
        }]
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await detectBullshit('The Earth is flat and water boils at 50C.');

      expect(result).toHaveLength(2);
      expect(result[0].claim).toBe('The Earth is flat');
      expect(result[1].claim).toBe('Water boils at 50C');
    });
  });

  describe('Legacy class interface tests', () => {
    it('should support BullshitDetector class for backward compatibility', async () => {
      const { BullshitDetector } = require('../index');

      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify([{
              transcript: 'Test transcript',
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

      mockCreate.mockResolvedValueOnce(mockResponse);

      const detector = new BullshitDetector();
      const result = await detector.evaluateClaim('Test claim');

      expect(result).toEqual({
        claim: 'Test claim',
        bullshitLevel: 2,
        confidence: 4,
        reasoning: 'Test reasoning',
        truth: 'Test truth'
      });
    });

    it('should handle empty results array in evaluateClaim', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify([])
          }
        }]
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const { BullshitDetector } = require('../index');
      const detector = new BullshitDetector();
      
      await expect(detector.evaluateClaim('No factual claims here')).rejects.toThrow('No factual claims found in input');
    });

    it('should support analyzeTranscript with multiple results', async () => {
      const { BullshitDetector } = require('../index');

      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify([
              {
                transcript: 'Multiple claims here',
                claim: 'First claim',
                summary: 'Test summary',
                bullshitLevel: 2,
                confidence: 4,
                reasoning: 'First reasoning',
                truth: 'First truth'
              },
              {
                transcript: 'Multiple claims here',
                claim: 'Second claim',
                summary: 'Test summary',
                bullshitLevel: 3,
                confidence: 3,
                reasoning: 'Second reasoning',
                truth: 'Second truth'
              }
            ])
          }
        }]
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const detector = new BullshitDetector();
      const result = await detector.analyzeTranscript('Multiple claims here');

      expect(result).toHaveLength(2);
      expect(result[0].claim).toBe('First claim');
      expect(result[1].claim).toBe('Second claim');
    });
  });
});