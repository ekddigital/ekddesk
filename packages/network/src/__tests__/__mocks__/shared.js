// Mock for @ekd-desk/shared package
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

// Create Logger class that returns the mock
class MockLogger {
    constructor() {
        Object.assign(this, mockLogger);
    }

    static createLogger() {
        return new MockLogger();
    }

    static getInstance() {
        return new MockLogger();
    }

    debug = jest.fn()
    info = jest.fn()
    warn = jest.fn()
    error = jest.fn()
    verbose = jest.fn()
    setLevel = jest.fn()
    setContext = jest.fn()
    child = jest.fn(() => new MockLogger())
    stream = jest.fn(() => ({ write: jest.fn() }))
    logConnection = jest.fn()
    logSession = jest.fn()
    logAuth = jest.fn()
    logNetworkEvent = jest.fn()
    logMediaEvent = jest.fn()
    logPerformance = jest.fn()
}

module.exports = {
    Logger: MockLogger,
    EventBus: class MockEventBus {
        on = jest.fn()
        emit = jest.fn()
        off = jest.fn()
    },
    ConfigManager: class MockConfigManager {
        get = jest.fn()
        set = jest.fn()
    },
    DeviceManager: class MockDeviceManager {
        getDeviceId = jest.fn()
        getDeviceInfo = jest.fn()
    },
};

// Also export the mock instance for test assertions
module.exports.mockLogger = mockLogger;
