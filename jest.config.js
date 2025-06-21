module.exports = {
    // Root Jest configuration for EKD Desk monorepo
    projects: [
        // Packages with existing Jest configs
        '<rootDir>/packages/shared/jest.config.js',
        '<rootDir>/packages/crypto/jest.config.js',
        '<rootDir>/packages/network/jest.config.js',

        // Packages that need basic Jest setup
        {
            displayName: 'media',
            rootDir: '<rootDir>/packages/media',
            testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts'],
            preset: 'ts-jest',
            testEnvironment: 'node',
            setupFilesAfterEnv: ['<rootDir>/src/__tests__/jest-setup.ts'],
        },
        {
            displayName: 'platform',
            rootDir: '<rootDir>/packages/platform',
            testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts'],
            preset: 'ts-jest',
            testEnvironment: 'node',
            setupFilesAfterEnv: ['<rootDir>/src/__tests__/jest-setup.ts'],
        }, {
            displayName: 'ui-components',
            rootDir: '<rootDir>/packages/ui-components',
            testMatch: ['<rootDir>/src/**/__tests__/**/*.test.{ts,tsx}'],
            preset: 'ts-jest',
            testEnvironment: 'jsdom',
            setupFilesAfterEnv: ['<rootDir>/src/__tests__/jest-setup.ts'],
            moduleNameMapper: {
                '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
            },
        },

        // Apps
        {
            displayName: 'auth-service',
            rootDir: '<rootDir>/apps/auth-service',
            testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts'],
            preset: 'ts-jest',
            testEnvironment: 'node',
            setupFilesAfterEnv: ['<rootDir>/src/__tests__/jest-setup.ts'],
        },
        {
            displayName: 'signaling-server',
            rootDir: '<rootDir>/apps/signaling-server',
            testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts'],
            preset: 'ts-jest',
            testEnvironment: 'node',
            setupFilesAfterEnv: ['<rootDir>/src/__tests__/jest-setup.ts'],
        },],

    // Global settings
    collectCoverageFrom: [
        'packages/*/src/**/*.{ts,tsx}',
        'apps/*/src/**/*.{ts,tsx}',
        '!**/*.d.ts',
        '!**/node_modules/**',
        '!**/dist/**',
        '!**/__tests__/**',
    ],

    coverageDirectory: '<rootDir>/coverage'
};
