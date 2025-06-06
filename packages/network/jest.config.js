module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    setupFilesAfterEnv: ['<rootDir>/src/__tests__/jest-setup-final.ts'],
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.test.ts',
        '!src/**/__tests__/**',
        '!src/index.ts'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    testMatch: [
        '<rootDir>/src/**/__tests__/**/*.test.ts',
        '<rootDir>/src/**/*.test.ts'
    ],
    moduleNameMapper: {
        '^@ekd-desk/(.*)$': '<rootDir>/../$1/src'
    },
    transform: {
        '^.+\\.ts$': ['ts-jest', {
            useESM: false,
            tsconfig: {
                module: 'commonjs'
            }
        }]
    },
    moduleFileExtensions: ['ts', 'js', 'json'],
    roots: ['<rootDir>/src'], testTimeout: 10000,
    // Additional settings for better cleanup and stability
    forceExit: true,
    clearMocks: true,
    resetMocks: true,
    restoreMocks: true,
    // Reduce worker issues
    maxWorkers: 1,
    // Better error handling
    detectOpenHandles: true,
    verbose: false
};
