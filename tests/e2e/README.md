# Playwright E2E Tests

This directory contains end-to-end (E2E) tests for the VoiceNote Electron application using Playwright.

## Setup

The Playwright test framework is already configured in the project. The required dependencies are:

- `@playwright/test` - Playwright test framework
- `electron` - Electron runtime (already installed)

## Running Tests

### Prerequisites

Before running E2E tests, you must build the application:

```bash
npm run build
```

This builds both the main process (`dist/main/`) and renderer process (`dist/renderer/`).

### Run All E2E Tests

```bash
npm run test:e2e
```

### Run Tests with UI Mode

Playwright UI mode provides an interactive interface to run and debug tests:

```bash
npm run test:e2e:ui
```

### Run Tests in Headed Mode

To see the Electron app window during tests:

```bash
npm run test:e2e:headed
```

### Run Specific Test File

```bash
npx playwright test tests/e2e/app-launch.spec.ts
```

### Run Tests with Debugging

```bash
npx playwright test --debug
```

## Test Files

### `app-launch.spec.ts`

Tests basic application launch functionality:
- App launches successfully
- Login page displays on launch
- Window has correct title and dimensions

### `auth-flow.spec.ts`

Tests authentication flow:
- Login form displays with required fields
- Can type in form fields
- Login button click handling
- Navigation after successful login

**Note:** Authentication tests may fail without valid test credentials. In a production setup, you would seed a test database with known credentials.

### `navigation.spec.ts`

Tests navigation between app pages:
- Sidebar navigation elements exist
- Navigation links to main routes (/dashboard, /sessions, /settings)
- Can click navigation links
- App state maintained during navigation
- Active navigation item highlighting
- Browser back/forward navigation

**Note:** Navigation tests will skip if the app is on the login page (requires authentication).

## Test Structure

Each test file follows this pattern:

```typescript
import { test, expect, _electron as electron } from '@playwright/test';
import { ElectronApplication, Page } from 'playwright';
import path from 'path';

test.describe('Test Suite Name', () => {
  let electronApp: ElectronApplication;
  let window: Page;

  test.beforeEach(async () => {
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../../dist/main/index.js')],
    });
    window = await electronApp.firstWindow();
  });

  test.afterEach(async () => {
    await electronApp.close();
  });

  test('test case', async () => {
    // Test implementation
  });
});
```

## Configuration

Playwright configuration is in `playwright.config.ts` at the project root:

- **Test directory:** `tests/e2e/`
- **Timeout:** 30 seconds per test
- **Retries:** 2 on CI, 0 locally
- **Reporters:** HTML report and list
- **Artifacts:** Screenshots and videos on failure

## Debugging Tips

1. **Use headed mode** to see what's happening:
   ```bash
   npm run test:e2e:headed
   ```

2. **Use debug mode** for step-by-step execution:
   ```bash
   npx playwright test --debug
   ```

3. **View test reports** after failures:
   ```bash
   npx playwright show-report
   ```

4. **Take screenshots** in tests:
   ```typescript
   await window.screenshot({ path: 'screenshot.png' });
   ```

5. **Add console logging**:
   ```typescript
   window.on('console', msg => console.log('PAGE LOG:', msg.text()));
   ```

## Limitations

These E2E tests have some limitations in the current setup:

1. **Authentication:** Tests may fail without seeded test credentials
2. **Database:** Tests run against the actual database (no test isolation)
3. **State:** No automatic cleanup between test runs

## Future Improvements

To make these tests production-ready:

1. **Test Database:** Use a separate test database with seeded data
2. **Test Fixtures:** Create reusable test fixtures for common scenarios
3. **Mock External Services:** Mock OpenAI API and other external dependencies
4. **CI Integration:** Add tests to CI/CD pipeline
5. **Visual Regression:** Add screenshot comparison tests
6. **Performance Testing:** Add timing assertions for critical paths

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Electron Guide](https://playwright.dev/docs/api/class-electron)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
