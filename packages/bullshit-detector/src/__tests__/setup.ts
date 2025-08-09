// Vitest setup file for common test utilities and mocks
import { vi } from 'vitest';

// Set a default timeout for tests
vi.setConfig({ testTimeout: 30000 });

// Mock environment variables for tests
process.env.OPENAI_API_KEY = 'test-api-key';