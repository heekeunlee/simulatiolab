// 각 실험의 실제 결과 화면을 메인 페이지 썸네일로 만든다 → site/thumbs/<slug>.jpg (480×480)
// 사용법: NODE_PATH=~/.simlab-tools/node_modules node tools/browser/make_thumbs.js [slug,...] [--wait=9000]
// - 찍는 캔버스: 페이지에서 data-thumb 속성이 붙은 캔버스가 있으면 그것, 없으면 첫 번째 차트 캔버스
// - 찍는 시점: --wait 밀리초 동안 시뮬레이션을 돌린 뒤 (실험별 시점은 아래 WAIT에서 조정)
// - 직접 고른 그림을 쓰려면 site/thumbs/custom/<slug>.jpg|png|webp 를 넣는다 (그쪽이 우선). 그 뒤 python3 tools/pages/index.py
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const WAIT = { traffic: 12000, schelling: 10000, firefly: 14000, painters: 12000, fashion: 10000, population: 12000 };
(async () => {
  const { srv, base, SITE } = await require('./serve')();
  const args = process.argv.slice(2), opt = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
  let slugs = (args.find((a) => !a.startsWith('--')) || '').split(',').filter(Boolean);
  if (!slugs.length) slugs = fs.readdirSync(SITE + '/experiments').sort();
  const OUT = path.join(SITE, 'thumbs'); fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  async function one(s) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
    await ctx.addInitScript(() => { try { localStorage.setItem('lab-lang', 'ko'); } catch (e) {} });
    await ctx.route(/abacus|jasoncameron/, (r) => r.fulfill({ status: 200, body: '{"value":1}' }));
    const page = await ctx.newPage();
    await page.goto(base + `experiments/${s}/?thumb=1`);   // ?thumb=1 이면 실험이 대표 장면으로 바로 가도록 app.js에서 처리할 수 있다
    await page.waitForTimeout(+(opt.wait || WAIT[s] || 9000));
    const url = await page.evaluate(() => {
      const c = document.querySelector('canvas[data-thumb]') || document.querySelector('main section.panel canvas') || document.querySelector('main canvas');
      if (!c || !c.width) return null;
      const S = 480, o = document.createElement('canvas'); o.width = o.height = S; const x = o.getContext('2d');
      const bg = getComputedStyle(c).backgroundColor; x.fillStyle = bg && bg !== 'rgba(0, 0, 0, 0)' ? bg : '#ffffff'; x.fillRect(0, 0, S, S);
      // 가운데를 정사각형으로 잘라 채운다 (가로가 길면 양옆을 자름)
      const w = c.width, h = c.height, k = Math.min(w, h), sx = (w - k) / 2, sy = (h - k) / 2;
      x.drawImage(c, sx, sy, k, k, 0, 0, S, S);
      return o.toDataURL('image/jpeg', 0.82);
    });
    if (!url) { console.log(s, '캔버스 없음'); await ctx.close(); return; }
    fs.writeFileSync(path.join(OUT, s + '.jpg'), Buffer.from(url.split(',')[1], 'base64'));
    console.log(s, 'ok', Math.round(fs.statSync(path.join(OUT, s + '.jpg')).size / 1024) + 'KB');
    await ctx.close();
  }
  let i = 0; await Promise.all(Array.from({ length: 4 }, async () => { while (i < slugs.length) await one(slugs[i++]); }));
  await browser.close(); srv.close();
})();
