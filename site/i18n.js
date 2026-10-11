// 다국어: 한국어 · English · Español · Français · 日本語
//  - 언어 선택: 주소의 ?lang= > 저장된 선택 > 브라우저 언어 (지원 언어가 아니면 영어)
//  - 정적 문구: 요소의 data-en(영어 HTML)을 원문 키로 삼아, 선택한 언어의 사전(i18n-xx.js)에서 찾아 바꿔 끼운다. 없으면 영어.
//  - 실행 중 JS가 만드는 문구와 캔버스 글자: I18N.t()가 한국어 원문을 번역 규칙으로 번역한다 (없으면 영어)
//  - es/fr/ja 사전은 해당 언어를 고를 때만 불러온다 (i18n-es.js 등)
(function () {
  const KEY = 'lab-lang';
  const LANGS = [['ko', '한국어'], ['en', 'English'], ['es', 'Español'], ['fr', 'Français'], ['ja', '日本語']];
  const CODES = LANGS.map((x) => x[0]);
  let lang = null;
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (CODES.indexOf(q) >= 0) { lang = q; localStorage.setItem(KEY, q); }
    else lang = localStorage.getItem(KEY);
  } catch (e) {}
  if (CODES.indexOf(lang) < 0) {
    const nav = (navigator.language || 'ko').toLowerCase().slice(0, 2);
    lang = CODES.indexOf(nav) >= 0 ? nav : 'en';
  }

  const HANGUL = /[ㄱ-ㆎ가-힣]/;
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tables = {};
  const mk = () => ({ exact: Object.create(null), rules: [], frags: [] });
  const statics = {};
  const missing = new Set(), fallbacks = new Set();

  // 실행 중 문구 규칙 추가: dict = { 한국어 원문(자리표시자 {0} {#0} {%0}) : 번역 }
  function addLang(l, dict) {
    const tb = tables[l] || (tables[l] = mk());
    for (const ko in dict) {
      const val = dict[ko], key = ko.trim();
      if (!/\{[#%]?\d+\}/.test(key)) { tb.exact[key] = val; continue; }
      const names = []; let src = '', last = 0, stat = 0;
      key.replace(/\{([#%]?)(\d+)\}/g, (m, ty, i, off) => {
        const part = key.slice(last, off); src += esc(part); stat += part.length;
        src += ty === '#' ? '(-?[\\d,]*\\.?\\d+)' : ty === '%' ? '(-?[\\d.]+%)' : '([\\s\\S]*?)';
        names.push(+i); last = off + m.length; return m;
      });
      const tail = key.slice(last); src += esc(tail); stat += tail.length;
      tb.rules.push({ re: new RegExp('^' + src + '$'), names, val, stat, n: names.length });
    }
    tb.rules.sort((a, b) => b.stat - a.stat || a.n - b.n);
    tb.frags = Object.keys(tb.exact).sort((a, b) => b.length - a.length);
  }
  const add = (dict) => addLang('en', dict); // 기존 i18n-en.js 호환

  function lookup(l, core, depth) {
    const tb = tables[l];
    if (!tb) return undefined;
    if (tb.exact[core] !== undefined) return tb.exact[core];
    for (const r of tb.rules) {
      const x = r.re.exec(core);
      if (!x) continue;
      return r.val.replace(/\{(\d+)\}/g, (mm, i) => { const v = x[r.names.indexOf(+i) + 1]; return depth < 4 ? t(v, depth + 1) : v; });
    }
    return undefined;
  }

  function t(s, depth) {
    depth = depth || 0;
    if (lang === 'ko' || typeof s !== 'string' || !HANGUL.test(s)) return s;
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s), core = m[2];
    let out = lookup(lang, core, depth);
    if (out === undefined && lang !== 'en') out = lookup('en', core, depth); // 해당 언어 번역이 없으면 영어
    if (out === undefined) {
      fallbacks.add(core); out = core;
      const tb = tables.en;
      if (tb) for (const f of tb.frags) if (out.indexOf(f) >= 0) out = out.split(f).join(tb.exact[f]);
    }
    if (HANGUL.test(out)) missing.add(core);
    return m[1] + out + m[3];
  }

  // 정적 문구: 영어 HTML → 선택 언어 HTML
  function addStatic(l, dict) { statics[l] = Object.assign(statics[l] || {}, dict); }
  function st(enHtml) {
    if (lang === 'en' || lang === 'ko') return enHtml;
    const d = statics[lang];
    return (d && d[enHtml] !== undefined) ? d[enHtml] : enHtml;
  }

  // 자바스크립트가 직접 쓰는 짧은 화면 문구 (영어 문구가 키)
  const UI = {
    'How it works': { es: 'Cómo funciona', fr: 'Fonctionnement', ja: 'しくみ' },
    'What it shows': { es: 'Qué muestra', fr: 'Ce que ça montre', ja: '結果の読み方' },
    'Notes': { es: 'Notas', fr: 'Notes', ja: '実装メモ' },
    '✕ Close': { es: '✕ Cerrar', fr: '✕ Fermer', ja: '✕ 閉じる' },
    '⚙ Settings': { es: '⚙ Ajustes', fr: '⚙ Réglages', ja: '⚙ 設定' },
    '🔗 Copy link': { es: '🔗 Copiar enlace', fr: '🔗 Copier le lien', ja: '🔗 リンクをコピー' },
    'Copies a link that opens this experiment with the current settings': { es: 'Copia un enlace que abre este experimento con los ajustes actuales', fr: 'Copie un lien qui ouvre cette expérience avec les réglages actuels', ja: '現在の設定のままこの実験を開くリンクをコピーします' },
    '✓ Copied': { es: '✓ Copiado', fr: '✓ Copié', ja: '✓ コピーしました' },
    'Copy this link:': { es: 'Copia este enlace:', fr: 'Copiez ce lien :', ja: 'このリンクをコピーしてください:' },
    '← Previous (P)': { es: '← Anterior (P)', fr: '← Précédente (P)', ja: '← 前の実験 (P)' },
    'All experiments': { es: 'Todos los experimentos', fr: 'Toutes les expériences', ja: '実験一覧' },
    'Next (N) →': { es: 'Siguiente (N) →', fr: 'Suivante (N) →', ja: '次の実験 (N) →' },
    'What if success were mostly luck?': { es: '¿Y si el éxito fuera sobre todo suerte?', fr: 'Et si la réussite était surtout une question de chance ?', ja: 'もし成功のほとんどが運だったら?' },
    'What if everyone wanted a slightly better partner?': { es: '¿Y si todos quisieran una pareja un poco mejor?', fr: 'Et si chacun voulait un partenaire un peu meilleur ?', ja: 'もし誰もが少しだけ良い相手を望んだら?' },
    'What if a tiny brake tap could jam a whole highway?': { es: '¿Y si un leve toque de freno atascara toda una autopista?', fr: 'Et si un simple coup de frein bloquait toute une autoroute ?', ja: 'もしブレーキ一回が高速道路全体を止めたら?' },
    'What if one person could tip a revolution?': { es: '¿Y si una sola persona pudiera desatar una revolución?', fr: 'Et si une seule personne pouvait déclencher une révolution ?', ja: 'もし一人の人が革命の引き金になったら?' },
    'What if 100 painters copied each other?': { es: '¿Y si 100 pintores se copiaran entre sí?', fr: 'Et si 100 peintres se copiaient les uns les autres ?', ja: 'もし100人の画家が互いに真似し合ったら?' },
    'What if the voting method changed the winner?': { es: '¿Y si el sistema de votación cambiara al ganador?', fr: 'Et si le mode de scrutin changeait le vainqueur ?', ja: 'もし投票方式が当選者を変えたら?' }
  };
  // 한국어면 ko, 영어면 en, 그 밖의 언어면 UI 사전(없으면 영어)
  function u(ko, en) {
    if (lang === 'ko') return ko;
    if (lang === 'en') return en;
    const d = UI[en]; return (d && d[lang]) || en;
  }

  function walk(node) {
    if (node.nodeType === 3) { if (HANGUL.test(node.nodeValue)) { const v = t(node.nodeValue); if (v !== node.nodeValue) node.nodeValue = v; } }
    else if (node.nodeType === 1 && !/^(SCRIPT|STYLE)$/.test(node.tagName)) node.childNodes.forEach(walk);
  }

  function applyStatic() {
    document.querySelectorAll('[data-en]').forEach((el) => { el.innerHTML = st(el.getAttribute('data-en')); });
    document.querySelectorAll('[data-en-title]').forEach((el) => { el.setAttribute('title', st(el.getAttribute('data-en-title'))); });
    document.querySelectorAll('[data-en-content]').forEach((el) => { el.setAttribute('content', st(el.getAttribute('data-en-content'))); });
  }

  function choose(l) {
    if (l === lang) return;
    try { localStorage.setItem(KEY, l); } catch (e) {}
    const url = new URL(location.href); url.searchParams.delete('lang'); location.href = url.toString();
  }

  // 우상단 언어 선택 (드롭다운)
  function toggle() {
    const host = document.querySelector('.navr') || document.querySelector('.nav .wrap');
    if (!host) return;
    const box = document.createElement('div');
    box.className = 'langtoggle'; box.setAttribute('role', 'group'); box.setAttribute('aria-label', 'Language');
    const cur = LANGS.filter((x) => x[0] === lang)[0];
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'lt-btn'; btn.setAttribute('aria-haspopup', 'listbox'); btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span class="lt-globe" aria-hidden="true">🌐</span><span class="lt-cur"></span><span class="lt-caret" aria-hidden="true">▾</span>';
    btn.querySelector('.lt-cur').textContent = cur[1];
    const menu = document.createElement('ul');
    menu.className = 'lt-menu'; menu.setAttribute('role', 'listbox'); menu.hidden = true;
    LANGS.forEach(([l, label]) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option'); li.setAttribute('data-l', l); li.setAttribute('aria-selected', String(l === lang));
      li.tabIndex = -1; li.textContent = label; if (l === lang) li.className = 'on';
      li.addEventListener('click', () => choose(l));
      li.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(l); }
        else if (e.key === 'ArrowDown' && li.nextElementSibling) { e.preventDefault(); li.nextElementSibling.focus(); }
        else if (e.key === 'ArrowUp' && li.previousElementSibling) { e.preventDefault(); li.previousElementSibling.focus(); }
        else if (e.key === 'Escape') { close(); btn.focus(); }
      });
      menu.appendChild(li);
    });
    function open() { menu.hidden = false; btn.setAttribute('aria-expanded', 'true'); const on = menu.querySelector('.on') || menu.firstChild; on.focus(); }
    function close() { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
    btn.addEventListener('click', () => { if (menu.hidden) open(); else close(); });
    document.addEventListener('click', (e) => { if (!box.contains(e.target)) close(); });
    box.appendChild(btn); box.appendChild(menu);
    host.appendChild(box);
  }

  window.I18N = { lang, t, u, st, add, addLang, addStatic, apply: applyStatic, missing, fallbacks, langs: LANGS };
  document.documentElement.lang = lang;
  toggle();
  // es / fr / ja 사전은 이 스크립트 바로 뒤에 동기적으로 불러온다
  if (lang !== 'ko' && lang !== 'en') {
    const me = document.currentScript, src = me && me.src;
    if (src) document.write('<script src="' + src.replace(/i18n\.js(\?.*)?$/, 'i18n-' + lang + '.js') + '"><\/script>');
  }
  if (lang === 'en') applyStatic(); // es/fr/ja는 사전 파일이 끝에서 I18N.apply()를 부른다
  if (lang !== 'ko') {
    new MutationObserver((recs) => {
      for (const r of recs) {
        if (r.type === 'characterData') walk(r.target);
        else r.addedNodes.forEach(walk);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }
})();
