import puppeteer from 'puppeteer-core';
import path from 'path';

const outDir = 'C:/Users/dhars/.gemini/antigravity/brain/8ef847a2-effc-401b-bc47-8f1726c507c8';

async function verify() {
    console.log('=== STARTING HERO INTERACTIVE BACKGROUND & LAUNCH BUTTON VERIFICATION ===');
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
        console.error('PAGE ERROR:', err.message);
        errors.push(err.message);
    });

    console.log('1. Navigating to http://127.0.0.1:5173/ ...');
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));

    // 2. Check hero elements & initial state
    const heroStatus = await page.evaluate(() => {
        const hero = document.getElementById('hero-section');
        const canvas = document.getElementById('terrain');
        const level = document.getElementById('water-level');
        const extent = document.getElementById('flood-extent');
        const coords = document.getElementById('coordinates');
        const launchBtn = document.getElementById('run-scenario');
        const topbarLaunchBtn = document.getElementById('btn-hero-launch');
        const brand = document.querySelector('.hero .brand');

        return {
            heroVisible: !!hero && window.getComputedStyle(hero).display !== 'none' && !hero.classList.contains('hidden'),
            canvasVisible: !!canvas && window.getComputedStyle(canvas).display !== 'none',
            canvasDimensions: canvas ? { width: canvas.width, height: canvas.height } : null,
            levelText: level ? level.textContent : null,
            extentText: extent ? extent.textContent : null,
            coordsText: coords ? coords.textContent : null,
            launchBtnExists: !!launchBtn,
            launchBtnText: launchBtn ? launchBtn.innerText.trim() : null,
            topbarLaunchBtnExists: !!topbarLaunchBtn,
            brandVisible: !!brand && window.getComputedStyle(brand).display !== 'none'
        };
    });
    console.log('2. Initial Hero Status:', JSON.stringify(heroStatus, null, 2));

    // 3. Move mouse to trigger interactive ripple and waterline adjustments
    console.log('3. Simulating mouse interactions across the hero canvas...');
    await page.mouse.move(800, 350);
    await new Promise(r => setTimeout(r, 200));
    await page.mouse.move(1100, 500);
    await new Promise(r => setTimeout(r, 200));
    await page.mouse.click(1050, 420); // click to produce caustic ripple wave
    await new Promise(r => setTimeout(r, 300));
    await page.mouse.move(950, 300);
    await new Promise(r => setTimeout(r, 300));

    // Check updated telemetry after mouse movement
    const telemetryAfterMove = await page.evaluate(() => {
        return {
            level: document.getElementById('water-level')?.textContent,
            extent: document.getElementById('flood-extent')?.textContent,
            coords: document.getElementById('coordinates')?.textContent
        };
    });
    console.log('Telemetry after mouse movement:', JSON.stringify(telemetryAfterMove));

    // Take screenshot of interactive hero section
    const heroShot = path.join(outDir, 'hero_interactive_working.png');
    await page.screenshot({ path: heroShot });
    console.log('Hero screenshot saved to:', heroShot);

    // 4. Test clicking "Launch 3D Simulation" button
    console.log('4. Clicking "Launch 3D Simulation" button (#run-scenario)...');
    await page.click('#run-scenario');
    await new Promise(r => setTimeout(r, 1500));

    const afterLaunchStatus = await page.evaluate(() => {
        const hero = document.getElementById('hero-section');
        const studioHeader = document.getElementById('top-nav');
        const threeCanvas = document.getElementById('three-canvas');

        return {
            heroHidden: hero ? hero.classList.contains('hidden') : false,
            heroDisplay: hero ? window.getComputedStyle(hero).display : null,
            studioHeaderVisible: studioHeader ? window.getComputedStyle(studioHeader).display !== 'none' : false,
            threeCanvasVisible: threeCanvas ? window.getComputedStyle(threeCanvas).display !== 'none' : false
        };
    });
    console.log('5. Studio Status after Launch:', JSON.stringify(afterLaunchStatus, null, 2));

    const studioShot = path.join(outDir, 'studio_active_working.png');
    await page.screenshot({ path: studioShot });
    console.log('Studio screenshot saved to:', studioShot);

    // 5. Test clicking "Overview" (#btn-back-hero) to return to Hero
    console.log('6. Clicking "Overview" to test return to Hero...');
    await page.click('#btn-back-hero');
    await new Promise(r => setTimeout(r, 1000));

    const returnHeroStatus = await page.evaluate(() => {
        const hero = document.getElementById('hero-section');
        return {
            heroVisibleAgain: hero ? !hero.classList.contains('hidden') && window.getComputedStyle(hero).display !== 'none' : false
        };
    });
    console.log('7. Hero Status after Overview click:', JSON.stringify(returnHeroStatus));

    // 6. Test clicking topbar launch button (#btn-hero-launch)
    console.log('8. Clicking topbar "Launch 3D Simulation" (#btn-hero-launch)...');
    await page.click('#btn-hero-launch');
    await new Promise(r => setTimeout(r, 1000));

    const finalStatus = await page.evaluate(() => {
        const hero = document.getElementById('hero-section');
        return {
            heroHiddenAgain: hero ? hero.classList.contains('hidden') : false
        };
    });
    console.log('9. Final Status after topbar launch:', JSON.stringify(finalStatus));

    await browser.close();

    console.log('=== VERIFICATION SUMMARY ===');
    console.log('Total Page Errors:', errors.length);
    if (errors.length > 0) {
        console.error('Errors found:', errors);
        process.exit(1);
    }
    if (!afterLaunchStatus.heroHidden || !finalStatus.heroHiddenAgain) {
        console.error('Launch 3D Simulation button did not hide hero section properly!');
        process.exit(1);
    }
    console.log('ALL VERIFICATION CHECKS PASSED PERFECTLY!');
}

verify().catch(err => {
    console.error('VERIFICATION SCRIPT ERROR:', err);
    process.exit(1);
});
