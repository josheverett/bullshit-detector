# @josheverett/bullshit-detector

Core fact-checking and scoring logic for AI voice applications.

## Overview

This package provides utilities for analyzing statements and detecting misinformation in real-time voice applications. It combines fact extraction and bullshit detection into a single, efficient package optimized for hackathon velocity.

## Features

- **Single LLM Call Architecture**: Designed to extract facts and evaluate bullshit levels in one efficient operation
- **TypeScript Support**: Full TypeScript types and interfaces
- **Pluggable Design**: Ready for integration with various fact-checking sources
- **Hackathon Optimized**: Built for speed and simplicity, not production complexity

## Installation

```bash
npm install @josheverett/bullshit-detector
```

## Quick Start

```typescript
import { BullshitDetector } from '@josheverett/bullshit-detector';

const detector = new BullshitDetector();

// Analyze a full transcript
const evaluations = await detector.analyzeTranscript(
  "The population of Earth is 27 billion people. Also, the sky is blue."
);

// Evaluate a single claim
const evaluation = await detector.evaluateClaim(
  "There are 27 billion people on Earth"
);

console.log(evaluation.bullshitLevel); // 4-5 (high bullshit)
console.log(evaluation.reasoning); // Explanation of why this is wrong
```

## API Reference

### `BullshitDetector`

Main class for fact-checking operations.

### `StatementEvaluation`

Interface describing the evaluation result:

```typescript
interface StatementEvaluation {
  claim: string;           // The factual statement being evaluated
  bullshitLevel: number;   // 0-5 scale (0 = truth, 5 = maximum bullshit)
  confidence: number;      // 0-5 scale confidence in the evaluation
  reasoning: string;       // Explanation of the evaluation
  truth: string;          // The actual facts or corrected information
}
```

## Development Status

🚧 **This package is currently scaffolding only.** The actual implementation will be completed during the hackathon for maximum velocity and focus on the specific use case.

## License

MIT