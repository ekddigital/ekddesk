module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src'], testMatch: [
        '**/__tests__/**/*.+(ts|tsx|js)',
        '**/*.(test|spec).+(ts|tsx|js)'
    ],
    testPathIgnorePatterns: [
        '.*jest-setup\\.ts$'
    ],
    transform: {
        '^.+\\.(ts|tsx)$': 'ts-jest'
    },
    collectCoverageFrom: [
        'src/**/*.{ts,tsx}',
        '!src/**/*.d.ts',
        '!src/index.ts'
    ], coverageDirectory: 'coverage',
    setupFilesAfterEnv: ['<rootDir>/src/__tests__/jest-setup.ts']
};
