import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const FRAMES_DIR = 'cache/video_frames_dibrugarh';
const EVIDENCE_DIR = 'evidence';
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
fs.mkdirSync(FRAMES_DIR, { recursive: true });

function getFfmpegPath() {
    try {
        execSync('ffmpeg -version', { stdio: 'ignore' });
        return 'ffmpeg';
    } catch (_) {
        const pyFfmpeg = 'C:\\Users\\dhars\\AppData\\Local\\Programs\\Python\\Python311\\Lib\\site-packages\\imageio_ffmpeg\\binaries\\ffmpeg-win-x86_64-v7.1.exe';
        if (fs.existsSync(pyFfmpeg)) {
            return `"${pyFfmpeg}"`;
        }
        throw new Error(`FFmpeg not found in PATH or at ${pyFfmpeg}`);
    }
}

async function recordDemo() {
    console.log('================================================================');
    console.log('  RECORDING SIGNATURE DIBRUGARH SIMULATION DEMO (evidence/demo.mp4)  ');
    console.log('================================================================\n');

    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    if (!fs.existsSync(chromePath)) {
        throw new Error(`Google Chrome not found at ${chromePath}`);
    }

    const ffmpegBin = getFfmpegPath();
    console.log(`Using FFmpeg binary: ${ffmpegBin}`);

    // Clean previous frames if any
    const existingFrames = fs.readdirSync(FRAMES_DIR);
    for (const f of existingFrames) {
        fs.unlinkSync(path.join(FRAMES_DIR, f));
    }

    console.log('Launching browser with WebGL hardware acceleration...');
    const browser = await puppeteer.launch({
        executablePath: chromePath,
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

    console.log('Navigating to http://127.0.0.1:5173/#town=dibrugarh...');
    await page.goto('http://127.0.0.1:5173/#town=dibrugarh', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3500));

    // Transition from Hero section into 3D Simulation
    console.log('Transitioning into 3D Simulation Viewport...');
    await page.evaluate(() => {
        const btn = document.getElementById('run-scenario') || document.getElementById('btn-hero-launch');
        if (btn) btn.click();
        const hero = document.getElementById('hero-section');
        if (hero) {
            hero.classList.add('hidden');
            hero.style.display = 'none';
        }
    });
    await new Promise(r => setTimeout(r, 2000));

    let frameIdx = 0;
    async function captureFrame() {
        const framePath = path.join(FRAMES_DIR, `frame_${String(frameIdx).padStart(5, '0')}.png`);
        await page.screenshot({ path: framePath });
        frameIdx++;
    }

    // ACT 1: Normal Monsoon River Flow & Overview (Frames 0 to 30)
    console.log('ACT 1: Capturing Normal Monsoon Flow (104.50 m MSL) across Brahmaputra...');
    await page.evaluate(() => {
        const btn = document.querySelector('.scenario-btn[data-scenario="baseline-monsoon"]');
        if (btn) btn.click();
        if (window.controls) {
            window.controls.object.position.set(-180, 500, 680);
            window.controls.target.set(0, 0, 0);
            window.controls.update();
        }
    });
    await new Promise(r => setTimeout(r, 1500));

    for (let i = 0; i < 30; i++) {
        await captureFrame();
        await new Promise(r => setTimeout(r, 40));
    }

    // ACT 2: Peak Inundation & Smooth Camera Flyover toward Graham Bazaar/AT Road (Frames 31 to 75)
    console.log('ACT 2: Triggering Historic Flood Wave & Cinematic Camera Descent...');
    await page.evaluate(() => {
        const btn = document.querySelector('.scenario-btn[data-scenario="sept-1998-record"]')
            || document.querySelector('.scenario-btn[data-scenario="july-2024-flash"]');
        if (btn) btn.click();
        const speedBtn = document.querySelector('.speed-btn[data-speed="300"]') || document.querySelector('.speed-btn[data-speed="900"]');
        if (speedBtn) speedBtn.click();
    });

    const startPos = { x: -180, y: 500, z: 680 };
    const endPos = { x: -50, y: 220, z: 340 };
    const startTgt = { x: 0, y: 0, z: 0 };
    const endTgt = { x: 30, y: 15, z: 40 };

    const flySteps = 45;
    for (let i = 0; i < flySteps; i++) {
        const t = i / (flySteps - 1);
        // Smooth hermite ease
        const ease = t * t * (3 - 2 * t);
        const curX = startPos.x + (endPos.x - startPos.x) * ease;
        const curY = startPos.y + (endPos.y - startPos.y) * ease;
        const curZ = startPos.z + (endPos.z - startPos.z) * ease;
        const tgtX = startTgt.x + (endTgt.x - startTgt.x) * ease;
        const tgtY = startTgt.y + (endTgt.y - startTgt.y) * ease;
        const tgtZ = startTgt.z + (endTgt.z - startTgt.z) * ease;

        await page.evaluate((cx, cy, cz, tx, ty, tz) => {
            if (window.controls) {
                window.controls.object.position.set(cx, cy, cz);
                window.controls.target.set(tx, ty, tz);
                window.controls.update();
            }
        }, curX, curY, curZ, tgtX, tgtY, tgtZ);

        await captureFrame();
        await new Promise(r => setTimeout(r, 40));
    }

    // ACT 3: Drawing Tactical Flood Wall along Riverfront & Reinforcing DTP Dyke (Frames 76 to 110)
    console.log('ACT 3: Deploying Tactical Riverfront Demountable Barrier & DTP Reinforcement...');
    await page.evaluate(() => {
        // Switch to intervention tab
        const tabIntervention = document.getElementById('tab-intervention') || document.getElementById('tab-barrier');
        if (tabIntervention) tabIntervention.click();

        // Draw wall
        if (window.barriersManager && typeof window.barriersManager.addBarrierPolyline === 'function') {
            const wallPts = [
                [94.9030, 27.4845],
                [94.9080, 27.4860],
                [94.9135, 27.4878],
                [94.9195, 27.4895],
                [94.9240, 27.4910]
            ];
            window.barriersManager.addBarrierPolyline(wallPts, 'wall', 2.8, 2.0, 1.5, 'Riverfront Demountable Barrier');
        }

        // Deploy DTP Dyke preset & Sluice Pumps
        const btnPreset = document.getElementById('btn-tool-preset');
        if (btnPreset) btnPreset.click();

        const btnPumps = document.getElementById('btn-toggle-pumps');
        if (btnPumps && !btnPumps.classList.contains('active')) btnPumps.click();
    });
    await new Promise(r => setTimeout(r, 1200));

    for (let i = 0; i < 35; i++) {
        await captureFrame();
        await new Promise(r => setTimeout(r, 40));
    }

    // ACT 4: Synchronized Side-by-Side Replay (Frames 111 to 155)
    console.log('ACT 4: Running Synchronized Dual-Simulation Side-by-Side Replay...');
    await page.evaluate(() => {
        if (typeof window.setSideBySideReplay === 'function') {
            window.setSideBySideReplay(true);
        } else {
            const btnSbs = document.getElementById('btn-toggle-sbs');
            if (btnSbs) btnSbs.click();
        }
    });
    await new Promise(r => setTimeout(r, 1500));

    for (let i = 0; i < 45; i++) {
        await captureFrame();
        await new Promise(r => setTimeout(r, 40));
    }

    // Turn off side-by-side for final act
    await page.evaluate(() => {
        if (typeof window.setSideBySideReplay === 'function') {
            window.setSideBySideReplay(false);
        }
    });

    // ACT 5: Live Gauge Readouts & Interactive Click-for-Depth Telemetry (Frames 156 to 195)
    console.log('ACT 5: Clicking Inundated Corridor for Depth & Telemetry HUD Readout...');
    await page.evaluate(() => {
        const tabLive = document.getElementById('tab-live');
        if (tabLive) tabLive.click();
    });
    await new Promise(r => setTimeout(r, 1000));

    await page.mouse.click(880, 540);
    await new Promise(r => setTimeout(r, 800));

    for (let i = 0; i < 40; i++) {
        await captureFrame();
        await new Promise(r => setTimeout(r, 40));
    }

    console.log(`\nSuccessfully captured ${frameIdx} frames. Compiling with FFmpeg...`);
    await browser.close();

    const outVideo = path.join(EVIDENCE_DIR, 'demo.mp4');
    const ffmpegCmd = `${ffmpegBin} -y -framerate 25 -i "${FRAMES_DIR}/frame_%05d.png" -c:v libx264 -pix_fmt yuv420p -crf 18 -preset fast "${outVideo}"`;
    
    console.log(`Executing FFmpeg command: ${ffmpegCmd}`);
    execSync(ffmpegCmd, { stdio: 'inherit' });

    if (fs.existsSync(outVideo)) {
        const stat = fs.statSync(outVideo);
        console.log(`\n[SUCCESS] Compiled ${outVideo} (${(stat.size / (1024 * 1024)).toFixed(2)} MB, ${frameIdx} frames @ 25 fps)`);
    } else {
        throw new Error(`Failed to compile ${outVideo}`);
    }

    // Clean up temp frames directory to conserve storage
    fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
    console.log('Cleaned temporary frame sequence cache.');
    console.log('--- DEMO RECORDING COMPLETE ---\n');
}

recordDemo().catch(err => {
    console.error('\n[FATAL ERROR in record_dibrugarh_demo.js]:', err);
    process.exit(1);
});
