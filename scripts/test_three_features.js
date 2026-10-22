import puppeteer from 'puppeteer-core';
import path from 'path';

const outDir = 'C:/Users/dhars/.gemini/antigravity/brain/8ef847a2-effc-401b-bc47-8f1726c507c8';

async function run() {
    console.log('Launching browser to test the 3 decision support features & responsive timeline...');
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
    await page.setViewport({ width: 1440, height: 900 });

    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    page.on('pageerror', err => console.error('BROWSER ERROR:', err.message));

    console.log('Navigating to http://127.0.0.1:5173/ ...');
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2500));

    // 1. Dismiss hero overlay if present
    const runBtn = await page.$('#run-scenario');
    if (runBtn) {
        console.log('Clicking run-scenario to enter 3D simulation...');
        await runBtn.click();
        await new Promise(r => setTimeout(r, 1500));
    }

    // 2. Test Feature 1: Critical Infrastructure Dependency Map
    console.log('Testing Feature 1: Critical Infrastructure Dependency Map...');
    await page.click('#tab-impact');
    await new Promise(r => setTimeout(r, 1500));

    // Verify infrastructure elements rendered
    const facCount = await page.$$eval('.infra-facility-item', els => els.length);
    console.log(`Rendered infrastructure facilities count: ${facCount}`);

    // Click Healthcare filter
    await page.click('.infra-chip[data-filter="healthcare"]');
    await new Promise(r => setTimeout(r, 500));
    const healthCount = await page.$$eval('.infra-facility-item', els => els.length);
    console.log(`Filtered healthcare facilities count: ${healthCount}`);

    // Click "All" filter and select STGH Hospital
    await page.click('.infra-chip[data-filter="all"]');
    await new Promise(r => setTimeout(r, 500));
    await page.click('.infra-facility-item[data-fac-id="stgh-hospital"]');
    await new Promise(r => setTimeout(r, 500));

    await page.screenshot({ path: path.join(outDir, 'test_feature1_infrastructure_map.png') });
    console.log('Saved test_feature1_infrastructure_map.png');

    // 3. Test Feature 2: Community Flood Evidence Network
    console.log('Testing Feature 2: Community Flood Evidence Network...');
    await page.click('#tab-evidence');
    await new Promise(r => setTimeout(r, 1500));

    const evidenceCount = await page.$$eval('.evidence-report-item', els => els.length);
    console.log(`Rendered community evidence observations count: ${evidenceCount}`);

    // Test submission modal
    await page.click('#btn-open-submit-evidence');
    await new Promise(r => setTimeout(r, 500));
    const modalVisible = await page.$eval('#evidence-submit-modal', m => m.open);
    console.log(`Evidence submission modal opened: ${modalVisible}`);

    // Fill and submit form
    await page.type('#obs-title', 'Wolfe Tone Street High Water Mark');
    await page.type('#obs-desc', 'Wrack line observed on granite step outside community centre.');
    await page.click('#evidence-submit-modal button[type="submit"]');
    await new Promise(r => setTimeout(r, 1000));

    const updatedEvidenceCount = await page.$$eval('.evidence-report-item', els => els.length);
    console.log(`Updated evidence count after submission: ${updatedEvidenceCount}`);

    await page.screenshot({ path: path.join(outDir, 'test_feature2_community_evidence.png') });
    console.log('Saved test_feature2_community_evidence.png');

    // 4. Test Feature 3: Interactive Emergency Command Exercise
    console.log('Testing Feature 3: Interactive Emergency Command Exercise...');
    await page.click('#tab-exercise');
    await new Promise(r => setTimeout(r, 1500));

    const phaseTitle = await page.$eval('#exercise-phase-title', el => el.textContent);
    const initialCrews = await page.$eval('#res-crews', el => el.textContent);
    console.log(`Exercise phase: ${phaseTitle}, Initial Barrier Crews: ${initialCrews}`);

    // Execute tactical action
    const actionBtn = await page.$('.btn-execute-action');
    if (actionBtn) {
        await actionBtn.click();
        await new Promise(r => setTimeout(r, 1000));
        const postActionCrews = await page.$eval('#res-crews', el => el.textContent);
        const ledgerCount = await page.$eval('#exercise-ledger-count', el => el.textContent);
        console.log(`Post-action Barrier Crews: ${postActionCrews}, Incident log count: ${ledgerCount}`);
    }

    // Advance to Phase 2
    await page.click('#btn-exercise-advance');
    await new Promise(r => setTimeout(r, 1000));
    const phase2Title = await page.$eval('#exercise-phase-title', el => el.textContent);
    console.log(`Advanced to: ${phase2Title}`);

    await page.screenshot({ path: path.join(outDir, 'test_feature3_command_exercise.png') });
    console.log('Saved test_feature3_command_exercise.png');

    // 5. Test Bottom Play Bar Responsiveness & Bidirectional Scrubbing
    console.log('Testing Bottom Play Bar Bidirectional Scrubbing & Step Buttons...');
    
    // Step forward +10m twice
    await page.click('#btn-step-fwd');
    await new Promise(r => setTimeout(r, 500));
    await page.click('#btn-step-fwd');
    await new Promise(r => setTimeout(r, 500));
    let timeText = await page.$eval('#flood-clock-text', el => el.textContent);
    console.log(`Clock after +20m step: ${timeText}`);

    // Step back -10m
    await page.click('#btn-step-back');
    await new Promise(r => setTimeout(r, 500));
    timeText = await page.$eval('#flood-clock-text', el => el.textContent);
    console.log(`Clock after -10m step: ${timeText}`);

    // Scrub forward to 03:00 (10800s)
    await page.$eval('#timeline-scrubber', el => {
        el.value = 10800;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await new Promise(r => setTimeout(r, 1000));
    let timeAt3h = await page.$eval('#flood-clock-text', el => el.textContent);
    console.log(`Clock after scrubbing forward to 03:00: ${timeAt3h}`);

    // Scrub backward to 01:15 (4500s)
    await page.$eval('#timeline-scrubber', el => {
        el.value = 4500;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await new Promise(r => setTimeout(r, 1000));
    let timeAt1h15 = await page.$eval('#flood-clock-text', el => el.textContent);
    console.log(`Clock after scrubbing backward to 01:15: ${timeAt1h15}`);

    await page.screenshot({ path: path.join(outDir, 'test_scrubber_bidirectional_valid.png') });
    console.log('Saved test_scrubber_bidirectional_valid.png');

    await browser.close();
    console.log('All tests completed successfully!');
}

run().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
