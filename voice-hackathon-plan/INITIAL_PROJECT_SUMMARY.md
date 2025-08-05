# AI Voice Hackathon Project - Initial Summary

## Project Overview

Our project will be a voice agent for calling out bullshit in real time and relaying that information to the user.

### Target Use Cases

1. **Business negotiations**
2. **Political debates**

## Technical Architecture

### Voice Platform
We have extensive experience with creating voice agents with Vapi, both directly on their platform and via their "Custom LLM" feature.

For this project, we will be using Vapi's Custom LLM feature. The reason for this is that we need to simultaneously drive UI states from the server.

### System Components

- **Server**: Express app
- **Client**: Next.js app  
- **Communication**: WebSocket connection (server → client only)

Note: Server-side events could be used instead, but WebSockets are simpler to implement due to their ubiquity.

### Data Flow

When our custom LLM receives a request to our `/chat/completions` endpoint, it will:
1. **Single LLM Call**: Extract factual statements AND evaluate their bullshit levels in one efficient operation
2. Generate text to be spoken by the Vapi agent
3. Drive UI states in the client via WebSocket with structured evaluation data

## WebSocket Payload Structure

```typescript
type WebSocketPayload = {
   id: string; // A uuid for the payload.
   timestamp: number; // The ISO-8601 timestamp of the payload.
   type: 'statement_evaluation'; // Hardcoded until/unless more payload types are needed.
   data: {
     transcript: string; // The transcript of the most recent user message.
     claim: string; // The statement of fact that was evaluated.
     summary: string; // A concise summary of the most recent user message.
     bullshitLevel: number; // A number between 0 and 5, where 0 is no bullshit and 5 is maximum bullshit.
     confidence: number; // Confidence of the determined bullshit level. A number between 0 and 5, where 0 is no confidence and 5 is maximum confidence.
     reasoning: string; // A concise summary of the reasoning behind the determined bullshit level.
     truth: string; // A concise summary of the actual facts. For statements that are determined to be true or to have a low bullshit level, it is expected that this string will more or less match the statement of fact that was evaluated.
   };
}
```

### Processing Rules

- Payloads must be stringified JSON that is then parsed on the client
- **Single LLM Call Constraint**: The LLM performs fact extraction AND bullshit evaluation in one operation for maximum efficiency
- If a transcript contains multiple statements of fact, the LLM sends multiple payloads (one per factual claim)
- Only statements of facts will be considered when determining the bullshit level
- A single sentence may contain multiple different statements of facts
- Sentences expressing subjective views may contain factual statements (e.g., "I think X because there are 27 billion people in the world")
- The LLM's job is to identify non-subjective statements then evaluate their bullshit level in a single, efficient operation

## Implementation Notes

### Package Structure
- **Monorepo with npm workspaces**: All code lives in a single repository for hackathon velocity
- **`@josheverett/bullshit-detector`**: Core TypeScript package combining fact extraction and evaluation
- **No separate packages**: vapi-helpers and realtime-ui functionality will be built directly into the main application

### Hackathon Constraints
- **Single day execution**: All development compressed into one day
- **Demo-focused**: Optimized for presentation impact over production readiness
- **Minimal viable features**: Focus on core bullshit detection with basic UI