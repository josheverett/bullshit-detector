# Claude Context Management for AI Voice Hackathon

This file serves as a living guide for how Claude should iteratively maintain and update the project planning documents throughout the hackathon development process.

## Document Structure Overview

### Core Planning Documents
- **`voice-hackathon-plan/INITIAL_PROJECT_SUMMARY.md`**: Complete project overview with technical architecture, constraints, and requirements
- **`voice-hackathon-plan/EXECUTION_PLAN.md`**: Single-day hackathon execution timeline with phases and success criteria
- **`voice-hackathon-plan/RECOMMENDATIONS.md`**: Strategic implementation guidance with accepted and rejected recommendations

### Implementation Package
- **`packages/bullshit-detector/`**: TypeScript package for combined fact extraction and bullshit evaluation

## Iterative Maintenance Process

### 1. Context Preservation Strategy

**Before making any changes**, Claude should:
- Read ALL planning documents to understand current state and constraints
- Review the "Rejected Recommendations" section in `RECOMMENDATIONS.md` to avoid repeating previously dismissed ideas
- Understand the single-day hackathon constraint and demo-focused approach
- Recognize the single LLM call architecture requirement

### 2. Document Update Workflow

When implementing features or making changes:

1. **Update `EXECUTION_PLAN.md`** with:
   - Mark completed tasks with ✅
   - Add new tasks discovered during implementation
   - Adjust time estimates based on actual progress
   - Document any blockers or changes in approach

2. **Update `RECOMMENDATIONS.md`** when:
   - New technical decisions are made (add to accepted recommendations)
   - User feedback rejects proposed approaches (add to "Rejected Recommendations")
   - Better implementation strategies are discovered

3. **Update `INITIAL_PROJECT_SUMMARY.md`** only when:
   - Core requirements change (rare)
   - Technical architecture needs fundamental updates
   - WebSocket payload structure changes

### 3. Avoiding Rejected Paths

The "Rejected Recommendations" section exists to prevent Claude from:
- Re-proposing complex repository structures
- Suggesting performance optimizations inappropriate for a demo
- Adding unnecessary UI polish or accessibility features
- Recommending concurrent user support or historical features
- Reverting to multi-day planning

**Critical Rule**: Always check rejected recommendations before suggesting new approaches.

### 4. Context Management Guidelines

#### When Starting New Tasks:
1. Read this CLAUDE.md file first
2. Review all planning documents for current state
3. Check git status and recent commits for context
4. Use TodoWrite tool to track multi-step tasks

#### When User Provides Feedback:
1. Update rejected recommendations if user dismisses suggestions
2. Adjust execution plan based on new priorities
3. Document any architectural changes in project summary
4. Commit updated planning documents alongside code changes

#### Maintaining Hackathon Focus:
- Always prioritize demo velocity over code quality
- Prefer simple, hacky solutions that work for presentation
- Avoid suggesting production-ready patterns
- Keep implementation focused on single compelling use case

### 5. File Change Protocol

When updating planning documents:
- Make atomic commits for planning updates separate from code changes
- Use descriptive commit messages referencing which recommendations changed
- Update documents immediately when user feedback changes direction
- Keep documents synchronized with actual implementation state

### 6. Decision Documentation

For major technical decisions, document in `RECOMMENDATIONS.md`:
- **What** was decided
- **Why** it was chosen over alternatives  
- **When** it was decided (link to commit/PR if relevant)
- **Impact** on other parts of the system

This creates a decision history that prevents revisiting resolved questions.

## Emergency Procedures

### If Planning Documents Become Inconsistent:
1. Stop implementation work
2. Read all documents to identify conflicts
3. Create reconciliation plan
4. Update documents to consistent state
5. Resume implementation

### If User Feedback Contradicts Documents:
1. User feedback always takes precedence
2. Update documents immediately to reflect new direction
3. Move contradicted recommendations to "Rejected" section
4. Adjust execution plan timeline accordingly

## Success Metrics for Document Maintenance

- Documents always reflect current project state
- No suggestions repeat previously rejected recommendations  
- Execution plan accurately tracks progress
- New team members could understand project from documents alone
- Documents support single-day hackathon velocity constraints

## Key Reminders

- **Single LLM call constraint**: Never suggest separating fact extraction from bullshit evaluation
- **Demo focus**: Resist suggestions for production-ready features
- **Monorepo structure**: Everything lives in npm workspaces, no separate repositories
- **One-day timeline**: All implementation must fit in single hackathon day
- **Velocity over quality**: Hacky solutions are preferred if they enable faster demo development

This file should be read by Claude at the start of every session to maintain consistent context and avoid repeating rejected approaches.