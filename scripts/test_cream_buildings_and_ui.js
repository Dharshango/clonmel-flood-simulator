import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

const FRAMES_DIR = 'cache/video_frames';

async function main() {
    console.log('--- TESTING FREE BOARD WITH CREAM BUILDINGS, GRAY GROUND & FLOOD HIGHLIGHTING ---');
    
    fs.mkdirSync('evidence', { recursive: true });
    fs.mkdirSync(FRAMES_DIR, { recursive: true });

    const browser = await puppeteer.launch({
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--use-gl=angle',
            '--use-angle=d3d11',
            '--enable-webgl',
            '--window-size=1920,1080',
            '--hide-scrollbars'
        ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    page.on('console', msg => {
        const text = msg.text();
        if (!text.includes('THREE.WebGLRenderer') && !text.includes('downloadable font')) {
            console.log(`[Browser Console] ${text}`);
        }
    });

    console.log('Navigating to http://127.0.0.1:5173/...');
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#three-canvas');
    await new Promise(r => setTimeout(r, 3000));

    let frameIdx = 0;
    async function captureFrame() {
        const padded = String(frameIdx++).padStart(5, '0');
        await page.screenshot({ path: `${FRAMES_DIR}/frame_${padded}.png` });
    }

    // 1. Verify Header & Playback Bar
    const headerCheck = await page.evaluate(() => {
        const vercelBtn = document.querySelector('.vercel');
        const liveBtn = document.getElementById('tab-live');
        const barrierBtn = document.getElementById('tab-barrier');
        const compareBtn = document.getElementById('tab-compare');
        const quickExport = document.getElementById('btn-quick-export');
        const quickReset = document.getElementById('btn-quick-reset');
        return {
            hasVercelInHeader: !!vercelBtn,
            has3Tabs: !!(liveBtn && barrierBtn && compareBtn),
            hasQuickActions: !!(quickExport && quickReset)
        };
    });
    console.log('Top Header Verification:', headerCheck);

    const playbackCheck = await page.evaluate(() => {
        const bar = document.getElementById('bottom-playback-bar');
        const playBtn = document.getElementById('btn-play-pause');
        const timeClock = document.getElementById('flood-clock-text');
        const scrubberKnob = document.getElementById('scrubber-knob');
        const homeBtn = document.getElementById('btn-home-view');
        const vantageBtn = document.getElementById('btn-cycle-camera');
        const cameraBtn = document.getElementById('btn-toggle-camera');
        const panelsBtn = document.getElementById('btn-toggle-panels');
        return {
            hasBar: !!bar,
            hasPlayCircle: !!playBtn,
            hasTimeClock: timeClock?.textContent,
            hasScrubberKnob: !!scrubberKnob,
            has4ActionButtons: !!(homeBtn && vantageBtn && cameraBtn && panelsBtn)
        };
    });
    console.log('Bottom Playback Bar Verification (Image 4):', playbackCheck);

    // Shot 1: Normal baseline flow (Cream buildings on slate gray ground)
    console.log('Shot 1: Normal flow scenario...');
    await page.evaluate(() => {
        const normalBtn = document.querySelector('.scenario-btn[data-scenario="normal"]');
        if (normalBtn) normalBtn.click();
    });
    await new Promise(r => setTimeout(r, 2000));
    for (let i = 0; i < 20; i++) {
        await captureFrame();
        await new Promise(r => setTimeout(r, 40));
    }
    await page.screenshot({ path: 'evidence/cream_01_normal_flow.png' });
    console.log('Saved evidence/cream_01_normal_flow.png');

    // Shot 2: Bridge & The Quay vantage point
    console.log('Shot 2: Switching vantage to Old Bridge & The Quay...');
    await page.evaluate(() => {
        const vantageBtn = document.getElementById('btn-cycle-camera');
        if (vantageBtn) vantageBtn.click();
    });
    await new Promise(r => setTimeout(r, 1500));
    for (let i = 0; i < 20; i++) {
        await captureFrame();
        await new Promise(r => setTimeout(r, 40));
    }
    await page.screenshot({ path: 'evidence/cream_02_bridge_vantage.png' });
    console.log('Saved evidence/cream_02_bridge_vantage.png');

    // Shot 3: Fast-forward 1-in-100-Year Peak Flood overtopping quays
    console.log('Shot 3: Fast-forwarding 1-in-100-year peak flood at Max speed...');
    await page.evaluate(() => {
        const floodBtn = document.querySelector('.scenario-btn[data-scenario="flood100"]');
        if (floodBtn) floodBtn.click();
        const maxBtn = document.querySelector('.speed-btn[data-speed="2500"]');
        if (maxBtn) maxBtn.click();
    });

    for (let i = 0; i < 50; i++) {
        await captureFrame();
        await new Promise(r => setTimeout(r, 90));
    }

    const floodMetrics = await page.evaluate(() => {
        const total = document.getElementById('stat-flooded-bldgs')?.textContent;
        const endangered = document.getElementById('stat-endangered-bldgs')?.textContent;
        const partial = document.getElementById('stat-partial-bldgs')?.textContent;
        const clock = document.getElementById('flood-clock-text')?.textContent;
        const roads = document.getElementById('stat-roads-cutoff')?.textContent;
        return { total, endangered, partial, clock, roads };
    });
    console.log('Peak Flood Metrics (Yellow Partial vs Red Endangered):', floodMetrics);
    await page.screenshot({ path: 'evidence/cream_03_flood_spill.png' });
    console.log('Saved evidence/cream_03_flood_spill.png');

    // Shot 4: Unobstructed Town View (Toggling side panels off using 4th button)
    console.log('Shot 4: Unobstructed model overview with side panels toggled off...');
    await page.evaluate(() => {
        const togglePanelsBtn = document.getElementById('btn-toggle-panels');
        if (togglePanelsBtn) togglePanelsBtn.click();
    });
    await new Promise(r => setTimeout(r, 1000));
    for (let i = 0; i < 20; i++) {
        await captureFrame();
        await new Promise(r => setTimeout(r, 40));
    }
    await page.screenshot({ path: 'evidence/cream_04_unobstructed_overview.png' });
    console.log('Saved evidence/cream_04_unobstructed_overview.png');

    // Toggle panels back on
    await page.evaluate(() => {
        const togglePanelsBtn = document.getElementById('btn-toggle-panels');
        if (togglePanelsBtn) togglePanelsBtn.click();
    });
    await new Promise(r => setTimeout(r, 800));

    // Shot 5: Barrier & Compare Mode
    console.log('Shot 5: Compare Mode (Side-by-Side Replay)...');
    await page.evaluate(() => {
        const compareBtn = document.getElementById('tab-compare');
        if (compareBtn) compareBtn.click();
    });
    await new Promise(r => setTimeout(r, 2000));
    for (let i = 0; i < 30; i++) {
        await captureFrame();
        await new Promise(r => setTimeout(r, 60));
    }
    await page.screenshot({ path: 'evidence/cream_05_compare_mode.png' });
    console.log('Saved evidence/cream_05_compare_mode.png');

    console.log(`Captured ${frameIdx} frames. Compiling with FFmpeg...`);
    await browser.close();

    const ffmpegCmd = `ffmpeg -y -framerate 25 -i "${FRAMES_DIR}/frame_%05d.png" -c:v libx264 -pix_fmt yuv420p -crf 18 -preset fast evidence/demo.mp4`;
    execSync(ffmpegCmd, { stdio: 'inherit' });
    console.log('Updated evidence/demo.mp4 compiled successfully!');

    fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
    console.log('--- ALL TASKS COMPLETED SUCCESSFULLY ---');
}

main().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});
