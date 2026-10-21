import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cssPath = path.join(__dirname, '..', 'src', 'style.css');
let css = fs.readFileSync(cssPath, 'utf8');

// 1. Update :root variables
css = css.replace(
    /--panel-bg:\s*rgba\(13,\s*18,\s*30,\s*0\.90\);/,
    '--panel-bg: rgba(10, 16, 28, 0.42);'
);
css = css.replace(
    /--panel-border:\s*rgba\(255,\s*255,\s*255,\s*0\.08\);/,
    '--panel-border: rgba(255, 255, 255, 0.13);'
);
css = css.replace(/--radius-sm:\s*6px;/, '--radius-sm: 12px;');
css = css.replace(/--radius-md:\s*10px;/, '--radius-md: 14px;');
css = css.replace(/--radius-lg:\s*14px;/, '--radius-lg: 20px;');
css = css.replace(
    /--shadow-panel:\s*0 16px 36px -4px rgba\(0, 0, 0, 0\.7\),\s*0 4px 12px -2px rgba\(0, 0, 0, 0\.5\);/,
    '--shadow-panel: 0 20px 48px -4px rgba(0, 0, 0, 0.45), inset 0 1px 1px rgba(255, 255, 255, 0.18);'
);

// 2. Header Back Button
css = css.replace(
    /\.btn-back-hero\s*\{[\s\S]*?transition:\s*all 0\.15s ease;\s*\}/,
    `.btn-back-hero {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    background: rgba(255, 255, 255, 0.06);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 16px;
    color: #cbd5e1;
    font-size: 11.5px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.15);
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}`
);

// 3. Header Center Modes & Tabs
css = css.replace(
    /\.header-modes\.center-modes\s*\{[\s\S]*?pointer-events:\s*auto;\s*\}/,
    `.header-modes.center-modes {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(10, 16, 28, 0.45);
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    padding: 5px 8px;
    border-radius: 24px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.18);
    pointer-events: auto;
}`
);

