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

  // Optional external fact-checking data (when external APIs are enabled)
  externalSources?: Array<{
    source: string;
    rating?: string;
    url?: string;
    confidence?: number;
    summary?: string;
  }>;

  // Hybrid detection metadata
  detectionMethod?: 'llm_only' | 'llm_with_api_enhancement' | 'api_first_with_llm_fallback';
}

export interface FactCheckAPI {
  name: string;
  enabled: boolean;
  config?: any; // API-specific configuration
}

export interface GoogleFactCheckConfig {
  apiKey: string;
  maxResults?: number;
}

export interface ClaimBusterConfig {
  apiKey?: string; // Some endpoints may require authentication
}

export interface WikipediaConfig {
  maxResults?: number;
  language?: string; // Language code for Wikipedia (defaults to 'en')
}

export interface BullshitDetectionConfig {
  model?: string; // OpenAI model to use (defaults to 'gpt-4.1-2025-04-14')
  temperature?: number; // Temperature for LLM calls (defaults to 0)
  maxTokens?: number; // Maximum tokens in response (defaults to 1500)

  // External fact-checking APIs (all disabled by default)
  factCheckAPIs?: {
    googleFactCheck?: FactCheckAPI & { config?: GoogleFactCheckConfig };
    claimBuster?: FactCheckAPI & { config?: ClaimBusterConfig };
    wikipedia?: FactCheckAPI & { config?: WikipediaConfig };
  };

