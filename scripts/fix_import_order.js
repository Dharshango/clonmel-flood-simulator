import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cssPath = path.join(__dirname, '..', 'src', 'style.css');
let css = fs.readFileSync(cssPath, 'utf8');

const importStr = "@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&display=swap');";

css = css.replace(importStr + '\r\n', '');
css = css.replace(importStr + '\n', '');
css = importStr + '\n' + css;

fs.writeFileSync(cssPath, css, 'utf8');
console.log('Successfully positioned @import at line 1 of style.css');
