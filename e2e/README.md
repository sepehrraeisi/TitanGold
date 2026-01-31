# E2E Tests for TitanGold

## Overview

End-to-end tests using Playwright to test the complete AI Agent workflows in the TitanGold trading platform.

## Test Coverage

The E2E test suite covers the following workflows:

1. **Opening AI Center** - Navigate to the AI agents dashboard
2. **Selecting an Agent** - Click on an agent to open its control panel
3. **Running Analysis** - Execute analysis on selected agent
4. **Viewing Results** - Display and verify analysis results
5. **Updating Configuration** - Modify agent settings and save changes
6. **Error Handling** - Test network failures and edge cases

## Prerequisites

- Node.js 18.x or 20.x
- npm or yarn
- Chromium browser (installed automatically by Playwright)

## Installation

Install Playwright and its dependencies:

```bash
npm install
npx playwright install chromium
```

## Running Tests

### Run all E2E tests
```bash
npm run test:e2e
```

### Run tests with UI (interactive mode)
```bash
npm run test:e2e:ui
```

### Run tests in headed mode (see browser)
```bash
npm run test:e2e:headed
```

### Debug tests
```bash
npm run test:e2e:debug
```

### Run specific test file
```bash
npx playwright test e2e/agents.spec.ts
```

### Run specific test by name
```bash
npx playwright test -g "should open AI Center"
```

## Test Structure

```
e2e/
├── agents.spec.ts           # AI agent workflow tests
├── screenshots/             # Test screenshots (generated)
└── README.md               # This file
```

## Configuration

Test configuration is in `playwright.config.ts`:

- **Base URL**: `http://localhost:5173` (can be overridden with `PLAYWRIGHT_BASE_URL` env var)
- **Browser**: Chromium (Desktop Chrome)
- **Retries**: 2 on CI, 0 locally
- **Timeout**: 30 seconds per test
- **Screenshots**: On failure
- **Videos**: On failure

## CI Integration

E2E tests run automatically on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`
- When relevant files change (e2e/, components/, src/, etc.)

See `.github/workflows/e2e-tests.yml` for CI configuration.

## Test Reports

After running tests, view the HTML report:

```bash
npx playwright show-report
```

## Screenshots

Test screenshots are saved to `e2e/screenshots/` directory:
- `ai-center-opened.png` - AI Center page
- `agent-control-panel.png` - Agent control panel
- `agent-tabs.png` - Control panel tabs
- `analysis-running.png` - Analysis in progress
- `analysis-results.png` - Analysis results
- `config-modified.png` - Configuration settings
- `control-commands.png` - Control commands
- `agent-metrics.png` - Agent metrics display

## Writing New Tests

To add new E2E tests:

1. Create a new `.spec.ts` file in the `e2e/` directory
2. Import necessary Playwright utilities:
   ```typescript
   import { test, expect } from '@playwright/test';
   ```
3. Write your test cases using the Playwright API
4. Run and verify your tests locally before committing

## Debugging

### Visual debugging
```bash
npm run test:e2e:debug
```

### Trace viewer (for failed tests)
```bash
npx playwright show-trace trace.zip
```

### Inspector
Add `await page.pause()` in your test to pause execution and inspect:
```typescript
test('debug test', async ({ page }) => {
  await page.goto('/');
  await page.pause(); // Opens Playwright Inspector
});
```

## Best Practices

1. **Use meaningful test names** - Describe what the test does
2. **Wait for elements** - Use `waitForSelector` or `waitForLoadState`
3. **Avoid hard-coded waits** - Use `waitForTimeout` sparingly
4. **Take screenshots** - Capture important states for debugging
5. **Clean up** - Use `beforeEach` and `afterEach` hooks
6. **Test in isolation** - Each test should be independent
7. **Use data-testid** - Add test IDs to components for reliable selection

## Troubleshooting

### Tests fail locally but pass in CI
- Check browser version compatibility
- Ensure dev server is running
- Check for timing issues (add appropriate waits)

### Cannot find elements
- Verify selectors are correct
- Check if elements are visible
- Use Playwright Inspector to debug selectors

### Timeout errors
- Increase timeout in playwright.config.ts
- Check if elements load slowly
- Verify network conditions

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright API Reference](https://playwright.dev/docs/api/class-playwright)
- [Debugging Guide](https://playwright.dev/docs/debug)

## Support

For issues or questions about E2E tests:
1. Check Playwright documentation
2. Review existing test examples
3. Consult the team
4. Check CI logs for failures

---

**Note**: E2E tests require the frontend dev server to be running. The tests will automatically start the server if it's not already running.
