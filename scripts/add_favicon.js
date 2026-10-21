import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const indexPath = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

// Insert favicon links right after <title>
const faviconTags = `<title>Hydroverse — See the flood before it flows</title>
    <link rel="icon" type="image/svg+xml" href="/brand-mark.svg">
    <link rel="alternate icon" href="/favicon.svg">
    <link rel="apple-touch-icon" href="/brand-mark.svg">`;

if (!html.includes('rel="icon"')) {
    html = html.replace('<title>Hydroverse — See the flood before it flows</title>', faviconTags);
    fs.writeFileSync(indexPath, html, 'utf8');
    console.log('Successfully added favicon tags to index.html');
} else {
    console.log('Favicon already present');
}
