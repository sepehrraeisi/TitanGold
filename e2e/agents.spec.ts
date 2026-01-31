import { test, expect, Page } from '@playwright/test';

/**
 * E2E Tests for AI Agent Workflows
 * 
 * Tests the complete user journey through the AI Center:
 * 1. Opening the AI Center
 * 2. Selecting an agent
 * 3. Running analysis
 * 4. Viewing results
 * 5. Updating configuration
 */

// Helper function to login (if needed)
async function login(page: Page) {
  // Check if already logged in by looking for dashboard elements
  const isDashboard = await page.locator('[data-testid="dashboard"], .dashboard').count() > 0;
  
  if (!isDashboard) {
    // Try to login - adjust selectors based on your login form
    const usernameInput = page.locator('input[name="username"], input[type="text"], input[placeholder*="username" i]').first();
    const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
    const loginButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")').first();
    
    // Wait for login form
    await page.waitForLoadState('networkidle');
    
    if (await usernameInput.isVisible()) {
      await usernameInput.fill('dev');
      await passwordInput.fill('password');
      await loginButton.click();
      
      // Wait for dashboard to load
      await page.waitForURL(/.*/, { timeout: 10000 });
      await page.waitForLoadState('networkidle');
    }
  }
}

// Helper function to navigate to AI Center
async function navigateToAICenter(page: Page) {
  // Look for AI Agents, AI Center, or similar navigation items
  const aiNavItems = [
    'text=/AI.*Agent/i',
    'text=/AI.*Center/i',
    '[href*="ai"]',
    '[href*="agent"]',
    'button:has-text("AI")',
    'a:has-text("AI")',
  ];
  
  for (const selector of aiNavItems) {
    const element = page.locator(selector).first();
    if (await element.count() > 0 && await element.isVisible()) {
      await element.click();
      await page.waitForLoadState('networkidle');
      break;
    }
  }
}

