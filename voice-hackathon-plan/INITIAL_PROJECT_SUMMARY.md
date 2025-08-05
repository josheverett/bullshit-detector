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
1. Generate text to be spoken by the Vapi agent
2. Drive UI states in the client via WebSocket

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
     truth: number; // A concise summary of the actual facts. For statements that are determined to be true or to have a low bullshit level, it is expected that this string will more or less match the statement of fact that was evaluated.
   };
}
```

### Processing Rules

- Payloads must be stringified JSON that is then parsed on the client
- The LLM must only evaluate one statement of fact at a time
- If a transcript contains multiple statements of fact, the LLM sends multiple payloads
- Only statements of facts will be considered when determining the bullshit level
- A single sentence may contain multiple different statements of facts
- Sentences expressing subjective views may contain factual statements (e.g., "I think X because there are 27 billion people in the world")
- The LLM's job is to identify non-subjective statements then evaluate their bullshit level

## Open Questions

* What public open source packages can we create ahead of time to help us and others with various aspects of our or similar projects?