import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const FRAMES_DIR = 'cache/video_frames';
fs.mkdirSync('evidence', { recursive: true });
fs.mkdirSync(FRAMES_DIR, { recursive: true });

async function shoot() {
    console.log('--- SHOOTING UPDATED SUIRVIEW CLONMEL SIMULATOR (V2) ---');
    console.log('Config: Smooth Royal Blue Water, Bottom Playback Bar, Camera Vantages, 3D Landmark Labels');
    
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

    // Shot 1: Normal Flow with Smooth Royal Blue Ribbon Water & Floating Labels
    console.log('Shot 1: Normal Flow Overview...');
    await page.click('.scenario-card[data-scenario="normal"]');
    await new Promise(r => setTimeout(r, 2500));
    for (let i = 0; i < 25; i++) {
        await captureFrame();
        await new Promise(r => setTimeout(r, 50));
    }
    await page.screenshot({ path: 'evidence/01_normal_flow.png' });
    console.log('Saved evidence/01_normal_flow.png');

    // Shot 2: Camera Vantage - Old Bridge & The Quay
    console.log('Shot 2: Camera Vantage - Old Bridge & The Quay...');
    await page.click('.btn-vantage[data-vantage="bridge"]');
    await new Promise(r => setTimeout(r, 2000));
    for (let i = 0; i < 20; i++) {
        await captureFrame();
        await new Promise(r => setTimeout(r, 50));
    }
    await page.screenshot({ path: 'evidence/vantage_old_bridge.png' });
    console.log('Saved evidence/vantage_old_bridge.png');

    // Shot 3: Camera Vantage - Sarsfield St Centre
    console.log('Shot 3: Camera Vantage - Sarsfield St Centre...');
    await page.click('.btn-vantage[data-vantage="centre"]');
    await new Promise(r => setTimeout(r, 2000));
    for (let i = 0; i < 20; i++) {
        await captureFrame();
        await new Promise(r => setTimeout(r, 50));
    }
    await page.screenshot({ path: 'evidence/vantage_sarsfield_centre.png' });
    console.log('Saved evidence/vantage_sarsfield_centre.png');

    // Return to Overview
    await page.click('.btn-vantage[data-vantage="overview"]');
    await new Promise(r => setTimeout(r, 1500));

    // Shot 4: 1-in-100-Year Flood breaching quays in fast-forward (without barrier)
    console.log('Shot 4: 1-in-100-Year Flood Flowing through Streets in Fast-Forward...');
    await page.click('#btn-clear-barriers');
    await page.click('.scenario-card[data-scenario="flood100"]');
    await page.click('.speed-btn[data-speed="50"]');
    for (let i = 0; i < 50; i++) {
        await captureFrame();
        await new Promise(r => setTimeout(r, 80));
    }
    await page.screenshot({ path: 'evidence/02_peak_flood_unprotected.png' });
    console.log('Saved evidence/02_peak_flood_unprotected.png');

    // Shot 5: Barrier Placed along Quays
    console.log('Shot 5: Barrier Placed along Quays...');
    await page.click('#card-barrier-wall');
    await new Promise(r => setTimeout(r, 1000));
    // Reset to preset barriers for official scheme
    await page.evaluate(() => {
        const btnReset = document.getElementById('btn-reset');
        if (btnReset) btnReset.click();
    });
    await new Promise(r => setTimeout(r, 1500));
    await page.click('.scenario-card[data-scenario="flood100"]');
    await page.click('.speed-btn[data-speed="50"]');
    for (let i = 0; i < 30; i++) {
        await captureFrame();
        await new Promise(r => setTimeout(r, 60));
    }
    await page.screenshot({ path: 'evidence/03_barrier_drawn.png' });
    console.log('Saved evidence/03_barrier_drawn.png');

    // Shot 6: Side-by-Side Replay with Glowing Green Saved Buildings
    console.log('Shot 6: Side-by-Side Replay...');
    await page.click('#btn-side-by-side');
    for (let i = 0; i < 35; i++) {
        await captureFrame();
        await new Promise(r => setTimeout(r, 60));
    }
    await page.screenshot({ path: 'evidence/04_side_by_side_replay.png' });
    console.log('Saved evidence/04_side_by_side_replay.png');

    // Shot 7: Click-for-Depth Gauge & Readouts
    console.log('Shot 7: Click-for-Depth Gauge...');
    await page.mouse.click(820, 520);
    for (let i = 0; i < 20; i++) {
        await captureFrame();
        await new Promise(r => setTimeout(r, 50));
    }
    await page.screenshot({ path: 'evidence/05_readouts_depth_inspector.png' });
    console.log('Saved evidence/05_readouts_depth_inspector.png');

    // Shot 8: Exported Peak Depth Map
    console.log('Shot 8: Export Depth Map...');
    await page.click('#btn-export-map');
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: 'evidence/06_peak_depth_map.png' });
    console.log('Saved evidence/06_peak_depth_map.png');

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
