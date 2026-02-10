import { chromium } from 'playwright';
(async () => {
    try {
        console.log('Attempting to launch browser...');
        const browser = await chromium.launch({ headless: true });
        console.log('Browser launched successfully!');
        await browser.close();
        console.log('Browser closed.');
    } catch (err) {
        console.error('FAILED to launch browser:', err.message);
        process.exit(1);
    }
})();
