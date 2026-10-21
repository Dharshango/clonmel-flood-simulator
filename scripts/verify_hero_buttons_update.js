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
    
    // Check buttons in hero section
    const heroButtons = await page.evaluate(() => {
        const topbarLaunch = document.getElementById('btn-hero-launch');
        const ctaLaunch = document.getElementById('btn-hero-launch-cta');
        const mainBtn = document.getElementById('run-scenario');
        return {
            hasTopbarLaunch: !!topbarLaunch,
            hasCtaLaunch: !!ctaLaunch,
            mainBtnText: mainBtn ? mainBtn.innerText.trim() : null
        };
    });
    console.log('Hero buttons state:', JSON.stringify(heroButtons, null, 2));
    
    // Screenshot hero section
    await page.screenshot({ path: 'evidence/hero_renamed_launch_button.png' });
    console.log('Saved evidence/hero_renamed_launch_button.png');
    
    // Click the renamed Launch 3D Simulation button
    await page.click('#run-scenario');
    await new Promise(r => setTimeout(r, 2000));
    
    // Check if hero is hidden and 3D simulation is active
    const heroHidden = await page.$eval('#hero-section', el => el.classList.contains('hidden'));
    console.log('Hero hidden after clicking renamed Launch 3D Simulation button:', heroHidden);
    
    // Screenshot 3D simulation
    await page.screenshot({ path: 'evidence/simulation_after_hero_launch.png' });
    console.log('Saved evidence/simulation_after_hero_launch.png');
    
    await browser.close();
}

main().catch(console.error);
