import puppeteer from 'puppeteer-core';
import path from 'path';

const outDir = 'C:/Users/dhars/.gemini/antigravity/brain/8ef847a2-effc-401b-bc47-8f1726c507c8';

async function verifyHeroCleaned() {
    console.log('=== VERIFYING CLEANED HERO SECTION ===');
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
            '--window-size=1440,900'
        ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    const errors = [];
    page.on('pageerror', err => {
        console.error('Page Error:', err.message);
        errors.push(err.message);
    });

    console.log('1. Navigating to http://127.0.0.1:5173/ ...');
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 1500));

    // Check DOM for removed elements
    const elementsCheck = await page.evaluate(() => {
        return {
            topbarLaunchBtn: !!document.getElementById('btn-hero-launch'),
            modelOnlineBadge: !!document.querySelector('.live-state'),
            surfaceElevationCard: !!document.querySelector('.simulation-readout'),
            waterLevelElem: !!document.getElementById('water-level'),
            interactionHint: !!document.querySelector('.interaction-hint'),
            mapLabels: document.querySelectorAll('.map-label').length,
            heroFooter: !!document.querySelector('.hero-footer'),
            coordinates: !!document.getElementById('coordinates'),
            mainLaunchBtn: !!document.getElementById('run-scenario'),
            howLink: !!document.getElementById('how-link'),
            brand: !!document.querySelector('.hero .brand')
        };
    });

    console.log('DOM Element Audit:', JSON.stringify(elementsCheck, null, 2));

    // Verify all unwanted elements are completely absent
    const unwantedFound = [];
    if (elementsCheck.topbarLaunchBtn) unwantedFound.push('topbarLaunchBtn');
    if (elementsCheck.modelOnlineBadge) unwantedFound.push('modelOnlineBadge');
    if (elementsCheck.surfaceElevationCard) unwantedFound.push('surfaceElevationCard');
    if (elementsCheck.waterLevelElem) unwantedFound.push('waterLevelElem');
    if (elementsCheck.interactionHint) unwantedFound.push('interactionHint');
    if (elementsCheck.mapLabels > 0) unwantedFound.push('mapLabels');
    if (elementsCheck.heroFooter) unwantedFound.push('heroFooter');
    if (elementsCheck.coordinates) unwantedFound.push('coordinates');

    if (unwantedFound.length > 0) {
        console.error('FAILED: Found elements that should have been removed:', unwantedFound);
        process.exit(1);
    }
    console.log('SUCCESS: All specified elements have been completely removed!');

    // Test mouse motion on interactive canvas
    console.log('2. Testing mouse motion on hero background...');
    await page.mouse.move(800, 450);
    await new Promise(r => setTimeout(r, 200));
    await page.mouse.move(1100, 350);
    await new Promise(r => setTimeout(r, 200));
    await page.mouse.click(950, 450); // click wave
    await new Promise(r => setTimeout(r, 300));

    // Take screenshot of clean hero
    const heroShot = path.join(outDir, 'hero_cleaned_minimal.png');
    await page.screenshot({ path: heroShot });
    console.log('Clean Hero screenshot saved to:', heroShot);

    // Test clicking the main "Launch 3D Simulation" button
    console.log('3. Clicking main Launch 3D Simulation button (#run-scenario)...');
    await page.click('#run-scenario');
    await new Promise(r => setTimeout(r, 1500));

    const transitionState = await page.evaluate(() => {
        const hero = document.getElementById('hero-section');
        const studioHeader = document.getElementById('top-nav');
        return {
            heroHidden: hero ? hero.classList.contains('hidden') : false,
            heroDisplay: hero ? window.getComputedStyle(hero).display : null,
            studioHeaderVisible: studioHeader ? window.getComputedStyle(studioHeader).display !== 'none' : false
        };
    });
    console.log('Studio Transition State:', JSON.stringify(transitionState, null, 2));

    const studioShot = path.join(outDir, 'studio_after_hero_clean.png');
    await page.screenshot({ path: studioShot });
    console.log('Studio screenshot saved to:', studioShot);

    await browser.close();

    if (!transitionState.heroHidden) {
        console.error('Launch 3D Simulation button failed to transition!');
        process.exit(1);
    }

    console.log('=== CLEAN HERO VERIFICATION COMPLETED SUCCESSFULLY ===');
}

verifyHeroCleaned().catch(err => {
    console.error('VERIFICATION ERROR:', err);
    process.exit(1);
});
