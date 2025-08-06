/**
 * @josheverett/bullshit-detector
 * 
 * Generic fact-checking and bullshit detection for any Node.js project requiring LLM-based analysis.
 * Uses OpenAI for single-call fact extraction and evaluation.
 */

import { config } from 'dotenv';
import OpenAI from 'openai';

// Load environment variables from .env file
config();

export interface BullshitDetectionResult {
  transcript: string;
  claim: string;
  summary: string;
  bullshitLevel: number; // 0-5 scale, where 0 is no bullshit and 5 is maximum bullshit
  confidence: number; // 0-5 scale confidence in the evaluation
  reasoning: string;
  truth: string; // The actual facts or corrected information
}

export interface BullshitDetectionConfig {
  model?: string; // OpenAI model to use (defaults to 'gpt-4o-mini')
  temperature?: number; // Temperature for LLM calls (defaults to 0.1)
  maxTokens?: number; // Maximum tokens in response (defaults to 1500)
}

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const STRING_SYSTEM_PROMPT = `You are a fact-checking AI that analyzes text for factual claims and evaluates their accuracy using your knowledge.

Your task:
1. Identify ALL factual claims in the input text (objective, verifiable statements)
2. Evaluate the accuracy of each claim using your knowledge
3. Return a JSON array with one object per factual claim

Rules:
- Focus on objective, verifiable statements of fact (not opinions or subjective statements)
- If no factual claims exist, return an empty array: []
- Rate bullshit level: 0 = completely accurate, 5 = completely false/misleading
- Rate confidence: 0 = no confidence, 5 = very confident in your evaluation
- Be concise but thorough in your reasoning

Return only valid JSON array matching this structure:
[
  {
    "transcript": "The full input text",
    "claim": "The specific factual statement being evaluated", 
    "summary": "A concise summary of the input",
    "bullshitLevel": 0-5,
    "confidence": 0-5,
    "reasoning": "Brief explanation of why this bullshit level was assigned",
    "truth": "The accurate facts (if bullshitLevel is low, this should match the claim)"
  }
]`;

const MESSAGES_SYSTEM_PROMPT = `You are a fact-checking AI that analyzes conversations for factual claims and evaluates their accuracy using your knowledge.

Your task:
1. Look at the conversation context, focusing on the most recent user message
2. Identify ALL factual claims in the latest user message (objective, verifiable statements)
3. Evaluate the accuracy of each claim using your knowledge  
4. Return a JSON array with one object per factual claim

Rules:
- Focus on objective, verifiable statements of fact (not opinions or subjective statements)
- If no factual claims exist, return an empty array: []
- Rate bullshit level: 0 = completely accurate, 5 = completely false/misleading
- Rate confidence: 0 = no confidence, 5 = very confident in your evaluation
- Be concise but thorough in your reasoning

Return only valid JSON array matching this structure:
[
  {
    "transcript": "The most recent user message content",
    "claim": "The specific factual statement being evaluated",
    "summary": "A concise summary of the most recent user message", 
    "bullshitLevel": 0-5,
    "confidence": 0-5,
    "reasoning": "Brief explanation of why this bullshit level was assigned",
    "truth": "The accurate facts (if bullshitLevel is low, this should match the claim)"
  }
]`;

/**
 * Detects bullshit in text using OpenAI for fact-checking analysis
 * @param input Either a string to analyze or an array of OpenAI-formatted messages
 * @param config Optional configuration for the detection process
 * @returns Promise resolving to array of bullshit detection results (one per factual claim)
 */
export async function detectBullshit(input: string | OpenAIMessage[], config: BullshitDetectionConfig = {}): Promise<BullshitDetectionResult[]> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Apply default configuration
  const {
    model = 'gpt-4o-mini',
    temperature = 0.1,
    maxTokens = 1500
  } = config;

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }

  try {
    let messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];

    if (typeof input === 'string') {
      messages = [
        { role: 'system', content: STRING_SYSTEM_PROMPT },
        { role: 'user', content: input }
      ];
    } else {
      messages = [
        { role: 'system', content: MESSAGES_SYSTEM_PROMPT },
        ...input.map(msg => ({
          role: msg.role as 'system' | 'user' | 'assistant',
          content: msg.content
        }))
      ];
    }

    const response = await openai.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response content from OpenAI');
    }

    // Parse the JSON response - expect an array
    let results: BullshitDetectionResult[];
    try {
      const parsed = JSON.parse(content);
      // Handle both array and single object responses for backward compatibility
      results = Array.isArray(parsed) ? parsed : [parsed];
    } catch (parseError) {
      throw new Error(`Failed to parse OpenAI response as JSON: ${content}`);
    }

    // Validate each result in the array
    const requiredFields = ['transcript', 'claim', 'summary', 'bullshitLevel', 'confidence', 'reasoning', 'truth'];
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      for (const field of requiredFields) {
        if (!(field in result)) {
          throw new Error(`Missing required field in response[${i}]: ${field}`);
        }
      }

      // Validate numeric ranges
      if (result.bullshitLevel < 0 || result.bullshitLevel > 5) {
        throw new Error(`Invalid bullshitLevel in response[${i}]: ${result.bullshitLevel} (must be 0-5)`);
      }
      if (result.confidence < 0 || result.confidence > 5) {
        throw new Error(`Invalid confidence in response[${i}]: ${result.confidence} (must be 0-5)`);
      }
    }

    return results;

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Bullshit detection failed: ${error.message}`);
    }
    throw new Error('Bullshit detection failed with unknown error');
  }
}

// Legacy exports for backward compatibility (keeping existing class structure)
export interface StatementEvaluation {
  claim: string;
  bullshitLevel: number;
  confidence: number;
  reasoning: string;
  truth: string;
}

export interface BullshitDetectorConfig {
  maxStatements?: number;
  confidenceThreshold?: number;
}

export class BullshitDetector {
  private config: BullshitDetectorConfig;

  constructor(config: BullshitDetectorConfig = {}) {
    this.config = config;
  }

  async analyzeTranscript(transcript: string): Promise<StatementEvaluation[]> {
    const results = await detectBullshit(transcript);
    return results.map(result => ({
      claim: result.claim,
      bullshitLevel: result.bullshitLevel,
      confidence: result.confidence,
      reasoning: result.reasoning,
      truth: result.truth
    }));
  }

  async evaluateClaim(claim: string): Promise<StatementEvaluation> {
    const results = await detectBullshit(claim);
    // For evaluateClaim, return the first result (or throw if none)
    if (results.length === 0) {
      throw new Error('No factual claims found in input');
    }
    const result = results[0];
    return {
      claim: result.claim,
      bullshitLevel: result.bullshitLevel,
      confidence: result.confidence,
      reasoning: result.reasoning,
      truth: result.truth
    };
  }
}

export default detectBullshit;