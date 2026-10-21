import puppeteer from 'puppeteer-core';

async function testFullUI() {
    console.log('Testing Free Board Full UI and Simulation Dynamics...');
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

    const errors = [];
    page.on('pageerror', err => {
        console.error('PAGE ERROR:', err.message);
        errors.push(err.message);
    });

    console.log('1. Loading application...');
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));

    // Dismiss hero
    await page.click('#btn-hero-launch');
    console.log('   Hero dismissed, simulation active.');

    // 2. Test Play / Pause
    console.log('2. Testing Play / Pause toggle...');
    await page.click('#btn-play-pause'); // Pause
    await new Promise(r => setTimeout(r, 1000));
    const clockPaused = await page.$eval('#flood-clock-text', el => el.textContent);
    await new Promise(r => setTimeout(r, 1000));
    const clockPaused2 = await page.$eval('#flood-clock-text', el => el.textContent);
    console.log(`   Paused: clock at ${clockPaused} == ${clockPaused2} (frozen: ${clockPaused === clockPaused2})`);

    await page.click('#btn-play-pause'); // Resume
    console.log('   Resumed playback.');

    // 3. Test Embedded Reset
    console.log('3. Testing Embedded Reset button...');
    await page.click('#btn-bar-reset');
    await new Promise(r => setTimeout(r, 1000));
    const clockReset = await page.$eval('#flood-clock-text', el => el.textContent);
    console.log(`   Clock after reset: ${clockReset}`);

    // 4. Test Speed switching: 60x
    console.log('4. Testing 60x speed...');
    await page.click('button[data-speed="60"]');
    await new Promise(r => setTimeout(r, 2000));
    const clock60 = await page.$eval('#flood-clock-text', el => el.textContent);
    console.log(`   Clock after 2s at 60x: ${clock60}`);

    // 5. Test Speed switching: 300x
    console.log('5. Testing 300x speed...');
    await page.click('button[data-speed="300"]');
    await new Promise(r => setTimeout(r, 2000));
    const clock300 = await page.$eval('#flood-clock-text', el => el.textContent);
    console.log(`   Clock after 2s at 300x: ${clock300}`);

    // 6. Test Compare Mode
    console.log('6. Testing Compare Mode (Side-by-Side Dual Telemetry)...');
    await page.click('#tab-compare');
    await new Promise(r => setTimeout(r, 2000));
    const sbsVisible = await page.$eval('#side-by-side-overlay', el => !el.classList.contains('hidden'));
    const savedCount = await page.$eval('#sbs-saved-bldgs', el => el.textContent);
    console.log(`   Compare overlay visible: ${sbsVisible}, Saved structures: ${savedCount}`);

    // Return to Live mode
    await page.click('#tab-live');
    await new Promise(r => setTimeout(r, 1000));

    // 7. Test Depth Inspector probe click
    console.log('7. Testing 3D Depth Inspector probe click...');
    const canvas = await page.$('#three-canvas');
    const box = await canvas.boundingBox();
    // Click in the middle of canvas
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await new Promise(r => setTimeout(r, 1000));
    const inspectorVisible = await page.$eval('#inspector-card', el => el.style.display !== 'none');
    const streetName = await page.$eval('#inspect-street-name', el => el.textContent);
    const depthVal = await page.$eval('#inspect-depth', el => el.textContent);
    console.log(`   Inspector card visible: ${inspectorVisible}, Street: ${streetName}, Depth: ${depthVal}`);

    console.log(`\nAll UI & simulation tests completed with ${errors.length} errors.`);
    await page.screenshot({ path: 'evidence/final_ui_verification.png' });
    console.log('Saved evidence/final_ui_verification.png');

    await browser.close();
    if (errors.length > 0) {
        throw new Error('Test encountered browser errors');
    }
}

testFullUI().catch(err => {
    console.error('Full UI test failed:', err);
    process.exit(1);
});