css = css.replace(
    /\.mode-tab\s*\{[\s\S]*?\.mode-tab\.active\s*\{[\s\S]*?box-shadow:\s*0 0 14px rgba\(2, 132, 199, 0\.45\);\s*\}/,
    `.mode-tab {
    background: rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #94a3b8;
    padding: 6px 18px;
    border-radius: 18px;
    font-size: 12.5px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.mode-tab:hover {
    background: rgba(255, 255, 255, 0.09);
    border-color: rgba(255, 255, 255, 0.18);
    color: #ffffff;
}

.mode-tab.active {
    background: rgba(2, 132, 199, 0.32);
    color: #ffffff;
    border: 1.5px solid rgba(56, 189, 248, 0.8);
    box-shadow: 0 0 18px rgba(2, 132, 199, 0.45), inset 0 1px 2px rgba(255, 255, 255, 0.3);
}`
);

// 4. Header Icon button & Badge status
css = css.replace(
    /\.header-icon-btn\s*\{[\s\S]*?transition:\s*all 0\.15s ease;\s*\}/,
    `.header-icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.06);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border: 1px solid rgba(255, 255, 255, 0.14);
    color: #cbd5e1;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.15);
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}`
);

css = css.replace(
    /\.badge-status\s*\{[\s\S]*?box-shadow:\s*0 4px 12px rgba\(0, 0, 0, 0\.4\);\s*\}/,
    `.badge-status {
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(255, 255, 255, 0.06);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border: 1px solid rgba(255, 255, 255, 0.14);
    padding: 6px 14px;
    border-radius: 18px;
    font-size: 11px;
    font-family: 'JetBrains Mono', monospace;
    font-weight: 700;
    color: var(--accent-sky);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.15);
}`
);

// 5. Side-by-side cards
css = css.replace(
    /\.sbs-comparison-card\s*\{[\s\S]*?pointer-events:\s*auto;\s*\}/,
    `.sbs-comparison-card {
    flex: 1;
    background: rgba(10, 16, 28, 0.45);
    backdrop-filter: blur(28px) saturate(180%);
    -webkit-backdrop-filter: blur(28px) saturate(180%);
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    padding: 18px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45), inset 0 1px 1px rgba(255, 255, 255, 0.18);
    display: flex;
    flex-direction: column;
    gap: 12px;
    pointer-events: auto;
}`
);

// 6. Clean Floating Panels
css = css.replace(
    /\.clean-panel\s*\{[\s\S]*?transition:\s*opacity 0\.25s ease, transform 0\.25s ease;\s*\}/,
    `.clean-panel {
    position: absolute;
    top: 70px;
    bottom: 88px; /* room for floating bottom pill bar */
    width: 296px;
    background: rgba(10, 16, 28, 0.40);
    backdrop-filter: blur(28px) saturate(190%);
    -webkit-backdrop-filter: blur(28px) saturate(190%);
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 20px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45), inset 0 1px 1px rgba(255, 255, 255, 0.2);
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    overflow-y: auto;
    z-index: 40;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
    transition: opacity 0.25s ease, transform 0.25s ease;
}`
);

// 7. Scenario Buttons (.scenario-btn)
css = css.replace(
    /\.scenario-btn\s*\{[\s\S]*?\.scenario-btn\.active\s*\{[\s\S]*?box-shadow:\s*0 0 10px rgba\(56, 189, 248, 0\.25\);\s*\}/,
    `.scenario-btn {
    display: flex;
    align-items: center;
    gap: 12px;
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(14px) saturate(160%);
    -webkit-backdrop-filter: blur(14px) saturate(160%);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 14px;
    padding: 10px 12px;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    text-align: left;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18), inset 0 1px 1px rgba(255, 255, 255, 0.14);
    position: relative;
    overflow: hidden;
}

.scenario-btn::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 45%;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0) 100%);
    pointer-events: none;
    border-radius: 14px 14px 0 0;
}

.scenario-btn:hover {
    background: rgba(255, 255, 255, 0.10);
    border-color: rgba(255, 255, 255, 0.25);
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.25);
}

.scenario-btn.active {
    background: rgba(2, 132, 199, 0.24);
    border-color: rgba(56, 189, 248, 0.65);
    box-shadow: 0 0 18px rgba(56, 189, 248, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.3);
}`
);

// 8. Barrier Guide Hint, Tool Cards, Stats Box, Sub Buttons
css = css.replace(
    /\.barrier-guide-hint\s*\{[\s\S]*?padding:\s*8px 10px;\s*\}/,
    `.barrier-guide-hint {
    font-size: 11px;
    line-height: 1.45;
    color: var(--text-secondary);
    background: rgba(56, 189, 248, 0.08);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(56, 189, 248, 0.22);
    border-radius: 14px;
    padding: 10px 12px;
    box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.1);
}`
);

css = css.replace(
    /\.barrier-tool-card\s*\{[\s\S]*?\.barrier-tool-card\.preset\s*\{[\s\S]*?border-left:\s*3px solid #10b981;\s*\}/,
    `.barrier-tool-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 11px 12px;
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(14px) saturate(160%);
    -webkit-backdrop-filter: blur(14px) saturate(160%);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 14px;
    cursor: pointer;
    text-align: left;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18), inset 0 1px 1px rgba(255, 255, 255, 0.14);
    position: relative;
    overflow: hidden;
}

.barrier-tool-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 45%;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0) 100%);
    pointer-events: none;
    border-radius: 14px 14px 0 0;
}

.barrier-tool-card:hover {
    background: rgba(255, 255, 255, 0.10);
    border-color: rgba(255, 255, 255, 0.25);
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.25);
}

.barrier-tool-card.active {
    background: rgba(14, 165, 233, 0.22);
    border-color: #38bdf8;
    box-shadow: 0 0 18px rgba(2, 132, 199, 0.35), inset 0 1px 2px rgba(255, 255, 255, 0.3);
}

.barrier-tool-card.preset {
    border-left: 3px solid #10b981;
}`
);

css = css.replace(
    /\.barrier-stats-box\s*\{[\s\S]*?padding:\s*8px 10px;[\s\S]*?font-size:\s*11px;\s*\}/,
    `.barrier-stats-box {
    background: rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.10);
    border-radius: 14px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 11px;
    box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.1);
}`
);

css = css.replace(
    /\.btn-sub\s*\{[\s\S]*?\.btn-sub\.danger:hover\s*\{[\s\S]*?border-color:\s*var\(--accent-red\);\s*\}/,
    `.btn-sub {
    background: rgba(255, 255, 255, 0.06);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.14);
    color: var(--text-primary);
    padding: 8px 12px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 1px rgba(255, 255, 255, 0.15);
}

.btn-sub:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.25);
    transform: translateY(-1px);
}

.btn-sub.primary {
    background: rgba(16, 185, 129, 0.2);
    border-color: rgba(16, 185, 129, 0.45);
    color: #6ee7b7;
    box-shadow: 0 0 12px rgba(16, 185, 129, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.2);
}

.btn-sub.primary:hover {
    background: rgba(16, 185, 129, 0.32);
    border-color: rgba(16, 185, 129, 0.6);
}

.btn-sub.danger:hover {
    background: rgba(239, 68, 68, 0.25);
    border-color: var(--accent-red);
    box-shadow: 0 0 12px rgba(239, 68, 68, 0.3);
}`
);

// 9. Readouts Panel: Depth Card, Metric Card, Roads, Export Button
css = css.replace(
    /\.depth-card\s*\{[\s\S]*?gap:\s*6px;\s*\}/,
    `.depth-card {
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.13);
    border-radius: 16px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2), inset 0 1px 1px rgba(255, 255, 255, 0.14);
}`
);

css = css.replace(
    /\.depth-number-display\s*\{[\s\S]*?padding:\s*6px 12px;\s*\}/,
    `.depth-number-display {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(2, 132, 199, 0.16);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(56, 189, 248, 0.32);
    border-radius: 12px;
    padding: 8px 14px;
    box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.2);
}`
);

css = css.replace(
    /\.metric-card\s*\{[\s\S]*?flex-direction:\s*column;\s*\}/,
    `.metric-card {
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(14px) saturate(160%);
    -webkit-backdrop-filter: blur(14px) saturate(160%);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 14px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18), inset 0 1px 1px rgba(255, 255, 255, 0.14);
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.metric-card:hover {
    background: rgba(255, 255, 255, 0.09);
    border-color: rgba(255, 255, 255, 0.22);
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.2);
}`
);

css = css.replace(
    /\.road-entry\s*\{[\s\S]*?font-size:\s*10\.5px;\s*\}/,
    `.road-entry {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 5px 10px;
    background: rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    font-size: 10.5px;
    transition: background 0.15s ease;
}

.road-entry:hover {
    background: rgba(255, 255, 255, 0.08);
}`
);

css = css.replace(
    /\.btn-export\s*\{[\s\S]*?margin-top:\s*2px;\s*\}/,
    `.btn-export {
    background: linear-gradient(135deg, rgba(2, 132, 199, 0.75), rgba(37, 99, 235, 0.75));
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border: 1px solid rgba(255, 255, 255, 0.28);
    color: #ffffff;
    padding: 10px 14px;
    border-radius: 14px;
    font-size: 11.5px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 18px rgba(2, 132, 199, 0.35), inset 0 1px 2px rgba(255, 255, 255, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    margin-top: 2px;
}`
);

// 10. Floating Bottom Playback Bar
css = css.replace(
    /#bottom-playback-bar\.floating-pill-bar\s*\{[\s\S]*?max-width:\s*92vw;\s*\}/,
    `#bottom-playback-bar.floating-pill-bar {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    height: 54px;
    background: rgba(10, 16, 28, 0.45);
    backdrop-filter: blur(28px) saturate(190%);
    -webkit-backdrop-filter: blur(28px) saturate(190%);
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 28px;
    display: flex;
    align-items: center;
    padding: 0 18px;
    gap: 14px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45), inset 0 1px 1px rgba(255, 255, 255, 0.2);
    z-index: 1000;
    min-width: 740px;
    max-width: 92vw;
}`
);

css = css.replace(
    /\.btn-bar-reset\s*\{[\s\S]*?transition:\s*all 0\.15s ease;\s*\}/,
    `.btn-bar-reset {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px 14px;
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.16);
    color: #cbd5e1;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 1px rgba(255, 255, 255, 0.18);
}`
);

css = css.replace(
    /\.speed-capsule-group\s*\{[\s\S]*?flex-shrink:\s*0;\s*\}/,
    `.speed-capsule-group {
    display: flex;
    align-items: center;
    gap: 2px;
    background: rgba(255, 255, 255, 0.06);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    padding: 3px;
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    flex-shrink: 0;
}`
);

css = css.replace(
    /\.speed-btn\s*\{[\s\S]*?\.speed-btn\.active\s*\{[\s\S]*?box-shadow:\s*0 1px 4px rgba\(0, 0, 0, 0\.3\);\s*\}/,
    `.speed-btn {
    background: transparent;
    border: 1px solid transparent;
    color: #94a3b8;
    padding: 4px 9px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
}

.speed-btn:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.08);
}

.speed-btn.active {
    background: rgba(2, 132, 199, 0.35);
    color: #ffffff;
    font-weight: 700;
    border: 1px solid rgba(56, 189, 248, 0.7);
    box-shadow: 0 0 10px rgba(56, 189, 248, 0.35);
}`
);

css = css.replace(
    /\.bar-action-btn\s*\{[\s\S]*?\.bar-action-btn\.active\s*\{[\s\S]*?background:\s*rgba\(14, 165, 233, 0\.15\);\s*\}/,
    `.bar-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.06);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.15s ease;
    box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.1);
}

.bar-action-btn:hover {
    background: rgba(255, 255, 255, 0.14);
    color: #ffffff;
    border-color: rgba(255, 255, 255, 0.25);
    transform: scale(1.05);
}

.bar-action-btn.active {
    color: #38bdf8;
    border-color: rgba(56, 189, 248, 0.6);
    background: rgba(14, 165, 233, 0.25);
    box-shadow: 0 0 12px rgba(56, 189, 248, 0.35);
}`
);

// 11. Inspector Card
css = css.replace(
    /\.inspector-card\s*\{[\s\S]*?z-index:\s*50;\s*\}/,
    `.inspector-card {
    position: absolute;
    bottom: 74px;
    left: 320px;
    width: 220px;
    background: rgba(10, 16, 28, 0.50);
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    border: 1px solid rgba(56, 189, 248, 0.35);
    border-radius: 16px;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45), inset 0 1px 1px rgba(255, 255, 255, 0.18);
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    z-index: 50;
}`
);

fs.writeFileSync(cssPath, css, 'utf8');
console.log('Successfully updated style.css with glassy buttons, transparent effects, and curved borders!');
