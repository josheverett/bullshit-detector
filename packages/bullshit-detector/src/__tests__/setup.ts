// Jest setup file for common test utilities and mocks
import { jest } from '@jest/globals';

// Set a default timeout for tests
jest.setTimeout(30000);

// Mock environment variables for tests
process.env.OPENAI_API_KEY = 'test-api-key';