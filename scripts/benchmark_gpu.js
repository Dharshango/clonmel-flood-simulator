import puppeteer from 'puppeteer-core';

async function testGpuSpeed() {
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
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));
    await page.click('#run-scenario');
    await new Promise(r => setTimeout(r, 2000));

    // Evaluate GPU stepping speed inside the page
    const perf = await page.evaluate(() => {
        const sim = window.simulator;
        if (!sim) return { error: 'No window.simulator' };

        const t0 = performance.now();
        const startSimTime = sim.totalSimTime;
        
        // Run 500 sub-steps
        const dt = 0.15;
        sim.computeMaterial.uniforms.u_dt.value = dt;
        sim.quadMesh.material = sim.computeMaterial;
        
        for (let i = 0; i < 500; i++) {
            sim.computeMaterial.uniforms.u_stateTex.value = sim.readTarget.texture;
            sim.renderer.setRenderTarget(sim.writeTarget);
            sim.renderer.render(sim.scene, sim.camera);
            
            const temp = sim.readTarget;
            sim.readTarget = sim.writeTarget;
            sim.writeTarget = temp;
            sim.totalSimTime += dt;
        }
        sim.renderer.setRenderTarget(null);
        sim.updateReadback();

        const t1 = performance.now();
        return {
            steps: 500,
            elapsedMs: t1 - t0,
            simTimeAdvanced: 500 * dt,
            newSimTime: sim.totalSimTime
        };
    });

    console.log('GPU Benchmark Results:', perf);
    await browser.close();
}

testGpuSpeed().catch(console.error);
