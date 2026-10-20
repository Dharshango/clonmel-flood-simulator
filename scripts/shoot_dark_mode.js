import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const FRAMES_DIR = 'cache/video_frames';
fs.mkdirSync('evidence', { recursive: true });
fs.mkdirSync(FRAMES_DIR, { recursive: true });

async function shoot() {
    console.log('--- SHOOTING UPDATED DARK MODE SIMULATOR ---');
    console.log('Config: Dark Theme, Gray Buildings, Black Ground, Enhanced River Flow & Water Animation');
    
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

    let frameIdx = 0;
    async function captureFrame() {
        const framePath = path.join(FRAMES_DIR, `frame_${String(frameIdx).padStart(5, '0')}.png`);
        await page.screenshot({ path: framePath });
        frameIdx++;
    }

    // Shot 1: Dark Mode Overview (Normal Flow, Gray Buildings, Black Ground)
    console.log('Shot 1: Dark Mode Overview (Gray Buildings on Black Ground)...');
    await page.click('button[data-scenario="normal"]');
    await new Promise(r => setTimeout(r, 2500));
    for (let i = 0; i < 25; i++) {
        await captureFrame();
        await new Promise(r => setTimeout(r, 50));
    }
    await page.screenshot({ path: 'evidence/dark_mode_overview.png' });
    console.log('Saved evidence/dark_mode_overview.png');

    // Shot 2: Close-up on Gray Buildings & Flowing River Suir
    console.log('Shot 2: Close-up on Gray Buildings & River Currents...');
    await page.mouse.move(960, 540);
    await page.mouse.down();
    await page.mouse.move(960, 680, { steps: 12 });
    await page.mouse.up();
    await new Promise(r => setTimeout(r, 2000));
    for (let i = 0; i < 20; i++) {
        await captureFrame();
        await new Promise(r => setTimeout(r, 50));
    }
    await page.screenshot({ path: 'evidence/dark_mode_closeup_buildings.png' });
    console.log('Saved evidence/dark_mode_closeup_buildings.png');

    // Reset camera position for scenario run
    await page.mouse.move(960, 680);
    await page.mouse.down();
    await page.mouse.move(960, 540, { steps: 12 });
    await page.mouse.up();

    // Shot 3: Peak Flood with Water Flowing through Gray Buildings
    console.log('Shot 3: 1-in-100-Year Flood Flowing through Streets & Gray Buildings...');
    await page.click('#btn-clear-barriers');
    await page.click('button[data-scenario="flood100"]');
    await page.click('button[data-speed="50"]');
    for (let i = 0; i < 45; i++) {
        await captureFrame();
        await new Promise(r => setTimeout(r, 60));
    }
    await page.screenshot({ path: 'evidence/dark_mode_peak_flood.png' });
    console.log('Saved evidence/dark_mode_peak_flood.png');

    // Shot 4: Quay Barrier Placed & Side-by-Side Replay
    console.log('Shot 4: Side-by-Side Replay with Glowing Green Saved Buildings...');
    await page.click('#btn-preset-clonmel');
    await new Promise(r => setTimeout(r, 1500));
    await page.click('#btn-side-by-side');
    for (let i = 0; i < 40; i++) {
        await captureFrame();
        await new Promise(r => setTimeout(r, 60));
    }
    await page.screenshot({ path: 'evidence/dark_mode_side_by_side.png' });
    console.log('Saved evidence/dark_mode_side_by_side.png');

    // Shot 5: Depth Inspector on Quay Street
    console.log('Shot 5: Click-for-Depth Inspector Pin & Readouts...');
    await page.mouse.click(820, 500);
    for (let i = 0; i < 20; i++) {
        await captureFrame();
        await new Promise(r => setTimeout(r, 50));
    }
    await page.screenshot({ path: 'evidence/dark_mode_depth_inspector.png' });
    console.log('Saved evidence/dark_mode_depth_inspector.png');

    // Shot 6: Export Peak Depth Map
    console.log('Shot 6: Exported Peak Depth Map in Dark Mode...');
    await page.click('#btn-export-map');
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: 'evidence/dark_mode_peak_depth_map.png' });
    console.log('Saved evidence/dark_mode_peak_depth_map.png');

    const fps = await page.$eval('#fps-counter', el => el.textContent);
    console.log(`Live Performance: ${fps}`);

    console.log(`Captured ${frameIdx} frames. Compiling with FFmpeg...`);
    await browser.close();

    const ffmpegCmd = `ffmpeg -y -framerate 25 -i "${FRAMES_DIR}/frame_%05d.png" -c:v libx264 -pix_fmt yuv420p -crf 18 -preset fast evidence/demo.mp4`;
    execSync(ffmpegCmd, { stdio: 'inherit' });
    console.log('Updated evidence/demo.mp4 compiled successfully!');

    fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
    console.log('--- ALL SHOOTS AND VIDEO COMPLETED SUCCESSFULLY ---');
}

shoot().catch(err => {
    console.error('Shoot failed:', err);
    process.exit(1);
});
