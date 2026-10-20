import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const FRAMES_DIR = 'cache/video_frames';
fs.mkdirSync('evidence', { recursive: true });
fs.mkdirSync(FRAMES_DIR, { recursive: true });

async function record() {
    console.log('Recording updated Light Mode demo.mp4 video...');
    
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

    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await new Promise(r => setTimeout(r, 3000));

    let frameIdx = 0;
    async function captureFrame() {
        const framePath = path.join(FRAMES_DIR, `frame_${String(frameIdx).padStart(5, '0')}.png`);
        await page.screenshot({ path: framePath });
        frameIdx++;
    }

    // Scene 1: Normal Flow with pristine white buildings
    console.log('Scene 1: Normal Suir Flow with White Buildings...');
    await page.click('button[data-scenario="normal"]');
    await new Promise(r => setTimeout(r, 2000));
    for (let i = 0; i < 25; i++) {
        await captureFrame();
        await new Promise(r => setTimeout(r, 50));
    }

    // Scene 2: 1-in-100-Year Flood Surge (Fast-Forward overtopping quays into town)
    console.log('Scene 2: Unprotected 1-in-100-Year Flood in fast-forward...');
    await page.click('#btn-clear-barriers');
    await page.click('button[data-scenario="flood100"]');
    await page.click('button[data-speed="50"]');
    for (let i = 0; i < 45; i++) {
        await captureFrame();
        await new Promise(r => setTimeout(r, 60));
    }

    // Scene 3: Drawing / Applying Quay Barriers
    console.log('Scene 3: Placing Quay Wall barrier...');
    await page.click('#btn-preset-clonmel');
    for (let i = 0; i < 25; i++) {
        await captureFrame();
        await new Promise(r => setTimeout(r, 60));
    }

    // Scene 4: Side-by-Side Replay (Protected vs Unprotected, Green Saved Buildings)
    console.log('Scene 4: Side-by-Side Replay in Light Mode...');
    await page.click('#btn-side-by-side');
    for (let i = 0; i < 40; i++) {
        await captureFrame();
        await new Promise(r => setTimeout(r, 60));
    }

    // Scene 5: Click-for-Depth Inspector Pin
    console.log('Scene 5: Click-to-inspect depth...');
    await page.mouse.click(820, 500);
    for (let i = 0; i < 25; i++) {
        await captureFrame();
        await new Promise(r => setTimeout(r, 60));
    }

    console.log(`Captured ${frameIdx} frames. Compiling with FFmpeg...`);
    await browser.close();

    const ffmpegCmd = `ffmpeg -y -framerate 25 -i "${FRAMES_DIR}/frame_%05d.png" -c:v libx264 -pix_fmt yuv420p -crf 18 -preset fast evidence/demo.mp4`;
    execSync(ffmpegCmd, { stdio: 'inherit' });
    console.log('Updated evidence/demo.mp4 compiled successfully!');

    fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
}

record().catch(err => {
    console.error('Video recording failed:', err);
    process.exit(1);
});
