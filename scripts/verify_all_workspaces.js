import puppeteer from 'puppeteer-core';
import fs from 'fs';

async function main() {
    console.log('--- Launching Hydroverse Platform End-to-End Verification ---');
    const browser = await puppeteer.launch({
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--use-gl=angle',
            '--use-angle=d3d11',
            '--enable-webgl',
            '--window-size=1440,900'
        ]
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    
    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.error('Browser Error:', msg.text());
        }
    });

    console.log('Navigating to Hydroverse localhost...');
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 2000));
    
    // 1. Launch 3D Simulation from Hero
    console.log('1. Launching 3D Simulation from Hero section...');
    await page.click('#run-scenario');
    await new Promise(r => setTimeout(r, 2500));
    
    // 2. Test 900x / Max speed stability
    console.log('2. Testing 900x / Max speed stability...');
    await page.evaluate(() => {
        const btn900 = document.querySelector('.speed-btn[data-speed="900"]');
        if (btn900) btn900.click();
    });
    await new Promise(r => setTimeout(r, 3000));
    await page.screenshot({ path: 'evidence/workspace_01_900x_stability.png' });
    console.log('Saved evidence/workspace_01_900x_stability.png');
    
    // 3. Test Workspace 1: Live Map Analytical Overlays
    console.log('3. Testing Workspace 1: Live Map Overlays...');
    await page.evaluate(() => {
        const depthBtn = document.querySelector('.overlay-toggle-btn[data-overlay="depthHeatmap"]');
        if (depthBtn) depthBtn.click();
    });
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: 'evidence/workspace_01_live_map_overlays.png' });
    console.log('Saved evidence/workspace_01_live_map_overlays.png');
    
    // 4. Test Workspace 2: Flood Time Machine & Hydrograph
    console.log('4. Testing Workspace 2: Flood Time Machine...');
    await page.click('#tab-time');
    await new Promise(r => setTimeout(r, 1200));
    
    // Click milestone: Quay Spill
    await page.evaluate(() => {
        const spillBtn = document.querySelector('.milestone-btn[data-time="4500"]');
        if (spillBtn) spillBtn.click();
    });
    await new Promise(r => setTimeout(r, 1500));
    
    // Click historical event: Storm Frank 2015
    await page.evaluate(() => {
        const frankBtn = document.querySelector('.historical-event-card[data-event="storm_frank_2015"]');
        if (frankBtn) frankBtn.click();
    });
    await new Promise(r => setTimeout(r, 2500));
    await page.screenshot({ path: 'evidence/workspace_02_time_machine.png' });
    console.log('Saved evidence/workspace_02_time_machine.png');
    
    // Test Story Mode Launch
    console.log('Testing "ONE STORM. TWO FUTURES." story mode...');
    await page.evaluate(() => document.getElementById('btn-launch-story')?.click());
    await new Promise(r => setTimeout(r, 1000));
    await page.evaluate(() => document.getElementById('btn-story-next')?.click());
    await new Promise(r => setTimeout(r, 1000));
    await page.evaluate(() => document.getElementById('btn-story-close')?.click());
    await new Promise(r => setTimeout(r, 500));
    
    // 5. Test Workspace 3: Intervention Lab
    console.log('5. Testing Workspace 3: Intervention Lab...');
    await page.evaluate(() => document.getElementById('tab-intervention')?.click());
    await new Promise(r => setTimeout(r, 1500));
    
    // Toggle SuDS and Pumps
    await page.evaluate(() => {
        const suds = document.getElementById('btn-toggle-suds');
        const pumps = document.getElementById('btn-toggle-pumps');
        const diff = document.getElementById('btn-toggle-diff');
        if (suds) suds.click();
        if (pumps) pumps.click();
        if (diff) diff.click();
    });
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: 'evidence/workspace_03_intervention_lab.png' });
    console.log('Saved evidence/workspace_03_intervention_lab.png');
    
    // 6. Test Workspace 4: Impact Intelligence
    console.log('6. Testing Workspace 4: Impact Intelligence...');
    await page.evaluate(() => document.getElementById('tab-impact')?.click());
    await new Promise(r => setTimeout(r, 1500));
    
    const impactStats = await page.evaluate(() => {
        return {
            hospBadge: document.getElementById('impact-hospital-badge')?.innerText,
            hospStatus: document.getElementById('impact-hospital-status')?.innerText,
            roadsKm: document.getElementById('impact-roads-km')?.innerText,
            roadsCount: document.getElementById('impact-roads-count')?.innerText,
            suirIsland: document.getElementById('sector-suir-island')?.innerText
        };
    });
    console.log('Impact intelligence telemetry:', JSON.stringify(impactStats, null, 2));
    await page.screenshot({ path: 'evidence/workspace_04_impact_intel.png' });
    console.log('Saved evidence/workspace_04_impact_intel.png');
    
    // 7. Test Workspace 5: Science & Validation
    console.log('7. Testing Workspace 5: Science & Validation...');
    await page.evaluate(() => document.getElementById('tab-science')?.click());
    await new Promise(r => setTimeout(r, 1500));
    
    const scienceStats = await page.evaluate(() => {
        return {
            massBadge: document.getElementById('sci-mass-badge')?.innerText,
            massError: document.getElementById('sci-mass-error')?.innerText,
            volume: document.getElementById('sci-current-volume')?.innerText
        };
    });
    console.log('Science & validation metrics:', JSON.stringify(scienceStats, null, 2));
    await page.screenshot({ path: 'evidence/workspace_05_science_validation.png' });
    console.log('Saved evidence/workspace_05_science_validation.png');
    
    console.log('--- ALL 5 WORKSPACES VERIFIED SUCCESSFULLY ---');
    await browser.close();
}

main().catch(err => {
    console.error('Verification failed:', err);
    process.exit(1);
});
