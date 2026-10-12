// 각 HTML에서 data-en(영어) ↔ 한국어 원문 짝을 뽑는다 → review/pairs.json
const { JSDOM } = require('jsdom'); const fs = require('fs'), path = require('path');
const SITE = path.join(__dirname, '..', '..', '..', 'site');
const files = [path.join(SITE, 'index.html'), ...fs.readdirSync(SITE + '/experiments').map((s) => path.join(SITE, 'experiments', s, 'index.html'))];
const out = {};
for (const f of files) {
  const d = new JSDOM(fs.readFileSync(f, 'utf8')).window.document, page = path.basename(path.dirname(f)) === 'site' ? 'index' : path.basename(path.dirname(f));
  d.querySelectorAll('[data-en]').forEach((e) => { const en = e.getAttribute('data-en'); if (!out[en]) out[en] = { ko: e.innerHTML, page }; });
  d.querySelectorAll('[data-en-title]').forEach((e) => { const en = e.getAttribute('data-en-title'); if (!out[en]) out[en] = { ko: e.getAttribute('title'), page }; });
  d.querySelectorAll('[data-en-content]').forEach((e) => { const en = e.getAttribute('data-en-content'); if (!out[en]) out[en] = { ko: e.getAttribute('content'), page }; });
}
fs.writeFileSync(path.join(__dirname, 'pairs.json'), JSON.stringify(out));
console.log(Object.keys(out).length, 'pairs');
