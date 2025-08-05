# @josheverett/bullshit-detector

Generic fact-checking and bullshit detection for any Node.js project requiring LLM-based analysis.

## Overview

This package provides a simple, efficient way to detect bullshit in text using OpenAI's language models. It combines fact extraction and evaluation into a single LLM call for maximum efficiency. Perfect for real-time applications, content moderation, or any system that needs automated fact-checking.

## Features

- **Single Function API**: Simple `detectBullshit(input)` function
- **Dual Input Support**: Accepts either plain strings or OpenAI-formatted message arrays
- **Single LLM Call**: Extracts facts and evaluates them in one efficient operation
- **Structured Output**: Returns consistent JSON with bullshit levels, confidence scores, and reasoning
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

const result = await detectBullshit("The Earth has 27 billion people living on it.");

console.log(result);
// {
//   transcript: "The Earth has 27 billion people living on it.",
//   claim: "The Earth has 27 billion people living on it",
//   summary: "Statement about Earth's population",
//   bullshitLevel: 5,
//   confidence: 5,
//   reasoning: "The actual population is approximately 8 billion, not 27 billion",
//   truth: "The Earth has approximately 8 billion people living on it"
// }
```

### OpenAI Message Array Analysis

```typescript
import { detectBullshit } from '@josheverett/bullshit-detector';

const messages = [
  { role: 'user', content: 'I read that vaccines contain microchips for tracking' },
  { role: 'assistant', content: 'That is not accurate. Can you tell me more about where you heard this?' },
  { role: 'user', content: 'Well, I saw it on social media. Also, did you know the moon is made of cheese?' }
];

const result = await detectBullshit(messages);
// Analyzes the most recent user message for factual claims
```

## API Reference

### `detectBullshit(input)`

Main function for bullshit detection.

**Parameters:**
- `input: string | OpenAIMessage[]` - Either a text string or array of OpenAI-formatted messages

**Returns:** `Promise<BullshitDetectionResult>`

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
```

## Error Handling

The function throws descriptive errors for common issues:

```typescript
try {
  const result = await detectBullshit("Some text");
} catch (error) {
  if (error.message.includes('OPENAI_API_KEY')) {
    console.error('Please set your OpenAI API key');
  } else {
    console.error('Detection failed:', error.message);
  }
}
```

## License

MIT