import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const FRAMES_DIR = 'cache/video_frames';
fs.mkdirSync('evidence', { recursive: true });
fs.mkdirSync(FRAMES_DIR, { recursive: true });

async function run() {
    console.log('--- TESTING NEW FREE BOARD SIMPLE UI & WATER FLOOD ANIMATION ---');
    
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

    // Shot 1: Normal Flow Overview in Clean Simple UI
    console.log('Shot 1: Normal Flow Overview...');
    await page.click('.scenario-btn[data-scenario="normal"]');
    await new Promise(r => setTimeout(r, 2000));
    for (let i = 0; i < 20; i++) {
        await captureFrame();
        await new Promise(r => setTimeout(r, 50));
    }
    await page.screenshot({ path: 'evidence/freeboard_01_normal_flow.png' });
    console.log('Saved evidence/freeboard_01_normal_flow.png');

    // Shot 2: Old Bridge Camera Vantage
    console.log('Shot 2: Camera Vantage (Old Bridge & The Quay)...');
    await page.click('#btn-cycle-camera');
    await new Promise(r => setTimeout(r, 2000));
    for (let i = 0; i < 20; i++) {
        await captureFrame();
        await new Promise(r => setTimeout(r, 50));
    }
    await page.screenshot({ path: 'evidence/freeboard_02_bridge_vantage.png' });
    console.log('Saved evidence/freeboard_02_bridge_vantage.png');

    // Return to Overview
    await page.click('#btn-cycle-camera');
    await new Promise(r => setTimeout(r, 500));
    await page.click('#btn-cycle-camera');
    await new Promise(r => setTimeout(r, 500));
    await page.click('#btn-cycle-camera');
    await new Promise(r => setTimeout(r, 1500));

    // Shot 3: 1-in-100-Year Flood with Water Spilling Out of River into Streets
    console.log('Shot 3: 1-in-100-Year Flood Spilling Over Quays into Streets...');
    await page.click('#btn-clear-barriers');
    await page.click('.scenario-btn[data-scenario="flood100"]');
    await page.click('.speed-btn[data-speed="900"]');
    for (let i = 0; i < 40; i++) {
        await captureFrame();
        await new Promise(r => setTimeout(r, 80));
    }
    await page.screenshot({ path: 'evidence/freeboard_03_flood_spill.png' });
    console.log('Saved evidence/freeboard_03_flood_spill.png');

    // Shot 4: Barrier Mode (Deploy Quay Wall)
    console.log('Shot 4: Barrier Mode (Demountable Wall Defending Quay)...');
    await page.click('#tab-barrier');
    await new Promise(r => setTimeout(r, 2000));
    for (let i = 0; i < 20; i++) {
        await captureFrame();
        await new Promise(r => setTimeout(r, 50));
    }
    await page.screenshot({ path: 'evidence/freeboard_04_barrier_mode.png' });
    console.log('Saved evidence/freeboard_04_barrier_mode.png');

    // Shot 5: Compare Mode (Side-by-Side Split View)
    console.log('Shot 5: Compare Mode (Side-by-Side Replay)...');
    await page.click('#tab-compare');
    for (let i = 0; i < 30; i++) {
        await captureFrame();
        await new Promise(r => setTimeout(r, 60));
    }
    await page.screenshot({ path: 'evidence/freeboard_05_compare_mode.png' });
    console.log('Saved evidence/freeboard_05_compare_mode.png');

    const fps = await page.$eval('#fps-counter', el => el.textContent);
    console.log(`Live Performance: ${fps}`);

    console.log(`Captured ${frameIdx} frames. Compiling with FFmpeg...`);
    await browser.close();

    const ffmpegCmd = `ffmpeg -y -framerate 25 -i "${FRAMES_DIR}/frame_%05d.png" -c:v libx264 -pix_fmt yuv420p -crf 18 -preset fast evidence/demo.mp4`;
    execSync(ffmpegCmd, { stdio: 'inherit' });
    console.log('Updated evidence/demo.mp4 compiled successfully!');

    fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
    console.log('--- ALL FREE BOARD SHOTS AND VIDEO COMPLETED SUCCESSFULLY ---');
}

run().catch(err => {
    console.error('Run failed:', err);
    process.exit(1);
});
