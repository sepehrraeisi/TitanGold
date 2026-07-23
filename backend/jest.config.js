/**
 * Jest Configuration for TitanGold Backend
 * Task: TEST-001 - Set Up Unit Testing Framework
 * 
 * This configuration enables comprehensive unit testing with:
 * - ES Modules support
 * - Coverage reporting
 * - Multiple test environments (unit, integration, performance)
 * - Coverage thresholds for quality gates
 */

export default {
  // Test environment
  testEnvironment: 'node',
  
  // ES Modules support
  transform: {},
  
  // Module resolution for ES Modules
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  
  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/__tests__/**/*.spec.js'
  ],
  
  // Files to collect coverage from
  collectCoverageFrom: [
    // Core application files
    'middleware/**/*.js',
    'utils/**/*.js',
    'services/**/*.js',
    'routes/**/*.js',
    
    // Exclude patterns
    '!**/__tests__/**',
    '!**/node_modules/**',
    '!**/coverage/**',
    '!**/dist/**',
    '!server.js',
    '!database/migrate.js'
  ],
  
  // Coverage output
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',        // Console output
    'text-summary', // Brief summary
    'lcov',        // For CI tools
    'html',        // Interactive HTML report
    'json'         // Machine-readable format
  ],
  
  // Coverage thresholds (quality gates)
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 70,
      statements: 70
    }
  },
  
  // Test timeouts
  testTimeout: 10000,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Collect coverage automatically
  collectCoverage: false, // Only when explicitly requested
  
  // Verbose output
  verbose: true,
  
  // Error handling
  errorOnDeprecated: true,
  
  // Test path ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/dist/',
    // Lives outside backend package; requires telegram-collector local deps.
    '<rootDir>/__tests__/unit/telegramCollectorAuth.test.js',
  ],
  
  // Watch mode ignore patterns
  watchPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/dist/'
  ],
  
  // Setup files
  // setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'], // Uncomment if needed
  
  // Maximum number of concurrent workers
  maxWorkers: '50%',
  
  // Notify on test completion
  notify: false,
  
  // Display individual test results
  displayName: {
    name: 'TITANGOLD',
    color: 'yellow'
  }
};
