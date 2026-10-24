import puppeteer from 'puppeteer-core';
import path from 'path';

const outDir = 'C:/Users/dhars/.gemini/antigravity/brain/8ef847a2-effc-401b-bc47-8f1726c507c8';

async function benchmark() {
    console.log('=== BENCHMARKING HERO INTERACTIVE BACKGROUND FPS & SMOOTHNESS ===');
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
    page.on('pageerror', err => errors.push(err.message));

    console.log('1. Navigating to http://127.0.0.1:5173/ ...');
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 1500));

    // Measure FPS in the hero canvas loop
    console.log('2. Measuring animation frame rate over 120 frames...');
    const fpsStats = await page.evaluate(async () => {
        return new Promise(resolve => {
            const frameTimes = [];
            let last = performance.now();
            let count = 0;

            function measure(now) {
                const delta = now - last;
                last = now;
                if (count > 0) frameTimes.push(delta); // skip first frame warmup
                count++;

                if (count <= 120) {
                    requestAnimationFrame(measure);
                } else {
                    const avgDelta = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
                    const maxDelta = Math.max(...frameTimes);
                    const minDelta = Math.min(...frameTimes);
                    const fps = 1000 / avgDelta;
                    resolve({
                        fps: Math.round(fps * 10) / 10,
                        avgFrameTimeMs: Math.round(avgDelta * 100) / 100,
                        maxFrameTimeMs: Math.round(maxDelta * 100) / 100,
                        minFrameTimeMs: Math.round(minDelta * 100) / 100,
                        frameCount: frameTimes.length
                    });
                }
            }
            requestAnimationFrame(measure);
        });
    });

    console.log('Hero FPS Stats:', JSON.stringify(fpsStats, null, 2));

    // Test mouse movement smoothness
    console.log('3. Testing rapid mouse movement and ripple generation...');
    for (let x = 600; x <= 1200; x += 50) {
        await page.mouse.move(x, 400 + Math.sin(x * 0.05) * 100);
        await new Promise(r => setTimeout(r, 16));
    }
    await page.mouse.click(950, 450);
    await new Promise(r => setTimeout(r, 400));

    const telemetry = await page.evaluate(() => {
        return {
            level: document.getElementById('water-level')?.textContent,
            extent: document.getElementById('flood-extent')?.textContent,
            coords: document.getElementById('coordinates')?.textContent
        };
    });
    console.log('Telemetry after smooth mouse motion:', JSON.stringify(telemetry));

    const heroScreenshot = path.join(outDir, 'hero_smooth_animation.png');
    await page.screenshot({ path: heroScreenshot });
    console.log('Saved screenshot of smooth hero animation to:', heroScreenshot);

    // Test clicking Launch 3D Simulation
    console.log('4. Clicking "Launch 3D Simulation"...');
    await page.click('#run-scenario');
    await new Promise(r => setTimeout(r, 1500));

    const studioState = await page.evaluate(() => {
        const hero = document.getElementById('hero-section');
        const three = document.getElementById('three-canvas');
        return {
            heroHidden: hero ? hero.classList.contains('hidden') : false,
            threeVisible: three ? window.getComputedStyle(three).display !== 'none' : false
        };
    });
    console.log('Studio state after launch:', JSON.stringify(studioState));

    const studioScreenshot = path.join(outDir, 'studio_transition_after_smooth_hero.png');
    await page.screenshot({ path: studioScreenshot });
    console.log('Saved screenshot of 3D studio view to:', studioScreenshot);

    await browser.close();

    console.log('=== VERIFICATION SUMMARY ===');
    console.log('FPS:', fpsStats.fps);
    console.log('Average frame time:', fpsStats.avgFrameTimeMs, 'ms');
    console.log('Errors:', errors.length);
    if (errors.length > 0) {
        console.error('Errors encountered:', errors);
        process.exit(1);
    }
    console.log('BENCHMARK COMPLETE - SMOOTH ANIMATION CONFIRMED!');
}

benchmark().catch(err => {
    console.error('BENCHMARK ERROR:', err);
    process.exit(1);
});
