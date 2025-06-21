// Jest setup for signaling-server tests
import { jest } from "@jest/globals";

// Set up test environment
beforeEach(() => {
  jest.clearAllMocks();
});

// Global test timeout
jest.setTimeout(10000);
