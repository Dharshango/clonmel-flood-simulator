import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const indexPath = path.join(__dirname, '..', 'index.html');
let content = fs.readFileSync(indexPath, 'utf8');

if (!content.includes('id="hero-water-canvas"')) {
    content = content.replace(
        /(<section id="hero-section" class="hero-overlay">)(\r?\n\s*)(<div class="hero-content">)/,
        '$1$2<canvas id="hero-water-canvas" class="hero-water-canvas"></canvas>$2$3'
    );
    fs.writeFileSync(indexPath, content, 'utf8');
    console.log('Successfully inserted hero-water-canvas into index.html');
} else {
    console.log('hero-water-canvas already present');
}
