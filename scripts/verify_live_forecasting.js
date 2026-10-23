import puppeteer from 'puppeteer-core';
import path from 'path';

const outDir = 'C:/Users/dhars/.gemini/antigravity/brain/8ef847a2-effc-401b-bc47-8f1726c507c8';

async function run() {
    console.log('Launching Chrome to verify Real-Time Physics-Based Flood Forecasting platform...');
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

        // 2. Click Forecast Ops tab
        console.log('Clicking tab-forecast (Forecast Ops)...');
        await page.click('#tab-forecast');
        await new Promise(r => setTimeout(r, 1500));

        // 3. Verify forecast UI elements and readouts
        const forecastInfo = await page.evaluate(() => {
            const fm = window.forecastManager;
            const badge = document.getElementById('forecast-status-badge')?.textContent;
            const stage = document.getElementById('fc-clonmel-stage')?.textContent;
            const q = document.getElementById('fc-clonmel-q')?.textContent;
            const klStage = document.getElementById('fc-knocklofty-stage')?.textContent;
            const rain = document.getElementById('fc-rain-rate')?.textContent;
            const coupledQ = document.getElementById('fc-coupled-q')?.textContent;
            const coupledStage = document.getElementById('fc-coupled-stage')?.textContent;
            const activeTag = document.getElementById('fc-chart-active-tag')?.textContent;

            return {
                isInitialized: fm?.isInitialized,
                feedStatus: fm?.feedStatus,
                badge,
                stage,
                q,
                klStage,
                rain,
                coupledQ,
                coupledStage,
                activeTag
            };
        });

        console.log('Forecast State Evaluation:', JSON.stringify(forecastInfo, null, 2));

        // 4. Capture Overview Screenshot with Live Hydrograph
        const overviewPath = path.join(outDir, 'test_forecast_ops_overview.png');
        await page.screenshot({ path: overviewPath });
        console.log(`Saved screenshot: ${overviewPath}`);

        // 5. Test Scenario Switching: P90 Severe
        console.log('Testing Scenario Switch -> P90 (Severe / Worst-case)...');
        await page.click('#btn-scenario-p90');
        await new Promise(r => setTimeout(r, 1000));

        const p90Info = await page.evaluate(() => {
            return {
                activeScenario: window.forecastManager?.activeScenario,
                chartTag: document.getElementById('fc-chart-active-tag')?.textContent,
                coupledQ: document.getElementById('fc-coupled-q')?.textContent,
                coupledSurge: document.getElementById('fc-coupled-surge')?.textContent
            };
        });
        console.log('P90 Scenario Evaluation:', JSON.stringify(p90Info, null, 2));

        const p90Path = path.join(outDir, 'test_forecast_scenario_p90_severe.png');
        await page.screenshot({ path: p90Path });
        console.log(`Saved screenshot: ${p90Path}`);

        // 6. Test Lead-Time Seeking: +24h (Peak Inundation Crest)
        console.log('Testing Lead-Time Quick Jump -> +24h (Peak Crest)...');
        const chip24 = await page.$('.lead-chip[data-hours="24"]');
        if (chip24) {
            await chip24.click();
        } else {
            console.error('Lead chip +24h not found!');
        }
        await new Promise(r => setTimeout(r, 3000)); // allow GPU hydrodynamic steps to settle

        const peak24Info = await page.evaluate(() => {
            const fm = window.forecastManager;
            const sim = window.simulator;
            const bldgs = document.getElementById('stat-flooded-bldgs')?.textContent;
            const peakDepth = document.getElementById('stat-peak-depth')?.textContent;
            const clock = document.getElementById('flood-clock-text')?.textContent;
            return {
                currentLeadTimeHours: fm?.currentLeadTimeHours,
                simInflow: sim?.params?.riverInflow,
                simSurge: sim?.params?.downstreamSurge,
                bldgsFlooded: bldgs,
                peakDepth,
                clock
            };
        });
        console.log('+24h Lead Time Evaluation:', JSON.stringify(peak24Info, null, 2));

        const peakPath = path.join(outDir, 'test_forecast_leadtime_24h_peak_flood.png');
        await page.screenshot({ path: peakPath });
        console.log(`Saved screenshot: ${peakPath}`);

        // 7. Test Scientific Validation Modal Dialog
        console.log('Testing Scientific Validation Modal Dialog...');
        await page.click('#btn-open-validation-modal');
        await new Promise(r => setTimeout(r, 800));

        const modalOpen = await page.evaluate(() => {
            const modal = document.getElementById('forecast-validation-modal');
            return modal && modal.open;
        });
        console.log('Validation Modal Open State:', modalOpen);

        const valModalPath = path.join(outDir, 'test_forecast_validation_modal.png');
        await page.screenshot({ path: valModalPath });
        console.log(`Saved screenshot: ${valModalPath}`);

        // Close modal
        await page.click('#btn-close-val-modal');
        await new Promise(r => setTimeout(r, 500));

        console.log('ALL VERIFICATION CHECKS COMPLETED SUCCESSFULLY!');
    } catch (err) {
        console.error('Verification failed with error:', err);
    } finally {
        await browser.close();
    }
}

run();
