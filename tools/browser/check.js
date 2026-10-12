// 실제 브라우저(헤드리스 크롬)로 페이지를 열어 오류·번역 누락을 검사한다.
// 사용법: NODE_PATH=~/.simlab-tools/node_modules node tools/browser/check.js [slug,...|all] [langs=ko,en,es,fr,ja,ru,zh] [wait=4000]
const { chromium } = require('playwright');
const serve = require('./serve'), fs = require('fs');
(async () => {
  const { srv, base, SITE } = await serve();
  let slugs = (process.argv[2] || 'all').split(',');
  if (slugs[0] === 'all') slugs = ['index', ...fs.readdirSync(SITE + '/experiments').sort()];
  const langs = (process.argv[3] || 'ko,en,es,fr,ja,ru,zh').split(','), wait = +(process.argv[4] || 4000);
  const launch = () => chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  let browser = await launch(), bad = 0, relaunching = null;
  // 브라우저가 죽으면(메모리 부족 등) 다시 띄운다
  const ensure = async () => { if (!browser.isConnected()) { relaunching = relaunching || launch().then((b) => { browser = b; relaunching = null; }); await relaunching; } };
  const jobs = [];
  for (const s of slugs) for (const l of langs) jobs.push([s, l]);
  async function one([s, l]) {
    for (let k = 0; k < 2; k++) {
      try { await ensure(); await one_([s, l]); return; }
      catch (e) { if (k === 1 || browser.isConnected()) { bad++; console.log(`✗ ${s}/${l}  검사 실패: ${e.message.split('\n')[0]}`); return; } }
    }
  }
  async function one_([s, l]) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript((x) => { try { localStorage.setItem('lab-lang', x); } catch (e) {} }, l);
    await ctx.route(/abacus|jasoncameron/, (r) => r.fulfill({ status: 200, body: '{"value":1}' }));
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    const t0 = Date.now();
    try { await page.goto(base + (s === 'index' ? '' : `experiments/${s}/`), { waitUntil: 'load', timeout: 45000 }); }
    catch (e) { errs.push('로딩 시간 초과(45초)'); }
    const loadMs = Date.now() - t0;
    await page.waitForTimeout(wait / 2);
    // 버튼 몇 개 눌러 실행 중 문구도 만들어 본다
    for (const id of ['stepbtn', 'play', 'reroll', 'batch']) { const b = await page.$('#' + id); if (b) { try { await b.click({ timeout: 1000 }); } catch (e) {} await page.waitForTimeout(300); } }
    await page.waitForTimeout(wait / 2);
    const r = await page.evaluate((lang) => {
      const H = /[ㄱ-ㆎ가-힣]/, left = [];
      if (lang !== 'ko') {
        const w = document.createTreeWalker(document.body, 4); let n;
        while ((n = w.nextNode())) { const p = n.parentElement; if (!p || p.closest('script,style,.langtoggle')) continue; if (H.test(n.nodeValue)) left.push(n.nodeValue.trim().slice(0, 60)); }
        document.querySelectorAll('[title]').forEach((e) => { if (H.test(e.title) && !e.closest('.langtoggle')) left.push('title: ' + e.title.slice(0, 60)); });
      }
      const I = window.I18N || {};
      return { left: [...new Set(left)], missing: lang === 'ko' ? [] : [...(I.missing || [])], lang: document.documentElement.lang };
    }, l);
    const probs = [...errs, ...r.left.map((x) => '한글: ' + x), ...r.missing.map((x) => '번역 없음: ' + x)];
    if (probs.length) { bad++; console.log(`✗ ${s}/${l}`); probs.slice(0, 8).forEach((p) => console.log('    ' + p)); }
    else console.log(`✓ ${s}/${l}` + (loadMs > 8000 ? `  (로딩 ${Math.round(loadMs / 1000)}초)` : ''));
    await ctx.close();
  }
  const N = 4; let i = 0;
  await Promise.all(Array.from({ length: N }, async () => { while (i < jobs.length) await one(jobs[i++]); }));
  await browser.close(); srv.close();
  console.log(bad ? `문제 있는 페이지 ${bad}개` : '모두 통과'); process.exit(bad ? 1 : 0);
})();
