# External Fact-Checking APIs

This document explains how to use external fact-checking APIs with the bullshit detector for enhanced accuracy.

## Overview

The bullshit detector now supports optional integration with external fact-checking APIs to enhance its accuracy. **All external APIs are disabled by default** to maintain the existing behavior and avoid requiring additional API keys.

## Supported APIs

### 1. Google Fact Check Tools API
- **Purpose**: Searches for fact-checked claims from established fact-checking organizations
- **Requirements**: Google Cloud API key with Fact Check Tools API enabled
- **Documentation**: https://developers.google.com/fact-check/tools/api/

### 2. ClaimBuster API
- **Purpose**: Evaluates claim-worthiness and provides basic fact-checking
- **Requirements**: Optional API key (some endpoints work without authentication)
- **Documentation**: https://idir.uta.edu/claimbuster/api/

### 3. Wikipedia Search API
- **Purpose**: Searches Wikipedia for factual information related to claims
- **Requirements**: None (public API)
- **Documentation**: https://www.mediawiki.org/wiki/API:Search

## Configuration

### Basic Usage (LLM Only - Default)
```typescript
import { detectBullshit } from '@josheverett/bullshit-detector';

// Default behavior - uses only OpenAI LLM
const results = await detectBullshit('The Earth is flat.');
console.log(results[0].detectionMethod); // 'llm_only'
```

### Enhanced with External APIs
```typescript
import { detectBullshit, BullshitDetectionConfig } from '@josheverett/bullshit-detector';

const config: BullshitDetectionConfig = {
  hybridStrategy: 'api_enhanced', // Enhance LLM results with external APIs
  factCheckAPIs: {
    googleFactCheck: {
      name: 'Google Fact Check',
      enabled: true,
      config: {
        apiKey: process.env.GOOGLE_FACT_CHECK_API_KEY!,
        maxResults: 3
      }
    },
    wikipedia: {
      name: 'Wikipedia',
      enabled: true,
      config: {
        maxResults: 2,
        language: 'en'
      }
    },
    claimBuster: {
      name: 'ClaimBuster',
      enabled: true,
      config: {
        apiKey: process.env.CLAIMBUSTER_API_KEY // Optional for some endpoints
      }
    }
  }
};

const results = await detectBullshit('Climate change is a hoax.', config);

console.log(results[0].detectionMethod); // 'llm_with_api_enhancement'
console.log(results[0].externalSources); // Array of external source results
```

## Hybrid Strategies

### `'llm_only'` (Default)
- Uses only the OpenAI LLM for fact-checking
- No external API calls made
- Maintains existing behavior and performance
- No additional API keys required

### `'api_enhanced'`
- Uses LLM as primary source
- Enhances results with external API data
- Adjusts confidence based on external source agreement
- Adds `externalSources` array to results
- Gracefully falls back to LLM-only if APIs fail

### `'api_first'` (Future)
- Would use external APIs first, LLM as fallback
- Currently aliases to `'api_enhanced'`
- Reserved for future implementation

## Environment Variables

Set these environment variables to use external APIs:

```bash
# Required for LLM functionality
OPENAI_API_KEY=your_openai_api_key_here

# Optional for enhanced fact-checking
GOOGLE_FACT_CHECK_API_KEY=your_google_api_key_here
CLAIMBUSTER_API_KEY=your_claimbuster_api_key_here
```

## Result Format with External APIs

When external APIs are enabled, results include additional fields:

```typescript
interface BullshitDetectionResult {
  // Standard fields (always present)
  transcript: string;
  claim: string;
  summary: string;
  bullshitLevel: number; // 0-5 scale
  confidence: number; // 0-5 scale
  reasoning: string;
  truth: string;

  // Enhanced fields (when external APIs enabled)
  externalSources?: Array<{
    source: string;        // e.g., "Google Fact Check - PolitiFact"
    rating?: string;       // e.g., "False", "True", "Misleading"
    url?: string;          // Link to full fact-check or source
    confidence?: number;   // 0-1 confidence from this source
    summary?: string;      // Brief summary from this source
  }>;

  detectionMethod?: 'llm_only' | 'llm_with_api_enhancement' | 'api_first_with_llm_fallback';
}
```

## Error Handling

- External API failures are logged as warnings but don't break the detection process
- Falls back gracefully to LLM-only results if external APIs fail
- Network timeouts and API rate limits are handled transparently
- Invalid API keys result in fallback to LLM-only mode

## Performance Considerations

- External API calls add latency (typically 200-1000ms per API)
- APIs are called in parallel to minimize total latency
- Results are cached at the API level (not implemented in this package)
- Consider rate limits when using in production

## Demo Usage

For quick testing or demos, you can enable Wikipedia search without any API keys:

```typescript
const demoConfig: BullshitDetectionConfig = {
  hybridStrategy: 'api_enhanced',
  factCheckAPIs: {
    wikipedia: {
      name: 'Wikipedia',
      enabled: true,
      config: { maxResults: 1 }
    }
  }
};

const results = await detectBullshit('The Great Wall of China is visible from space.', demoConfig);
```

This provides enhanced results for demos while maintaining the package's simplicity and not requiring additional API credentials.