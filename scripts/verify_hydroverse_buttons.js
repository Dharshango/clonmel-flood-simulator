import puppeteer from 'puppeteer-core';

async function main() {
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
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 2000));
    
    // Check brand title in top nav
    const brandTitle = await page.$eval('.brand-title', el => el.textContent.trim());
    console.log('Brand title in top nav:', brandTitle);
    
    // Launch into 3D simulation
    await page.click('#btn-hero-launch-cta');
    await new Promise(r => setTimeout(r, 2000));
    
    // Inspect button computed styles
    const styles = await page.evaluate(() => {
        const btn = document.querySelector('.scenario-btn');
        const cs = window.getComputedStyle(btn);
        const panel = document.querySelector('.clean-panel');
        const pcs = window.getComputedStyle(panel);
        return {
            btnBg: cs.backgroundColor,
            btnRadius: cs.borderRadius,
            btnBackdrop: cs.backdropFilter,
            panelBg: pcs.backgroundColor
        };
    });
    console.log('Computed styles:', JSON.stringify(styles, null, 2));
    
    await page.screenshot({ path: 'evidence/hydroverse_partial_glass_verified.png' });
    console.log('Screenshot saved to evidence/hydroverse_partial_glass_verified.png');
    await browser.close();
}

main().catch(console.error);
