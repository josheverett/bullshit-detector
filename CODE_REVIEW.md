# Code Review: @josheverett/bullshit-detector

**Reviewed**: January 8, 2026
**Reviewer**: Claude (Agentic Code Review)
**Commit**: 65384a0

---

## Executive Summary

This is a well-structured, production-ready npm package for AI-powered fact-checking. The codebase demonstrates solid engineering practices with comprehensive testing, proper TypeScript usage, and thoughtful error handling. Below are detailed findings organized by category.

**Overall Assessment**: ✅ **Ready for production** with minor improvements recommended

---

## 1. Architecture & Design

### Strengths ✅

1. **Single-file architecture** (`src/index.ts` - 544 LOC) is appropriate for the library's scope
2. **Clean separation of concerns**: Main function, external API integrations, and legacy class wrapper are logically grouped
3. **Hybrid detection strategy** is well-designed with `llm_only`, `api_enhanced`, and `api_first` modes
4. **Dual input support** (strings and OpenAI message arrays) provides flexibility
5. **Backward-compatible legacy class** (`BullshitDetector`) maintains API stability

### Areas for Improvement ⚠️

1. **Single file may become unwieldy** - Consider splitting into modules as features grow:
   ```
   src/
   ├── index.ts           # Main exports
   ├── detectBullshit.ts  # Core detection function
   ├── externalAPIs.ts    # Google, ClaimBuster, Wikipedia
   ├── prompts.ts         # System prompts
   └── types.ts           # Interfaces and types
   ```

2. **`api_first` strategy is declared but not implemented** (`src/index.ts:452-454`):
   ```typescript
   } else if (hybridStrategy === 'api_first') {
     // For api_first, fall back to LLM with a specific fallback method
     finalResult.detectionMethod = 'api_first_with_llm_fallback';
   }
   ```
   This only sets a label but doesn't actually implement API-first logic.

---

## 2. Code Quality

### Strengths ✅

1. **Consistent coding style** throughout
2. **Descriptive variable names** (`bullshitLevel`, `externalSources`, `hybridStrategy`)
3. **Proper use of async/await** patterns
4. **Good use of destructuring** with defaults in config handling
5. **Clean JSON parsing** with validation

### Issues 🔴

1. **Excessive use of `any` type** (`src/index.ts:39, 176, 202, 232, 234`):
   ```typescript
   config?: any; // API-specific configuration (line 39)
   return (data as any).claims || [];  // line 176
   ```
   ESLint has this as a warning (`@typescript-eslint/no-explicit-any: 'warn'`), but these should be properly typed.

2. **Magic numbers without constants** (`src/index.ts:436-437`):
   ```typescript
   const externalWeight = 0.3; // External APIs contribute 30%
   const llmWeight = 0.7;
   ```
   Consider making these configurable or defining as named constants.

3. **Hardcoded default model** (`src/index.ts:352`):
   ```typescript
   model = 'gpt-4.1-2025-04-14',
   ```
   This model string appears in multiple files (tests too). Should be a single constant.

---

## 3. Security

### Strengths ✅

1. **API key validation** before making requests
2. **No hardcoded credentials** in source code
3. **Environment variable usage** for secrets
4. **Graceful error handling** that doesn't leak sensitive info

### Concerns ⚠️

1. **API key exposed in URL query params** (`src/index.ts:163-167`):
   ```typescript
   const params = new URLSearchParams({
     query: claim,
     key: config.apiKey,  // API key in URL
     pageSize: maxResults.toString()
   });
   ```
   While this is how Google's API works, it may appear in logs. Consider adding a note about log scrubbing.

2. **No input sanitization** - The `claim` string is passed directly to external APIs. While unlikely to cause issues with these APIs, input validation is a good practice.

3. **`dotenv` called at module load** (`src/index.ts:12`):
   ```typescript
   config();
   ```
   This side effect on import may conflict with applications that manage their own env loading.

---

## 4. Testing

### Strengths ✅

1. **Excellent test coverage** with 7 test files totaling ~2,400 LOC
2. **Proper separation** of unit tests, integration tests, and live API tests
3. **Comprehensive mocking strategy** for OpenAI and fetch
4. **Creative use of LLM evaluator** (`llmEvaluator.ts`) for flexible test assertions
5. **Good error case coverage** (missing API key, invalid responses, out-of-range values)
6. **Legacy API backward compatibility tests**

### Issues 🔴

1. **Test file imports use `.js` extension** (`src/__tests__/detectBullshit.unit.test.ts:340`):
   ```typescript
   const { BullshitDetector } = await import('../index.js');
   ```
   While this works with ESM, it's inconsistent with other imports in the same file.

