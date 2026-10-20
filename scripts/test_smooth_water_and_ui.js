import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

fs.mkdirSync('evidence', { recursive: true });

async function runTest() {
    console.log('--- TESTING UPDATED SMOOTH WATER & REFERENCE UI ---');
    
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
            '--window-size=1920,1080',
            '--hide-scrollbars'
        ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    page.on('console', msg => console.log('PAGE:', msg.text()));
    page.on('pageerror', err => console.error('PAGE ERROR:', err.message));

    console.log('Navigating to http://127.0.0.1:5173/ ...');
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await new Promise(r => setTimeout(r, 4000));

    // Shot 1: Normal Flow with Smooth Royal Blue Ribbon Water
    console.log('Selecting Normal Flow Scenario...');
    await page.click('.scenario-card[data-scenario="normal"]');
    await new Promise(r => setTimeout(r, 3000));
    await page.screenshot({ path: 'evidence/smooth_water_normal_flow.png' });
    console.log('Saved evidence/smooth_water_normal_flow.png');

    // Shot 2: Close-up on River Suir and Old Bridge
    console.log('Selecting Old Bridge & The Quay camera vantage...');
    await page.click('.btn-vantage[data-vantage="bridge"]');
    await new Promise(r => setTimeout(r, 2500));
    await page.screenshot({ path: 'evidence/smooth_water_bridge_vantage.png' });
    console.log('Saved evidence/smooth_water_bridge_vantage.png');

    // Shot 3: 100-Yr Surge with Flood Flowing Through Streets
    console.log('Selecting 100-Yr Surge Scenario...');
    await page.click('.scenario-card[data-scenario="flood100"]');
    await new Promise(r => setTimeout(r, 3500));
    await page.screenshot({ path: 'evidence/smooth_water_surge_flood.png' });
    console.log('Saved evidence/smooth_water_surge_flood.png');

    // Shot 4: Sarsfield Street Centre Vantage
    console.log('Selecting Sarsfield St Centre camera vantage...');
    await page.click('.btn-vantage[data-vantage="centre"]');
    await new Promise(r => setTimeout(r, 2500));
    await page.screenshot({ path: 'evidence/smooth_water_centre_vantage.png' });
    console.log('Saved evidence/smooth_water_centre_vantage.png');

    // Shot 5: Side-by-Side Replay with Bottom Bar & Landmarks
    console.log('Returning to Overview and Activating Side-by-Side Replay...');
    await page.click('.btn-vantage[data-vantage="overview"]');
    await new Promise(r => setTimeout(r, 1500));
    await page.click('#btn-side-by-side');
    await new Promise(r => setTimeout(r, 2500));
    await page.screenshot({ path: 'evidence/smooth_water_side_by_side.png' });
    console.log('Saved evidence/smooth_water_side_by_side.png');

    const fps = await page.$eval('#fps-counter', el => el.textContent);
    console.log(`Live Performance: ${fps}`);

    await browser.close();
    console.log('--- ALL TEST SHOTS COMPLETED SUCCESSFULLY ---');
}

runTest().catch(err => {
    console.error('Test run failed:', err);
    process.exit(1);
});
