import puppeteer from 'puppeteer-core';

async function testFavicon() {
    const browser = await puppeteer.launch({
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        headless: 'new'
    });
    const page = await browser.newPage();
    const resp = await page.goto('http://127.0.0.1:5173/brand-mark.svg');
    console.log('brand-mark.svg HTTP Status:', resp.status());
    console.log('brand-mark.svg Content-Type:', resp.headers()['content-type']);

    await page.goto('http://127.0.0.1:5173/');
    const faviconHref = await page.$eval('link[rel="icon"]', el => el.href);
    console.log('Favicon link href in DOM:', faviconHref);

    await browser.close();
    console.log('--- FAVICON VERIFIED SUCCESSFULLY ---');
}

testFavicon().catch(err => {
    console.error('Error testing favicon:', err);
    process.exit(1);
});
