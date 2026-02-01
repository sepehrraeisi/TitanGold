# Frontend Tests

This directory contains all frontend tests for the TitanGold application.

## Test Files

- **setup.ts** - Global test configuration and setup
- **Button.tsx** / **Button.test.tsx** - Sample component and tests (for reference)
- **utils.ts** / **utils.test.ts** - Sample utility functions and tests (for reference)

## Running Tests

```bash
# Run all frontend tests
npm test -- src/__tests__/

# Run specific test file
npm test -- src/__tests__/Button.test.tsx

# Run with coverage
npm run test:coverage -- src/__tests__/

# Run with UI
npm run test:ui -- src/__tests__/
```

## Writing New Tests

1. Create your test file next to the component/module you're testing, or in this directory
2. Name it with `.test.ts` or `.test.tsx` extension
3. Import necessary utilities:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
```

4. Write your tests following the examples in this directory

## Sample Tests

The sample tests demonstrate:
- Component rendering
- Event handling
- Props validation
- Styling and variants
- Disabled states
- Utility function testing
- Mocking and timers
- Edge cases

Feel free to use these as templates or delete them once you have your own tests.

## Documentation

See `/docs/TESTING_GUIDE.md` for comprehensive testing documentation.
