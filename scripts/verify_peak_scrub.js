import puppeteer from 'puppeteer-core';
import path from 'path';

const outDir = 'C:/Users/dhars/.gemini/antigravity/brain/8ef847a2-effc-401b-bc47-8f1726c507c8';

async function run() {
    console.log('Testing peak flood time scrub (02h45) for Benchmark 2000 and Storm Frank...');
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
    await page.setViewport({ width: 1500, height: 950 });

    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));

    const runBtn = await page.$('#run-scenario');
    if (runBtn) {
        await runBtn.click();
        await new Promise(r => setTimeout(r, 2000));
    }

    // 1. Time Machine -> Benchmark Flood 2000
    await page.evaluate(() => {
        const tab = document.getElementById('tab-time');
        if (tab) tab.click();
        const btn2000 = document.querySelector('[data-event="flood_2000"]');
        if (btn2000) btn2000.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    // 2. Click Peak Flood milestone (02:45)
    await page.evaluate(() => {
        const peakBtn = document.querySelectorAll('.milestone-chip')[2]; // 02:45 Peak Flood
        if (peakBtn) peakBtn.click();
    });
    await new Promise(r => setTimeout(r, 2500));

    // Screenshot Peak Flood Overview
    await page.evaluate(() => {
        const item = document.querySelector('.view-dropdown-item[data-index="0"]');
        if (item) item.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    const shotPeakOverview = path.join(outDir, 'test_benchmark_2000_peak_flood_overview.png');
    await page.screenshot({ path: shotPeakOverview });
    console.log(`Saved screenshot: ${shotPeakOverview}`);

    // Screenshot Peak Flood at The Quay
    await page.evaluate(() => {
        const item = document.querySelector('.view-dropdown-item[data-index="1"]');
        if (item) item.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    const shotPeakQuay = path.join(outDir, 'test_benchmark_2000_peak_flood_quay.png');
    await page.screenshot({ path: shotPeakQuay });
    console.log(`Saved screenshot: ${shotPeakQuay}`);

    // Screenshot Peak Flood at Old Bridge
    await page.evaluate(() => {
        const item = document.querySelector('.view-dropdown-item[data-index="2"]');
        if (item) item.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    const shotPeakOldBridge = path.join(outDir, 'test_benchmark_2000_peak_flood_old_bridge.png');
    await page.screenshot({ path: shotPeakOldBridge });
    console.log(`Saved screenshot: ${shotPeakOldBridge}`);

    await browser.close();
    console.log('Peak flood time scrub test complete!');
}

run().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
