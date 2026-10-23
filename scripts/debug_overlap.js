import puppeteer from 'puppeteer-core';
import path from 'path';

const outDir = 'C:/Users/dhars/.gemini/antigravity/brain/8ef847a2-effc-401b-bc47-8f1726c507c8';

(async () => {
    const browser = await puppeteer.launch({
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        headless: 'new',
        args: ['--no-sandbox', '--window-size=1366,768']
    });

    const page = await browser.newPage();
    
    // Test 1366x768
    await page.setViewport({ width: 1366, height: 768 });
    await page.goto('http://127.0.0.1:5173/#town=dibrugarh', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 2000));
    
    const runBtn = await page.$('#run-scenario');
    if (runBtn) {
        await runBtn.click();
        await new Promise(r => setTimeout(r, 1500));
    }

    await page.screenshot({
        path: path.join(outDir, 'test_overlap_1366.png'),
        clip: { x: 0, y: 0, width: 1366, height: 250 }
    });

    // Test 1440x900
    await page.setViewport({ width: 1440, height: 900 });
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({
        path: path.join(outDir, 'test_overlap_1440.png'),
        clip: { x: 0, y: 0, width: 1440, height: 250 }
    });

    // Test Intervention Lab open
    const tabIntervention = await page.$('#tab-intervention');
    if (tabIntervention) {
        await tabIntervention.click();
        await new Promise(r => setTimeout(r, 1000));
    }
    await page.screenshot({
        path: path.join(outDir, 'test_overlap_intervention_1366.png'),
        clip: { x: 0, y: 0, width: 1366, height: 350 }
    });

    await browser.close();
    console.log('Screenshots captured!');
})();
