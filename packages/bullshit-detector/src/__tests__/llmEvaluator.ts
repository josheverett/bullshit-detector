/**
 * LLM Evaluator for Integration Tests
 * 
 * This utility uses OpenAI's GPT to evaluate if integration test results are acceptable.
 * It's designed to be fair-but-lenient, understanding that LLM outputs can vary while
 * still being correct and useful.
 */

import OpenAI from 'openai';
import { BullshitDetectionResult } from '../index';

interface EvaluationResult {
  passed: boolean;
  score: number; // 0-10 score for the result quality
  reasoning: string;
  suggestions?: string;
}

interface EvaluationCriteria {
  expectedBullshitLevelRange?: [number, number];
  expectedConfidenceRange?: [number, number];
  shouldContainExternalSources?: boolean;
  allowableVariance?: number; // How much variance to allow in numerical scores
}

export class LLMEvaluator {
  private openai: OpenAI;
  
  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required for LLM evaluator');
    }
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async evaluateResult(
    inputClaim: string,
    result: BullshitDetectionResult,
    criteria: EvaluationCriteria = {}
  ): Promise<EvaluationResult> {
    const systemPrompt = `You are an AI evaluator for a fact-checking system's integration tests. Your job is to determine if the fact-checking results are reasonable and acceptable, even if not perfect.

EVALUATION GUIDELINES:
- Be fair but lenient - LLM outputs naturally vary while still being correct
- Focus on whether the result is reasonable, not perfect
- Consider that different phrasings of the same truth are acceptable
- Numerical scores can vary by ±1 point and still be acceptable for borderline cases
- Pay attention to the overall quality and usefulness of the analysis

SCORING CRITERIA (0-10 scale):
- 8-10: Excellent result, accurate assessment with good reasoning
- 6-7: Good result with minor issues or slightly off numerical scores
- 4-5: Acceptable result but with notable issues that don't invalidate it
- 2-3: Poor result with significant problems
- 0-1: Completely incorrect or nonsensical result

You should PASS results that are reasonable and useful, even if they have minor imperfections.
You should FAIL only results that are seriously wrong or misleading.`;

    const userPrompt = `Please evaluate this fact-checking result:

INPUT CLAIM: "${inputClaim}"

RESULT:
- Transcript: "${result.transcript}"
- Extracted Claim: "${result.claim}"
- Summary: "${result.summary}"
- Bullshit Level: ${result.bullshitLevel}/5
- Confidence: ${result.confidence}/5
- Reasoning: "${result.reasoning}"
- Truth: "${result.truth}"
- Detection Method: ${result.detectionMethod || 'not specified'}
- External Sources: ${result.externalSources ? JSON.stringify(result.externalSources, null, 2) : 'none'}

EXPECTED CRITERIA:
${criteria.expectedBullshitLevelRange ? `- Bullshit level should be between ${criteria.expectedBullshitLevelRange[0]} and ${criteria.expectedBullshitLevelRange[1]}` : '- No specific bullshit level expected'}
${criteria.expectedConfidenceRange ? `- Confidence should be between ${criteria.expectedConfidenceRange[0]} and ${criteria.expectedConfidenceRange[1]}` : '- No specific confidence expected'}
${criteria.shouldContainExternalSources ? '- Should include external sources when available' : '- External sources optional'}
${criteria.allowableVariance ? `- Allow ±${criteria.allowableVariance} variance in numerical scores` : '- Standard variance tolerance'}

Please respond with a JSON object in this exact format:
{
  "passed": true/false,
  "score": 0-10,
  "reasoning": "Detailed explanation of your evaluation",
  "suggestions": "Optional suggestions for improvement"
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'o3',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        max_tokens: 800
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      // Extract JSON from response (handle potential markdown formatting)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const evaluation = JSON.parse(jsonMatch[0]) as EvaluationResult;
      
      // Validate the response structure
      if (typeof evaluation.passed !== 'boolean' || 
          typeof evaluation.score !== 'number' ||
          typeof evaluation.reasoning !== 'string') {
        throw new Error('Invalid evaluation response structure');
      }

      return evaluation;
    } catch (error) {
      console.warn('LLM Evaluator failed:', error instanceof Error ? error.message : 'Unknown error');
      
      // Fallback evaluation - be lenient and pass unless obviously wrong
      return {
        passed: this.fallbackEvaluation(result, criteria),
        score: 5,
        reasoning: `LLM evaluator failed, using fallback logic. Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        suggestions: 'Manual review recommended due to evaluator failure'
      };
    }
  }

  private fallbackEvaluation(result: BullshitDetectionResult, criteria: EvaluationCriteria): boolean {
    // Simple fallback checks - be very lenient
    if (result.bullshitLevel < 0 || result.bullshitLevel > 5) return false;
    if (result.confidence < 0 || result.confidence > 5) return false;
    if (!result.claim || !result.reasoning || !result.truth) return false;
    
    // Check basic criteria if provided
    if (criteria.expectedBullshitLevelRange) {
      const [min, max] = criteria.expectedBullshitLevelRange;
      const variance = criteria.allowableVariance || 1;
      if (result.bullshitLevel < min - variance || result.bullshitLevel > max + variance) {
        return false;
      }
    }
    
    if (criteria.expectedConfidenceRange) {
      const [min, max] = criteria.expectedConfidenceRange;
      const variance = criteria.allowableVariance || 1;
      if (result.confidence < min - variance || result.confidence > max + variance) {
        return false;
      }
    }
    
    return true; // Pass by default in fallback mode
  }

  /**
   * Evaluate multiple results (for multi-claim statements)
   */
  async evaluateResults(
    inputClaim: string,
    results: BullshitDetectionResult[],
    criteria: EvaluationCriteria = {}
  ): Promise<EvaluationResult> {
    if (results.length === 0) {
      return {
        passed: false,
        score: 0,
        reasoning: 'No results returned - this may be acceptable for statements with no factual claims'
      };
    }

    if (results.length === 1) {
      return this.evaluateResult(inputClaim, results[0], criteria);
    }

    // For multiple results, evaluate them collectively
    const systemPrompt = `You are an AI evaluator for a fact-checking system's integration tests. You're evaluating multiple claims extracted from a single input statement.

EVALUATION GUIDELINES:
- Be fair but lenient - multiple valid interpretations of claims are acceptable
- Check that the most important/obvious claims were detected
- Minor variations in claim extraction are acceptable
- Focus on overall usefulness and accuracy of the collective analysis

SCORING CRITERIA (0-10 scale):
- 8-10: Excellent coverage of claims with accurate assessments
- 6-7: Good coverage with minor issues
- 4-5: Acceptable but missed some important claims or had notable issues  
- 2-3: Poor coverage or significant accuracy issues
- 0-1: Completely incorrect or missed all important claims`;

    const resultsJson = JSON.stringify(results, null, 2);
    const userPrompt = `Please evaluate these fact-checking results for multiple claims:

INPUT STATEMENT: "${inputClaim}"

RESULTS (${results.length} claims detected):
${resultsJson}

EXPECTED CRITERIA:
${criteria.expectedBullshitLevelRange ? `- Bullshit levels should generally be between ${criteria.expectedBullshitLevelRange[0]} and ${criteria.expectedBullshitLevelRange[1]}` : '- No specific bullshit level expected'}
${criteria.expectedConfidenceRange ? `- Confidence should generally be between ${criteria.expectedConfidenceRange[0]} and ${criteria.expectedConfidenceRange[1]}` : '- No specific confidence expected'}
${criteria.allowableVariance ? `- Allow ±${criteria.allowableVariance} variance in numerical scores` : '- Standard variance tolerance'}

Focus on whether the important factual claims were detected and reasonably evaluated.

Please respond with a JSON object in this exact format:
{
  "passed": true/false,
  "score": 0-10,
  "reasoning": "Detailed explanation of your evaluation covering claim detection and accuracy",
  "suggestions": "Optional suggestions for improvement"
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'o3',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        max_tokens: 1000
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const evaluation = JSON.parse(jsonMatch[0]) as EvaluationResult;
      return evaluation;
      
    } catch (error) {
      console.warn('LLM Evaluator failed for multiple results:', error instanceof Error ? error.message : 'Unknown error');
      
      // Fallback - check if all results pass basic validation
      const allValid = results.every(result => this.fallbackEvaluation(result, criteria));
      
      return {
        passed: allValid,
        score: allValid ? 6 : 2,
        reasoning: `LLM evaluator failed, using fallback logic. ${results.length} results detected, all valid: ${allValid}. Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        suggestions: 'Manual review recommended due to evaluator failure'
      };
    }
  }
}

/**
 * Helper function to create common evaluation criteria
 */
export const createCriteria = {
  truthfulClaim: (allowableVariance = 1): EvaluationCriteria => ({
    expectedBullshitLevelRange: [0, 2],
    expectedConfidenceRange: [3, 5],
    allowableVariance
  }),
  
  falseInformation: (allowableVariance = 1): EvaluationCriteria => ({
    expectedBullshitLevelRange: [3, 5],
    expectedConfidenceRange: [3, 5],
    allowableVariance
  }),
  
  ambiguousStatement: (allowableVariance = 1): EvaluationCriteria => ({
    expectedBullshitLevelRange: [1, 4],
    expectedConfidenceRange: [2, 5],
    allowableVariance
  }),
  
  withExternalSources: (allowableVariance = 1): EvaluationCriteria => ({
    shouldContainExternalSources: true,
    allowableVariance
  })
};