2. **Integration tests modify `process.env`** without cleanup in all paths:
   ```typescript
   // line 420-428 in integration tests
   delete process.env.OPENAI_API_KEY;
   // ... if test throws before finally block, env stays modified
   ```

3. **No coverage threshold configured** in `vitest.config.ts`. Consider adding:
   ```typescript
   coverage: {
     thresholds: { statements: 80, branches: 70, functions: 80, lines: 80 }
   }
   ```

4. **`console.log` in tests** (`detectBullshit.integration.test.ts:63-67`) - Consider using a logger that can be silenced.

---

## 5. Performance

### Strengths ✅

1. **Single LLM call** for multi-claim extraction (efficient)
2. **External API calls are parallelizable** (though currently sequential in `enhanceWithExternalAPIs`)

### Opportunities ⚠️

1. **Sequential external API calls** (`src/index.ts:267-325`):
   ```typescript
   // Google Fact Check
   if (config.factCheckAPIs?.googleFactCheck?.enabled...) { ... }
   // ClaimBuster
   if (config.factCheckAPIs?.claimBuster?.enabled...) { ... }
   // Wikipedia
   if (config.factCheckAPIs?.wikipedia?.enabled...) { ... }
   ```
   These could run in parallel with `Promise.all()` for faster response times.

2. **No caching** for repeated claims. Consider adding optional memoization.

3. **OpenAI client instantiated per call** (`src/index.ts:346-348`):
   ```typescript
   const openai = new OpenAI({
     apiKey: process.env.OPENAI_API_KEY,
   });
   ```
   Could be instantiated once and reused.

---

## 6. TypeScript & Type Safety

### Strengths ✅

1. **Comprehensive interface definitions** for all data structures
2. **Proper use of TypeScript features** (generics, union types)
3. **Declaration files generated** for consumers
4. **Strict config** inherited from `@tsconfig/node22`

### Issues 🔴

1. **Several `any` casts** that bypass type safety:
   - `src/index.ts:39` - `config?: any`
   - `src/index.ts:176` - `(data as any).claims`
   - `src/index.ts:202` - `(data as any).score`
   - `src/index.ts:232` - `(data as any).query`
   - `src/index.ts:234` - `(result: any, index: number)`

2. **Missing return type annotations** on some functions (though ESLint allows this)

3. **Interface inconsistency** - `BullshitDetectorConfig` (legacy) has different fields than `BullshitDetectionConfig`:
   ```typescript
   // Legacy - unused fields
   interface BullshitDetectorConfig {
     maxStatements?: number;      // Never used
     confidenceThreshold?: number; // Never used
   }
   ```

---

## 7. Error Handling

### Strengths ✅

1. **Descriptive error messages** with context
2. **Proper error wrapping** in the main function
3. **Graceful degradation** when external APIs fail
4. **Validation of numeric ranges** (0-5 scale)

### Issues ⚠️

1. **Generic error catch** (`src/index.ts:488-493`):
   ```typescript
   } catch (error) {
     if (error instanceof Error) {
       throw new Error(`Bullshit detection failed: ${error.message}`);
     }
     throw new Error('Bullshit detection failed with unknown error');
   }
   ```
   Original error stack trace is lost. Consider:
   ```typescript
   throw new Error(`Bullshit detection failed: ${error.message}`, { cause: error });
   ```

2. **`console.warn` for production code** (`src/index.ts:178, 206, 241, 286, etc.`):
   Consider using a configurable logger or callback for warning handling.

---

## 8. Dependencies

### Analysis

| Dependency | Version | Purpose | Risk |
|------------|---------|---------|------|
| `openai` | ^4.0.0 | Core functionality | Low - well-maintained |
| `dotenv` | ^16.0.0 | Env loading | Low - mature package |

**DevDependencies are appropriate** for the project scope.

### Recommendations

1. **Consider making `dotenv` optional** - Not all users need auto-loading of `.env` files
2. **Pin major versions** in production to avoid breaking changes

---

## 9. Documentation

### Strengths ✅

1. **Comprehensive README** with examples
2. **Dedicated FACT_CHECK_APIS.md** for external API integration
3. **CHANGELOG.md** for version history
4. **JSDoc header** in main source file
5. **Well-named functions** serve as self-documentation

### Improvements ⚠️

1. **Missing inline documentation** for complex logic (e.g., confidence weighting algorithm)
2. **No API rate limit guidance** in documentation
3. **README example uses outdated temperature value** (shows `1` but default is `0`)

