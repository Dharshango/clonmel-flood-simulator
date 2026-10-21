import puppeteer from 'puppeteer-core';
import path from 'path';

async function verifyGlassUI() {
    console.log('--- Verifying Glassmorphic UI & Removed Reset Button ---');
    const browser = await puppeteer.launch({
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--enable-webgl',
            '--ignore-gpu-blocklist',
            '--use-gl=angle',
            '--use-angle=d3d11',
            '--window-size=1920,1080'
        ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    const errors = [];
    page.on('pageerror', err => {
        console.error('PAGE ERROR:', err.message);
        errors.push(err.message);
    });

    console.log('1. Loading application at http://127.0.0.1:5173/ ...');
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));

    // Verify #btn-quick-reset is removed
    const quickReset = await page.$('#btn-quick-reset');
    console.log('2. #btn-quick-reset in DOM:', quickReset === null ? 'REMOVED (PASSED)' : 'STILL PRESENT (FAIL)');

    // Verify #btn-bar-reset is present in bottom bar
    const barReset = await page.$('#btn-bar-reset');
    console.log('3. #btn-bar-reset in DOM:', barReset !== null ? 'PRESENT (PASSED)' : 'MISSING (FAIL)');

    // Dismiss Hero
    await page.click('#btn-hero-launch');
    await new Promise(r => setTimeout(r, 1500));

    // Check CSS computed styles on glass elements
    const styles = await page.evaluate(() => {
        const panel = document.querySelector('.clean-panel.left-panel');
        const scenarioBtn = document.querySelector('.scenario-btn');
        const metricCard = document.querySelector('.metric-card');
        const depthCard = document.querySelector('.depth-card');
        const btnExport = document.querySelector('.btn-export');
        const bottomBar = document.querySelector('#bottom-playback-bar');

        const getInfo = (el) => {
            if (!el) return null;
            const cs = window.getComputedStyle(el);
            return {
                borderRadius: cs.borderRadius,
                background: cs.backgroundColor,
                backdropFilter: cs.backdropFilter || cs.webkitBackdropFilter,
                border: cs.border
            };
        };

        return {
            panel: getInfo(panel),
            scenarioBtn: getInfo(scenarioBtn),
            metricCard: getInfo(metricCard),
            depthCard: getInfo(depthCard),
            btnExport: getInfo(btnExport),
            bottomBar: getInfo(bottomBar)
        };
    });

    console.log('4. Computed Styles verification:');
    console.log('   Panel:', styles.panel);
    console.log('   Scenario Button:', styles.scenarioBtn);
    console.log('   Metric Card:', styles.metricCard);
    console.log('   Depth Card:', styles.depthCard);
    console.log('   Export Button:', styles.btnExport);
    console.log('   Bottom Bar:', styles.bottomBar);

    // Capture screenshot of UI
    const screenshotPath = 'C:\\Users\\dhars\\.gemini\\antigravity\\brain\\8ef847a2-effc-401b-bc47-8f1726c507c8\\glass_ui_verified.png';
    await page.screenshot({ path: screenshotPath });
    console.log('5. Screenshot saved to:', screenshotPath);

    await browser.close();

    if (errors.length > 0) {
        console.error('Found page errors during verification:', errors);
        process.exit(1);
    } else {
        console.log('All checks passed with 0 errors!');
    }
}

verifyGlassUI().catch(err => {
    console.error('Error during verification:', err);
    process.exit(1);
});
