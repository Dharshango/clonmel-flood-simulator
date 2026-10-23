import puppeteer from 'puppeteer-core';

async function run() {
    const browser = await puppeteer.launch({
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        headless: 'new'
    });
    const page = await browser.newPage();
    page.on('pageerror', err => console.log('ERROR TRACE:', err.message, 'LOCATION:', err.stack));
    await page.goto('http://127.0.0.1:5173/');
    await new Promise(r => setTimeout(r, 2000));
    const btn = await page.$('#run-scenario');
    if (btn) await btn.click();
    await new Promise(r => setTimeout(r, 2000));
    await page.click('#tab-intervention');
    await new Promise(r => setTimeout(r, 1000));
    await browser.close();
}
run();
