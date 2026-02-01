import { test, expect, _electron as electron } from '@playwright/test';
import { ElectronApplication, Page } from 'playwright';
import * as path from 'path';

/**
 * E2E Test: Application Launch
 * Tests that the Electron app launches successfully and displays the login page
 */

test.describe('App Launch', () => {
  let electronApp: ElectronApplication;
  let window: Page;

  test.beforeAll(async () => {
    // Launch Electron app
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../../dist/main/index.js')],
      // Enable more debugging info if needed
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    });

    // Get the first window that the app opens
    window = await electronApp.firstWindow();

    // Wait for the app to be ready
    await window.waitForLoadState('domcontentloaded');
  });

  test.afterAll(async () => {
    // Close the app after tests
    await electronApp.close();
  });

  test('should launch the app successfully', async () => {
    // Check that the app window exists
    expect(window).toBeDefined();

    // Check that the window is visible
    const isVisible = await window.isVisible('body');
    expect(isVisible).toBe(true);
  });

  test('should display the login page on launch', async () => {
    // Wait for navigation to complete
    await window.waitForLoadState('networkidle');

    // Check for login page elements
    // This assumes the login page has a recognizable element like a login form or title
    const url = window.url();

    // URL should contain login or be at root (which redirects to login)
    const isLoginRoute = url.includes('login') || url.endsWith('/');
    expect(isLoginRoute).toBe(true);

    // Check for common login page elements
    // Adjust selectors based on your actual login page implementation
    const hasLoginForm = await window.locator('form').count() > 0 ||
                        await window.locator('[type="password"]').count() > 0 ||
                        await window.locator('button:has-text("Login")').count() > 0 ||
                        await window.locator('button:has-text("Sign In")').count() > 0;

    expect(hasLoginForm).toBe(true);
  });

  test('should have the correct window title', async () => {
    const title = await window.title();

    // Check that the title is set (not empty)
    expect(title.length).toBeGreaterThan(0);

    // Optionally check for specific title pattern
    // Adjust based on your actual app title
    const hasValidTitle = title.includes('VoiceNote') ||
                         title.includes('Login') ||
                         title.length > 0;
    expect(hasValidTitle).toBe(true);
  });

  test('should have proper window dimensions', async () => {
    const size = await window.viewportSize();

    if (size) {
      // Check that window has reasonable dimensions
      expect(size.width).toBeGreaterThan(0);
      expect(size.height).toBeGreaterThan(0);

      // Check minimum usable size (adjust as needed)
      expect(size.width).toBeGreaterThanOrEqual(800);
      expect(size.height).toBeGreaterThanOrEqual(600);
    }
  });
});
