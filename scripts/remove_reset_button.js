import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const indexPath = path.join(__dirname, '..', 'index.html');
let content = fs.readFileSync(indexPath, 'utf8');

const regex = /\r?\n\s*<button id="btn-quick-reset"[\s\S]*?<\/button>/;
if (regex.test(content)) {
    content = content.replace(regex, '');
    fs.writeFileSync(indexPath, content, 'utf8');
    console.log('Successfully removed btn-quick-reset from index.html');
} else {
    console.log('btn-quick-reset not found or already removed');
}
