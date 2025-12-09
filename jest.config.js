module.exports = {
    testEnvironment: 'node',
    collectCoverageFrom: [
        'src/modules/**/*.js',
        'src/renderer/js/**/*.js',
        '!**/*.backup.js'
    ],
    coverageThreshold: {
        global: {
            branches: 70,
            functions: 75,
            lines: 80,
            statements: 80
        }
    },
    testMatch: ['**/__tests__/**/*.test.js', '**/*.spec.js'],
    moduleNameMapper: {
        '^@modules/(.*)$': '<rootDir>/src/modules/$1',
        '^@renderer/(.*)$': '<rootDir>/src/renderer/js/$1'
    },
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    testTimeout: 10000
};
