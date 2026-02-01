import { _electron as electron, ElectronApplication, Page } from '@playwright/test';
import * as path from 'path';

/**
 * Helper utilities for Playwright Electron E2E tests
 */

/**
 * Launch the Electron application for testing
 * @returns Electron application instance and first window
 */
export async function launchApp(): Promise<{ electronApp: ElectronApplication; window: Page }> {
  const electronApp = await electron.launch({
    args: [path.join(__dirname, '../../dist/main/index.js')],
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
  });

  const window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  return { electronApp, window };
}

/**
 * Login helper for tests that require authentication
 * @param window - Playwright Page instance
 * @param email - Email address to login with
 * @param password - Password to login with
 */
export async function login(window: Page, email: string, password: string): Promise<void> {
  // Wait for login page to load
  await window.waitForLoadState('networkidle');

  // Find and fill email field
  const emailInput = window.locator('input[type="email"]').first()
    .or(window.locator('input[type="text"]').first())
    .or(window.locator('input[placeholder*="email" i]').first());

  await emailInput.waitFor({ state: 'visible', timeout: 5000 });
  await emailInput.fill(email);

  // Find and fill password field
  const passwordInput = window.locator('input[type="password"]').first();
  await passwordInput.waitFor({ state: 'visible', timeout: 5000 });
  await passwordInput.fill(password);

  // Find and click login button
  const loginButton = window.locator('button:has-text("Login")').first()
    .or(window.locator('button:has-text("Sign In")').first())
    .or(window.locator('button[type="submit"]').first());

  await loginButton.waitFor({ state: 'visible', timeout: 5000 });
  await loginButton.click();

  // Wait for navigation
  await window.waitForTimeout(1000);
}

/**
 * Check if the app is on the login page
 * @param window - Playwright Page instance
 * @returns true if on login page
 */
export async function isLoginPage(window: Page): Promise<boolean> {
  const url = window.url();
  return url.includes('login') || url.endsWith('/');
}

/**
 * Navigate to a specific route
 * @param window - Playwright Page instance
 * @param route - Route to navigate to (e.g., '/dashboard', '/settings')
 */
export async function navigateToRoute(window: Page, route: string): Promise<void> {
  // Try to find a navigation link to the route
  const navLink = window.locator(`a[href*="${route}"]`).first();

  if (await navLink.count() > 0) {
    await navLink.click();
    await window.waitForTimeout(500);
  } else {
    // Fallback: use React Router if available via window object
    // This would require exposing navigation in preload script
    console.warn(`No navigation link found for route: ${route}`);
  }
}

/**
 * Wait for the app to be fully loaded and ready
 * @param window - Playwright Page instance
 */
export async function waitForAppReady(window: Page): Promise<void> {
  await window.waitForLoadState('networkidle');

  // Wait for React to be ready
  await window.waitForSelector('body', { state: 'visible' });

  // Additional wait for any initial data loading
  await window.waitForTimeout(500);
}

/**
 * Get all console messages from the app
 * @param window - Playwright Page instance
 * @returns Array of console messages
 */
export function setupConsoleCapture(window: Page): string[] {
  const messages: string[] = [];

  window.on('console', (msg) => {
    messages.push(`[${msg.type()}] ${msg.text()}`);
  });

  return messages;
}

/**
 * Check if an element exists on the page
 * @param window - Playwright Page instance
 * @param selector - CSS selector or text selector
 * @returns true if element exists
 */
export async function elementExists(window: Page, selector: string): Promise<boolean> {
  return (await window.locator(selector).count()) > 0;
}

/**
 * Take a screenshot with a descriptive name
 * @param window - Playwright Page instance
 * @param name - Name for the screenshot file
 */
export async function takeScreenshot(window: Page, name: string): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `screenshot-${name}-${timestamp}.png`;
  await window.screenshot({ path: path.join(__dirname, '../../test-results', filename) });
}

/**
 * Get the current route from the URL
 * @param window - Playwright Page instance
 * @returns Current route path
 */
export function getCurrentRoute(window: Page): string {
  const url = window.url();
  const urlObj = new URL(url);
  return urlObj.pathname;
}

/**
 * Common test credentials for use in tests
 * Note: These should match seeded data in a test database
 */
export const TEST_CREDENTIALS = {
  ADMIN: {
    email: 'admin@example.com',
    password: 'admin123',
  },
  USER: {
    email: 'test@example.com',
    password: 'testpassword123',
  },
};

/**
 * Common routes in the application
 */
export const ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  SESSIONS: '/sessions',
  SETTINGS: '/settings',
  ADMIN: '/admin',
};
