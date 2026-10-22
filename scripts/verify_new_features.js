import puppeteer from 'puppeteer-core';

async function verifyFeatures() {
    console.log('Launching browser for comprehensive feature verification...');
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

    console.log('1. Navigating to http://127.0.0.1:5173/ ...');
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));

    // Click Launch 3D Simulation
    console.log('2. Launching 3D Simulation...');
    await page.click('#run-scenario');
    await new Promise(r => setTimeout(r, 3000));

    // Test Camera Views Dropdown Menu
    console.log('3. Testing Camera Views Dropdown...');
    await page.click('#btn-camera-menu');
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: 'evidence/camera_dropdown_open.png' });
    console.log('Saved evidence/camera_dropdown_open.png');

    // Select View 2: The Quay
    console.log('4. Selecting View 2: The Quay & Riverfront...');
    await page.click('.view-dropdown-item[data-index="1"]');
    await new Promise(r => setTimeout(r, 1600));
    await page.screenshot({ path: 'evidence/view_02_the_quay.png' });
    console.log('Saved evidence/view_02_the_quay.png');

    // Select View 3: Old Bridge & Weir
    console.log('5. Selecting View 3: Old Bridge & Weir...');
    await page.click('#btn-camera-menu');
    await new Promise(r => setTimeout(r, 400));
    await page.click('.view-dropdown-item[data-index="2"]');
    await new Promise(r => setTimeout(r, 1600));
    await page.screenshot({ path: 'evidence/view_03_old_bridge.png' });
    console.log('Saved evidence/view_03_old_bridge.png');

    // Select View 4: Suir Island
    console.log('6. Selecting View 4: Suir Island...');
    await page.click('#btn-camera-menu');
    await new Promise(r => setTimeout(r, 400));
    await page.click('.view-dropdown-item[data-index="3"]');
    await new Promise(r => setTimeout(r, 1600));
    await page.screenshot({ path: 'evidence/view_04_suir_island.png' });
    console.log('Saved evidence/view_04_suir_island.png');

    // Select View 8: Tactical Top-Down (2D Map)
    console.log('7. Selecting View 8: Tactical Top-Down (2D)...');
    await page.click('#btn-camera-menu');
    await new Promise(r => setTimeout(r, 400));
    await page.click('.view-dropdown-item[data-index="7"]');
    await new Promise(r => setTimeout(r, 1600));
    await page.screenshot({ path: 'evidence/view_08_top_down_map.png' });
    console.log('Saved evidence/view_08_top_down_map.png');

    // Return to Overview
    await page.click('#btn-home-view');
    await new Promise(r => setTimeout(r, 1400));

    // Test Time Scrubbing: Scrub to 03:00 (10800 seconds)
    console.log('8. Testing Time Scrubbing to 03:00 (10800s)...');
    await page.evaluate(() => {
        const scrubber = document.getElementById('timeline-scrubber');
        scrubber.value = 10800;
        scrubber.dispatchEvent(new Event('input', { bubbles: true }));
        scrubber.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await new Promise(r => setTimeout(r, 1200));

    const statsAt3h = await page.evaluate(() => {
        return {
            clock: document.getElementById('flood-clock-text').textContent,
            floodedBldgs: document.getElementById('stat-flooded-bldgs').textContent,
            endangeredBldgs: document.getElementById('stat-endangered-bldgs') ? document.getElementById('stat-endangered-bldgs').textContent : 'N/A',
            partialBldgs: document.getElementById('stat-partial-bldgs') ? document.getElementById('stat-partial-bldgs').textContent : 'N/A',
            roadsCutoff: document.getElementById('stat-roads-cutoff').textContent,
            peakDepth: document.getElementById('stat-peak-depth').textContent,
            depthVal: document.getElementById('readout-depth-val').textContent
        };
    });
    console.log('Metrics at 03:00 (10,800s):', statsAt3h);
    await page.screenshot({ path: 'evidence/scrub_to_03h00_flooded.png' });
    console.log('Saved evidence/scrub_to_03h00_flooded.png');

    // Test Scrubbing BACKWARDS to 00:30 (1800s)
    console.log('9. Testing Time Scrubbing BACKWARDS to 00:30 (1800s)...');
    await page.evaluate(() => {
        const scrubber = document.getElementById('timeline-scrubber');
        scrubber.value = 1800;
        scrubber.dispatchEvent(new Event('input', { bubbles: true }));
        scrubber.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await new Promise(r => setTimeout(r, 1200));

    const statsAt30m = await page.evaluate(() => {
        return {
            clock: document.getElementById('flood-clock-text').textContent,
            floodedBldgs: document.getElementById('stat-flooded-bldgs').textContent,
            roadsCutoff: document.getElementById('stat-roads-cutoff').textContent,
            peakDepth: document.getElementById('stat-peak-depth').textContent
        };
    });
    console.log('Metrics at 00:30 (1,800s after rewind):', statsAt30m);
    await page.screenshot({ path: 'evidence/scrub_rewind_to_00h30.png' });
    console.log('Saved evidence/scrub_rewind_to_00h30.png');

    // Test Responsive Layout at 768px (Tablet)
    console.log('10. Testing Responsive Layout at 768px...');
    await page.setViewport({ width: 768, height: 1024 });
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: 'evidence/responsive_tablet_768px.png' });
    console.log('Saved evidence/responsive_tablet_768px.png');

    console.log('All verification steps completed successfully!');
    await browser.close();
}

verifyFeatures().catch(err => {
    console.error('Verification failed:', err);
    process.exit(1);
});
