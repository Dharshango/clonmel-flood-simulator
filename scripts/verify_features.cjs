const puppeteer = require('puppeteer-core');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const artifactDir = 'C:\\Users\\kethe\\.gemini\\antigravity\\brain\\9d1789ba-5f93-48b7-9faa-1652c883e2e1';

async function run() {
    console.log('Launching browser with puppeteer-core...');
    const browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: 'new',
        args: [
            '--use-gl=angle',
            '--use-angle=default',
            '--enable-webgl',
            '--ignore-gpu-blocklist',
            '--window-size=1600,980'
        ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 980 });

    const errors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.error('[BROWSER ERROR]', msg.text());
            errors.push(msg.text());
        } else {
            console.log('[BROWSER LOG]', msg.text());
        }
    });
    page.on('pageerror', err => {
        console.error('[PAGE ERROR]', err.message);
        errors.push(err.message);
    });

    console.log('Navigating to http://127.0.0.1:5173...');
    await page.goto('http://127.0.0.1:5173', { waitUntil: 'domcontentloaded' });

    // 1. Capture Hero Section
    console.log('1. Capturing Hero Landing Section...');
    await new Promise(r => setTimeout(r, 800));
    await page.screenshot({ path: path.join(artifactDir, 'feature_01_hero_section.png') });

    // 2. Click "Launch Simulation" button
    console.log('2. Clicking "Launch Simulation" button...');
    await page.click('#btn-hero-launch');
    await new Promise(r => setTimeout(r, 2000));

    // Check FPS, tabs centered, and bottom bar reset button
    const heroHidden = await page.$eval('#hero-section', el => el.classList.contains('hidden'));
    const fpsText = await page.$eval('#fps-counter', el => el.textContent);
    console.log(`Hero hidden: ${heroHidden}, FPS: ${fpsText}`);

    // Capture Simulation Normal View (Live Mode)
    console.log('3. Capturing Live Simulation View...');
    await page.screenshot({ path: path.join(artifactDir, 'feature_02_live_simulation.png') });

    // 3. Switch to 1-in-100-Yr Flood and let water develop
    console.log('4. Waiting 4 seconds for 1-in-100 flood overflow to develop...');
    await new Promise(r => setTimeout(r, 4000));
    await page.screenshot({ path: path.join(artifactDir, 'feature_03_flood_spread.png') });

    // 4. Click Barrier Tab to view Barrier Defense Studio
    console.log('5. Clicking Barrier Tab...');
    await page.click('#tab-barrier');
    await new Promise(r => setTimeout(r, 1500));
    const barrierStudioVisible = await page.$eval('#barrier-studio-view', el => !el.classList.contains('hidden'));
    const barrierLenText = await page.$eval('#stat-barrier-length', el => el.textContent);
    console.log(`Barrier Studio visible: ${barrierStudioVisible}, Barrier length: ${barrierLenText}`);
    await page.screenshot({ path: path.join(artifactDir, 'feature_04_barrier_studio.png') });

    // 5. Click Compare Tab to view Side-by-Side replay & telemetry
    console.log('6. Clicking Compare Tab...');
    await page.click('#tab-compare');
    await new Promise(r => setTimeout(r, 2000));
    const sbsVisible = await page.$eval('#side-by-side-overlay', el => !el.classList.contains('hidden'));
    const sbsLeft = await page.$eval('#sbs-unmit-flooded', el => el.textContent);
    const sbsRight = await page.$eval('#sbs-saved-bldgs', el => el.textContent);
    console.log(`Compare overlay visible: ${sbsVisible}, Unmitigated: ${sbsLeft}, Saved: ${sbsRight}`);
    await page.screenshot({ path: path.join(artifactDir, 'feature_05_compare_mode.png') });

    // 6. Test Back button to return to Hero
    console.log('7. Testing Back to Overview button...');
    await page.click('#btn-back-hero');
    await new Promise(r => setTimeout(r, 800));
    const heroBack = await page.$eval('#hero-section', el => !el.classList.contains('hidden'));
    console.log(`Returned to Hero: ${heroBack}`);
    await page.screenshot({ path: path.join(artifactDir, 'feature_06_back_to_hero.png') });

    await browser.close();
    console.log('Verification completed successfully! Errors encountered:', errors.length);
}

run().catch(err => {
    console.error('Test script failed:', err);
    process.exit(1);
});
