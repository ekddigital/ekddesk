module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.test.ts',
        '!src/**/__tests__/**',
        '!src/index.ts'
    ],
    coverageDirectory: 'coverage',
    testMatch: [
        '<rootDir>/src/**/__tests__/**/*.test.ts',
        '<rootDir>/src/**/*.test.ts'
    ],
    moduleNameMapper: {
        '^@ekd-desk/shared$': '<rootDir>/src/__tests__/__mocks__/shared.js',
        '^@ekd-desk/(.*)$': '<rootDir>/../$1/src'
    },
    setupFiles: ['<rootDir>/src/__tests__/jest-setup-early.ts'],
    setupFilesAfterEnv: ['<rootDir>/src/__tests__/jest-setup-final.ts'], transform: {
        '^.+\\.ts$': ['ts-jest', {
            useESM: false,
            tsconfig: {
                module: 'commonjs'
            }
        }]
    },
    moduleFileExtensions: ['ts', 'js', 'json'],
    roots: ['<rootDir>/src'],
    // Additional settings for better cleanup and stability
    clearMocks: true,
    resetMocks: true,
    restoreMocks: true,
    // Reduce worker issues
    maxWorkers: 1,    // Better error handling
    detectOpenHandles: true,
    // Force exit after tests to avoid hanging
    forceExit: true
};
