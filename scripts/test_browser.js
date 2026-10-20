import puppeteer from 'puppeteer-core';

async function test() {
    console.log('Launching Chrome with GPU acceleration...');
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

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.error('PAGE ERROR:', err.message));

    console.log('Navigating to http://127.0.0.1:5173/ ...');
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 15000 });

    console.log('Waiting 4 seconds for simulation frames and initial readback...');
    await new Promise(r => setTimeout(r, 4000));

    const fps = await page.$eval('#fps-counter', el => el.textContent);
    const buildingsFlooded = await page.$eval('#stat-buildings', el => el.textContent);
    const roadsCutoff = await page.$eval('#stat-roads', el => el.textContent);
    const peakDepth = await page.$eval('#stat-peak-depth', el => el.textContent);
    const totalWater = await page.$eval('#val-total-vol', el => el.textContent);
    const massError = await page.$eval('#val-mass-error', el => el.textContent);

    console.log(`=== LIVE METRICS ===`);
    console.log(`Hardware Performance: ${fps} (RTX 4050 GPU)`);
    console.log(`Grid Resolution: 600x400 cells (240,000 cells, dx=5.67m, dy=5.29m)`);
    console.log(`Buildings Flooded: ${buildingsFlooded} / 6,638`);
    console.log(`Roads Cut Off: ${roadsCutoff}`);
    console.log(`Peak Depth at Quay: ${peakDepth}`);
    console.log(`Total Water Volume: ${totalWater}`);
    console.log(`Mass Conservation Error: ${massError}`);

    await page.screenshot({ path: 'evidence/test_run.png' });
    console.log('Successfully saved evidence/test_run.png');

    await browser.close();
}

test().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});
