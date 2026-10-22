import puppeteer from 'puppeteer-core';

async function test() {
    console.log('Launching browser...');
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

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.error('PAGE ERROR:', err.message));

    console.log('Navigating to http://127.0.0.1:5173/ ...');
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));

    await page.screenshot({ path: 'evidence/hero_without_circled_items.png' });
    console.log('Hero screenshot saved: evidence/hero_without_circled_items.png');

    // Click Launch 3D Simulation
    console.log('Clicking Launch 3D Simulation...');
    await page.click('#run-scenario');
    await new Promise(r => setTimeout(r, 4000));

    await page.screenshot({ path: 'evidence/simulation_after_river_removal.png' });
    console.log('Simulation screenshot saved: evidence/simulation_after_river_removal.png');

    await browser.close();
}

test().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});
