// 한국어 / English 전환
//  - 언어 선택: 주소의 ?lang=en|ko > 저장된 선택 > 브라우저 언어 (한국어가 아니면 영어)
//  - 정적 문구: 요소의 data-en(영어 HTML)로 바꿔 끼운다
//  - 실행 중에 JS가 만드는 문구와 캔버스 글자: I18N.t()가 번역 규칙(i18n-en.js)으로 번역한다
(function () {
  const KEY = 'lab-lang';
  let lang = null;
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (q === 'en' || q === 'ko') { lang = q; localStorage.setItem(KEY, q); }
    else lang = localStorage.getItem(KEY);
  } catch (e) {}
  if (lang !== 'en' && lang !== 'ko') lang = ((navigator.language || 'ko').toLowerCase().indexOf('ko') === 0) ? 'ko' : 'en';

  const HANGUL = /[ㄱ-ㆎ가-힣]/;
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const exact = Object.create(null), rules = [];
  let frags = [];
  const missing = new Set(), fallbacks = new Set();

  function add(dict) {
    for (const ko in dict) {
      const en = dict[ko], key = ko.trim();
      if (!/\{[#%]?\d+\}/.test(key)) { exact[key] = en; continue; }
      const names = []; let src = '', last = 0, statics = 0;
      key.replace(/\{([#%]?)(\d+)\}/g, (m, t, i, off) => {
        const part = key.slice(last, off); src += esc(part); statics += part.length;
        src += t === '#' ? '(-?[\\d,]*\\.?\\d+)' : t === '%' ? '(-?[\\d.]+%)' : '([\\s\\S]*?)';
        names.push(+i); last = off + m.length; return m;
      });
      const tail = key.slice(last); src += esc(tail); statics += tail.length;
      rules.push({ re: new RegExp('^' + src + '$'), names, en, statics, n: names.length });
    }
    rules.sort((a, b) => b.statics - a.statics || a.n - b.n);
    frags = Object.keys(exact).sort((a, b) => b.length - a.length);
  }

  function t(s, depth) {
    depth = depth || 0;
    if (typeof s !== 'string' || !HANGUL.test(s)) return s;
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s), core = m[2];
    let out;
    if (exact[core] !== undefined) out = exact[core];
    else {
      for (const r of rules) {
        const x = r.re.exec(core);
        if (!x) continue;
        out = r.en.replace(/\{(\d+)\}/g, (mm, i) => { const v = x[r.names.indexOf(+i) + 1]; return depth < 4 ? t(v, depth + 1) : v; });
        break;
      }
      if (out === undefined) { fallbacks.add(core); out = core; for (const f of frags) if (out.indexOf(f) >= 0) out = out.split(f).join(exact[f]); }
    }
    if (HANGUL.test(out)) missing.add(core);
    return m[1] + out + m[3];
  }

  function walk(node) {
    if (node.nodeType === 3) { if (HANGUL.test(node.nodeValue)) { const v = t(node.nodeValue); if (v !== node.nodeValue) node.nodeValue = v; } }
    else if (node.nodeType === 1 && !/^(SCRIPT|STYLE)$/.test(node.tagName)) node.childNodes.forEach(walk);
  }

  function applyStatic() {
    document.querySelectorAll('[data-en]').forEach((el) => { el.innerHTML = el.getAttribute('data-en'); });
    document.querySelectorAll('[data-en-title]').forEach((el) => { el.setAttribute('title', el.getAttribute('data-en-title')); });
    document.querySelectorAll('[data-en-content]').forEach((el) => { el.setAttribute('content', el.getAttribute('data-en-content')); });
  }

  function toggle() {
    const host = document.querySelector('.navr') || document.querySelector('.nav .wrap');
    if (!host) return;
    const box = document.createElement('div');
    box.className = 'langtoggle'; box.setAttribute('role', 'group'); box.setAttribute('aria-label', 'Language');
    [['ko', '한국어'], ['en', 'English']].forEach(([l, label]) => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = label; b.setAttribute('data-l', l);
      b.setAttribute('aria-pressed', String(l === lang)); if (l === lang) b.className = 'on';
      b.addEventListener('click', () => {
        if (l === lang) return;
        try { localStorage.setItem(KEY, l); } catch (e) {}
        const u = new URL(location.href); u.searchParams.delete('lang'); location.href = u.toString();
      });
      box.appendChild(b);
    });
    host.appendChild(box);
  }

  window.I18N = { lang, t, add, missing, fallbacks };
  document.documentElement.lang = lang;
  toggle();
  if (lang === 'en') {
    applyStatic();
    new MutationObserver((recs) => {
      for (const r of recs) {
        if (r.type === 'characterData') walk(r.target);
        else r.addedNodes.forEach(walk);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
    document.addEventListener('DOMContentLoaded', () => {});
  }
})();
