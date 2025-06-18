// Jest setup for UI components package
// Reuses shared test utilities following DRY principles
import "@ekd-desk/shared/src/test-utils";
import "@testing-library/jest-dom";

// UI-specific test setup
// Mock CSS modules
jest.mock("*.module.css", () => ({}));
jest.mock("*.module.scss", () => ({}));

// Mock React features that might not be available in test environment
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});
