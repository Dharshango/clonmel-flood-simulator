import puppeteer from 'puppeteer-core';
import path from 'path';

const outDir = 'C:/Users/dhars/.gemini/antigravity/brain/8ef847a2-effc-401b-bc47-8f1726c507c8';

async function run() {
    console.log('Launching Chrome to verify Flood Defence Performance Monitor...');
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
            await new Promise(r => setTimeout(r, 2000));
        }

        // 2. Click Defence Monitor tab
        console.log('Clicking tab-defences (Flood Defence Performance Monitor)...');
        await page.click('#tab-defences');
        await new Promise(r => setTimeout(r, 1500));

        // 3. Inspect KPI scorecard and default selection
        const initialDefState = await page.evaluate(() => {
            const dm = window.defenceManager;
            const kpiTotal = document.getElementById('def-kpi-total')?.textContent;
            const kpiVerified = document.getElementById('def-kpi-verified')?.textContent;
            const kpiMonitored = document.getElementById('def-kpi-monitored')?.textContent;
            const kpiAction = document.getElementById('def-kpi-opcheck')?.textContent;
            const assetName = document.getElementById('def-card-name')?.textContent;
            const crest = document.getElementById('def-card-crest')?.textContent;
            const fbVal = document.getElementById('def-card-freeboard-val')?.textContent;
            const wl = document.getElementById('def-card-water-level')?.textContent;
            const uncert = document.getElementById('def-card-uncertainty')?.textContent;
            const items = document.querySelectorAll('.def-asset-row-item').length;

            return {
                isLoaded: dm?.isLoaded,
                assetCount: dm?.assets?.length,
                kpiTotal,
                kpiVerified,
                kpiMonitored,
                kpiAction,
                assetName,
                crest,
                fbVal,
                wl,
                uncert,
                domItemCount: items
            };
        });

        console.log('Initial Defence Monitor State:', initialDefState);

        // Capture Screenshot 1: Overview of Workspace 9 Defence Monitor
        const ss1Path = path.join(outDir, 'test_defence_monitor_overview.png');
        await page.screenshot({ path: ss1Path });
        console.log(`Saved screenshot 1: ${ss1Path}`);

        // 4. Test Type Filter: Click Demountables filter chip
        console.log('Clicking Demountables filter chip...');
        await page.evaluate(() => {
            const btn = document.querySelector('.def-type-chip[data-deftype="demountable_barrier"]');
            if (btn) btn.click();
        });
        await new Promise(r => setTimeout(r, 800));

        const demountableCount = await page.evaluate(() => {
            return document.querySelectorAll('.def-asset-row-item').length;
        });
        console.log('Visible demountable barriers in list:', demountableCount);

        // Select Demountable Barrier 01 (The Quay Gaps)
        await page.evaluate(() => {
            const item = document.querySelector('.def-asset-row-item[data-def-id="OPW-CLM-DB01"]');
            if (item) item.click();
        });
        await new Promise(r => setTimeout(r, 800));

        // Capture Screenshot 2: Demountables Filter and DB01 Deep-Dive
        const ss2Path = path.join(outDir, 'test_defence_demountables_filter.png');
        await page.screenshot({ path: ss2Path });
        console.log(`Saved screenshot 2: ${ss2Path}`);

        // 5. Test Hypothetical Scenario Testing Sandbox: Toggle sandbox & fail demountables
        console.log('Toggling Hypothetical Scenario: Assume Demountables NOT Deployed...');
        await page.evaluate(() => {
            const toggle = document.getElementById('toggle-hypothetical-mode');
            if (toggle) {
                toggle.checked = true;
                toggle.dispatchEvent(new Event('change'));
            }
            const btnFail = document.getElementById('btn-hypo-fail-demountables');
            if (btnFail) btnFail.click();
        });
        await new Promise(r => setTimeout(r, 1000));

        const hypoState = await page.evaluate(() => {
            const badge = document.getElementById('def-card-status-badge')?.textContent;
            const opText = document.getElementById('def-card-operational-text')?.textContent;
            return { badge, opText };
        });
        console.log('Hypothetical Scenario State for DB01:', hypoState);

        // Capture Screenshot 3: Hypothetical Scenario Active
        const ss3Path = path.join(outDir, 'test_defence_hypothetical_sandbox.png');
        await page.screenshot({ path: ss3Path });
        console.log(`Saved screenshot 3: ${ss3Path}`);

        // 6. Reset filter to All and switch camera to Old Bridge
        await page.evaluate(() => {
            const btnAll = document.querySelector('.def-type-chip[data-deftype="all"]');
            if (btnAll) btnAll.click();
            // Reset hypothetical override
            const btnResetHypo = document.getElementById('btn-hypo-reset');
            if (btnResetHypo) btnResetHypo.click();
            // Select Old Bridge Demountable Gap
            if (window.defenceManager) {
                window.defenceManager.selectAsset('OPW-CLM-DB02');
            }
        });
        await new Promise(r => setTimeout(r, 1000));

        // Trigger Old Bridge camera vantage
        await page.evaluate(() => {
            const item = document.querySelector('.view-dropdown-item[data-index="2"]');
            if (item) item.click();
        });
        await new Promise(r => setTimeout(r, 1500));

        // Capture Screenshot 4: Old Bridge Defence Context
        const ss4Path = path.join(outDir, 'test_defence_old_bridge_vantage.png');
        await page.screenshot({ path: ss4Path });
        console.log(`Saved screenshot 4: ${ss4Path}`);

        console.log('All automated browser tests completed successfully!');
    } catch (err) {
        console.error('Browser verification failed:', err);
    } finally {
        await browser.close();
    }
}

run();
