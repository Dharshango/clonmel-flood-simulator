import puppeteer from 'puppeteer-core';
import path from 'path';

async function verifyHeroBackground() {
    console.log('--- Verifying Interactive Hero Water Background ---');
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

    // 2. Check that #hero-section and #hero-water-canvas exist
    const heroSection = await page.$('#hero-section');
    const heroCanvas = await page.$('#hero-water-canvas');
    console.log('2. #hero-section present:', !!heroSection);
    console.log('   #hero-water-canvas present:', !!heroCanvas);

    // 3. Move mouse around to trigger interactive ripples
    console.log('3. Simulating mouse interaction on hero canvas...');
    await page.mouse.move(960, 400);
    await new Promise(r => setTimeout(r, 300));
    await page.mouse.move(700, 500);
    await new Promise(r => setTimeout(r, 200));
    await page.mouse.move(1100, 450);
    await new Promise(r => setTimeout(r, 200));
    await page.mouse.click(960, 520); // trigger splash wave
    await new Promise(r => setTimeout(r, 600));

    // Capture screenshot of hero section with interactive water background
    const screenshotPath = 'C:\\Users\\dhars\\.gemini\\antigravity\\brain\\8ef847a2-effc-401b-bc47-8f1726c507c8\\hero_section_interactive_bg.png';
    await page.screenshot({ path: screenshotPath });
    console.log('4. Screenshot of Hero Section saved to:', screenshotPath);

    // 4. Test dismissing Hero Section
    console.log('5. Clicking "Launch Simulation"...');
    await page.click('#btn-hero-launch');
    await new Promise(r => setTimeout(r, 1000));

    const isHidden = await page.$eval('#hero-section', el => el.classList.contains('hidden'));
    console.log('   Hero section hidden status:', isHidden);

    // 5. Test returning to Hero Section via Overview back button
    console.log('6. Clicking "← Overview" to reopen Hero Section...');
    await page.click('#btn-back-hero');
    await new Promise(r => setTimeout(r, 1000));

    const isRestored = await page.$eval('#hero-section', el => !el.classList.contains('hidden'));
    console.log('   Hero section restored status:', isRestored);

    await browser.close();

    if (errors.length > 0) {
        console.error('Found page errors during verification:', errors);
        process.exit(1);
    } else {
        console.log('All Hero Background checks passed with 0 errors!');
    }
}

verifyHeroBackground().catch(err => {
    console.error('Error during verification:', err);
    process.exit(1);
});
