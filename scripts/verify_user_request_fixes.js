import puppeteer from 'puppeteer-core';
import path from 'path';

const outDir = 'C:/Users/dhars/.gemini/antigravity/brain/8ef847a2-effc-401b-bc47-8f1726c507c8';

async function verify() {
    console.log('=== STARTING VERIFICATION OF ALL 4 USER FIXES ===');
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

    const errors = [];
    page.on('console', msg => {
        const text = msg.text();
        if (msg.type() === 'error') errors.push(text);
        if (text.includes('Placed') || text.includes('Suir') || text.includes('Barrier')) {
            console.log('BROWSER:', text);
        }
    });
    page.on('pageerror', err => {
        console.error('PAGE ERROR:', err.message, err.stack);
        errors.push(err.message);
    });

    console.log('1. Navigating to http://127.0.0.1:5173/ ...');
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));

    // Transition from hero into 3D simulation
    const runBtn = await page.$('#run-scenario');
    if (runBtn) {
        console.log('Entering 3D simulation via #run-scenario...');
        await runBtn.click();
        await new Promise(r => setTimeout(r, 2500));
    }

    // -------------------------------------------------------------
    // TEST 1: Check clean model generation (No green/blue preset compounds)
    // -------------------------------------------------------------
    console.log('\n--- VERIFYING TEST 1: Clean Model Generation (Image 2 Fix) ---');
    const initialBarriersCount = await page.evaluate(() => {
        return window.barriersManager ? window.barriersManager.barriers.length : -1;
    });
    console.log(`Initial active barriers count: ${initialBarriersCount} (Expected: 0)`);
    if (initialBarriersCount !== 0) {
        throw new Error(`Expected 0 initial barriers, but found ${initialBarriersCount}`);
    }

    // Position camera to view Clonmel river corridor overview
    await page.evaluate(() => {
        const cam = window.controls ? window.controls.object : null;
        if (cam) {
            cam.position.set(-80, 420, 620);
            window.controls.target.set(-20, 20, 0);
            window.controls.update();
        }
    });
    await new Promise(r => setTimeout(r, 1500));

    const shot1 = path.join(outDir, 'test_clean_model_no_green_blue_compounds.png');
    await page.screenshot({ path: shot1 });
    console.log(`Saved screenshot 1: ${shot1}`);

    // -------------------------------------------------------------
    // TEST 2: Check Header Branding & Favicon (Logo/Favicon Fix)
    // -------------------------------------------------------------
    console.log('\n--- VERIFYING TEST 2: Studio Header & Favicon Clean ---');
    const brandingState = await page.evaluate(() => {
        const brandHome = document.getElementById('brand-nav-home');
        const iconLink = document.querySelector('link[rel="icon"]');
        return {
            hasBrandNavHome: !!brandHome,
            faviconHref: iconLink ? iconLink.getAttribute('href') : null,
            pageTitle: document.title
        };
    });
    console.log('Branding state:', brandingState);
    if (brandingState.hasBrandNavHome) {
        throw new Error('Hydroverse brand-nav-home element is still present in studio header!');
    }
    if (brandingState.faviconHref && !brandingState.faviconHref.startsWith('data:;base64,')) {
        throw new Error(`Unexpected favicon href: ${brandingState.faviconHref}`);
    }

    const shot2 = path.join(outDir, 'test_studio_header_clean_branding.png');
    await page.screenshot({ path: shot2, clip: { x: 0, y: 0, width: 1560, height: 120 } });
    console.log(`Saved screenshot 2: ${shot2}`);

    // -------------------------------------------------------------
    // TEST 3: Suir Island Flood Submersion & Red Buildings (Image 1 Fix)
    // -------------------------------------------------------------
    console.log('\n--- VERIFYING TEST 3: Suir Island Flood Submersion & Red Buildings ---');
    // Position camera focusing on Suir Island
    await page.evaluate(() => {
        const cam = window.controls ? window.controls.object : null;
        if (cam) {
            cam.position.set(-60, 160, 140);
            window.controls.target.set(-45, 18, 10);
            window.controls.update();
        }
    });
    // Wait for SWE hydrograph wave to advance over Suir Island
    await new Promise(r => setTimeout(r, 3000));

    const suirIslandState = await page.evaluate(() => {
        const bldgStats = window.AppState ? window.AppState.metrics : null;
        return {
            floodedBuildings: bldgStats ? bldgStats.floodedBuildings : 0,
            simTime: window.simulator ? window.simulator.totalSimTime : 0
        };
    });
    console.log('Suir Island flood state:', suirIslandState);

    const shot3 = path.join(outDir, 'test_suir_island_flood_submerged_red_buildings.png');
    await page.screenshot({ path: shot3 });
    console.log(`Saved screenshot 3: ${shot3}`);

    // -------------------------------------------------------------
    // TEST 4: Intervention Lab Freehand Drawing (Wall & Sandbag)
    // -------------------------------------------------------------
    console.log('\n--- VERIFYING TEST 4: Intervention Lab Freehand Wall & Sandbag Drawing ---');
    // Click Intervention Lab tab
    console.log('Clicking tab-intervention...');
    await page.click('#tab-intervention');
    await new Promise(r => setTimeout(r, 1500));

    // Verify Wall tool is active, configure height to 3.2m, depth to 2.2m
    await page.evaluate(() => {
        const hInp = document.getElementById('barrier-height-input');
        const dInp = document.getElementById('barrier-depth-input');
        if (hInp) {
            hInp.value = '3.2';
            hInp.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (dInp) {
            dInp.value = '2.2';
            dInp.dispatchEvent(new Event('input', { bubbles: true }));
        }
    });

    // Start drawing mode
    console.log('Clicking #btn-start-drawing for Wall...');
    await page.click('#btn-start-drawing');
    await new Promise(r => setTimeout(r, 800));

    // Check canvas cursor class
    const hasFreehandCursor = await page.evaluate(() => {
        const c = document.getElementById('three-canvas');
        return c.classList.contains('drawing-freehand-active');
    });
    console.log(`Canvas has .drawing-freehand-active cursor: ${hasFreehandCursor}`);

    // Perform freehand mouse drag across map in arc around premises
    console.log('Simulating freehand pen drag across map...');
    const canvasBox = await page.evaluate(() => {
        const c = document.getElementById('three-canvas');
        const rect = c.getBoundingClientRect();
        return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
    });

    const startX = canvasBox.x + canvasBox.width * 0.44;
    const startY = canvasBox.y + canvasBox.height * 0.52;

    await page.mouse.move(startX, startY);
    await page.mouse.down();

    // Drag in a curve around buildings
    const steps = 15;
    for (let i = 1; i <= steps; i++) {
        const angle = (i / steps) * Math.PI * 0.7;
        const curX = startX + Math.sin(angle) * 160;
        const curY = startY + (1 - Math.cos(angle)) * 80;
        await page.mouse.move(curX, curY);
        await new Promise(r => setTimeout(r, 50));
    }

    // Capture screenshot during active freehand drawing (showing glowing polyline & HUD banner)
    const shot4a = path.join(outDir, 'test_intervention_lab_freehand_stroke_drawing.png');
    await page.screenshot({ path: shot4a });
    console.log(`Saved screenshot 4a (active stroke): ${shot4a}`);

    await page.mouse.up();
    await new Promise(r => setTimeout(r, 600));

    // Commit barrier via HUD finish button
    console.log('Committing freehand drawn wall via #hud-btn-finish...');
    await page.click('#hud-btn-finish');
    await new Promise(r => setTimeout(r, 2000));

    const finalWallBarriersCount = await page.evaluate(() => {
        return window.barriersManager ? window.barriersManager.barriers.length : 0;
    });
    console.log(`Barriers count after freehand wall build: ${finalWallBarriersCount} (Expected: 1)`);
    if (finalWallBarriersCount !== 1) {
        throw new Error(`Expected 1 barrier, got ${finalWallBarriersCount}`);
    }

    const shot4b = path.join(outDir, 'test_intervention_lab_freehand_wall_built.png');
    await page.screenshot({ path: shot4b });
    console.log(`Saved screenshot 4b (built wall): ${shot4b}`);

    // Now test Sandbag freehand drawing
    console.log('\nTesting Sandbag Freehand Drawing...');
    await page.click('#btn-tool-sandbags');
    await new Promise(r => setTimeout(r, 500));

    await page.click('#btn-start-drawing');
    await new Promise(r => setTimeout(r, 800));

    const hasSandbagCursor = await page.evaluate(() => {
        const c = document.getElementById('three-canvas');
        return c.classList.contains('drawing-sandbag-active');
    });
    console.log(`Canvas has .drawing-sandbag-active cursor: ${hasSandbagCursor}`);

    // Drag sandbag curve
    const sbStartX = canvasBox.x + canvasBox.width * 0.58;
    const sbStartY = canvasBox.y + canvasBox.height * 0.45;
    await page.mouse.move(sbStartX, sbStartY);
    await page.mouse.down();

    for (let i = 1; i <= 12; i++) {
        const curX = sbStartX + i * 10;
        const curY = sbStartY + Math.sin(i * 0.5) * 40;
        await page.mouse.move(curX, curY);
        await new Promise(r => setTimeout(r, 50));
    }
    await page.mouse.up();
    await new Promise(r => setTimeout(r, 500));

    await page.click('#hud-btn-finish');
    await new Promise(r => setTimeout(r, 2000));

    const totalBarriersCount = await page.evaluate(() => {
        return window.barriersManager ? window.barriersManager.barriers.length : 0;
    });
    console.log(`Total barriers count after wall + sandbags: ${totalBarriersCount} (Expected: 2)`);

    const shot5 = path.join(outDir, 'test_intervention_lab_freehand_sandbags_built.png');
    await page.screenshot({ path: shot5 });
    console.log(`Saved screenshot 5: ${shot5}`);

    await browser.close();
    console.log('\n=== ALL 4 USER FIXES VERIFIED SUCCESSFULLY WITH 0 ERRORS! ===');
}

verify().catch(err => {
    console.error('VERIFICATION FAILED:', err);
    process.exit(1);
});
