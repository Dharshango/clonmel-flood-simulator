import puppeteer from 'puppeteer-core';
import path from 'path';

const outDir = 'C:/Users/dhars/.gemini/antigravity/brain/8ef847a2-effc-401b-bc47-8f1726c507c8';

async function run() {
    console.log('Launching Chrome to verify Explainable Flood Forecast platform...');
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
    await page.setViewport({ width: 1560, height: 980 });

    const errors = [];
    page.on('console', msg => {
        const text = msg.text();
        if (msg.type() === 'error') {
            errors.push(text);
        }
        console.log(`[Browser ${msg.type()}]:`, text);
    });

    try {
        console.log('Navigating to http://127.0.0.1:5173/ ...');
        await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 15000 });
        await new Promise(r => setTimeout(r, 2000));

        // 1. Launch simulation from Hero
        const btnHero = await page.$('#run-scenario');
        if (btnHero) {
            console.log('Clicking Launch Simulation...');
            await btnHero.click();
            await new Promise(r => setTimeout(r, 2500));
        }

        // 2. Click Explain Forecast tab
        console.log('Clicking tab-explainable (Explainable Flood Forecast)...');
        await page.click('#tab-explainable');
        await new Promise(r => setTimeout(r, 1500));

        // 3. Inspect Summary KPIs, Inflow Decomposition, and Narrative
        const initialExpState = await page.evaluate(() => {
            const em = window.explainabilityManager;
            const runBadge = document.getElementById('exp-run-badge')?.textContent;
            const peakStage = document.getElementById('exp-kpi-peak-stage')?.textContent;
            const peakQ = document.getElementById('exp-kpi-peak-q')?.textContent;
            const timing = document.getElementById('exp-kpi-timing')?.textContent;
            const risk = document.getElementById('exp-kpi-risk')?.textContent;

            const decompLead = document.getElementById('exp-decomp-lead-label')?.textContent;
            const baseVal = document.getElementById('decomp-val-base')?.textContent;
            const waveVal = document.getElementById('decomp-val-wave')?.textContent;
            const runoffVal = document.getElementById('decomp-val-runoff')?.textContent;

            const narrativeCards = document.querySelectorAll('.exp-narrative-card').length;
            const evidenceRows = document.querySelectorAll('#exp-evidence-scroll-list .def-asset-row-item').length;

            return {
                runBadge,
                peakStage,
                peakQ,
                timing,
                risk,
                decompLead,
                baseVal,
                waveVal,
                runoffVal,
                narrativeCards,
                evidenceRows
            };
        });

        console.log('Initial Explainable Forecast State:', initialExpState);

        // Capture Screenshot 1: Overview of Workspace 10 Explainable Forecast
        const ss1Path = path.join(outDir, 'test_explainable_forecast_overview.png');
        await page.screenshot({ path: ss1Path });
        console.log(`Saved screenshot 1: ${ss1Path}`);

        // 4. Test Controlled Sensitivity Explorer Sandbox
        console.log('Testing Sensitivity Explorer: Clicking +20% Rain perturbation...');
        await page.click('#btn-sens-rain-up');
        await new Promise(r => setTimeout(r, 800));

        const sensState = await page.evaluate(() => {
            const title = document.getElementById('exp-sens-title')?.textContent;
            const badge = document.getElementById('exp-sens-delta-badge')?.textContent;
            const conclusion = document.getElementById('exp-sens-conclusion')?.textContent;
            return { title, badge, conclusion };
        });
        console.log('Sensitivity Experiment Result:', sensState);

        // Capture Screenshot 2: Active Sensitivity Experiment
        const ss2Path = path.join(outDir, 'test_explainable_sensitivity_sandbox.png');
        await page.screenshot({ path: ss2Path });
        console.log(`Saved screenshot 2: ${ss2Path}`);

        // 5. Test Evidence Filter Chips
        console.log('Testing Evidence Filters: Clicking River Gauges filter chip...');
        await page.evaluate(() => {
            const chip = document.querySelector('.exp-ev-chip[data-evfilter="observed_gauge"]');
            if (chip) chip.click();
        });
        await new Promise(r => setTimeout(r, 600));

        const gaugeRows = await page.evaluate(() => {
            return document.querySelectorAll('#exp-evidence-scroll-list .def-asset-row-item').length;
        });
        console.log('Filtered River Gauge Evidence Rows:', gaugeRows);

        // Reset filter to All
        await page.evaluate(() => {
            const chip = document.querySelector('.exp-ev-chip[data-evfilter="all"]');
            if (chip) chip.click();
        });
        await new Promise(r => setTimeout(r, 600));

        // Capture Screenshot 3: Evidence Inventory & Independent Validation Table
        const ss3Path = path.join(outDir, 'test_explainable_evidence_inventory.png');
        await page.screenshot({ path: ss3Path });
        console.log(`Saved screenshot 3: ${ss3Path}`);

        // 6. Test Interactive Spatial Location Explanation
        console.log('Testing Spatial Location Explanation for Old Bridge (South Bank)...');
        await page.evaluate(() => {
            if (window.explainabilityManager && window.simulator) {
                window.explainabilityManager.selectLocation(0.49, 0.53, 'Old Bridge (South Bank)', window.simulator);
            }
        });
        await new Promise(r => setTimeout(r, 800));

        const locState = await page.evaluate(() => {
            const name = document.getElementById('exp-loc-name')?.textContent;
            const badge = document.getElementById('exp-loc-mechanism-badge')?.textContent;
            const depth = document.getElementById('exp-loc-depth')?.textContent;
            const ground = document.getElementById('exp-loc-ground-elev')?.textContent;
            const water = document.getElementById('exp-loc-water-elev')?.textContent;
            return { name, badge, depth, ground, water };
        });
        console.log('Spatial Explanation State for Old Bridge:', locState);

        // Capture Screenshot 4: Spatial Location Explanation
        const ss4Path = path.join(outDir, 'test_explainable_spatial_location.png');
        await page.screenshot({ path: ss4Path });
        console.log(`Saved screenshot 4: ${ss4Path}`);

        console.log('All Explainable Flood Forecast browser tests completed successfully!');
    } catch (err) {
        console.error('Browser verification failed:', err);
    } finally {
        await browser.close();
    }
}

run();
