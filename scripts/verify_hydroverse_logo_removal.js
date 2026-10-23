import puppeteer from 'puppeteer-core';
import path from 'path';

const outDir = 'C:/Users/dhars/.gemini/antigravity/brain/8ef847a2-effc-401b-bc47-8f1726c507c8';

(async () => {
    console.log('Testing Hydroverse logo complete removal in Studio page...');
    const browser = await puppeteer.launch({
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--enable-webgl',
            '--window-size=1560,960'
        ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1560, height: 960 });

    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));

    // Launch simulation
    const runBtn = await page.$('#run-scenario');
    if (runBtn) {
        await runBtn.click();
        await new Promise(r => setTimeout(r, 2000));
    }

    // Inspect if any brand mark or hydroverse elements exist or are visible
    const audit = await page.evaluate(() => {
        const brands = Array.from(document.querySelectorAll('.brand, .brand-mark, .brand-light, .brand-nav-link, .brand-mark-nav'));
        const allText = document.body.innerText;
        const brandMarkPath = document.querySelector('path[d*="M20 4.8"]');
        const hero = document.getElementById('hero-section');
        const topNav = document.getElementById('top-nav');
        
        return {
            brandElementsCount: brands.length,
            brandMarkSvgExists: !!brandMarkPath,
            heroDisplay: hero ? window.getComputedStyle(hero).display : null,
            heroVisibility: hero ? window.getComputedStyle(hero).visibility : null,
            topNavVisible: !!topNav,
            topNavPosition: topNav ? topNav.getBoundingClientRect().toJSON() : null
        };
    });

    console.log('Audit Results:', JSON.stringify(audit, null, 2));

    // Capture screenshot of the top navigation bar and the area behind it
    const shotPath = path.join(outDir, 'test_top_nav_no_hydroverse_logo.png');
    await page.screenshot({
        path: shotPath,
        clip: { x: 0, y: 0, width: 1560, height: 160 }
    });
    console.log('Saved top-nav screenshot to:', shotPath);

    // Also capture full view of the studio model generation to confirm pristine visual state
    const fullShotPath = path.join(outDir, 'test_studio_full_no_ghost_logo.png');
    await page.screenshot({ path: fullShotPath });
    console.log('Saved full studio screenshot to:', fullShotPath);

    await browser.close();
})();
