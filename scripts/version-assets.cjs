const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');

// A new URL is required when CSS/JS changes: REG.RU serves them with a 24h cache.
// Normalize line endings so Windows and the Linux deployment produce the same version.
function version(file) {
  const content = fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 12);
}
for (const name of ['index.html', 'privacy.html']) {
  const filename = path.join(root, name);
  const html = fs.readFileSync(filename, 'utf8');
  const updated = html.replace(/\b(src|href)="([^"?#]+\.(?:css|js))(?:\?[^"#]*)?"/g, (match, attr, file) => {
    if (/^(?:https?:)?\/\//.test(file)) return match;
    return `${attr}="${file}?v=${version(file)}"`;
  });
  fs.writeFileSync(filename, updated);
}
console.log('HTML now references content-versioned CSS and JavaScript.');
