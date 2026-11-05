const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
for (const file of ['index.html', 'privacy.html']) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  const links = [...html.matchAll(/\b(?:src|href)="([^"?#]+\.(?:css|js|svg))([^"#]*)"/g)];
  assert(links.length > 0);
  for (const [, asset, query] of links) {
    const content = fs.readFileSync(path.join(root, asset), 'utf8').replace(/\r\n/g, '\n');
    const hash = crypto.createHash('sha256').update(content).digest('hex').slice(0, 12);
    assert.equal(query, `?v=${hash}`, `${file}: stale or missing asset version for ${asset}`);
  }
}
console.log('All stylesheet and script URLs carry the current content version.');
