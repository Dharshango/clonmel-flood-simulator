import puppeteer from 'puppeteer-core';
import path from 'path';

const outDir = 'C:/Users/dhars/.gemini/antigravity/brain/8ef847a2-effc-401b-bc47-8f1726c507c8';

async function verify() {
    console.log('=== STARTING HERO LOGO & FAVICON VERIFICATION ===');
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
            '--window-size=1440,900'
        ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    const errors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => {
        errors.push(err.message);
    });

    console.log('1. Navigating to http://127.0.0.1:5173/ ...');
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));

    // 1. Check favicon
    const favicons = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('link[rel*="icon"]'));
        return links.map(l => ({ rel: l.rel, href: l.getAttribute('href') }));
    });
    console.log('Favicon links found:', JSON.stringify(favicons));

    // 2. Check hero brand logo visibility
    const brandInfo = await page.evaluate(() => {
        const brand = document.querySelector('.hero .brand');
        if (!brand) return { exists: false };
        const rect = brand.getBoundingClientRect();
        const style = window.getComputedStyle(brand);
        const mark = brand.querySelector('.brand-mark');
        const text = brand.textContent.trim();
        return {
            exists: true,
            visible: style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0',
            display: style.display,
            rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
            hasMarkSvg: !!mark,
            text: text
        };
    });
    console.log('Hero brand info:', JSON.stringify(brandInfo));

    // Screenshot of Hero Section
    const heroScreenshot = path.join(outDir, 'test_hero_with_hydroverse_logo.png');
    await page.screenshot({ path: heroScreenshot });
    console.log('Hero screenshot saved to:', heroScreenshot);

    // 3. Transition to 3D Simulation
    console.log('2. Entering 3D simulation Studio...');
    const runBtn = await page.$('#run-scenario');
    if (runBtn) {
        await runBtn.click();
        await new Promise(r => setTimeout(r, 2500));
    }

    // Check top-nav branding in Studio (should NOT show ghosted logo)
    const studioNavInfo = await page.evaluate(() => {
        const topNav = document.getElementById('top-nav');
        const brandElements = Array.from(topNav ? topNav.querySelectorAll('.brand, .brand-nav-link, .brand-mark-nav') : []);
        const visibleBrands = brandElements.filter(el => {
            const s = window.getComputedStyle(el);
            return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
        });
        return {
            topNavVisible: !!topNav,
            totalBrandElementsInNav: brandElements.length,
            visibleBrandsInNav: visibleBrands.length
        };
    });
    console.log('Studio top-nav info:', JSON.stringify(studioNavInfo));

    // Screenshot of Studio
    const studioScreenshot = path.join(outDir, 'test_studio_clean_nav.png');
    await page.screenshot({ path: studioScreenshot });
    console.log('Studio screenshot saved to:', studioScreenshot);

    await browser.close();
    console.log('=== VERIFICATION COMPLETE ===');
}

verify().catch(err => {
    console.error('VERIFICATION FAILED:', err);
    process.exit(1);
});
