import puppeteer from 'puppeteer-core';
import fs from 'fs';

async function shoot() {
    console.log('Launching Chrome with GPU acceleration for Light Mode shoot...');
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

    // 1. Full Light Mode Overview (Normal Flow, Pristine White Buildings)
    console.log('Shooting 1: Light Mode Overview (Pristine White Buildings)...');
    await page.click('button[data-scenario="normal"]');
    await new Promise(r => setTimeout(r, 2500));
    await page.screenshot({ path: 'evidence/light_mode_overview.png' });
    console.log('Saved evidence/light_mode_overview.png');

    // 2. Close-up on Clonmel Town Centre & White Buildings
    console.log('Shooting 2: Close-up on White Buildings & River Suir Quays...');
    // Programmatically animate camera to close-up perspective
    await page.evaluate(() => {
        const controls = window.__CONTROLS || null;
        // In main.js, let's trigger close-up view if needed, or adjust camera
    });
    // Let's drag camera slightly to inspect the white buildings
    await page.mouse.move(960, 540);
    await page.mouse.down();
    await page.mouse.move(960, 680, { steps: 10 });
    await page.mouse.up();
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: 'evidence/light_mode_closeup_buildings.png' });
    console.log('Saved evidence/light_mode_closeup_buildings.png');

    // 3. Peak Flood with White Buildings
    console.log('Shooting 3: 1-in-100-Year Flood in Light Mode...');
    await page.click('#btn-clear-barriers');
    await page.click('button[data-scenario="flood100"]');
    await page.click('button[data-speed="50"]');
    await new Promise(r => setTimeout(r, 4000));
    await page.screenshot({ path: 'evidence/light_mode_peak_flood.png' });
    console.log('Saved evidence/light_mode_peak_flood.png');

    // 4. Barrier Placed & Side-by-Side Replay
    console.log('Shooting 4: Side-by-Side Replay (Protected vs Unprotected with Green Saved Buildings)...');
    await page.click('#btn-preset-clonmel');
    await new Promise(r => setTimeout(r, 1500));
    await page.click('#btn-side-by-side');
    await new Promise(r => setTimeout(r, 2500));
    await page.screenshot({ path: 'evidence/light_mode_side_by_side.png' });
    console.log('Saved evidence/light_mode_side_by_side.png');

    // 5. Click-for-Depth Inspector Pin & Readouts
    console.log('Shooting 5: Click-for-Depth Inspector in Light Mode...');
    await page.mouse.click(820, 480);
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: 'evidence/light_mode_depth_inspector.png' });
    console.log('Saved evidence/light_mode_depth_inspector.png');

    // 6. Export Depth Map in Light Mode
    console.log('Shooting 6: Exported Peak Depth Map in Light Mode...');
    await page.click('#btn-export-map');
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: 'evidence/light_mode_peak_depth_map.png' });
    console.log('Saved evidence/light_mode_peak_depth_map.png');

    const fps = await page.$eval('#fps-counter', el => el.textContent);
    console.log(`Live performance in Light Mode: ${fps}`);

    await browser.close();
    console.log('All light mode shots captured successfully!');
}

shoot().catch(err => {
    console.error('Shoot failed:', err);
    process.exit(1);
});
