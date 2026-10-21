import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.join(__dirname, '..');
const indexPath = path.join(rootDir, 'index.html');
const cssPath = path.join(rootDir, 'src', 'style.css');
const mainPath = path.join(rootDir, 'src', 'main.js');

// 1. Update index.html
let html = fs.readFileSync(indexPath, 'utf8');

// Update Title and Favicon
html = html.replace(/<title>[\s\S]*?<\/title>/, '<title>Hydroverse — See the flood before it flows</title>');
if (!html.includes('href="/brand-mark.svg"')) {
    html = html.replace(
        '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />',
        '<link rel="icon" type="image/svg+xml" href="/brand-mark.svg" />'
    );
}

// Add DM Mono / DM Sans Google Fonts if not present
if (!html.includes('family=DM+Mono')) {
    html = html.replace(
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
        `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">`
    );
}

// Replace the Hero Section block
const heroHtml = `        <!-- Separate Hero Section (Hydroverse Interactive Terrain & Flood Model) -->
        <section id="hero-section" class="hero-overlay hero" id="home" aria-label="Hydroverse flood simulation">
            <canvas class="terrain" id="terrain" aria-hidden="true"></canvas>
            <div class="hero-wash" aria-hidden="true"></div>
            <div class="grain" aria-hidden="true"></div>

            <header class="topbar">
                <a class="brand" href="#home" aria-label="Hydroverse home">
                    <svg class="brand-mark" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                        <path d="M20 4.8C20 4.8 8.5 17.2 8.5 24.5a11.5 11.5 0 0 0 23 0C31.5 17.2 20 4.8 20 4.8Z" stroke="currentColor" stroke-width="1.5" />
                        <path d="M13.3 25.7c2.6 2.2 5.4 3.3 8.1 3.1 2-.2 3.8-.9 5.4-2.2M15.8 19.8c1.4.7 2.8 1 4.3 1 1.5-.1 3-.5 4.4-1.3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
                    </svg>
                    <span>hydro<span class="brand-light">verse</span></span>
                </a>
                <div class="topbar-right">
                    <a class="nav-link" href="#how-it-works" id="how-link">How it works <span aria-hidden="true">↗</span></a>
                    <button id="btn-hero-launch" class="nav-link launch-btn" type="button" title="Launch 3D Flood Simulator">Launch 3D Simulation <span aria-hidden="true">↗</span></button>
                    <div class="live-state"><span class="live-dot"></span><span>MODEL ONLINE</span></div>
                </div>
            </header>

            <section class="hero-content" aria-labelledby="hero-title">
                <div class="copy-block">
                    <h1 id="hero-title">See the flood<br />before it <em>flows.</em></h1>
                    <p class="intro">Explore how water moves through terrain. Trace flood paths, test rising levels, and see what needs protecting — before the next storm.</p>
                    <div class="actions">
                        <button class="primary-button" id="run-scenario" type="button">
                            <span class="button-icon" aria-hidden="true"><svg viewBox="0 0 16 16" fill="none"><path d="M5.2 3.6v8.8L12.1 8 5.2 3.6Z" fill="currentColor" /></svg></span>
                            <span class="button-label">Run a flood scenario</span>
                            <span class="button-arrow" aria-hidden="true">↗</span>
                        </button>
                        <button class="primary-button cta-3d" id="btn-hero-launch-cta" type="button">
                            <span class="button-icon" aria-hidden="true"><svg viewBox="0 0 16 16" fill="none"><path d="M2.5 8h11M9 3.5l4.5 4.5-4.5 4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
                            <span class="button-label">Launch 3D Simulation</span>
                            <span class="button-arrow" aria-hidden="true">↗</span>
                        </button>
                        <span class="action-note">A clearer view of what comes next.</span>
                    </div>
                </div>
            </section>

            <div class="map-label map-label-top"><span class="map-crosshair" aria-hidden="true">+</span><span>LOWLAND BASIN · SECTOR 04</span></div>
            <div class="map-label map-label-side"><span>▲</span> UPSTREAM <span class="side-rule"></span></div>

            <div class="simulation-readout" aria-label="Live simulation readings">
                <div class="readout-top"><span>WATER LEVEL</span><span class="readout-live"><span class="live-dot"></span> LIVE</span></div>
                <div class="level-value"><span id="water-level">+0.72</span><span class="unit">m</span></div>
                <div class="readout-divider"></div>
                <div class="extent-row"><span>EST. FLOOD EXTENT</span><strong id="flood-extent">18%</strong></div>
                <div class="readout-meter"><span id="extent-meter"></span></div>
            </div>

            <div class="interaction-hint"><span class="hint-pointer" aria-hidden="true">⌖</span><span>Move to raise the waterline</span></div>
            <footer class="hero-footer">
                <span>WATER FINDS ITS WAY.</span>
                <span class="footer-center"><span class="footer-dot"></span> TERRAIN MODEL <span class="footer-sep">/</span> INTERACTIVE</span>
                <span class="coordinates" id="coordinates">52°21′ N &nbsp; 7°42′ W</span>
            </footer>

            <dialog class="info-dialog" id="info-dialog" aria-labelledby="dialog-title">
                <button class="dialog-close" id="close-dialog" type="button" aria-label="Close">×</button>
                <div class="eyebrow"><span class="eyebrow-line"></span> HOW HYDROVERSE WORKS</div>
                <h2 id="dialog-title">Real-time 3D<br />hydrodynamic <em>simulation.</em></h2>
                <ol class="method-steps">
                    <li>
                        <span>01</span>
                        <div>
                            <strong>Map the ground & riverbed</strong>
                            <p>6,638 OpenStreetMap building footprints aligned with real AWS terrain DEM and River Suir bathymetry.</p>
                        </div>
                    </li>
                    <li>
                        <span>02</span>
                        <div>
                            <strong>Solve 2D Shallow Water Equations</strong>
                            <p>Kurganov-Petrova hydrodynamic solver computed in real-time on WebGL2 framebuffers with strict mass conservation.</p>
                        </div>
                    </li>
                    <li>
                        <span>03</span>
                        <div>
                            <strong>Simulate & deploy defenses</strong>
                            <p>Draw 2.8m quay walls or sandbag lines live, evaluate building danger levels (Yellow/Red), and compare protected vs baseline flood telemetry side-by-side.</p>
                        </div>
                    </li>
                </ol>
            </dialog>
        </section>`;

