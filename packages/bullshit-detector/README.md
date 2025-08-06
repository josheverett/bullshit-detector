# @josheverett/bullshit-detector

AI-powered fact-checking and bullshit detection for Node.js applications. Originally developed for a voice AI hackathon project, now available as a generic package for any project requiring LLM-based fact verification.

## Overview

This package provides an efficient way to detect misinformation in text using OpenAI's language models. It extracts multiple factual claims from input text and evaluates each one in a single LLM call for maximum efficiency. Perfect for real-time applications, content moderation, voice AI systems, or any application that needs automated fact-checking.

## Features

- **Multi-Statement Detection**: Extracts and evaluates ALL factual claims in text, not just one
- **Single Function API**: Simple `detectBullshit(input, config?)` function
- **Dual Input Support**: Accepts either plain strings or OpenAI-formatted message arrays
- **Single LLM Call**: Extracts facts and evaluates them in one efficient operation
- **Configurable**: Customize OpenAI model, temperature, and token limits
- **Structured Output**: Returns consistent JSON arrays with bullshit levels, confidence scores, and reasoning
- **TypeScript Support**: Full TypeScript types and interfaces
- **Generic Design**: Works with any Node.js project, not tied to specific use cases

## Installation

```bash
npm install @josheverett/bullshit-detector
```

## Setup

Set your OpenAI API key as an environment variable:

```bash
export OPENAI_API_KEY="your-openai-api-key"
```

## Quick Start

### Basic String Analysis

```typescript
import { detectBullshit } from '@josheverett/bullshit-detector';

const result = await detectBullshit("The Earth has 27 billion people and the moon is made of cheese.");

console.log(result);
// [
//   {
//     transcript: "The Earth has 27 billion people and the moon is made of cheese.",
//     claim: "The Earth has 27 billion people",
//     summary: "Claims about Earth's population and moon's composition",
//     bullshitLevel: 5,
//     confidence: 5,
//     reasoning: "The actual population is approximately 8 billion, not 27 billion",
//     truth: "The Earth has approximately 8 billion people"
//   },
//   {
//     transcript: "The Earth has 27 billion people and the moon is made of cheese.",
//     claim: "The moon is made of cheese",
//     summary: "Claims about Earth's population and moon's composition",
//     bullshitLevel: 5,
//     confidence: 5,
//     reasoning: "The moon is composed primarily of rock and dust, not cheese",
//     truth: "The moon is a rocky celestial body composed mainly of silicate minerals"
//   }
// ]
```

### With Configuration Options

```typescript
import { detectBullshit, BullshitDetectionConfig } from '@josheverett/bullshit-detector';

const config: BullshitDetectionConfig = {
  model: 'gpt-4o',           // Use a more powerful model
  temperature: 0.2,          // Slightly more creative responses
  maxTokens: 2000           // Allow longer responses
};

const result = await detectBullshit("Some complex text to analyze", config);
```

### OpenAI Message Array Analysis

```typescript
import { detectBullshit } from '@josheverett/bullshit-detector';

const messages = [
  { role: 'user', content: 'I read that vaccines contain microchips for tracking' },
  { role: 'assistant', content: 'That is not accurate. Can you tell me more about where you heard this?' },
  { role: 'user', content: 'Well, I saw it on social media. Also, did you know the moon landing was faked?' }
];

const results = await detectBullshit(messages);
// Analyzes the most recent user message for all factual claims
```

## API Reference

### `detectBullshit(input, config?)`

Main function for bullshit detection.

**Parameters:**
- `input: string | OpenAIMessage[]` - Either a text string or array of OpenAI-formatted messages
- `config?: BullshitDetectionConfig` - Optional configuration object

**Returns:** `Promise<BullshitDetectionResult[]>` - Array of detection results, one per factual claim

### `BullshitDetectionResult`

```typescript
interface BullshitDetectionResult {
  transcript: string;      // The input text that was analyzed
  claim: string;          // The specific factual statement evaluated
  summary: string;        // A concise summary of the input
  bullshitLevel: number;  // 0-5 scale (0 = no bullshit, 5 = maximum bullshit)
  confidence: number;     // 0-5 scale confidence in the evaluation
  reasoning: string;      // Explanation of why this level was assigned
  truth: string;         // The accurate facts or corrected information
}
```

### `BullshitDetectionConfig`

```typescript
interface BullshitDetectionConfig {
  model?: string;         // OpenAI model to use (default: 'gpt-4o-mini')
  temperature?: number;   // Temperature for LLM calls (default: 0.1)
  maxTokens?: number;    // Maximum tokens in response (default: 1500)
}
```

### `OpenAIMessage`

```typescript
interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
```

## Legacy Class-Based API

For applications that prefer a class-based approach, the original interface is still available:

```typescript
import { BullshitDetector } from '@josheverett/bullshit-detector';

const detector = new BullshitDetector();
const evaluations = await detector.analyzeTranscript("Some text to analyze");
// Returns StatementEvaluation[] (similar to BullshitDetectionResult but without transcript/summary)
```

## Error Handling

The function throws descriptive errors for common issues:

```typescript
try {
  const results = await detectBullshit("Some text");
} catch (error) {
  if (error.message.includes('OPENAI_API_KEY')) {
    console.error('Please set your OpenAI API key');
  } else if (error.message.includes('No factual claims found')) {
    console.log('Input contains no verifiable factual statements');
  } else {
    console.error('Detection failed:', error.message);
  }
}
```

## Common Use Cases

### Voice AI Applications
Perfect for real-time fact-checking during voice conversations, as originally designed for the hackathon project:

```typescript
// In a voice AI pipeline
const transcriptResults = await detectBullshit(userTranscript);
if (transcriptResults.some(r => r.bullshitLevel > 3)) {
  // Send correction to user via TTS
}
```

### Content Moderation
Analyze user-generated content for factual accuracy:

```typescript
const contentResults = await detectBullshit(userPost);
contentResults.forEach(result => {
  if (result.bullshitLevel >= 4 && result.confidence >= 4) {
    flagForReview(result);
  }
});
```

### Educational Tools
Help students identify misinformation in texts:

```typescript
const analysisResults = await detectBullshit(studentEssay);
// Show corrections and reasoning to help learning
```

## Hackathon Origins

This package was initially developed for an AI voice hackathon focused on real-time bullshit detection in conversations. The single-LLM-call architecture and WebSocket-ready payload structure reflect those original requirements. While now generalized for broader use, it maintains the efficiency and real-time focus that made it hackathon-ready.

## License

MIT