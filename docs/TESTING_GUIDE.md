# TitanGold Backend Testing Guide

**Task**: TEST-001 - Set Up Unit Testing Framework  
**Date**: 2026-01-06  
**Framework**: Jest 29.7.0

---

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Running Tests](#running-tests)
4. [Writing Tests](#writing-tests)
5. [Directory Structure](#directory-structure)
6. [Coverage Requirements](#coverage-requirements)
7. [CI Integration](#ci-integration)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)
10. [Examples](#examples)

---

## Overview

The TitanGold backend uses **Jest** as the primary testing framework. Our testing strategy includes:

- **Unit Tests**: Test individual functions and modules in isolation
- **Integration Tests**: Test interactions between components
- **Performance Tests**: Test performance and load characteristics

### Key Features

✅ **ES Modules Support**: Full support for modern JavaScript modules  
✅ **Coverage Reporting**: Comprehensive code coverage with thresholds  
✅ **Watch Mode**: Automatic re-run on file changes  
✅ **Parallel Execution**: Fast test runs with concurrent workers  
✅ **CI Integration**: Ready for continuous integration pipelines  

---

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Backend dependencies installed (`npm install`)

### Installation

Jest and testing dependencies are already included in `package.json`. If you need to reinstall:

```bash
cd /home/ubuntu/webapp/TitanGold/backend
npm install --save-dev jest @jest/globals
```

### Verify Installation

```bash
npm test -- --version
# Should output: Jest 29.7.0 (or similar)
```

---

## Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run tests for CI (optimized for CI environments)
npm run test:ci

# Run tests with verbose output
npm run test:verbose

# Debug tests (with Node inspector)
npm run test:debug
```

### Filtering Tests

```bash
# Run tests matching a pattern
npm test -- cache

# Run tests in a specific file
npm test -- __tests__/unit/cache.test.js

# Run tests with a specific name
npm test -- --testNamePattern="should cache results"

# Run only failed tests
npm test -- --onlyFailures
```

### Watch Mode Commands

When in watch mode (`npm run test:watch`), you can use these commands:

- **a**: Run all tests
- **f**: Run only failed tests
- **p**: Filter by filename pattern
- **t**: Filter by test name pattern
- **q**: Quit watch mode
- **Enter**: Trigger a test run

---

## Writing Tests

### Test File Structure

Create test files in the `__tests__` directory with the `.test.js` extension:

```
backend/
  __tests__/
    unit/
      myModule.test.js
    integration/
      myFeature.integration.test.js
    performance/
      myPerf.perf.test.js
```

### Basic Test Template

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { myFunction } from '../services/myModule.js';

describe('MyModule', () => {
  // Setup before each test
  beforeEach(() => {
    // Initialize test data or mocks
  });

  // Cleanup after each test
  afterEach(() => {
    // Clean up resources
  });

  describe('myFunction', () => {
    it('should return expected result for valid input', () => {
      // Arrange
      const input = 'test';
      const expected = 'TEST';

      // Act
      const result = myFunction(input);

      // Assert
      expect(result).toBe(expected);
    });

    it('should throw error for invalid input', () => {
      // Arrange
      const input = null;

      // Act & Assert
      expect(() => myFunction(input)).toThrow();
    });
  });
});
```

### ES Modules Testing

Since TitanGold uses ES Modules, use the ES6 import syntax:

```javascript
// Import Jest functions
import { describe, it, expect, jest } from '@jest/globals';

// Import module to test
import { myModule } from '../services/myModule.js';

// For mocking
jest.mock('../services/external.js', () => ({
  externalFunction: jest.fn()
}));
```

### Common Matchers

```javascript
// Equality
expect(value).toBe(expected);           // Strict equality (===)
expect(value).toEqual(expected);        // Deep equality
expect(value).not.toBe(unexpected);     // Not equal

// Truthiness
expect(value).toBeTruthy();             // Truthy value
expect(value).toBeFalsy();              // Falsy value
expect(value).toBeNull();               // Null
expect(value).toBeUndefined();          // Undefined
expect(value).toBeDefined();            // Defined

// Numbers
expect(number).toBeGreaterThan(3);      // > 3
expect(number).toBeGreaterThanOrEqual(3); // >= 3
expect(number).toBeLessThan(5);         // < 5
expect(number).toBeCloseTo(0.3);        // Floating point

// Strings
expect(string).toMatch(/pattern/);      // Regex match
expect(string).toContain('substring');  // Contains substring

// Arrays
expect(array).toContain(item);          // Contains item
expect(array).toHaveLength(3);          // Length check

// Objects
expect(object).toHaveProperty('key');   // Has property
expect(object).toMatchObject({ key: 'value' }); // Partial match

// Functions
expect(fn).toThrow();                   // Throws error
expect(fn).toThrow(Error);              // Throws specific error
expect(fn).toHaveBeenCalled();          // Mock was called
expect(fn).toHaveBeenCalledWith(arg);   // Called with args
```

### Async Testing

```javascript
// Using async/await
it('should handle async operations', async () => {
  const result = await asyncFunction();
  expect(result).toBe(expected);
});

// Using promises
it('should handle promises', () => {
  return asyncFunction().then(result => {
    expect(result).toBe(expected);
  });
});

// Testing promise rejection
it('should handle errors', async () => {
  await expect(asyncFunction()).rejects.toThrow();
});
```

### Mocking

```javascript
import { jest } from '@jest/globals';

// Mock a function
const mockFn = jest.fn();
mockFn.mockReturnValue('mocked value');
mockFn.mockResolvedValue('async mocked value');

// Mock a module
jest.mock('../services/external.js', () => ({
  externalFunction: jest.fn(() => 'mocked')
}));

// Spy on a method
const spy = jest.spyOn(object, 'method');
spy.mockImplementation(() => 'mocked');

// Clear mocks
jest.clearAllMocks();  // Clear call history
jest.resetAllMocks();  // Reset implementation
```

---

## Directory Structure

```
backend/
├── __tests__/
│   ├── unit/                    # Unit tests (test single functions/modules)
│   │   ├── cache.test.js
│   │   ├── timeout.test.js
│   │   └── ...
│   │
│   ├── integration/             # Integration tests (test component interactions)
│   │   ├── rateLimit.integration.test.js
│   │   └── ...
│   │
│   ├── performance/             # Performance tests (load and performance)
│   │   ├── cache.perf.test.js
│   │   └── ...
│   │
│   ├── fixtures/                # Test data and fixtures
│   │   ├── users.json
│   │   └── ...
│   │
│   └── helpers/                 # Test helper functions
│       ├── testDb.js
│       └── ...
│
├── coverage/                    # Coverage reports (auto-generated)
│   ├── lcov-report/
│   └── coverage-final.json
│
├── jest.config.js               # Jest configuration
└── package.json                 # Test scripts
```

### Test Organization Guidelines

1. **Unit Tests** (`__tests__/unit/`)
   - Test single functions or classes
   - Fast execution (< 100ms per test)
   - No external dependencies (database, API, file system)
   - Use mocks for dependencies

2. **Integration Tests** (`__tests__/integration/`)
   - Test component interactions
   - May use real dependencies (database, Redis)
   - Slower execution (< 5s per test)
   - Test end-to-end workflows

3. **Performance Tests** (`__tests__/performance/`)
   - Test performance characteristics
   - Measure execution time, memory usage
   - Load testing, stress testing
   - May take longer to run

---

## Coverage Requirements

### Current Thresholds

The project enforces minimum coverage thresholds:

| Metric | Threshold |
|--------|-----------|
| **Branches** | 60% |
| **Functions** | 60% |
| **Lines** | 70% |
| **Statements** | 70% |

### Viewing Coverage

```bash
# Generate coverage report
npm run test:coverage

# Coverage will be displayed in the console
# HTML report available at: coverage/lcov-report/index.html
```

### Coverage Report Files

- **Text Report**: Console output
- **HTML Report**: `coverage/lcov-report/index.html` (open in browser)
- **LCOV Report**: `coverage/lcov.info` (for CI tools)
- **JSON Report**: `coverage/coverage-final.json` (machine-readable)

### Excluding Files from Coverage

Files are excluded from coverage in `jest.config.js`:

```javascript
collectCoverageFrom: [
  'middleware/**/*.js',
  'utils/**/*.js',
  'services/**/*.js',
  'routes/**/*.js',
  
  // Excluded patterns
  '!**/__tests__/**',
  '!**/node_modules/**',
  '!**/coverage/**',
  '!server.js'
]
```

---

## CI Integration

### GitHub Actions Integration

To integrate tests into GitHub Actions, create `.github/workflows/test.yml`:

```yaml
name: Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'
        cache-dependency-path: backend/package-lock.json
    
    - name: Install dependencies
      run: |
        cd backend
        npm ci
    
    - name: Run tests with coverage
      run: |
        cd backend
        npm run test:ci
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        files: ./backend/coverage/lcov.info
        flags: backend
        name: backend-coverage
    
    - name: Archive coverage report
      uses: actions/upload-artifact@v3
      with:
        name: coverage-report
        path: backend/coverage/
```

### GitLab CI Integration

For GitLab CI, add to `.gitlab-ci.yml`:

```yaml
backend-tests:
  stage: test
  image: node:18
  script:
    - cd backend
    - npm ci
    - npm run test:ci
  coverage: '/All files[^|]*\|[^|]*\s+([\d\.]+)/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: backend/coverage/cobertura-coverage.xml
    paths:
      - backend/coverage/
```

### Jenkins Integration

For Jenkins, add to `Jenkinsfile`:

```groovy
stage('Test') {
  steps {
    dir('backend') {
      sh 'npm ci'
      sh 'npm run test:ci'
    }
  }
  post {
    always {
      publishHTML([
        reportDir: 'backend/coverage/lcov-report',
        reportFiles: 'index.html',
        reportName: 'Coverage Report'
      ])
      junit 'backend/coverage/junit.xml'
    }
  }
}
```

### Pre-commit Hooks

Add tests to pre-commit hooks using Husky:

```bash
# Install Husky
npm install --save-dev husky

# Initialize
npx husky install

# Add pre-commit hook
npx husky add .husky/pre-commit "cd backend && npm test"
```

---

## Best Practices

### 1. Test Organization

✅ **DO**: Organize tests by feature or module
```javascript
describe('CacheService', () => {
  describe('get', () => {
    it('should return cached value', () => { ... });
    it('should return null for missing key', () => { ... });
  });
  
  describe('set', () => {
    it('should store value', () => { ... });
    it('should respect TTL', () => { ... });
  });
});
```

❌ **DON'T**: Mix unrelated tests
```javascript
describe('Tests', () => {
  it('cache should work', () => { ... });
  it('redis should connect', () => { ... });
  it('user login should work', () => { ... });
});
```

### 2. Test Naming

✅ **DO**: Use descriptive test names
```javascript
it('should return 401 when user is not authenticated', () => { ... });
it('should cache result for 5 minutes after successful fetch', () => { ... });
```

❌ **DON'T**: Use vague names
```javascript
it('works', () => { ... });
it('test 1', () => { ... });
```

### 3. AAA Pattern

Follow **Arrange-Act-Assert** pattern:

```javascript
it('should calculate total correctly', () => {
  // Arrange: Set up test data
  const items = [
    { price: 10, quantity: 2 },
    { price: 5, quantity: 3 }
  ];
  
  // Act: Execute the function
  const total = calculateTotal(items);
  
  // Assert: Verify the result
  expect(total).toBe(35);
});
```

### 4. Test Independence

✅ **DO**: Each test should be independent
```javascript
describe('UserService', () => {
  beforeEach(() => {
    // Fresh setup for each test
    users = [];
  });
  
  it('should add user', () => {
    addUser({ name: 'John' });
    expect(users).toHaveLength(1);
  });
  
  it('should remove user', () => {
    addUser({ name: 'John' });
    removeUser('John');
    expect(users).toHaveLength(0);
  });
});
```

❌ **DON'T**: Tests depending on each other
```javascript
it('should add user', () => {
  addUser({ name: 'John' });
  expect(users).toHaveLength(1);
});

it('should remove user', () => {
  // Depends on previous test!
  removeUser('John');
  expect(users).toHaveLength(0);
});
```

### 5. Mock External Dependencies

✅ **DO**: Mock external services
```javascript
import { jest } from '@jest/globals';

jest.mock('../services/api.js', () => ({
  fetchData: jest.fn().mockResolvedValue({ data: 'mocked' })
}));

it('should process API data', async () => {
  const result = await processData();
  expect(result).toBe('processed: mocked');
});
```

### 6. Test Error Cases

✅ **DO**: Test both success and failure cases
```javascript
describe('divideNumbers', () => {
  it('should divide two numbers', () => {
    expect(divideNumbers(10, 2)).toBe(5);
  });
  
  it('should throw error when dividing by zero', () => {
    expect(() => divideNumbers(10, 0)).toThrow('Division by zero');
  });
  
  it('should handle negative numbers', () => {
    expect(divideNumbers(-10, 2)).toBe(-5);
  });
});
```

### 7. Keep Tests Fast

✅ **DO**: Unit tests should run quickly
- Target: < 100ms per unit test
- Use mocks for slow operations
- Avoid real database/API calls in unit tests

❌ **DON'T**: Slow tests in unit test suite
```javascript
// BAD: Real API call in unit test
it('should fetch user data', async () => {
  const user = await fetch('https://api.example.com/user/1');
  expect(user.name).toBe('John');
});
```

### 8. Avoid Test Code Duplication

✅ **DO**: Extract common setup to helpers
```javascript
// __tests__/helpers/testDb.js
export function createTestUser(overrides = {}) {
  return {
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
    ...overrides
  };
}

// In tests
import { createTestUser } from '../helpers/testDb.js';

it('should validate user', () => {
  const user = createTestUser({ email: 'invalid' });
  expect(validateUser(user)).toBe(false);
});
```

---

## Troubleshooting

### Common Issues

#### 1. ES Modules Import Errors

**Error**: `SyntaxError: Cannot use import statement outside a module`

**Solution**: Ensure `NODE_OPTIONS=--experimental-vm-modules` is set:
```bash
NODE_OPTIONS=--experimental-vm-modules jest
```

Or use the npm scripts:
```bash
npm test
```

#### 2. Module Not Found

**Error**: `Cannot find module '../myModule.js'`

**Solution**: Ensure `.js` extension is included:
```javascript
// Correct
import { myFunction } from '../myModule.js';

// Incorrect (missing .js)
import { myFunction } from '../myModule';
```

#### 3. Async Tests Timeout

**Error**: `Timeout - Async callback was not invoked within the 5000 ms timeout`

**Solution**: Increase timeout in jest.config.js or for specific test:
```javascript
it('slow test', async () => {
  // Test code
}, 15000); // 15 second timeout
```

#### 4. Redis Connection Errors

**Error**: `Redis connection failed`

**Solution**: For unit tests, mock Redis:
```javascript
jest.mock('../utils/redis.js', () => ({
  getRedisClient: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn()
  }))
}));
```

#### 5. Coverage Threshold Not Met

**Error**: `Jest: "global" coverage threshold for lines (70%) not met`

**Solution**: 
- Write more tests to cover untested code
- Or temporarily adjust thresholds in `jest.config.js`

#### 6. Tests Pass Locally But Fail in CI

**Common causes**:
- Different Node version
- Missing environment variables
- Race conditions in parallel tests
- File system differences

**Solution**:
```bash
# Run tests in CI mode locally
npm run test:ci

# Run with same Node version as CI
nvm use 18
npm test
```

---

## Examples

### Example 1: Unit Test for Cache Service

```javascript
// __tests__/unit/cache.test.js
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CacheService } from '../../services/cache.js';

describe('CacheService', () => {
  let cache;

  beforeEach(() => {
    cache = new CacheService();
  });

  describe('set and get', () => {
    it('should store and retrieve value', async () => {
      await cache.set('key1', 'value1');
      const result = await cache.get('key1');
      expect(result).toBe('value1');
    });

    it('should return null for non-existent key', async () => {
      const result = await cache.get('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('TTL', () => {
    it('should expire after TTL', async () => {
      await cache.set('key1', 'value1', 100); // 100ms TTL
      
      let result = await cache.get('key1');
      expect(result).toBe('value1');
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));
      
      result = await cache.get('key1');
      expect(result).toBeNull();
    });
  });
});
```

### Example 2: Integration Test for API Route

```javascript
// __tests__/integration/auth.integration.test.js
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../server.js';

describe('Authentication API', () => {
  let server;

  beforeAll(() => {
    server = app.listen(0); // Random port
  });

  afterAll(() => {
    server.close();
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(server)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
    });

    it('should reject invalid credentials', async () => {
      const response = await request(server)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
    });
  });
});
```

### Example 3: Performance Test

```javascript
// __tests__/performance/cache.perf.test.js
import { describe, it, expect } from '@jest/globals';
import { CacheService } from '../../services/cache.js';

describe('CacheService Performance', () => {
  it('should handle 1000 operations under 100ms', async () => {
    const cache = new CacheService();
    const start = Date.now();

    // Perform 1000 operations
    for (let i = 0; i < 1000; i++) {
      await cache.set(`key${i}`, `value${i}`);
    }

    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(100);
  });

  it('should handle concurrent reads efficiently', async () => {
    const cache = new CacheService();
    await cache.set('key', 'value');

    const start = Date.now();

    // 100 concurrent reads
    await Promise.all(
      Array(100).fill().map(() => cache.get('key'))
    );

    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(50);
  });
});
```

---

## Additional Resources

### Jest Documentation
- Official Docs: https://jestjs.io/docs/getting-started
- API Reference: https://jestjs.io/docs/api
- ES Modules: https://jestjs.io/docs/ecmascript-modules

### Testing Best Practices
- Testing Library: https://testing-library.com/
- Kent C. Dodds Blog: https://kentcdodds.com/blog/
- JavaScript Testing Best Practices: https://github.com/goldbergyoni/javascript-testing-best-practices

### Related Documentation
- `docs/BACKEND_SETUP.md` - Backend setup guide
- `docs/DEVELOPMENT.md` - Development workflow
- `README.md` - Project overview

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-06 | 1.0 | Initial testing guide (TEST-001) |

---

## Support

For issues or questions about testing:

1. Check this documentation
2. Review Jest official documentation
3. Check existing test examples in `__tests__/`
4. Ask the development team
5. Create an issue in the project tracker

---

**Last Updated**: 2026-01-06  
**Owner**: Development Team  
**Review Cycle**: Quarterly