const heroSectionRegex = /<!-- Separate Hero Section[\s\S]*?<\/section>/;
if (heroSectionRegex.test(html)) {
    html = html.replace(heroSectionRegex, heroHtml);
    fs.writeFileSync(indexPath, html, 'utf8');
    console.log('Successfully updated index.html with Hydroverse Hero markup');
} else {
    console.error('Could not find hero section in index.html');
}

// 2. Update src/style.css
let css = fs.readFileSync(cssPath, 'utf8');

const heroCssBlock = `/* ==================== HYDROVERSE INTERACTIVE HERO SECTION ==================== */
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&display=swap');

:root {
  --ink: #071b24;
  --ink-soft: #0a2731;
  --text: #edf5f2;
  --muted: #a4bab9;
  --muted-dim: #708d90;
  --aqua: #7de2d2;
  --aqua-bright: #a0f0df;
  --line: rgba(200, 234, 227, .15);
  --mono: 'DM Mono', 'SFMono-Regular', Consolas, monospace;
  --sans: 'DM Sans', 'Segoe UI', sans-serif;
}

.hero {
  isolation: isolate;
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  z-index: 2000;
  overflow: hidden;
  background: radial-gradient(ellipse at 79% 41%, #103640 0%, #0b2933 36%, var(--ink) 79%);
  transition: opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.5s cubic-bezier(0.16, 1, 0.3, 1);
  font-family: var(--sans);
  color: var(--text);
}

.hero.hidden {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}

.terrain, .hero-wash, .grain { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.terrain { z-index: 0; opacity: .9; }
.hero-wash {
  z-index: 1;
  background:
    linear-gradient(90deg, rgba(7,27,36,.98) 0%, rgba(7,27,36,.92) 25%, rgba(7,27,36,.49) 52%, rgba(7,27,36,.08) 100%),
    linear-gradient(0deg, rgba(5,22,29,.78) 0%, transparent 19%, transparent 76%, rgba(5,22,29,.28) 100%);
}
.grain { z-index: 2; opacity: .12; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.82' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.23'/%3E%3C/svg%3E"); mix-blend-mode: soft-light; }
.hero > .topbar, .hero > .hero-content, .hero > .map-label, .hero > .simulation-readout, .hero > .interaction-hint, .hero > .hero-footer { z-index: 3; }
.hero > .info-dialog { z-index: 4; }

.topbar { position: absolute; top: 0; left: 0; right: 0; height: 92px; padding: 0 clamp(28px, 6.2vw, 100px); display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(220,244,239,.09); animation: fade-down .8s .08s both; }
.brand { display: inline-flex; align-items: center; gap: 10px; color: var(--text); text-decoration: none; font-size: 17px; font-weight: 600; letter-spacing: -.055em; }
.brand-mark { width: 34px; height: 34px; color: var(--aqua); }
.brand-light { color: #91aaa9; font-weight: 400; }
.topbar-right { display: flex; align-items: center; gap: clamp(20px, 3.5vw, 50px); }
.nav-link { color: #b6cac7; text-decoration: none; font-size: 13px; transition: color .2s ease; background: transparent; border: none; cursor: pointer; display: inline-flex; align-items: center; }
.nav-link:hover { color: var(--aqua-bright); }
.nav-link span { color: var(--aqua); padding-left: 4px; }
.launch-btn { font-family: var(--sans); }
.live-state, .readout-live { display: flex; align-items: center; gap: 8px; font: 10px var(--mono); letter-spacing: .11em; color: #bed4d0; }
.live-dot, .footer-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--aqua); box-shadow: 0 0 12px rgba(125,226,210,.72); }

.hero-content { position: absolute; inset: 0; display: flex; align-items: center; padding: 58px clamp(28px, 12.6vw, 205px) 72px; pointer-events: none; }
.copy-block { width: min(570px, 53vw); pointer-events: auto; animation: rise-in .9s .16s cubic-bezier(.2,.8,.2,1) both; }
.eyebrow { display: flex; align-items: center; gap: 11px; color: var(--aqua); font: 10px var(--mono); letter-spacing: .17em; }
.eyebrow-line { display: inline-block; width: 23px; height: 1px; background: currentColor; opacity: .8; }
.eyebrow-index { color: #7c9695; margin-left: -6px; }
.hero h1 { margin: 25px 0 22px; font-size: clamp(56px, 6.3vw, 89px); line-height: .99; font-weight: 500; letter-spacing: -.075em; color: var(--text); }
.hero h1 em, .info-dialog h2 em { color: var(--aqua); font-family: Georgia, 'Times New Roman', serif; font-weight: 400; letter-spacing: -.08em; }
.intro { width: min(420px, 100%); margin: 0; color: #afc1bf; font-size: 15px; line-height: 1.78; font-weight: 400; }
.actions { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-top: 34px; }
.primary-button { display: inline-flex; align-items: center; gap: 11px; height: 51px; padding: 0 17px; border: 1px solid rgba(157,239,223,.48); border-radius: 4px; background: rgba(124,226,210,.11); color: #e6fbf5; cursor: pointer; transition: background .22s ease, border-color .22s ease, transform .22s ease; }
.primary-button:hover { transform: translateY(-2px); border-color: var(--aqua); background: rgba(124,226,210,.19); }
.primary-button:active { transform: translateY(0); }
.primary-button.cta-3d { background: rgba(14, 165, 233, 0.22); border-color: rgba(125, 226, 210, 0.55); }
.primary-button.cta-3d:hover { background: rgba(14, 165, 233, 0.35); border-color: var(--aqua-bright); }
.button-icon { display: grid; place-items: center; width: 19px; height: 19px; border: 1px solid rgba(160,240,223,.55); border-radius: 50%; color: var(--aqua-bright); }
.button-icon svg { width: 10px; height: 10px; }
.button-label { font-size: 12px; font-weight: 600; letter-spacing: .01em; }
.button-arrow { padding-left: 9px; color: var(--aqua); font-size: 14px; }
.action-note { color: #81999a; font: 10px var(--mono); letter-spacing: .02em; }

.map-label { position: absolute; color: rgba(185,216,211,.58); font: 9px var(--mono); letter-spacing: .14em; animation: fade-in 1.2s .75s both; pointer-events: none; }
.map-label-top { top: 19%; right: 14.2%; display: flex; gap: 9px; align-items: center; }
.map-crosshair { color: var(--aqua); font-size: 17px; font-weight: 400; }
.map-label-side { right: 5.5%; top: 49%; display: flex; gap: 8px; align-items: center; writing-mode: vertical-rl; }
.map-label-side > span:first-child { color: var(--aqua); font-size: 9px; }
.side-rule { width: 1px; height: 39px; background: linear-gradient(var(--aqua), transparent); }

.simulation-readout { position: absolute; right: clamp(28px, 8.4vw, 138px); bottom: 18%; width: 224px; padding: 18px 19px 17px; border: 1px solid rgba(190,229,221,.17); border-radius: 5px; background: linear-gradient(145deg, rgba(13,45,54,.77), rgba(7,29,37,.66)); box-shadow: 0 14px 45px rgba(0,8,12,.12); backdrop-filter: blur(16px); animation: rise-in .9s .45s both; }
.readout-top, .extent-row { display: flex; align-items: center; justify-content: space-between; }
.readout-top { color: #91aaa8; font: 9px var(--mono); letter-spacing: .13em; }
.readout-live { gap: 6px; color: var(--aqua); font-size: 8px; }
.readout-live .live-dot { width: 5px; height: 5px; }
.level-value { margin: 13px 0 14px; font-size: 34px; font-weight: 500; letter-spacing: -.065em; font-family: var(--sans); color: var(--text); }
.unit { padding-left: 4px; color: #91aaa8; font: 13px var(--mono); letter-spacing: 0; }
.readout-divider { height: 1px; background: rgba(206,234,228,.13); margin-bottom: 12px; }
.extent-row { color: #91aaa8; font: 8px var(--mono); letter-spacing: .08em; }
.extent-row strong { color: #d6e9e4; font-size: 10px; font-weight: 400; }
.readout-meter { height: 2px; margin-top: 9px; background: rgba(211,239,234,.12); overflow: hidden; }
.readout-meter span { display: block; width: 18%; height: 100%; background: var(--aqua); transition: width .4s ease; box-shadow: 0 0 9px var(--aqua); }

.interaction-hint { position: absolute; right: clamp(28px, 8.4vw, 138px); bottom: calc(18% - 31px); display: flex; align-items: center; gap: 7px; color: rgba(179,211,206,.58); font: 9px var(--mono); letter-spacing: .035em; animation: fade-in 1.2s 1s both; pointer-events: none; }
.hint-pointer { color: var(--aqua); font-size: 15px; }
.hero-footer { position: absolute; right: clamp(28px, 6.2vw, 100px); bottom: 0; left: clamp(28px, 6.2vw, 100px); height: 61px; border-top: 1px solid rgba(220,244,239,.1); display: flex; align-items: center; justify-content: space-between; color: #82999a; font: 8px var(--mono); letter-spacing: .12em; }
.footer-center { display: flex; align-items: center; gap: 9px; color: #99afad; }
.footer-dot { width: 5px; height: 5px; }
.footer-sep { color: #49666a; }
.coordinates { color: #758e90; }

.info-dialog { position: fixed; inset: 0; width: min(480px, calc(100% - 32px)); max-width: none; margin: auto; padding: 43px 42px 38px; border: 1px solid rgba(185,229,220,.2); border-radius: 6px; background: #0a2731; color: var(--text); box-shadow: 0 24px 100px rgba(0,0,0,.42); z-index: 2500; }
.info-dialog::backdrop { background: rgba(3,14,19,.7); backdrop-filter: blur(7px); }
.info-dialog[open] { animation: dialog-in .28s ease-out both; }
.dialog-close { position: absolute; top: 14px; right: 17px; padding: 2px 6px; border: 0; background: transparent; color: #91aaa8; font-size: 23px; cursor: pointer; }
.info-dialog h2 { margin: 19px 0 28px; font-size: 39px; line-height: 1.04; font-weight: 500; letter-spacing: -.06em; color: var(--text); }
.method-steps { display: grid; gap: 21px; list-style: none; padding: 0; margin: 0; }
.method-steps li { display: grid; grid-template-columns: 30px 1fr; gap: 10px; }
.method-steps li > span { color: var(--aqua); font: 10px var(--mono); padding-top: 3px; }
.method-steps strong { font-size: 13px; font-weight: 600; color: #ffffff; }
.method-steps p { margin: 5px 0 0; color: #9fb5b3; font-size: 12px; line-height: 1.6; }

@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes fade-down { from { opacity: 0; transform: translateY(-9px); } to { opacity: 1; transform: translateY(0); } }
@keyframes rise-in { from { opacity: 0; transform: translateY(17px); } to { opacity: 1; transform: translateY(0); } }
@keyframes dialog-in { from { opacity: 0; transform: translateY(8px) scale(.99); } to { opacity: 1; transform: translateY(0) scale(1); } }

@media (max-width: 900px) {
  .hero-content { padding-left: 8vw; padding-right: 8vw; }
  .copy-block { width: min(530px, 63vw); }
  .simulation-readout { right: 7vw; bottom: 16%; width: 205px; }
  .interaction-hint { right: 7vw; bottom: calc(16% - 29px); }
  .map-label-top { right: 10%; }
  .hero-wash { background: linear-gradient(90deg, rgba(7,27,36,.97) 0%, rgba(7,27,36,.84) 40%, rgba(7,27,36,.25) 100%), linear-gradient(0deg, rgba(5,22,29,.78), transparent 25%, transparent 72%, rgba(5,22,29,.28)); }
}
@media (max-width: 640px) {
  .topbar { height: 75px; padding: 0 23px; }
  .brand { font-size: 16px; }
  .brand-mark { width: 31px; height: 31px; }
  .topbar-right { gap: 14px; }
  .nav-link { font-size: 11px; }
  .live-state { font-size: 0; gap: 0; }
  .live-state .live-dot { width: 7px; height: 7px; }
  .hero-content { align-items: flex-start; padding: 0 27px; }
  .copy-block { width: 100%; margin-top: clamp(165px, 23vh, 220px); }
  .hero h1 { font-size: clamp(53px, 13vw, 69px); margin: 22px 0 17px; }
  .intro { max-width: 370px; font-size: 13px; line-height: 1.7; }
  .actions { margin-top: 25px; gap: 11px; }
  .primary-button { height: 48px; padding: 0 13px; gap: 8px; }
  .button-label { font-size: 11px; }
  .action-note { display: none; }
  .simulation-readout { right: 24px; bottom: 102px; width: 184px; padding: 14px 15px 13px; }
  .level-value { margin: 9px 0 11px; font-size: 29px; }
  .interaction-hint { right: auto; left: 25px; bottom: 137px; font-size: 8px; }
  .map-label-top { top: auto; right: 25px; bottom: 310px; font-size: 7px; }
  .map-label-side { display: none; }
  .hero-wash { background: linear-gradient(180deg, rgba(7,27,36,.37) 0%, rgba(7,27,36,.65) 32%, rgba(7,27,36,.43) 63%, rgba(5,22,29,.93) 86%), linear-gradient(90deg, rgba(7,27,36,.77), rgba(7,27,36,.1)); }
  .hero-footer { left: 23px; right: 23px; height: 51px; font-size: 7px; }
  .footer-center { gap: 6px; font-size: 7px; }
  .coordinates { display: none; }
  .info-dialog { padding: 38px 25px 28px; }
  .info-dialog h2 { font-size: 35px; }
}
@media (max-width: 380px) {
  .topbar { padding: 0 18px; }
  .topbar-right { gap: 10px; }
  .hero-content { padding: 0 21px; }
  .hero h1 { font-size: 51px; }
  .intro { font-size: 12px; }
  .hero-footer { left: 18px; right: 18px; }
  .footer-center { letter-spacing: .06em; }
}
`;

