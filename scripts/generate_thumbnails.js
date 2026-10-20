import fs from 'fs';
import path from 'path';

const outDir = 'public/thumbnails';
fs.mkdirSync(outDir, { recursive: true });

// 1. Normal Flow Thumbnail SVG (Calm blue Suir river and bridge arches under sunny sky)
const normalFlowSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100" width="160" height="100">
  <defs>
    <linearGradient id="sky1" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="60%" stop-color="#bae6fd"/>
      <stop offset="100%" stop-color="#f0f9ff"/>
    </linearGradient>
    <linearGradient id="river1" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1d4ed8"/>
      <stop offset="50%" stop-color="#2563eb"/>
      <stop offset="100%" stop-color="#1e40af"/>
    </linearGradient>
    <linearGradient id="bridge1" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#64748b"/>
      <stop offset="100%" stop-color="#334155"/>
    </linearGradient>
  </defs>
  <rect width="160" height="100" fill="url(#sky1)"/>
  <!-- Distant Comeragh mountains -->
  <path d="M0,55 Q40,38 80,48 T160,42 L160,65 L0,65 Z" fill="#475569" opacity="0.4"/>
  <path d="M0,60 Q50,48 100,56 T160,52 L160,68 L0,68 Z" fill="#334155" opacity="0.6"/>
  <!-- Old Bridge stone arches -->
  <rect x="0" y="62" width="160" height="12" fill="url(#bridge1)"/>
  <!-- Bridge arches -->
  <path d="M15,74 A12,12 0 0,0 39,74 Z M55,74 A12,12 0 0,0 79,74 Z M95,74 A12,12 0 0,0 119,74 Z M135,74 A12,12 0 0,0 159,74 Z" fill="#1e3a8a"/>
  <!-- Suir river water with soft ripples -->
  <rect x="0" y="74" width="160" height="26" fill="url(#river1)"/>
  <path d="M0,82 Q40,80 80,83 T160,81" stroke="#60a5fa" stroke-width="1" fill="none" opacity="0.6"/>
  <path d="M0,90 Q40,88 80,91 T160,89" stroke="#93c5fd" stroke-width="1" fill="none" opacity="0.5"/>
</svg>`;

// 2. Heavy Rain Thumbnail SVG (Dark stormy sky, rain streaks, swollen river)
const heavyRainSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100" width="160" height="100">
  <defs>
    <linearGradient id="sky2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="60%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#334155"/>
    </linearGradient>
    <linearGradient id="river2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1e3a8a"/>
      <stop offset="100%" stop-color="#172554"/>
    </linearGradient>
  </defs>
  <rect width="160" height="100" fill="url(#sky2)"/>
  <!-- Storm clouds -->
  <circle cx="30" cy="25" r="22" fill="#1e293b"/>
  <circle cx="65" cy="20" r="28" fill="#0f172a"/>
  <circle cx="105" cy="22" r="25" fill="#1e293b"/>
  <circle cx="140" cy="28" r="20" fill="#0f172a"/>
  <!-- Rain streaks -->
  <g stroke="#94a3b8" stroke-width="1.2" opacity="0.55" stroke-dasharray="8,6">
    <line x1="20" y1="35" x2="10" y2="75" />
    <line x1="45" y1="30" x2="35" y2="78" />
    <line x1="70" y1="32" x2="60" y2="80" />
    <line x1="95" y1="30" x2="85" y2="78" />
    <line x1="120" y1="35" x2="110" y2="76" />
    <line x1="145" y1="32" x2="135" y2="79" />
  </g>
  <!-- Quayside silhouettes -->
  <rect x="0" y="66" width="160" height="8" fill="#1e293b"/>
  <rect x="15" y="52" width="22" height="14" fill="#0f172a"/>
  <rect x="42" y="48" width="18" height="18" fill="#1e293b"/>
  <rect x="95" y="50" width="28" height="16" fill="#0f172a"/>
  <!-- Churning water -->
  <rect x="0" y="74" width="160" height="26" fill="url(#river2)"/>
  <path d="M0,80 Q30,76 60,82 T120,78 T160,82" stroke="#38bdf8" stroke-width="1.5" fill="none" opacity="0.6"/>
  <path d="M0,88 Q40,92 80,86 T160,90" stroke="#60a5fa" stroke-width="1.2" fill="none" opacity="0.4"/>
</svg>`;

// 3. 100-Yr Surge Thumbnail SVG (Extreme floodwaters over quays, amber alarm sky)
const surgeFloodSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100" width="160" height="100">
  <defs>
    <linearGradient id="sky3" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#451a03"/>
      <stop offset="50%" stop-color="#78350f"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="surgeWater" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1e40af"/>
      <stop offset="40%" stop-color="#2563eb"/>
      <stop offset="80%" stop-color="#0284c7"/>
      <stop offset="100%" stop-color="#0369a1"/>
    </linearGradient>
  </defs>
  <rect width="160" height="100" fill="url(#sky3)"/>
  <!-- Submerged quayside buildings -->
  <rect x="10" y="40" width="28" height="30" fill="#334155"/>
  <polygon points="10,40 24,28 38,40" fill="#1e293b"/>
  <rect x="45" y="46" width="35" height="24" fill="#475569"/>
  <rect x="105" y="42" width="45" height="28" fill="#334155"/>
  <!-- High flood surge waters covering the quay -->
  <rect x="0" y="62" width="160" height="38" fill="url(#surgeWater)"/>
  <!-- Rushing crest waves -->
  <path d="M0,64 Q25,58 50,65 T100,60 T160,66" stroke="#bae6fd" stroke-width="2" fill="none" opacity="0.8"/>
  <path d="M0,74 Q35,70 70,76 T140,71 T160,75" stroke="#7dd3fc" stroke-width="1.5" fill="none" opacity="0.6"/>
  <path d="M0,86 Q40,82 80,88 T160,84" stroke="#38bdf8" stroke-width="1" fill="none" opacity="0.5"/>
