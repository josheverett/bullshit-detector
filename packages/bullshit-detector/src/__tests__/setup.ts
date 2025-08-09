// Vitest setup file for common test utilities and mocks
import { vi } from 'vitest';

// Set a default timeout for tests
vi.setConfig({ testTimeout: 30000 });

// Set default test API keys only if real ones aren't present
if (!process.env.OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = 'test-api-key';
}