const cssHeroRegex = /\/\* ==================== SEPARATE HERO SECTION ==================== \*\/[\s\S]*?(?=\/\* ==================== FLOATING TOP NAVIGATION OVERLAY ==================== \*\/)/;
if (cssHeroRegex.test(css)) {
    css = css.replace(cssHeroRegex, heroCssBlock + '\n\n');
    fs.writeFileSync(cssPath, css, 'utf8');
    console.log('Successfully updated src/style.css with Hydroverse Hero styling');
} else {
    console.error('Could not find hero CSS block in src/style.css');
}

// 3. Update src/main.js
let main = fs.readFileSync(mainPath, 'utf8');

main = main.replace(
    /import { initHeroBackground } from '\.\/ui\/hero_background\.js';/,
    "import { initHydroverseHero } from './ui/hydroverse_hero.js';"
);

main = main.replace(
    /const heroBg = initHeroBackground\(\);/,
    "const heroBg = initHydroverseHero();"
);

// Connect both btn-hero-launch and btn-hero-launch-cta
const launchLogicOld = `    if (btnHeroLaunch && heroSection) {
        btnHeroLaunch.addEventListener('click', () => {
            heroSection.classList.add('hidden');
        });
    }`;

const launchLogicNew = `    const btnHeroLaunchCta = document.getElementById('btn-hero-launch-cta');
    const launchSimulation = () => {
        if (heroSection) heroSection.classList.add('hidden');
    };
    if (btnHeroLaunch) btnHeroLaunch.addEventListener('click', launchSimulation);
    if (btnHeroLaunchCta) btnHeroLaunchCta.addEventListener('click', launchSimulation);`;

if (main.includes('btnHeroLaunch.addEventListener')) {
    main = main.replace(launchLogicOld, launchLogicNew);
}

fs.writeFileSync(mainPath, main, 'utf8');
console.log('Successfully updated src/main.js with Hydroverse Hero initialization');