</svg>`;

// 4. Demountable Quay Wall Thumbnail SVG (Sleek aluminium flood barrier with Suir river)
const quayWallSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100" width="160" height="100">
  <defs>
    <linearGradient id="wallAlum" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#94a3b8"/>
      <stop offset="25%" stop-color="#e2e8f0"/>
      <stop offset="50%" stop-color="#cbd5e1"/>
      <stop offset="75%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#64748b"/>
    </linearGradient>
    <linearGradient id="postSteel" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#334155"/>
      <stop offset="50%" stop-color="#64748b"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>
  <!-- Background quayside atmosphere -->
  <rect width="160" height="100" fill="#0f172a"/>
  <!-- Dry Quay promenade on left/back -->
  <polygon points="0,0 160,0 160,65 0,80" fill="#1e293b"/>
  <!-- Demountable Aluminium Flood Barrier Panels -->
  <polygon points="0,48 160,35 160,65 0,78" fill="url(#wallAlum)"/>
  <!-- Horizontal aluminium slat grooves -->
  <line x1="0" y1="54" x2="160" y2="41" stroke="#64748b" stroke-width="1"/>
  <line x1="0" y1="60" x2="160" y2="47" stroke="#64748b" stroke-width="1"/>
  <line x1="0" y1="66" x2="160" y2="53" stroke="#64748b" stroke-width="1"/>
  <line x1="0" y1="72" x2="160" y2="59" stroke="#64748b" stroke-width="1"/>
  <!-- Vertical Support Posts -->
  <rect x="25" y="44" width="8" height="34" fill="url(#postSteel)"/>
  <rect x="75" y="38" width="8" height="32" fill="url(#postSteel)"/>
  <rect x="125" y="33" width="8" height="30" fill="url(#postSteel)"/>
  <!-- River Suir water held back on front/right -->
  <polygon points="0,78 160,65 160,100 0,100" fill="#1d4ed8"/>
  <path d="M0,82 Q40,76 80,80 T160,72" stroke="#60a5fa" stroke-width="1.5" fill="none" opacity="0.7"/>
</svg>`;

// 5. Sandbags Thumbnail SVG (Stacked burlap sandbag defensive line holding back river)
const sandbagsSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100" width="160" height="100">
  <defs>
    <linearGradient id="sandbagGrad1" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#d97706"/>
      <stop offset="50%" stop-color="#b45309"/>
      <stop offset="100%" stop-color="#78350f"/>
    </linearGradient>
    <linearGradient id="sandbagGrad2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f59e0b"/>
      <stop offset="50%" stop-color="#d97706"/>
      <stop offset="100%" stop-color="#92400e"/>
    </linearGradient>
  </defs>
  <rect width="160" height="100" fill="#0f172a"/>
  <!-- Dry road behind -->
  <polygon points="0,0 160,0 160,50 0,55" fill="#1e293b"/>
  <!-- Stacked Sandbag Pyramids -->
  <!-- Layer 1 (bottom) -->
  <g fill="url(#sandbagGrad1)">
    <rect x="2" y="65" width="30" height="14" rx="4"/>
    <rect x="34" y="64" width="30" height="14" rx="4"/>
    <rect x="66" y="63" width="30" height="14" rx="4"/>
    <rect x="98" y="62" width="30" height="14" rx="4"/>
    <rect x="130" y="61" width="28" height="14" rx="4"/>
  </g>
  <!-- Layer 2 (mid) -->
  <g fill="url(#sandbagGrad2)">
    <rect x="16" y="54" width="28" height="13" rx="4"/>
    <rect x="48" y="53" width="28" height="13" rx="4"/>
    <rect x="80" y="52" width="28" height="13" rx="4"/>
    <rect x="112" y="51" width="28" height="13" rx="4"/>
  </g>
  <!-- Layer 3 (top) -->
  <g fill="url(#sandbagGrad1)">
    <rect x="32" y="44" width="26" height="12" rx="4"/>
    <rect x="64" y="43" width="26" height="12" rx="4"/>
    <rect x="96" y="42" width="26" height="12" rx="4"/>
  </g>
  <!-- Swirling river water on front -->
  <polygon points="0,79 160,75 160,100 0,100" fill="#2563eb"/>
  <path d="M0,84 Q40,80 80,83 T160,78" stroke="#93c5fd" stroke-width="1.5" fill="none" opacity="0.7"/>
</svg>`;

fs.writeFileSync(path.join(outDir, 'normal_flow.svg'), normalFlowSvg);
fs.writeFileSync(path.join(outDir, 'heavy_rain.svg'), heavyRainSvg);
fs.writeFileSync(path.join(outDir, 'surge_flood.svg'), surgeFloodSvg);
fs.writeFileSync(path.join(outDir, 'quay_wall.svg'), quayWallSvg);
fs.writeFileSync(path.join(outDir, 'sandbags.svg'), sandbagsSvg);

console.log('Generated all 5 SVG thumbnails in public/thumbnails/');
