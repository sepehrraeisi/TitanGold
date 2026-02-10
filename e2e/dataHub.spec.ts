import { test, expect, Page } from '@playwright/test';

/**
 * E2E Tests for Data Hub
 */

async function login(page: Page) {
    // Check if already logged in
    const isDashboard = await page.locator('[data-testid="dashboard"], .dashboard').count() > 0;

    if (!isDashboard) {
        const usernameInput = page.locator('input[name="username"], input[type="text"]').first();
        const loginButton = page.locator('button[type="submit"], button:has-text("Login")').first();

        // Wait for login form
        await page.waitForLoadState('networkidle');

        if (await usernameInput.isVisible()) {
            await usernameInput.fill('dev');
            await page.locator('input[name="password"], input[type="password"]').first().fill('password');
            await loginButton.click();

            await page.waitForURL(/.*/, { timeout: 10000 });
            await page.waitForLoadState('networkidle');
        }
    }
}

async function navigateToDataHub(page: Page) {
    // Click on "Data Hub" tab
    const dataHubTab = page.locator('button:has-text("Data Hub"), [role="tab"]:has-text("Data Hub")').first();
    await dataHubTab.click();
    await page.waitForTimeout(1000);
}

test.describe('Data Hub User Workflow', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await login(page);
    });

    test('should navigate to Data Hub', async ({ page }) => {
        await navigateToDataHub(page);

        // Verify Data Hub content
        const headings = await page.locator('h2:has-text("Data Sources"), h2:has-text("Data Categories")').count();
        expect(headings).toBeGreaterThan(0);

        await page.screenshot({ path: 'e2e/screenshots/data-hub-overview.png' });
    });

    test('should verify export buttons are visible', async ({ page }) => {
        await navigateToDataHub(page);

        const exportButtons = page.locator('button:has-text("Export CSV")');
        await expect(exportButtons.first()).toBeVisible();
    });

    test('should open add source modal', async ({ page }) => {
        await navigateToDataHub(page);

        const addSourceBtn = page.locator('button:has-text("Add Source"), button:has-text("New Source")').first();
        if (await addSourceBtn.isVisible()) {
            await addSourceBtn.click();
            await expect(page.locator('[role="dialog"]')).toBeVisible();
            await page.screenshot({ path: 'e2e/screenshots/add-source-modal.png' });
        }
    });
});