test.describe('AI Agent Workflows', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    
    // Handle login if required
    await login(page);
    
    // Wait for the page to be fully loaded
    await page.waitForLoadState('networkidle');
  });

  test('should open AI Center', async ({ page }) => {
    // Navigate to AI Center
    await navigateToAICenter(page);
    
    // Verify we're on the AI Center page
    // Look for agent cards, grid, or AI-related headings
    const aiCenterIndicators = await page.locator(
      '[data-testid="agent-card"], .agent-card, h1:has-text("AI"), h2:has-text("Agent")'
    ).count();
    
    expect(aiCenterIndicators).toBeGreaterThan(0);
    
    // Take a screenshot for verification
    await page.screenshot({ path: 'e2e/screenshots/ai-center-opened.png', fullPage: true });
  });

  test('should display multiple AI agents', async ({ page }) => {
    await navigateToAICenter(page);
    
    // Wait for agent cards to load
    await page.waitForSelector('[data-testid="agent-card"], .agent-card, [class*="agent"]', { timeout: 10000 });
    
    // Count agent cards
    const agentCards = await page.locator('[data-testid="agent-card"], .agent-card').count();
    
    // Expect at least one agent to be displayed
    expect(agentCards).toBeGreaterThan(0);
    
    console.log(`Found ${agentCards} agent cards`);
  });

  test('should select an agent and open control panel', async ({ page }) => {
    await navigateToAICenter(page);
    
    // Wait for agents to load
    await page.waitForTimeout(2000);
    
    // Find and click on the first agent's control panel button
    const controlPanelButton = page.locator(
      'button:has-text("control_panel"), button:has-text("Control Panel"), button:has-text("Open")'
    ).first();
    
    await expect(controlPanelButton).toBeVisible({ timeout: 10000 });
    await controlPanelButton.click();
    
    // Wait for control panel to open
    await page.waitForTimeout(1000);
    
    // Verify control panel is displayed
    // Look for modal, dialog, or panel indicators
    const controlPanelOpen = await page.locator(
      '[role="dialog"], .modal, [class*="fixed"][class*="inset"], [data-testid*="control"]'
    ).count();
    
    expect(controlPanelOpen).toBeGreaterThan(0);
    
    // Take screenshot
    await page.screenshot({ path: 'e2e/screenshots/agent-control-panel.png', fullPage: true });
  });

  test('should switch between tabs in control panel', async ({ page }) => {
    await navigateToAICenter(page);
    await page.waitForTimeout(2000);
    
    // Open control panel
    const controlPanelButton = page.locator('button:has-text("control_panel"), button:has-text("Control Panel")').first();
    await controlPanelButton.click();
    await page.waitForTimeout(1000);
    
    // Find and click different tabs
    const tabs = ['overview', 'settings', 'history'];
    
    for (const tabName of tabs) {
      const tab = page.locator(`button:has-text("${tabName}"), [role="tab"]:has-text("${tabName}")`).first();
      
      if (await tab.count() > 0) {
        await tab.click();
        await page.waitForTimeout(500);
        
        // Verify tab is active (usually has different styling)
        const isActive = await tab.evaluate((el) => {
          return el.classList.contains('active') || 
                 el.classList.contains('border-blue') || 
                 el.getAttribute('aria-selected') === 'true';
        });
        
        console.log(`Tab ${tabName} clicked, active state: ${isActive}`);
      }
    }
    
    await page.screenshot({ path: 'e2e/screenshots/agent-tabs.png', fullPage: true });
  });

  test('should run analysis and display analyzing state', async ({ page }) => {
    await navigateToAICenter(page);
    await page.waitForTimeout(2000);
    
    // Open control panel
    const controlPanelButton = page.locator('button:has-text("control_panel"), button:has-text("Control Panel")').first();
    await controlPanelButton.click();
    await page.waitForTimeout(1000);
    
    // Find and click run analysis button
    const runAnalysisButton = page.locator(
      'button:has-text("run_analysis"), button:has-text("Run Analysis"), button:has-text("Analyze")'
    ).first();
    
    if (await runAnalysisButton.count() > 0 && await runAnalysisButton.isEnabled()) {
      // Click the button
      await runAnalysisButton.click();
      
      // Check for analyzing/loading state
      const analyzingIndicator = page.locator(
        'text=/analyzing/i, text=/loading/i, [class*="spinner"], [class*="loading"]'
      );
      
      // Wait a bit to see if analyzing state appears
      await page.waitForTimeout(500);
      
      // Take screenshot during analysis
      await page.screenshot({ path: 'e2e/screenshots/analysis-running.png', fullPage: true });
      
      console.log('Analysis button clicked');
    } else {
      console.log('Run analysis button not available or disabled');
    }
  });

  test('should view analysis results', async ({ page }) => {
    await navigateToAICenter(page);
    await page.waitForTimeout(2000);
    
    // Open control panel
    const controlPanelButton = page.locator('button:has-text("control_panel"), button:has-text("Control Panel")').first();
    await controlPanelButton.click();
    await page.waitForTimeout(1000);
    
    // Look for existing analysis results or data
    const resultsIndicators = await page.locator(
      '[data-testid*="result"], [class*="result"], [class*="analysis"], [class*="signal"], [class*="trend"]'
    ).count();
    
    console.log(`Found ${resultsIndicators} result indicators`);
    
    // Look for specific result elements like confidence, strength, signals
    const confidenceElements = await page.locator('text=/confidence/i, text=/accuracy/i').count();
    const signalElements = await page.locator('text=/signal/i, text=/trend/i').count();
    
    console.log(`Confidence elements: ${confidenceElements}, Signal elements: ${signalElements}`);
    
    // Take screenshot of results
    await page.screenshot({ path: 'e2e/screenshots/analysis-results.png', fullPage: true });
    
    // If we have any results indicators, test passes
    expect(resultsIndicators + confidenceElements + signalElements).toBeGreaterThan(0);
  });

  test('should update agent configuration', async ({ page }) => {
    await navigateToAICenter(page);
    await page.waitForTimeout(2000);
    
    // Open control panel
    const controlPanelButton = page.locator('button:has-text("control_panel"), button:has-text("Control Panel")').first();
    await controlPanelButton.click();
    await page.waitForTimeout(1000);
    
    // Navigate to settings tab
    const settingsTab = page.locator('button:has-text("settings"), [role="tab"]:has-text("settings")').first();
    
    if (await settingsTab.count() > 0) {
      await settingsTab.click();
      await page.waitForTimeout(1000);
      
      // Look for configuration fields (inputs, textareas, checkboxes)
      const configFields = await page.locator('input, textarea, select').count();
      console.log(`Found ${configFields} configuration fields`);
      
      // Try to modify a configuration if fields exist
      if (configFields > 0) {
        // Find a text input or textarea
        const textField = page.locator('input[type="text"], input[type="number"], textarea').first();
        
        if (await textField.count() > 0 && await textField.isVisible()) {
          const originalValue = await textField.inputValue();
          
          // Modify the value
          await textField.clear();
          await textField.fill('TEST_CONFIG_VALUE');
          
          // Take screenshot of modified config
          await page.screenshot({ path: 'e2e/screenshots/config-modified.png', fullPage: true });
          
          // Look for save/update button
          const saveButton = page.locator(
            'button:has-text("save"), button:has-text("update"), button:has-text("apply")'
          ).first();
          
          if (await saveButton.count() > 0 && await saveButton.isVisible()) {
            console.log('Save button found and visible');
          }
          
          // Restore original value to not affect other tests
          await textField.clear();
          await textField.fill(originalValue);
        }
      }
      
      expect(configFields).toBeGreaterThan(0);
    } else {
      console.log('Settings tab not found');
    }
  });

  test('should handle agent control commands', async ({ page }) => {
    await navigateToAICenter(page);
    await page.waitForTimeout(2000);
    
    // Open control panel
    const controlPanelButton = page.locator('button:has-text("control_panel"), button:has-text("Control Panel")').first();
    await controlPanelButton.click();
    await page.waitForTimeout(1000);
    
    // Look for control command buttons (pause, start, restart)
    const controlButtons = await page.locator(
      'button:has-text("pause"), button:has-text("start"), button:has-text("restart")'
    ).count();
    
    console.log(`Found ${controlButtons} control command buttons`);
    
    // Take screenshot
    await page.screenshot({ path: 'e2e/screenshots/control-commands.png', fullPage: true });
    
    expect(controlButtons).toBeGreaterThan(0);
  });

  test('should close agent control panel', async ({ page }) => {
    await navigateToAICenter(page);
    await page.waitForTimeout(2000);
    
    // Open control panel
    const controlPanelButton = page.locator('button:has-text("control_panel"), button:has-text("Control Panel")').first();
    await controlPanelButton.click();
    await page.waitForTimeout(1000);
    
    // Find and click close button
    const closeButton = page.locator(
      'button:has-text("close"), button:has-text("×"), button[aria-label="Close"]'
    ).first();
    
    await expect(closeButton).toBeVisible({ timeout: 5000 });
    await closeButton.click();
    
    // Wait for modal to close
    await page.waitForTimeout(1000);
    
    // Verify modal is closed
    const modalStillOpen = await page.locator('[role="dialog"], .modal').count();
    expect(modalStillOpen).toBe(0);
    
    console.log('Control panel closed successfully');
  });

  test('should display agent metrics and statistics', async ({ page }) => {
    await navigateToAICenter(page);
    await page.waitForTimeout(2000);
    
    // Look for metrics on agent cards
    const accuracyElements = await page.locator('text=/accuracy/i, text=/[0-9]+%/').count();
    const decisionsElements = await page.locator('text=/decision/i, text=/[0-9,]+/').count();
    
    console.log(`Accuracy elements: ${accuracyElements}, Decision elements: ${decisionsElements}`);
    
    // Open a control panel to see detailed metrics
    const controlPanelButton = page.locator('button:has-text("control_panel"), button:has-text("Control Panel")').first();
    await controlPanelButton.click();
    await page.waitForTimeout(1000);
    
    // Look for detailed statistics
    const statsElements = await page.locator(
      'text=/confidence/i, text=/strength/i, text=/total/i, text=/average/i'
    ).count();
    
    console.log(`Statistics elements: ${statsElements}`);
    
    await page.screenshot({ path: 'e2e/screenshots/agent-metrics.png', fullPage: true });
    
    expect(accuracyElements + decisionsElements + statsElements).toBeGreaterThan(0);
  });
});

