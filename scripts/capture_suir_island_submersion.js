import puppeteer from 'puppeteer-core';
import path from 'path';

const outDir = 'C:/Users/dhars/.gemini/antigravity/brain/8ef847a2-effc-401b-bc47-8f1726c507c8';

async function captureSuirIsland() {
    console.log('Capturing authentic Suir Island flood submersion...');
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
    await page.setViewport({ width: 1560, height: 960 });

    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));

    // Transition from hero into 3D simulation
    const runBtn = await page.$('#run-scenario');
    if (runBtn) {
        await runBtn.click();
        await new Promise(r => setTimeout(r, 2000));
    }

    // Switch camera to Suir Island vantage (data-index="3")
    console.log('Switching to Suir Island vantage...');
    await page.evaluate(() => {
        const item = document.querySelector('.view-dropdown-item[data-index="3"]');
        if (item) item.click();
        
        // Fast forward simulation to peak hydrograph flood wave (2 hours in)
        if (window.simulator) {
            window.simulator.totalSimTime = 7200;
            window.simulator.params.riverInflow = 450;
        }
    });

    await new Promise(r => setTimeout(r, 3500));

    const shot1 = path.join(outDir, 'test_suir_island_submerged_red_buildings.png');
    await page.screenshot({ path: shot1 });
    console.log(`Saved screenshot 1: ${shot1}`);

    // Switch to Old Bridge vantage (data-index="2") looking directly at Suir Island and Old Bridge
    console.log('Switching to Old Bridge vantage...');
    await page.evaluate(() => {
        const item = document.querySelector('.view-dropdown-item[data-index="2"]');
        if (item) item.click();
    });
    await new Promise(r => setTimeout(r, 3000));

    const shot2 = path.join(outDir, 'test_old_bridge_and_suir_island_flood.png');
    await page.screenshot({ path: shot2 });
    console.log(`Saved screenshot 2: ${shot2}`);

    await browser.close();
    console.log('Suir Island flood capture finished successfully!');
}

captureSuirIsland().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
