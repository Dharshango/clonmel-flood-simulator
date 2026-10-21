import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mainPath = path.join(__dirname, '..', 'src', 'main.js');
let main = fs.readFileSync(mainPath, 'utf8');

const targetRegex = /const btnHeroLaunch = document\.getElementById\('btn-hero-launch'\);\r?\n\s*const btnBackHero = document\.getElementById\('btn-back-hero'\);\r?\n\s*const heroBg = initHydroverseHero\(\);\r?\n\s*if \(btnHeroLaunch && heroSection\) \{[\s\S]*?\}\r?\n\s*if \(btnBackHero && heroSection\) \{[\s\S]*?\}/;

const replacement = `const btnHeroLaunch = document.getElementById('btn-hero-launch');
    const btnHeroLaunchCta = document.getElementById('btn-hero-launch-cta');
    const btnBackHero = document.getElementById('btn-back-hero');
    const heroBg = initHydroverseHero();
    
    const launchSimulation = () => {
        if (heroSection) heroSection.classList.add('hidden');
    };
    if (btnHeroLaunch) btnHeroLaunch.addEventListener('click', launchSimulation);
    if (btnHeroLaunchCta) btnHeroLaunchCta.addEventListener('click', launchSimulation);
    if (btnBackHero && heroSection) {
        btnBackHero.addEventListener('click', () => {
            heroSection.classList.remove('hidden');
        });
    }`;

if (targetRegex.test(main)) {
    main = main.replace(targetRegex, replacement);
    fs.writeFileSync(mainPath, main, 'utf8');
    console.log('Successfully wired btnHeroLaunchCta in src/main.js');
} else {
    console.error('targetRegex did not match in src/main.js');
}
