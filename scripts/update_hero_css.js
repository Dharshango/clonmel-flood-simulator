import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cssPath = path.join(__dirname, '..', 'src', 'style.css');
let css = fs.readFileSync(cssPath, 'utf8');

const oldHeroRegex = /\/\* ==================== SEPARATE HERO SECTION ==================== \*\/[\s\S]*?(?=\/\* ==================== FLOATING TOP NAVIGATION OVERLAY ==================== \*\/)/;

const newHeroCss = `/* ==================== SEPARATE HERO SECTION ==================== */
.hero-overlay {
    position: fixed;
    inset: 0;
    z-index: 2000;
    background: #060913;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 30px;
    transition: opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

.hero-overlay.hidden {
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
}

.hero-water-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
    pointer-events: none;
}

.hero-content {
    position: relative;
    z-index: 10;
    max-width: 880px;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 18px;
    pointer-events: auto;
}

.hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 18px;
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border: 1px solid rgba(56, 189, 248, 0.35);
    border-radius: 24px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.8px;
    color: var(--accent-sky);
    text-transform: uppercase;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.15);
}

.badge-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--accent-cyan);
    box-shadow: 0 0 8px var(--accent-cyan);
}

.hero-title {
    font-size: 50px;
    font-weight: 900;
    letter-spacing: -0.5px;
    color: #ffffff;
    line-height: 1.05;
    text-shadow: 0 4px 24px rgba(0, 0, 0, 0.7);
    background: linear-gradient(180deg, #ffffff 30%, #cbd5e1 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
}

.hero-subtitle {
    font-size: 18px;
    font-weight: 600;
    color: var(--accent-sky);
    letter-spacing: -0.2px;
    text-shadow: 0 2px 12px rgba(56, 189, 248, 0.3);
}

.hero-desc {
    font-size: 14.5px;
    line-height: 1.65;
    color: #cbd5e1;
    max-width: 700px;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
}

.hero-features-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    width: 100%;
    margin-top: 10px;
    text-align: left;
}

.hero-card {
    background: rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 16px;
    padding: 18px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.14);
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    position: relative;
    overflow: hidden;
}

.hero-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 45%;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0) 100%);
    pointer-events: none;
    border-radius: 16px 16px 0 0;
}

.hero-card:hover {
    transform: translateY(-3px);
    background: rgba(255, 255, 255, 0.07);
    border-color: rgba(56, 189, 248, 0.45);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4), 0 0 24px rgba(56, 189, 248, 0.2), inset 0 1px 1px rgba(255, 255, 255, 0.25);
}

.hero-card-icon {
    font-size: 26px;
    margin-bottom: 10px;
}

.hero-card h3 {
    font-size: 14.5px;
    font-weight: 700;
    color: #ffffff;
    margin-bottom: 6px;
}

.hero-card p {
    font-size: 12px;
    line-height: 1.5;
    color: #94a3b8;
}

.hero-actions {
    margin-top: 14px;
}

.btn-hero-launch {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    padding: 15px 36px;
    background: linear-gradient(135deg, #0284c7, #2563eb);
    color: #ffffff;
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 32px;
    font-size: 15px;
    font-weight: 800;
    letter-spacing: 0.3px;
    cursor: pointer;
    box-shadow: 0 8px 30px rgba(2, 132, 199, 0.5), inset 0 1px 2px rgba(255, 255, 255, 0.35);
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    position: relative;
    overflow: hidden;
}

.btn-hero-launch:hover {
    transform: translateY(-2px) scale(1.03);
    box-shadow: 0 12px 42px rgba(2, 132, 199, 0.75), inset 0 1px 2px rgba(255, 255, 255, 0.5);
    filter: brightness(1.12);
}

`;

if (oldHeroRegex.test(css)) {
    css = css.replace(oldHeroRegex, newHeroCss);
    fs.writeFileSync(cssPath, css, 'utf8');
    console.log('Successfully updated hero section styling in style.css');
} else {
    console.log('Regex did not match hero section in style.css');
}
