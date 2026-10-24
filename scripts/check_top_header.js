import puppeteer from 'puppeteer-core';

(async () => {
    const browser = await puppeteer.launch({
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        headless: 'new',
        args: ['--no-sandbox', '--window-size=1560,960']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1560, height: 960 });
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 2000));
    const runBtn = await page.$('#run-scenario');
    if (runBtn) await runBtn.click();
    await new Promise(r => setTimeout(r, 1000));

    const info = await page.evaluate(() => {
        const topNav = document.getElementById('top-nav');
        const hero = document.getElementById('hero-section');
        const brand = document.querySelector('.brand');
        const brandMark = document.querySelector('.brand-mark');
        return {
            heroClasses: hero ? hero.className : null,
            heroDisplay: hero ? window.getComputedStyle(hero).display : null,
            heroVisibility: hero ? window.getComputedStyle(hero).visibility : null,
            heroOpacity: hero ? window.getComputedStyle(hero).opacity : null,
            brandDisplay: brand ? window.getComputedStyle(brand).display : null,
            brandVisibility: brand ? window.getComputedStyle(brand).visibility : null,
            brandOpacity: brand ? window.getComputedStyle(brand).opacity : null,
            brandRect: brand ? brand.getBoundingClientRect().toJSON() : null,
            topNavRect: topNav ? topNav.getBoundingClientRect().toJSON() : null
        };
    });
    console.log(JSON.stringify(info, null, 2));
    await page.screenshot({ path: 'C:/Users/dhars/.gemini/antigravity/brain/8ef847a2-effc-401b-bc47-8f1726c507c8/test_header_before_fix.png', clip: { x: 0, y: 0, width: 1560, height: 120 } });
    await browser.close();
})();
