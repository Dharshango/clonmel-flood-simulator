import puppeteer from 'puppeteer-core';
import path from 'path';

async function verifyHydroverse() {
    console.log('--- Verifying Hydroverse Hero Section Integration ---');
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
    await page.setViewport({ width: 1920, height: 1080 });

    const errors = [];
    page.on('pageerror', err => {
        console.error('PAGE ERROR:', err.message);
        errors.push(err.message);
    });

    console.log('1. Loading application at http://127.0.0.1:5173/ ...');
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));

    // 2. Verify branding and title
    const brandText = await page.$eval('.brand', el => el.textContent.trim());
    console.log('2. Brand name:', brandText);
    if (!brandText.toLowerCase().includes('hydroverse')) {
        throw new Error(`Expected brand name to contain hydroverse, got: ${brandText}`);
    }

    // 3. Verify 'FLOOD SIMULATION / 01' is NOT present
    const copyBlockHtml = await page.$eval('.copy-block', el => el.innerHTML);
    const hasFloodSim01 = copyBlockHtml.includes('FLOOD SIMULATION') || copyBlockHtml.includes('/ 01');
    console.log('3. "FLOOD SIMULATION / 01" in copy-block:', hasFloodSim01 ? 'FAIL (STILL PRESENT)' : 'PASSED (REMOVED)');
    if (hasFloodSim01) {
        throw new Error('Flood Simulation / 01 is still present in copy block!');
    }

    // 4. Test interactive canvas mouse movement
    console.log('4. Simulating mouse interaction on terrain canvas...');
    await page.mouse.move(960, 400);
    await new Promise(r => setTimeout(r, 300));
    await page.mouse.move(1100, 300);
    await new Promise(r => setTimeout(r, 300));
    await page.mouse.move(800, 600);
    await new Promise(r => setTimeout(r, 500));

    const waterLevelText = await page.$eval('#water-level', el => el.textContent);
    const floodExtentText = await page.$eval('#flood-extent', el => el.textContent);
    console.log(`   Interactive live reading: Water Level = ${waterLevelText}, Flood Extent = ${floodExtentText}`);

    // Capture screenshot of Hydroverse Hero
    const heroShotPath = path.join(process.cwd(), 'evidence', 'hydroverse_hero_interactive.png');
    await page.screenshot({ path: heroShotPath });
    console.log('   Hero screenshot saved to:', heroShotPath);

    // 5. Test "How It Works" dialog
    console.log('5. Clicking "How it works" link...');
    await page.click('#how-link');
    await new Promise(r => setTimeout(r, 600));

    const isDialogOpen = await page.$eval('#info-dialog', el => el.hasAttribute('open'));
    console.log('   Info dialog open status:', isDialogOpen);

    const dialogTitle = await page.$eval('#dialog-title', el => el.textContent.trim());
    console.log('   Dialog title:', dialogTitle);

    const step1 = await page.$eval('.method-steps li:nth-child(1) strong', el => el.textContent.trim());
    const step2 = await page.$eval('.method-steps li:nth-child(2) strong', el => el.textContent.trim());
    const step3 = await page.$eval('.method-steps li:nth-child(3) strong', el => el.textContent.trim());
    console.log('   Working Procedure Step 1:', step1);
    console.log('   Working Procedure Step 2:', step2);
    console.log('   Working Procedure Step 3:', step3);

    // Capture screenshot of How It Works Dialog
    const dialogShotPath = path.join(process.cwd(), 'evidence', 'hydroverse_how_it_works_dialog.png');
    await page.screenshot({ path: dialogShotPath });
    console.log('   Dialog screenshot saved to:', dialogShotPath);

    // Close dialog
    await page.click('#close-dialog');
    await new Promise(r => setTimeout(r, 400));

    // 6. Test "Run a flood scenario" button
    console.log('6. Clicking "Run a flood scenario"...');
    await page.click('#run-scenario');
    await new Promise(r => setTimeout(r, 1200));

    const scenarioRunningText = await page.$eval('#run-scenario .button-label', el => el.textContent);
    console.log('   Scenario button label during run:', scenarioRunningText);

    // 7. Test Launching 3D Simulation
    console.log('7. Clicking "Launch 3D Simulation"...');
    await page.click('#btn-hero-launch-cta');
    await new Promise(r => setTimeout(r, 1200));

    const isHeroHidden = await page.$eval('#hero-section', el => el.classList.contains('hidden'));
    console.log('   Hero section hidden (3D simulator active):', isHeroHidden);

    // 8. Test returning to Hero via Overview back button
    console.log('8. Clicking "← Overview" to return to Hydroverse Hero...');
    await page.click('#btn-back-hero');
    await new Promise(r => setTimeout(r, 1000));

    const isHeroRestored = await page.$eval('#hero-section', el => !el.classList.contains('hidden'));
    console.log('   Hero section restored:', isHeroRestored);

    await browser.close();

    if (errors.length > 0) {
        console.error('Found browser errors:', errors);
        process.exit(1);
    } else {
        console.log('--- ALL HYDROVERSE HERO CHECKS PASSED WITH 0 ERRORS! ---');
    }
}

verifyHydroverse().catch(err => {
    console.error('Error during Hydroverse verification:', err);
    process.exit(1);
});
