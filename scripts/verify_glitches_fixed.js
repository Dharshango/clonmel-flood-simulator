import puppeteer from 'puppeteer-core';
import path from 'path';

const outDir = 'C:/Users/dhars/.gemini/antigravity/brain/8ef847a2-effc-401b-bc47-8f1726c507c8';

async function run() {
    console.log('Launching Chrome to verify Old Bridge, Suir Island, and Time Machine flood fixes...');
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

    const errors = [];
    page.on('console', msg => {
        const text = msg.text();
        if (msg.type() === 'error') {
            errors.push(text);
        }
        if (text.includes('Creating') || text.includes('Buildings') || text.includes('Bridges') || text.includes('Event')) {
            console.log('BROWSER:', text);
        }
    });
    page.on('pageerror', err => {
        console.error('PAGE ERROR:', err.message);
        errors.push(err.message);
    });

    console.log('Navigating to http://127.0.0.1:5173/ ...');
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));

    // Click "Launch 3D Simulation" button (#run-scenario) to transition from hero into the 3D scene
    const runBtn = await page.$('#run-scenario');
    if (runBtn) {
        console.log('Clicking run-scenario to enter 3D simulation...');
        await runBtn.click();
        await new Promise(r => setTimeout(r, 2000));
    }

    // =========================================================================
    // TEST 1: Old Bridge & Suir Island 3D Structure (Glitch 1 Fix)
    // =========================================================================
    console.log('\n--- TEST 1: Verifying Old Bridge & Suir Island ---');
    // Switch to Old Bridge camera view (data-index="2")
    await page.evaluate(() => {
        const item = document.querySelector('.view-dropdown-item[data-index="2"]');
        if (item) item.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    const shot1 = path.join(outDir, 'test_old_bridge_3d_and_suir_island.png');
    await page.screenshot({ path: shot1 });
    console.log(`Saved screenshot 1: ${shot1}`);

    // Switch to Suir Island camera view (data-index="3")
    await page.evaluate(() => {
        const item = document.querySelector('.view-dropdown-item[data-index="3"]');
        if (item) item.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    const shot1b = path.join(outDir, 'test_suir_island_intact_land.png');
    await page.screenshot({ path: shot1b });
    console.log(`Saved screenshot 1b: ${shot1b}`);

    // =========================================================================
    // TEST 2: Time Machine - Benchmark Flood 2000 (Glitch 2 Fix)
    // =========================================================================
    console.log('\n--- TEST 2: Verifying Time Machine - Benchmark Flood 2000 ---');
    // Click Time Machine workspace tab (#tab-time)
    await page.evaluate(() => {
        const tab = document.getElementById('tab-time') || document.querySelector('[data-workspace="time"]');
        if (tab) tab.click();
    });
    await new Promise(r => setTimeout(r, 1000));

    // Click Benchmark Flood 2000 historical event button
    await page.evaluate(() => {
        const btn2000 = document.querySelector('[data-event="flood_2000"]');
        if (btn2000) btn2000.click();
    });
    await new Promise(r => setTimeout(r, 2500));

    // Switch to Overview camera view (data-index="0") to verify whole town
    await page.evaluate(() => {
        const item = document.querySelector('.view-dropdown-item[data-index="0"]');
        if (item) item.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    const shot2 = path.join(outDir, 'test_time_machine_benchmark_2000_fluvial_only.png');
    await page.screenshot({ path: shot2 });
    console.log(`Saved screenshot 2: ${shot2}`);

    // =========================================================================
    // TEST 3: Time Machine - Storm Frank 2015
    // =========================================================================
    console.log('\n--- TEST 3: Verifying Time Machine - Storm Frank 2015 ---');
    await page.evaluate(() => {
        const btnFrank = document.querySelector('[data-event="storm_frank_2015"]');
        if (btnFrank) btnFrank.click();
    });
    await new Promise(r => setTimeout(r, 2500));

    const shot3 = path.join(outDir, 'test_time_machine_storm_frank_2015.png');
    await page.screenshot({ path: shot3 });
    console.log(`Saved screenshot 3: ${shot3}`);

    // =========================================================================
    // TEST 4: Time Machine - River Suir Flood 2008
    // =========================================================================
    console.log('\n--- TEST 4: Verifying Time Machine - River Suir Flood 2008 ---');
    await page.evaluate(() => {
        const btn2008 = document.querySelector('[data-event="flood_2008"]');
        if (btn2008) btn2008.click();
    });
    await new Promise(r => setTimeout(r, 2500));

    const shot4 = path.join(outDir, 'test_time_machine_flood_2008.png');
    await page.screenshot({ path: shot4 });
    console.log(`Saved screenshot 4: ${shot4}`);

    // =========================================================================
    // TEST 5: Top-Down 2D Map View (data-index="7")
    // =========================================================================
    console.log('\n--- TEST 5: Top-Down 2D Map View ---');
    await page.evaluate(() => {
        const item = document.querySelector('.view-dropdown-item[data-index="7"]');
        if (item) item.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    const shot5 = path.join(outDir, 'test_top_down_fluvial_corridor.png');
    await page.screenshot({ path: shot5 });
    console.log(`Saved screenshot 5: ${shot5}`);

    console.log('\nVerification complete! Total browser console errors:', errors.length);
    if (errors.length > 0) {
        console.log('Errors caught:', errors);
    }

    await browser.close();
}

run().catch(err => {
    console.error('Verification script failed:', err);
    process.exit(1);
});
