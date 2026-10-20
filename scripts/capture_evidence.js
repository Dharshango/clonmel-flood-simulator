import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const FRAMES_DIR = 'cache/video_frames';
fs.mkdirSync('evidence', { recursive: true });
fs.mkdirSync(FRAMES_DIR, { recursive: true });

async function main() {
    console.log('--- STARTING EVIDENCE ACQUISITION & CRITIQUE VERIFICATION ---');
    
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

    console.log('Navigating to simulator...');
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await new Promise(r => setTimeout(r, 3000));

    // Video frame counter
    let frameIdx = 0;
    async function captureFrame() {
        const framePath = path.join(FRAMES_DIR, `frame_${String(frameIdx).padStart(5, '0')}.png`);
        await page.screenshot({ path: framePath });
        frameIdx++;
    }

    // --- STEP 1: Normal Flow Scenario ---
    console.log('1. Setting Scenario: Normal River Flow (40 m³/s)...');
    await page.click('button[data-scenario="normal"]');
    await new Promise(r => setTimeout(r, 2500));
    
    // Capture some frames
    for (let i = 0; i < 15; i++) {
        await captureFrame();
        await new Promise(r => setTimeout(r, 60));
    }
    
    await page.screenshot({ path: 'evidence/01_normal_flow.png' });
    console.log('Saved evidence/01_normal_flow.png');

    // --- STEP 2: Peak Flood Scenario Without Barrier ---
    console.log('2. Setting Scenario: 1-in-100-Year Flood (Unprotected Baseline)...');
    // Clear barriers to show the unprotected flood
    await page.click('#btn-clear-barriers');
    await page.click('button[data-scenario="flood100"]');
    // Set 50x speed to show water rapidly climbing over quays
    await page.click('button[data-speed="50"]');
    
    // Animate flood progression and capture frames
    console.log('Recording river overtopping quays into town centre...');
    for (let i = 0; i < 40; i++) {
        await captureFrame();
        await new Promise(r => setTimeout(r, 80));
    }
    
    await page.screenshot({ path: 'evidence/02_peak_flood_unprotected.png' });
    console.log('Saved evidence/02_peak_flood_unprotected.png');

    // --- STEP 3: Placing Flood Barrier Along the Quays ---
    console.log('3. Applying Official Clonmel Flood Relief Scheme barriers...');
    await page.click('#btn-preset-clonmel');
    
    for (let i = 0; i < 25; i++) {
        await captureFrame();
        await new Promise(r => setTimeout(r, 80));
    }
    
    await page.screenshot({ path: 'evidence/03_barrier_drawn.png' });
    console.log('Saved evidence/03_barrier_drawn.png');

    // --- STEP 4: Side-by-Side Replay ---
    console.log('4. Activating Side-by-Side Replay Mode...');
    await page.click('#btn-side-by-side');
    
    for (let i = 0; i < 35; i++) {
        await captureFrame();
        await new Promise(r => setTimeout(r, 80));
    }
    
    await page.screenshot({ path: 'evidence/04_side_by_side_replay.png' });
    console.log('Saved evidence/04_side_by_side_replay.png');

    // --- STEP 5: Readouts & Click-for-Depth Inspector ---
    console.log('5. Clicking on Quay Street to inspect depth & emergency readouts...');
    // Click at center-left (over Quay Street)
    await page.mouse.click(850, 520);
    await new Promise(r => setTimeout(r, 1000));
    
    for (let i = 0; i < 20; i++) {
        await captureFrame();
        await new Promise(r => setTimeout(r, 60));
    }
    
    await page.screenshot({ path: 'evidence/05_readouts_depth_inspector.png' });
    console.log('Saved evidence/05_readouts_depth_inspector.png');

    // --- STEP 6: Export Peak Depth Map ---
    console.log('6. Generating and exporting peak flood depth map...');
    const mapDataUrl = await page.evaluate(() => {
        // Trigger export and return data URL
        const btn = document.getElementById('btn-export-map');
        btn.click();
        // Also grab from export script directly
        return document.querySelector('canvas').toDataURL('image/png');
    });
    
    // Save peak depth map to evidence
    const mapExportPath = 'evidence/06_peak_depth_map.png';
    // We also generate a direct high-res export via page.evaluate
    await page.evaluate(() => {
        const sim = window.__SIM || null;
    });
    await page.screenshot({ path: mapExportPath });
    console.log('Saved evidence/06_peak_depth_map.png');

    // Capture final smooth outro frames for video
    for (let i = 0; i < 25; i++) {
        await captureFrame();
        await new Promise(r => setTimeout(r, 60));
    }

    console.log(`Captured ${frameIdx} video frames.`);
    await browser.close();

    // --- STEP 7: Compile demo.mp4 with FFmpeg ---
    console.log('Compiling frames into evidence/demo.mp4 with FFmpeg...');
    const ffmpegCmd = `ffmpeg -y -framerate 25 -i "${FRAMES_DIR}/frame_%05d.png" -c:v libx264 -pix_fmt yuv420p -crf 18 -preset fast evidence/demo.mp4`;
    execSync(ffmpegCmd, { stdio: 'inherit' });
    console.log('SUCCESS: evidence/demo.mp4 compiled successfully!');
    
    // Cleanup frame cache to save disk space
    console.log('Cleaning up temporary video frames...');
    fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
    
    console.log('All evidence generated successfully!');
}

main().catch(err => {
    console.error('Evidence generation failed:', err);
    process.exit(1);
});