  // Strategy for combining results
  hybridStrategy?: 'llm_only' | 'api_first' | 'api_enhanced'; // defaults to 'llm_only'
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

// External Fact-Checking API Functions

interface GoogleFactCheckResult {
  text: string;
  claimant?: string;
  claimDate?: string;
  claimReview?: Array<{
    publisher: { name: string; site?: string };
    url: string;
    title: string;
    reviewDate: string;
    textualRating: string;
    languageCode: string;
  }>;
}

interface ClaimBusterResult {
  score: number; // 0-1 score indicating claim-worthiness
  claim: string;
}

interface WikipediaSearchResult {
  title: string;
  snippet: string;
  url: string;
  confidence: number;
}

async function checkWithGoogleFactCheck(claim: string, config: GoogleFactCheckConfig): Promise<GoogleFactCheckResult[]> {
  const maxResults = config.maxResults || 5;
  const url = `https://factchecktools.googleapis.com/v1alpha1/claims:search`;
  const params = new URLSearchParams({
    query: claim,
    key: config.apiKey,
    pageSize: maxResults.toString()
  });

  try {
    const response = await fetch(`${url}?${params}`);
    if (!response.ok) {
      throw new Error(`Google Fact Check API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return (data as any).claims || [];
  } catch (error) {
    console.warn('Google Fact Check API failed:', error instanceof Error ? error.message : 'Unknown error');
    return [];
  }
}

async function checkWithClaimBuster(claim: string, config: ClaimBusterConfig): Promise<ClaimBusterResult | null> {
  const url = 'https://idir.uta.edu/claimbuster/api/v2/score/text';

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { 'x-api-key': config.apiKey } : {})
      },
      body: JSON.stringify({ input_text: claim })
    });

    if (!response.ok) {
      throw new Error(`ClaimBuster API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return {
      score: (data as any).score || 0,
      claim: claim
    };
  } catch (error) {
    console.warn('ClaimBuster API failed:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

async function searchWikipedia(claim: string, config: WikipediaConfig): Promise<WikipediaSearchResult[]> {
  const language = config.language || 'en';
  const maxResults = config.maxResults || 3;
  const url = `https://${language}.wikipedia.org/w/api.php`;

  const params = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: claim,
    format: 'json',
    origin: '*',
    srlimit: maxResults.toString()
  });

  try {
    const response = await fetch(`${url}?${params}`);
    if (!response.ok) {
      throw new Error(`Wikipedia API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const results = (data as any).query?.search || [];

    return results.map((result: any) => ({
      title: result.title,
      snippet: result.snippet.replace(/<[^>]*>/g, ''), // Remove HTML tags
      url: `https://${language}.wikipedia.org/wiki/${encodeURIComponent(result.title)}`,
      confidence: Math.min(result.score / 100, 1) // Normalize score to 0-1
    }));
  } catch (error) {
    console.warn('Wikipedia API failed:', error instanceof Error ? error.message : 'Unknown error');
    return [];
  }
}

async function enhanceWithExternalAPIs(claim: string, config: BullshitDetectionConfig): Promise<{
  externalSources: Array<{
    source: string;
    rating?: string;
    url?: string;
    confidence?: number;
    summary?: string;
  }>;
  aggregatedConfidence: number;
}> {
  const externalSources: Array<{
    source: string;
    rating?: string;
    url?: string;
    confidence?: number;
    summary?: string;
  }> = [];

  let totalConfidence = 0;
  let sourceCount = 0;

  // Google Fact Check
  if (config.factCheckAPIs?.googleFactCheck?.enabled && config.factCheckAPIs.googleFactCheck.config) {
    try {
      const googleResults = await checkWithGoogleFactCheck(claim, config.factCheckAPIs.googleFactCheck.config);
      for (const result of googleResults.slice(0, 2)) { // Take top 2 results
        if (result.claimReview && result.claimReview.length > 0) {
          const review = result.claimReview[0];
          externalSources.push({
            source: `Google Fact Check - ${review.publisher.name}`,
            rating: review.textualRating,
            url: review.url,
            confidence: 0.8, // High confidence in established fact-checkers
            summary: review.title
          });
          totalConfidence += 0.8;
          sourceCount++;
        }
      }
    } catch (error) {
      console.warn('Google Fact Check enhancement failed:', error);
    }
  }

  // ClaimBuster
  if (config.factCheckAPIs?.claimBuster?.enabled) {
    try {
      const claimBusterResult = await checkWithClaimBuster(claim, config.factCheckAPIs.claimBuster.config || {});
      if (claimBusterResult) {
        externalSources.push({
          source: 'ClaimBuster',
          confidence: claimBusterResult.score,
          summary: `Claim-worthiness score: ${(claimBusterResult.score * 100).toFixed(1)}%`
        });
        totalConfidence += claimBusterResult.score;
        sourceCount++;
      }
    } catch (error) {
      console.warn('ClaimBuster enhancement failed:', error);
    }
  }

  // Wikipedia
  if (config.factCheckAPIs?.wikipedia?.enabled) {
    try {
      const wikipediaResults = await searchWikipedia(claim, config.factCheckAPIs.wikipedia.config || {});
      for (const result of wikipediaResults.slice(0, 1)) { // Take top result only
        externalSources.push({
          source: 'Wikipedia',
          url: result.url,
          confidence: result.confidence * 0.7, // Wikipedia is reliable but not a fact-checker
          summary: result.snippet
        });
        totalConfidence += result.confidence * 0.7;
        sourceCount++;
      }
    } catch (error) {
      console.warn('Wikipedia enhancement failed:', error);
    }
  }

  const aggregatedConfidence = sourceCount > 0 ? totalConfidence / sourceCount : 0;

  return {
    externalSources,
    aggregatedConfidence
  };
}

/**
 * Detects bullshit in text using OpenAI for fact-checking analysis
 * @param input Either a string to analyze or an array of OpenAI-formatted messages
 * @param config Optional configuration for the detection process
 * @returns Promise resolving to array of bullshit detection results (one per factual claim)
 */
export async function detectBullshit(input: string | OpenAIMessage[], config: BullshitDetectionConfig = {}): Promise<BullshitDetectionResult[]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Apply default configuration
  const {
    model = 'gpt-4.1-2025-04-14',
    temperature = 0,
    maxTokens = 1500,
    hybridStrategy = 'llm_only'
  } = config;

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
      max_completion_tokens: maxTokens,
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

    // Enhance with external APIs if enabled and strategy requires it
    if (hybridStrategy !== 'llm_only' && results.length > 0) {
      const enhancedResults: BullshitDetectionResult[] = [];

      for (const result of results) {
        try {
          const enhancement = await enhanceWithExternalAPIs(result.claim, config);

          let finalResult = { ...result };

          // Add external sources
          if (enhancement.externalSources.length > 0) {
            finalResult.externalSources = enhancement.externalSources;
          }

          // Adjust confidence and bullshit level based on strategy
          if (hybridStrategy === 'api_enhanced') {
            if (enhancement.aggregatedConfidence > 0) {
              // Use external sources to enhance LLM confidence
              const externalWeight = 0.3; // External APIs contribute 30% to final confidence
              const llmWeight = 0.7;

              finalResult.confidence = Math.min(5,
                (finalResult.confidence * llmWeight) + (enhancement.aggregatedConfidence * 5 * externalWeight)
              );

              // If external sources strongly disagree with LLM, adjust reasoning
              if (enhancement.externalSources.some(source => source.rating?.toLowerCase().includes('false') || source.rating?.toLowerCase().includes('misleading'))) {
                if (finalResult.bullshitLevel < 3) {
                  finalResult.reasoning += ' However, external fact-checkers have flagged this claim as potentially problematic.';
                  finalResult.bullshitLevel = Math.min(5, finalResult.bullshitLevel + 1);
                }
              }
            }
            finalResult.detectionMethod = 'llm_with_api_enhancement';
          } else if (hybridStrategy === 'api_first') {
            // For api_first, fall back to LLM with a specific fallback method
            finalResult.detectionMethod = 'api_first_with_llm_fallback';
          } else {
            finalResult.detectionMethod = 'llm_only';
          }

          enhancedResults.push(finalResult);
        } catch (enhancementError) {
          // If enhancement fails, fall back to LLM-only result with appropriate detection method
          console.warn('External API enhancement failed for claim:', result.claim, enhancementError);
          let fallbackMethod: string;
          if (hybridStrategy === 'api_enhanced') {
            fallbackMethod = 'llm_with_api_enhancement';
          } else if (hybridStrategy === 'api_first') {
            fallbackMethod = 'api_first_with_llm_fallback';
          } else {
            fallbackMethod = 'llm_only';
          }

          enhancedResults.push({
            ...result,
            detectionMethod: fallbackMethod
          });
        }
      }

      return enhancedResults;
    }

    // If no external APIs enabled or requested, return LLM-only results
    return results.map(result => ({
      ...result,
      detectionMethod: 'llm_only' as const
    }));

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