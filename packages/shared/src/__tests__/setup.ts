// Test setup for shared package
import { Logger } from '../logger';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// Increase EventEmitter limits to avoid memory leak warnings
process.setMaxListeners(0);
require('events').EventEmitter.defaultMaxListeners = 0;

// Mock console methods for testing
const originalConsole = { ...console };

beforeAll(() => {
  // Mock console to avoid noise in test output
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
  console.info = jest.fn();
  console.debug = jest.fn();
});

afterAll(() => {
  // Restore console
  Object.assign(console, originalConsole);
});

beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
});

// Custom matchers
expect.extend({
  toBeValidDeviceInfo(received) {
    const pass = received &&
      typeof received.id === 'string' &&
      typeof received.name === 'string' &&
      typeof received.type === 'string' &&
      ['desktop', 'mobile', 'web', 'server'].includes(received.type);

    return {
      message: () => `expected ${received} to be valid device info`,
      pass
    };
  },

  toBeValidConfig(received) {
    const pass = received &&
      received.app &&
      received.database &&
      received.security &&
      received.network &&
      received.media;

    return {
      message: () => `expected ${received} to be valid config`,
      pass
    };
  }
});

// Export empty object to indicate this is a module
export {};
