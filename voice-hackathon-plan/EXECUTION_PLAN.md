# Execution Plan

Single-day hackathon execution plan optimized for demo velocity.

## Pre-Hackathon Setup (Complete ✅)
- [x] **Package Scaffolding**: `@josheverett/bullshit-detector` TypeScript package initialized
- [x] **Workspace Configuration**: npm workspaces configured at root level
- [x] **Planning Documents**: Updated to reflect single LLM call architecture and hackathon constraints

## Hackathon Day Execution

### Phase 1: Foundation (2 hours)
- **Environment Setup**: Configure development environment with Vapi credentials
- **Basic Server**: Express app with `/chat/completions` endpoint
- **WebSocket Infrastructure**: Basic server-to-client WebSocket connection
- **Next.js Client**: Minimal client with WebSocket connection

### Phase 2: Core Logic (4 hours)
- **LLM Integration**: Implement single-call fact extraction + bullshit detection
- **`@josheverett/bullshit-detector` Implementation**: Build core analysis logic
- **WebSocket Payload**: Implement exact payload structure from project summary
- **Basic Vapi Integration**: Connect Custom LLM endpoint to Vapi

### Phase 3: Demo UI (2 hours)
- **Real-time Display**: Show bullshit levels with visual indicators
- **Transcript View**: Display conversation with highlighted problematic statements
- **Reasoning Panel**: Show AI's evaluation reasoning
- **Demo Polish**: Styling for presentation impact

### Phase 4: Demo Preparation (2 hours)
- **Test Scenarios**: Prepare compelling demo statements (political/business claims)
- **Mock Data**: Fallback responses for connectivity issues
- **Demo Script**: 2-minute presentation narrative
- **Final Testing**: End-to-end demo rehearsal

## Success Criteria
- ✅ Working voice-to-bullshit-detection pipeline
- ✅ Real-time UI updates showing evaluations
- ✅ Compelling 2-minute demo presentation
- ✅ `@josheverett/bullshit-detector` package functional

## Risk Mitigation
- **Fallback Data**: Hardcoded responses for key demo scenarios
- **Simplified UI**: Focus on one compelling visual rather than complex interface
- **Single Use Case**: Perfect one scenario rather than handle all edge cases