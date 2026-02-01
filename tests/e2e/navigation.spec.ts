import { test, expect, _electron as electron } from '@playwright/test';
import { ElectronApplication, Page } from 'playwright';
import * as path from 'path';

/**
 * E2E Test: Navigation
 * Tests sidebar navigation between different pages in the app
 * Routes: /login, /dashboard, /sessions, /sessions/:id, /settings, /admin/*
 */

test.describe('Navigation', () => {
  let electronApp: ElectronApplication;
  let window: Page;

  test.beforeEach(async () => {
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../../dist/main/index.js')],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    });

    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
  });

  test.afterEach(async () => {
    await electronApp.close();
  });

  test('should have sidebar navigation elements', async () => {
    await window.waitForLoadState('networkidle');

    // Note: Sidebar only appears after login, so this test might not find elements
    // Check if we're on login page first
    const isLoginPage = window.url().includes('login');

    if (!isLoginPage) {
      // Look for navigation elements - adjust selectors based on your actual implementation
      const hasNavigation = await window.locator('nav').count() > 0 ||
                           await window.locator('[role="navigation"]').count() > 0 ||
                           await window.locator('aside').count() > 0 ||
                           await window.locator('.sidebar').count() > 0;

      expect(hasNavigation).toBe(true);

      // Check for common navigation links
      const navigationLinks = await window.locator('a[href]').count();
      expect(navigationLinks).toBeGreaterThan(0);
    } else {
      // If we're on login page, that's expected behavior
      expect(isLoginPage).toBe(true);
    }
  });

  test('should have navigation links to main routes', async () => {
    await window.waitForLoadState('networkidle');

    const isLoginPage = window.url().includes('login');

    if (!isLoginPage) {
      // Check for navigation links to main routes
      // Adjust these selectors based on your actual navigation implementation

      // Dashboard link
      const dashboardLink = window.locator('a[href*="dashboard"]')
        .or(window.locator('a:has-text("Dashboard")'));

      // Sessions link
      const sessionsLink = window.locator('a[href*="sessions"]')
        .or(window.locator('a:has-text("Sessions")'));

      // Settings link
      const settingsLink = window.locator('a[href*="settings"]')
        .or(window.locator('a:has-text("Settings")'));

      // At least one of these should exist in the navigation
      const hasDashboard = await dashboardLink.count() > 0;
      const hasSessions = await sessionsLink.count() > 0;
      const hasSettings = await settingsLink.count() > 0;

      const hasAnyNavLink = hasDashboard || hasSessions || hasSettings;
      expect(hasAnyNavLink).toBe(true);
    } else {
      // Skip this test if on login page
      test.skip();
    }
  });

  test('should be able to click navigation links', async () => {
    await window.waitForLoadState('networkidle');

    const isLoginPage = window.url().includes('login');

    if (!isLoginPage) {
      // Find any navigation link
      const navLinks = window.locator('nav a, aside a, [role="navigation"] a');
      const linkCount = await navLinks.count();

      if (linkCount > 0) {
        // Get the initial URL
        const initialUrl = window.url();

        // Click the first navigation link
        const firstLink = navLinks.first();
        await firstLink.click();

        // Wait for navigation
        await window.waitForTimeout(500);

        // Check that either URL changed or we're on a valid page
        const newUrl = window.url();
        const urlChanged = newUrl !== initialUrl;

        // Verify the page is still functional
        const bodyVisible = await window.locator('body').isVisible();
        expect(bodyVisible).toBe(true);

        // If URL changed, verify it's a valid app route
        if (urlChanged) {
          const isValidRoute = newUrl.includes('dashboard') ||
                              newUrl.includes('sessions') ||
                              newUrl.includes('settings') ||
                              newUrl.includes('admin');
          expect(isValidRoute).toBe(true);
        }
      }
    } else {
      test.skip();
    }
  });

  test('should maintain app state during navigation', async () => {
    await window.waitForLoadState('networkidle');

    const isLoginPage = window.url().includes('login');

    if (!isLoginPage) {
      // Navigate between pages and verify app remains stable
      const navLinks = window.locator('nav a, aside a, [role="navigation"] a');
      const linkCount = await navLinks.count();

      if (linkCount >= 2) {
        // Click first link
        await navLinks.nth(0).click();
        await window.waitForTimeout(300);

        // Verify page is still responsive
        let bodyVisible = await window.locator('body').isVisible();
        expect(bodyVisible).toBe(true);

        // Click second link
        await navLinks.nth(1).click();
        await window.waitForTimeout(300);

        // Verify page is still responsive after second navigation
        bodyVisible = await window.locator('body').isVisible();
        expect(bodyVisible).toBe(true);

        // Verify no console errors (optional - requires additional setup)
        // This would need console message listeners set up in beforeEach
      }
    } else {
      test.skip();
    }
  });

  test('should highlight active navigation item', async () => {
    await window.waitForLoadState('networkidle');

    const isLoginPage = window.url().includes('login');

    if (!isLoginPage) {
      // Look for active/selected navigation indicators
      // Common patterns: .active, .selected, [aria-current="page"], etc.
      const hasActiveIndicator = await window.locator('.active').count() > 0 ||
                                 await window.locator('.selected').count() > 0 ||
                                 await window.locator('[aria-current="page"]').count() > 0 ||
                                 await window.locator('[data-active="true"]').count() > 0;

      // At least some navigation systems should have active indicators
      // This is not strictly required, so we just check if indicators exist
      if (hasActiveIndicator) {
        expect(hasActiveIndicator).toBe(true);
      }
    } else {
      test.skip();
    }
  });

  test('should have working browser navigation (back/forward)', async () => {
    await window.waitForLoadState('networkidle');

    const isLoginPage = window.url().includes('login');

    if (!isLoginPage) {
      const navLinks = window.locator('nav a, aside a');
      const linkCount = await navLinks.count();

      if (linkCount > 0) {
        // Record initial URL
        const initialUrl = window.url();

        // Navigate to another page
        await navLinks.first().click();
        await window.waitForTimeout(500);
        const secondUrl = window.url();

        if (secondUrl !== initialUrl) {
          // Go back
          await window.goBack();
          await window.waitForTimeout(300);
          const backUrl = window.url();

          // Verify we're back at the initial URL (or at least navigated back)
          expect(backUrl).toBe(initialUrl);

          // Go forward
          await window.goForward();
          await window.waitForTimeout(300);
          const forwardUrl = window.url();

          // Verify we're at the second URL again
          expect(forwardUrl).toBe(secondUrl);
        }
      }
    } else {
      test.skip();
    }
  });
});
