import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mainPath = path.join(__dirname, '..', 'src', 'main.js');
let main = fs.readFileSync(mainPath, 'utf8');

// 1. Add import if not present
if (!main.includes('./ui/hero_background.js')) {
    main = main.replace(
        "import { exportPeakDepthMap } from './ui/export_map.js';",
        "import { exportPeakDepthMap } from './ui/export_map.js';\nimport { initHeroBackground } from './ui/hero_background.js';"
    );
}

// 2. Call initHeroBackground()
if (!main.includes('initHeroBackground();')) {
    main = main.replace(
        "const btnBackHero = document.getElementById('btn-back-hero');",
        "const btnBackHero = document.getElementById('btn-back-hero');\n    const heroBg = initHeroBackground();"
    );
}

fs.writeFileSync(mainPath, main, 'utf8');
console.log('Successfully updated main.js with hero background initialization');
