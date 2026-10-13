// 범례가 그래프 데이터를 가리는지 점검한다. 사용법: NODE_PATH=~/.simlab-tools/node_modules node tools/browser/legend_audit.js [slug,...] [--out=파일]
// 각 실험을 데스크톱(1280px)과 휴대폰(390px) 폭으로 열고, 기본값과 슬라이더 양 끝값에서 범례 상자 밑의 데이터 비율을 잰다.
const { chromium, devices } = require('playwright');
const path = require('path'), fs = require('fs'), http = require('http');
const ROOT = path.join(__dirname, '..', '..', 'site');
const args = process.argv.slice(2), opt = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
let slugs = (args.find((a) => !a.startsWith('--')) || '').split(',').filter(Boolean);
if (!slugs.length) slugs = fs.readdirSync(path.join(ROOT, 'experiments')).filter((d) => fs.existsSync(path.join(ROOT, 'experiments', d, 'index.html'))).sort();
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, r) => { let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html'; fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(d); } }); });
const THRESH = Number(opt.t || 0.1);   // 상자 넓이의 10% 넘게 데이터가 깔려 있으면 '가림'으로 본다
(async () => {
  await new Promise((r) => srv.listen(0, r)); const base = 'http://localhost:' + srv.address().port;
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const results = [];
  async function audit(slug, kind) {
    const ctx = await browser.newContext(kind === 'mobile' ? { ...devices['iPhone 13'], locale: 'ko-KR' } : { viewport: { width: 1280, height: 900 }, locale: 'ko-KR' });
    await ctx.addInitScript(() => { window.__legendAudit = true; });
    const page = await ctx.newPage(); const seen = {};
    const grab = async (tag) => { const log = await page.evaluate(() => { const l = window.__lgLog || []; window.__lgLog = []; return l; }); log.forEach((e) => { const k = e.id + '@' + e.pos; const o = seen[k] || (seen[k] = { id: e.id, pos: e.pos, max: 0, at: '' }); if (e.ratio > o.max) { o.max = e.ratio; o.at = tag; } }); };
    try {
      await page.goto(`${base}/experiments/${slug}/index.html?lang=ko`, { waitUntil: 'load', timeout: 40000 }); await page.waitForTimeout(1500);
      const sk = await page.$('.pskip'); if (sk) await sk.click().catch(() => {}); await page.waitForTimeout(kind === 'mobile' ? 2500 : 3000); await grab('기본');
      const ids = await page.evaluate(() => Array.from(document.querySelectorAll('.controls input[type=range]')).map((e) => e.id));
      for (const id of ids) for (const which of ['min', 'max']) {
        await page.evaluate(([id, w]) => { const e = document.getElementById(id); e.value = e[w]; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, [id, which]).catch(() => {});
        await page.waitForTimeout(1100); await grab(`${id}=${which}`);
      }
      await page.evaluate(() => { const b = document.getElementById('reset'); if (b) b.click(); }).catch(() => {});
    } catch (e) { seen.ERR = { id: 'ERR', pos: '', max: 0, at: String(e.message).slice(0, 60) }; }
    await ctx.close();
    Object.values(seen).forEach((o) => results.push({ slug, kind, ...o }));
  }
  // 4개씩 병렬
  const jobs = []; slugs.forEach((s) => ['desktop', 'mobile'].forEach((k) => jobs.push([s, k])));
  let next = 0; await Promise.all(Array.from({ length: Number(opt.j || 4) }, async () => { while (next < jobs.length) { const [s, k] = jobs[next++]; await audit(s, k); process.stderr.write(`\r${next}/${jobs.length} `); } }));
  await browser.close(); srv.close();
  results.sort((a, b) => b.max - a.max);
  const bad = results.filter((r) => r.max > THRESH);
  const txt = '# 범례 가림 점검 (비율 > ' + THRESH + ')\n' + bad.map((r) => `${r.slug.padEnd(15)} ${r.kind.padEnd(8)} ${String(r.id).padEnd(10)} ${r.pos}  ${(r.max * 100).toFixed(0)}%  (${r.at})`).join('\n') + `\n\n총 범례 ${results.length}개 중 ${bad.length}개 의심\n`;
  if (opt.out) fs.writeFileSync(opt.out, txt + '\n' + JSON.stringify(results)); console.log('\n' + txt);
})();
