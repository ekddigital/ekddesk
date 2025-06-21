// Shared Jest setup utilities following DRY principles
// This file can be imported by any package's jest-setup.ts

import { Logger } from "@ekd-desk/shared";

// Mock console methods to reduce noise in tests
const originalConsole = { ...console };

export const setupTestEnvironment = () => {
  // Setup test-specific logging
  jest.spyOn(Logger, "createLogger").mockImplementation(
    (name: string) =>
      ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        verbose: jest.fn(),
      }) as any
  );

  // Suppress console output in tests unless debugging
  if (!process.env.DEBUG_TESTS) {
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  }
};

export const teardownTestEnvironment = () => {
  // Restore original console
  Object.assign(console, originalConsole);

  // Clear all mocks
  jest.clearAllMocks();
};

// Common test utilities
export const createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
});

export const createAsyncMock = <T = any>(returnValue?: T, delay = 0) => {
  return jest
    .fn()
    .mockImplementation(
      () =>
        new Promise((resolve) => setTimeout(() => resolve(returnValue), delay))
    );
};

export const waitFor = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Setup and teardown hooks
beforeEach(() => {
  setupTestEnvironment();
});

afterEach(() => {
  teardownTestEnvironment();
});
