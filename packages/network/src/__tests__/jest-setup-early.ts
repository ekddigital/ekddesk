// Early Jest setup - runs before module loading
import { jest } from "@jest/globals";

// Create a mock logger that will be used everywhere
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  verbose: jest.fn(),
  setLevel: jest.fn(),
  setContext: jest.fn(),
  child: jest.fn(() => mockLogger),
  stream: jest.fn(() => ({ write: jest.fn() })),
  logConnection: jest.fn(),
  logSession: jest.fn(),
  logAuth: jest.fn(),
  logNetworkEvent: jest.fn(),
  logMediaEvent: jest.fn(),
  logPerformance: jest.fn(),
};

// Make the mock logger available globally immediately
(global as any).__mockLogger = mockLogger;

// Mock the Logger class at the earliest possible point
jest.mock("@ekd-desk/shared", () => {
  const LoggerClass: any = jest.fn().mockImplementation(() => mockLogger);
  LoggerClass.createLogger = jest.fn(() => mockLogger);
  LoggerClass.getInstance = jest.fn(() => mockLogger);

  return {
    Logger: LoggerClass,
    EventBus: jest.fn(),
    ConfigManager: jest.fn(),
  };
});