---

## 10. Configuration & Build

### Strengths ✅

1. **Modern ESM setup** with proper exports
2. **TypeScript declaration maps** for debugging
3. **Proper package.json `files` array** excludes tests from published package
4. **`engines` field** specifies Node.js >= 18

### Issues ⚠️

1. **Missing `sideEffects: false`** in package.json for tree-shaking optimization
2. **`.eslintrc.config.js` file exists** but isn't referenced (stale file?)
3. **No `types` field in `exports`** map uses older syntax - should use `types` condition:
   ```json
   "exports": {
     ".": {
       "types": "./dist/index.d.ts",
       "import": "./dist/index.js"
     }
   }
   ```

---

## 11. CI/CD & Workflows

### Strengths ✅

1. **Separate workflows** for unit and integration tests
2. **Security audit workflow** for dependency scanning
3. **NPM publish workflow** with dry-run option

### Issues ⚠️

1. **Workflows require manual dispatch** - Consider adding triggers for PRs and pushes to main
2. **No branch protection rules** evident in workflow files
3. **Missing workflow for linting** as part of CI

---

## 12. Specific Code Issues

### High Priority 🔴

1. **`src/index.ts:12`** - Side effect on import:
   ```typescript
   config(); // Calls dotenv.config() on every import
   ```
   This can conflict with user's env management. Consider:
   ```typescript
   // Let users call config() themselves, or make it lazy
   ```

2. **`src/index.ts:505-508`** - Unused legacy config fields:
   ```typescript
   export interface BullshitDetectorConfig {
     maxStatements?: number;      // Never referenced
     confidenceThreshold?: number; // Never referenced
   }
   ```

### Medium Priority ⚠️

1. **`src/index.ts:57`** - Comment references wrong model:
   ```typescript
   model?: string; // OpenAI model to use (defaults to 'gpt-4.1-2025-04-14')
   ```
   Verify this is the intended default model name.

2. **`src/index.ts:444-449`** - String matching for rating detection:
   ```typescript
   if (enhancement.externalSources.some(source =>
     source.rating?.toLowerCase().includes('false') ||
     source.rating?.toLowerCase().includes('misleading')
   )) {
   ```
   This is fragile. Consider using an enum or standardized rating codes.

3. **`src/index.ts:238`** - Confidence calculation magic numbers:
   ```typescript
   confidence: Math.max(0.9 - (index * 0.1), 0.1)
   ```
   Should be documented or made configurable.

### Low Priority 💡

1. **Inconsistent prompt formatting** - `STRING_SYSTEM_PROMPT` and `MESSAGES_SYSTEM_PROMPT` are nearly identical. Consider a template function.

2. **No timeout configuration** for fetch calls to external APIs.

3. **`src/__tests__/setup.ts`** sets a fallback API key that may mask missing key errors in development.

---

## 13. Recommendations Summary

### Must Fix Before Next Release 🔴

1. Remove or implement `api_first` strategy (currently stub)
2. Fix side effect on import (`dotenv.config()`)
3. Remove unused legacy config fields or implement them
4. Replace `any` types with proper interfaces

### Should Address ⚠️

1. Parallelize external API calls for performance
2. Add error cause chaining for better debugging
3. Make model name a configurable constant
4. Add input validation/sanitization
5. Configure coverage thresholds in tests

### Nice to Have 💡

1. Split into multiple modules for maintainability
2. Add optional caching layer
3. Create a configurable logger interface
4. Add timeout configuration for external APIs
5. Add `sideEffects: false` to package.json

---

## 14. Positive Highlights

The codebase demonstrates several excellent practices:

1. **🎯 Clear purpose** - The library does one thing well
2. **📦 Clean API surface** - Simple `detectBullshit()` function with sensible defaults
3. **🔄 Backward compatibility** - Legacy class API maintained
4. **🧪 Thorough testing** - Both unit and integration tests with creative LLM evaluation
5. **📝 Good documentation** - README and dedicated guides
6. **🔐 Security-conscious** - Proper env var handling, no hardcoded secrets
7. **⚡ Performance-aware** - Single LLM call for multi-claim extraction

---

## Conclusion

This is a well-engineered library that's ready for production use. The main issues are relatively minor (unused code paths, some type safety gaps, a side effect on import). The testing strategy is particularly impressive, using both traditional mocking and LLM-based evaluation for integration tests.

**Recommendation**: Address the "Must Fix" items before the next release, then tackle the "Should Address" items for v1.1.0.

---

*This review was generated by Claude Code as part of an agentic code review process.*