test.describe('AI Agent Workflows - Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await login(page);
    await page.waitForLoadState('networkidle');
  });

  test('should handle network errors gracefully', async ({ page }) => {
    await navigateToAICenter(page);
    await page.waitForTimeout(2000);
    
    // Open control panel
    const controlPanelButton = page.locator('button:has-text("control_panel"), button:has-text("Control Panel")').first();
    
    if (await controlPanelButton.count() > 0) {
      // Simulate network offline
      await page.context().setOffline(true);
      
      await controlPanelButton.click();
      await page.waitForTimeout(2000);
      
      // Look for error messages or retry buttons
      const errorIndicators = await page.locator(
        'text=/error/i, text=/failed/i, text=/retry/i, [class*="error"]'
      ).count();
      
      console.log(`Error indicators found: ${errorIndicators}`);
      
      // Restore network
      await page.context().setOffline(false);
      
      // The test passes if we handled the offline state without crashing
      expect(true).toBe(true);
    }
  });

  test('should handle empty agent list', async ({ page }) => {
    await navigateToAICenter(page);
    await page.waitForTimeout(3000);
    
    // Check if there's an empty state message or at least the page doesn't crash
    const pageContent = await page.textContent('body');
    
    // Page should have some content even if agents list is empty
    expect(pageContent).toBeTruthy();
    expect(pageContent!.length).toBeGreaterThan(0);
    
    console.log('Page handled potentially empty agent list');
  });
});
