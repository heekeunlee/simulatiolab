// 화면 캡처. 사용법: NODE_PATH=~/.simlab-tools/node_modules node tools/browser/shoot.js [slug,...] [--lang=ko] [--wait=6000] [--w=1440] [--h=900] [--full=1] [--mobile=1 --w=390 --h=844] [--out=폴더]
// 기본 저장 위치: ~/.simlab-tools/shots/<slug>-<lang>.png
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const args = process.argv.slice(2), opt = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => a.slice(2).split('=')));
const SITE = path.join(__dirname, '..', '..', 'site');
let slugs = (args.find(a => !a.startsWith('--')) || '').split(',').filter(Boolean);
if (!slugs.length) slugs = ['index', ...fs.readdirSync(SITE + '/experiments')];
const lang = opt.lang || 'ko', wait = +(opt.wait || 6000), W = +(opt.w || 1440), H = +(opt.h || 900), OUT = path.resolve(opt.out || path.join(require('os').homedir(), '.simlab-tools', 'shots'));
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const { srv, base } = await require('./serve')();
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: !!opt.mobile, hasTouch: !!opt.mobile });
  await ctx.addInitScript((l) => { try { localStorage.setItem('lab-lang', l); } catch (e) {} }, lang);
  await ctx.route(/abacus|jasoncameron/, (r) => r.fulfill({ status: 200, body: '{"value":1}' }));
  for (const s of slugs) {
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    await page.goto(base + (s === 'index' ? '' : `experiments/${s}/`)); await page.waitForTimeout(wait);
    const f = path.join(OUT, `${s}-${lang}${opt.mobile ? '-m' : ''}.png`);
    await page.screenshot({ path: f, fullPage: !!opt.full });
    console.log(s, errs.length ? 'ERR ' + errs.slice(0, 3).join(' | ') : 'ok', f);
    await page.close();
  }
  await browser.close(); srv.close();
})();
