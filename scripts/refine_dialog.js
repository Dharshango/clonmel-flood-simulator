import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// 1. Fix duplicate id in index.html
const indexPath = path.join(rootDir, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace(
    'id="hero-section" class="hero-overlay hero" id="home"',
    'id="hero-section" class="hero-overlay hero"'
);
fs.writeFileSync(indexPath, html, 'utf8');

// 2. Fix dialog open/close in hydroverse_hero.js
const heroJsPath = path.join(rootDir, 'src', 'ui', 'hydroverse_hero.js');
let js = fs.readFileSync(heroJsPath, 'utf8');

const oldDialogLogic = `    if (howLink && dialog) {
        howLink.addEventListener('click', (event) => {
            event.preventDefault();
            if (typeof dialog.showModal === 'function') dialog.showModal();
            else dialog.setAttribute('open', '');
        });
    }
    if (closeDialog && dialog) {
        closeDialog.addEventListener('click', () => dialog.close());
        dialog.addEventListener('click', (event) => {
            if (event.target === dialog) dialog.close();
        });
    }`;

const newDialogLogic = `    if (howLink && dialog) {
        howLink.addEventListener('click', (event) => {
            event.preventDefault();
            if (typeof dialog.showModal === 'function') {
                try {
                    dialog.showModal();
                } catch (e) {
                    dialog.setAttribute('open', '');
                }
            } else {
                dialog.setAttribute('open', '');
            }
        });
    }
    if (closeDialog && dialog) {
        closeDialog.addEventListener('click', () => {
            if (typeof dialog.close === 'function') {
                try { dialog.close(); } catch(e) {}
            }
            dialog.removeAttribute('open');
        });
        dialog.addEventListener('click', (event) => {
            if (event.target === dialog) {
                if (typeof dialog.close === 'function') {
                    try { dialog.close(); } catch(e) {}
                }
                dialog.removeAttribute('open');
            }
        });
    }`;

js = js.replace(oldDialogLogic, newDialogLogic);
fs.writeFileSync(heroJsPath, js, 'utf8');

// 3. Add .info-dialog:not([open]) { display: none !important; } in style.css
const cssPath = path.join(rootDir, 'src', 'style.css');
let css = fs.readFileSync(cssPath, 'utf8');
if (!css.includes('.info-dialog:not([open])')) {
    css = css.replace(
        '.info-dialog {',
        '.info-dialog:not([open]) { display: none !important; }\n.info-dialog[open] { display: block !important; }\n.info-dialog {'
    );
    fs.writeFileSync(cssPath, css, 'utf8');
}

console.log('Successfully refined dialog behavior and CSS');
