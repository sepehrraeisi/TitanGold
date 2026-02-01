# Frontend Testing Guide

## Overview

TitanGold frontend uses **Vitest** as the testing framework and **React Testing Library** for component testing. This setup provides fast, modern testing with excellent TypeScript support.

## Testing Stack

- **Vitest**: Fast unit test framework powered by Vite
- **React Testing Library**: Component testing utilities
- **@testing-library/jest-dom**: Custom matchers for DOM assertions
- **@testing-library/user-event**: User interaction simulation
- **jsdom**: DOM implementation for Node.js

## Getting Started

### Installation

Dependencies are already installed. If you need to reinstall:

```bash
npm install --save-dev vitest @vitest/ui @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

### Running Tests

```bash
# Run tests in watch mode
npm test

# Run tests once
npm run test:run

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Run only frontend tests (exclude backend)
npm test -- src/__tests__/
```

## Project Structure

```
TitanGold/
├── src/
│   ├── __tests__/
│   │   ├── setup.ts              # Test setup and global config
│   │   ├── Button.test.tsx       # Component tests
│   │   └── utils.test.ts         # Utility function tests
│   ├── components/
│   │   └── Button.tsx            # Sample component
│   ├── utils/
│   │   └── index.ts              # Sample utilities
│   └── ...
├── vitest.config.ts              # Vitest configuration
├── tsconfig.json                 # TypeScript configuration
└── package.json                  # Dependencies and scripts
```

**Important**: Place source files (components, utils) in `src/` directories, and test files in `src/__tests__/` with `.test.ts` or `.test.tsx` extensions.

## Writing Tests

### Component Testing

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MyComponent } from '../components/MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent title="Hello" />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('handles click events', () => {
    const handleClick = vi.fn();
    render(<MyComponent onClick={handleClick} />);
    
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### Utility Function Testing

```typescript
import { describe, it, expect } from 'vitest';
import { formatCurrency } from '../utils';

describe('formatCurrency', () => {
  it('formats USD correctly', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
  });

  it('handles zero value', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });
});
```

### Async Testing

```typescript
import { describe, it, expect, waitFor } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AsyncComponent } from './AsyncComponent';

describe('AsyncComponent', () => {
  it('loads data asynchronously', async () => {
    render(<AsyncComponent />);
    
    // Wait for async operation
    await waitFor(() => {
      expect(screen.getByText('Loaded')).toBeInTheDocument();
    });
  });
});
```

### Mocking

```typescript
import { describe, it, expect, vi } from 'vitest';

// Mock a module
vi.mock('./api', () => ({
  fetchData: vi.fn(() => Promise.resolve({ data: 'test' }))
}));

// Mock a function
const mockFn = vi.fn();
mockFn.mockReturnValue(42);

// Mock timers
vi.useFakeTimers();
vi.advanceTimersByTime(1000);
vi.restoreAllMocks();
```

## Testing Best Practices

### 1. Arrange-Act-Assert Pattern

```typescript
it('should update counter', () => {
  // Arrange
  render(<Counter initialCount={0} />);
  
  // Act
  fireEvent.click(screen.getByText('Increment'));
  
  // Assert
  expect(screen.getByText('Count: 1')).toBeInTheDocument();
});
```

### 2. Test User Behavior, Not Implementation

```typescript
// ❌ Bad: Testing implementation details
expect(component.state.count).toBe(1);

// ✅ Good: Testing user-facing behavior
expect(screen.getByText('Count: 1')).toBeInTheDocument();
```

### 3. Use Accessible Queries

```typescript
// ✅ Preferred queries (by accessibility)
screen.getByRole('button', { name: 'Submit' });
screen.getByLabelText('Email address');
screen.getByText('Welcome');

// ⚠️ Use when necessary
screen.getByTestId('custom-element');
```

### 4. Clean Up After Tests

Cleanup is automatic with `@testing-library/react`, but for manual cleanup:

```typescript
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
```

### 5. Test Edge Cases

```typescript
describe('formatCurrency', () => {
  it('handles positive values', () => { /* ... */ });
  it('handles negative values', () => { /* ... */ });
  it('handles zero', () => { /* ... */ });
  it('handles very large numbers', () => { /* ... */ });
  it('handles decimal precision', () => { /* ... */ });
});
```

## Configuration

### vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,              // Use global test APIs
    environment: 'jsdom',       // DOM environment
    setupFiles: './src/__tests__/setup.ts',
    css: true,                  // Process CSS
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [/* ... */],
    },
  },
});
```

### Test Setup (src/__tests__/setup.ts)

```typescript
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend expect with jest-dom matchers
expect.extend(matchers);

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock browser APIs
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }),
});
```

## Available Matchers

From `@testing-library/jest-dom`:

```typescript
// Visibility
expect(element).toBeInTheDocument();
expect(element).toBeVisible();
expect(element).toBeEmptyDOMElement();

// Attributes
expect(element).toHaveAttribute('type', 'text');
expect(element).toHaveClass('btn-primary');
expect(element).toHaveStyle('color: red');

// Form elements
expect(element).toBeDisabled();
expect(element).toBeEnabled();
expect(element).toBeChecked();
expect(input).toHaveValue('test');

// Text content
expect(element).toHaveTextContent('Hello');
expect(element).toContainHTML('<span>test</span>');
```

## Continuous Integration

Tests run automatically on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`
- Only when relevant files change (src, tests, config)

See `.github/workflows/frontend-tests.yml` for CI configuration.

## Coverage Reports

Generate coverage reports:

```bash
npm run test:coverage
```

Coverage reports are generated in `coverage/` directory:
- `coverage/index.html` - HTML report (open in browser)
- `coverage/coverage-final.json` - JSON report
- Terminal output - Text summary

## Troubleshooting

### Tests Not Running

1. Check that files end with `.test.ts` or `.test.tsx`
2. Ensure files are in the correct directory
3. Verify imports are correct

### Mock Not Working

```typescript
// Ensure mocks are hoisted before imports
vi.mock('./module', () => ({
  default: vi.fn()
}));

import { MyComponent } from './MyComponent';
```

### DOM Not Available

Ensure `environment: 'jsdom'` is set in `vitest.config.ts`.

### TypeScript Errors

Add types to `tsconfig.json`:

```json
{
  "compilerOptions": {
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  }
}
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [jest-dom Matchers](https://github.com/testing-library/jest-dom)
- [Testing Library Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

## Examples

See `src/__tests__/` for example tests:
- `Button.test.tsx` - Component testing examples
- `utils.test.ts` - Utility function testing examples

## Next Steps

1. Write tests for your components
2. Aim for 80%+ code coverage
3. Test user interactions and edge cases
4. Run tests before committing
5. Monitor CI test results

## Support

For issues or questions:
1. Check Vitest documentation
2. Review React Testing Library guides
3. Examine existing test examples
4. Consult team members

---

**Happy Testing! 🧪**
