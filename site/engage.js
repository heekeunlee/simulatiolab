// 다시 오게 만드는 장치 모음 (모든 페이지가 불러옴)
//  - 실험 도장판: 해 본 실험에 ✓, 메인에 "34개 중 N개" 진행 막대, 분야를 다 하면 완료 표시
//  - ★ 내 실험실: 실험 페이지에서 ☆를 눌러 담고, 메인 맨 위 줄에 모아 보여준다
//  - "이게 흥미로웠다면": 실험 아래에 주제가 이어지는 다른 실험 카드 (아직 안 해 본 것 우선)
//  - NEW 표시와 "지난 방문 이후 새 실험"
//  - 즐겨찾기·홈 화면 추가 안내: 충분히 즐긴 순간에 한 번만, 닫으면 한 달 동안 다시 안 띄움
//  - 머문 시간·다시 온 방문자·실험 실행 여부를 방문 기록에 보탠다 (구글 시트가 v2일 때만)
// 모든 기록은 그 사람의 브라우저(localStorage)에만 저장된다. 기기끼리 연결되지 않는다.
(function () {
  const SRC = (document.currentScript && document.currentScript.src) || '';
  const BASE = SRC.slice(0, SRC.lastIndexOf('/') + 1);
  const I = window.I18N || {};
  const LANG = I.lang || 'ko';
  const EXPS = window.LAB_EXPS || [];
  if (!EXPS.length) return;
  const byId = {}; EXPS.forEach((x) => { byId[x.s] = x; });

  // ---------- 화면 문구 (영어 문구가 키, 한국어는 코드에) ----------
  if (I.addUI) I.addUI({
    'My Lab': { es: 'Mi laboratorio', fr: 'Mon labo', ja: 'マイラボ', ru: 'Моя лаборатория', zh: '我的实验室' },
    '{0} of {1} experiments tried': { es: '{0} de {1} experimentos probados', fr: '{0} expériences sur {1} essayées', ja: '{1}件中{0}件を試しました', ru: 'Опробовано {0} из {1} экспериментов', zh: '已体验 {0}/{1} 个实验' },
    '🎉 You tried every experiment!': { es: '🎉 ¡Has probado todos los experimentos!', fr: '🎉 Vous avez tout essayé !', ja: '🎉 すべての実験を試しました！', ru: '🎉 Вы попробовали все эксперименты!', zh: '🎉 你已体验全部实验！' },
    'NEW': { es: 'NUEVO', fr: 'NOUVEAU', ja: 'NEW', ru: 'НОВОЕ', zh: '新' },
    'New since your last visit: {0}': { es: 'Novedades desde tu última visita: {0}', fr: 'Nouveautés depuis votre dernière visite : {0}', ja: '前回の訪問以降の新着：{0}件', ru: 'Новое с прошлого визита: {0}', zh: '上次访问后的新增：{0} 个' },
    '☆ Save to My Lab': { es: '☆ Guardar en Mi laboratorio', fr: '☆ Ajouter à Mon labo', ja: '☆ マイラボに保存', ru: '☆ В мою лабораторию', zh: '☆ 收藏到我的实验室' },
    '★ In My Lab': { es: '★ En Mi laboratorio', fr: '★ Dans Mon labo', ja: '★ マイラボに保存済み', ru: '★ В моей лаборатории', zh: '★ 已在我的实验室' },
    'If you liked this one': { es: 'Si te ha gustado este', fr: 'Si celui-ci vous a plu', ja: 'これが面白かったら', ru: 'Если вам понравился этот', zh: '喜欢这个的话' },
    'Remove': { es: 'Quitar', fr: 'Retirer', ja: '削除', ru: 'Убрать', zh: '移除' },
    'Tried': { es: 'Probado', fr: 'Essayée', ja: '体験済み', ru: 'Пройдено', zh: '已体验' },
    '✓ All done': { es: '✓ Completo', fr: '✓ Terminé', ja: '✓ 完了', ru: '✓ Готово', zh: '✓ 全部完成' },
    'Bookmark this site ({0}) to find your way back easily.': { es: 'Añade este sitio a favoritos ({0}) para volver fácilmente.', fr: 'Ajoutez ce site à vos favoris ({0}) pour le retrouver facilement.', ja: 'ブックマーク（{0}）しておくと、また来やすくなります。', ru: 'Добавьте сайт в закладки ({0}), чтобы легко вернуться.', zh: '按 {0} 收藏本站，下次更容易找回来。' },
    'Tap Share, then “Add to Home Screen” to open Simulatio Lab like an app.': { es: 'Toca Compartir y elige «Añadir a pantalla de inicio» para abrir Simulatio Lab como una app.', fr: 'Touchez Partager, puis « Sur l’écran d’accueil » pour ouvrir Simulatio Lab comme une app.', ja: '共有ボタンから「ホーム画面に追加」を選ぶと、アプリのように開けます。', ru: 'Нажмите «Поделиться», затем «На экран “Домой”», чтобы открывать Simulatio Lab как приложение.', zh: '点按“分享”，再选“添加到主屏幕”，就能像应用一样打开 Simulatio Lab。' },
    'Add to Home Screen': { es: 'Añadir a pantalla de inicio', fr: 'Ajouter à l’écran d’accueil', ja: 'ホーム画面に追加', ru: 'Добавить на главный экран', zh: '添加到主屏幕' },
    'Maybe later': { es: 'Quizá luego', fr: 'Plus tard', ja: 'あとで', ru: 'Позже', zh: '以后再说' },
  });
  const T = (ko, en, ...a) => { let s = I.u ? I.u(ko, en) : ko; a.forEach((v, i) => { s = s.split('{' + i + '}').join(v); }); return s; };
  const title = (x) => (LANG === 'ko' ? x.ko : (I.st ? I.st(x.en) : x.en));
  const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- 저장 상태 ----------
  const KEY = 'lab-state';
  let S = { done: {}, stars: [], days: [], last: 0, nudged: 0 };
  try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
  const kst = () => { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date()); } catch (e) { return new Date().toISOString().slice(0, 10); } };
  const today = kst();
  // 이번 "방문"(탭을 연 동안) 전의 마지막 방문 시각. 사이트 안에서 페이지를 옮겨도 바뀌지 않게 탭에 기억해 둔다.
  let prevVisit = S.last || 0;
  try { const p = sessionStorage.getItem('lab-prev'); if (p != null) prevVisit = +p || 0; else sessionStorage.setItem('lab-prev', String(prevVisit)); } catch (e) {}
  const returning = S.days.some((d) => d !== today);   // 이전 날에 온 적이 있는가
  if (S.days.indexOf(today) < 0) { S.days.push(today); S.days = S.days.slice(-90); }
  S.last = Date.now(); save();
  const isDone = (s) => !!S.done[s];
  const isStar = (s) => S.stars.indexOf(s) >= 0;
  const markDone = (s) => { if (!s || S.done[s]) return; S.done[s] = Date.now(); save(); };
  const toggleStar = (s) => { const i = S.stars.indexOf(s); if (i >= 0) S.stars.splice(i, 1); else S.stars.unshift(s); save(); };
  const doneCount = () => EXPS.filter((x) => isDone(x.s)).length;

  const m = location.pathname.match(/\/experiments\/([^/]+)\//);
  const slug = m && m[1];
  const real = location.hostname === 'heekeunlee.github.io' && !navigator.webdriver && !/HeadlessChrome/.test(navigator.userAgent);

  // 카드 (추천, 내 실험실 공용)
  const card = (x, extra) => `<a class="ecard${isDone(x.s) ? ' done' : ''}" href="${BASE}experiments/${x.s}/" style="--c:${x.c}">` +
    `<span class="ec-img">${x.t ? `<img src="${BASE}${x.t}" alt="" loading="lazy" decoding="async">` : ''}<span class="ec-sym">${x.sym}</span>${isDone(x.s) ? `<span class="ec-done" title="${esc(T('해 봤어요', 'Tried'))}">✓</span>` : ''}</span>` +
    `<span class="ec-t">${esc(title(x))}</span>${extra || ''}</a>`;

  // =================== 실험 페이지 ===================
  if (slug && byId[slug]) {
    const me = byId[slug];
    let ran = false, secs = 0;
    // ★ 내 실험실 담기 (바로가기 칩 줄 끝에)
    const jump = document.querySelector('.jump');
    if (jump) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'star-chip';
      const paint = () => { const on = isStar(slug); b.textContent = on ? T('★ 내 실험실에 담김', '★ In My Lab') : T('☆ 내 실험실에 담기', '☆ Save to My Lab'); b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); };
      b.addEventListener('click', () => { toggleStar(slug); paint(); });
      paint(); jump.appendChild(b);
    }
    // "이게 흥미로웠다면": 아직 안 해 본 것을 먼저, 부족하면 해 본 것으로 채운다
    const rel = (me.r || []).map((s) => byId[s]).filter(Boolean);
    const pick = rel.filter((x) => !isDone(x.s)).concat(rel.filter((x) => isDone(x.s))).slice(0, 2);
    if (pick.length) {
      const sec = document.createElement('section'); sec.className = 'more-like';
      sec.innerHTML = `<h2>${esc(T('이게 흥미로웠다면', 'If you liked this one'))}</h2><div class="ecards">${pick.map((x) => card(x)).join('')}</div>`;
      const anchor = document.querySelector('.xnav');
      if (anchor) anchor.before(sec); else (document.querySelector('main') || document.body).appendChild(sec);
    }
    // "해 봤어요" 기준: 설정을 만지거나 버튼을 눌렀거나, 25초 이상 지켜봤다
    const touch = (e) => {
      const t = e.target; if (!t || !t.closest) return;
      if (t.closest('.jump, .xnav, .more-like, nav.nav, footer, .langtoggle, #admin-gate')) return;
      if (e.type === 'click' && !t.closest('button, select, input, summary, canvas')) return;
      ran = true; markDone(slug);
    };
    ['input', 'change', 'click'].forEach((ev) => document.addEventListener(ev, touch, true));
    // 머문 시간(보이는 동안만) + 즐겨찾기 안내 시점 판단
    setInterval(() => {
      if (document.hidden) return;
      secs++; if (secs === 25) markDone(slug);
      if (secs % 5 === 0) maybeNudge(secs);
    }, 1000);
    // 방문 기록에 머문 시간·실행 여부 보내기 (구글 시트가 v2일 때만)
    let sent = false;
    const leave = () => {
      if (sent || secs < 3) return; sent = true;
      const url = window.LAB_LOG_URL; if (!url || !real || !window.LAB_LOG_V2) return;
      let cc = 'ZZ'; try { cc = sessionStorage.getItem('lab-cc') || 'ZZ'; } catch (e) {}
      const body = JSON.stringify({ type: 'leave', country: cc, page: location.pathname.replace(/^\/simulatiolab/, ''), lang: LANG, device: /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop', secs: Math.min(secs, 1800), ran: ran ? 1 : 0, returning: returning ? 1 : 0 });
      try { fetch(url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body, keepalive: true }); } catch (e) {}
    };
    document.addEventListener('visibilitychange', () => { if (document.hidden) leave(); });
    window.addEventListener('pagehide', leave);
    window.LAB_ENGAGE = { slug, secs: () => secs, ran: () => ran };
  }

  // 시트가 v2(머문 시간 기록을 받는 버전)인지 확인 — 하루 한 번만 물어 본다
  (function () {
    const url = window.LAB_LOG_URL; if (!url || !real) return;
    let v = null; try { v = sessionStorage.getItem('lab-v2'); } catch (e) {}
    if (v != null) { window.LAB_LOG_V2 = v === '1'; return; }
    fetch(url + '?a=v').then((r) => r.json()).then((j) => { window.LAB_LOG_V2 = !!(j && j.v >= 2); try { sessionStorage.setItem('lab-v2', window.LAB_LOG_V2 ? '1' : '0'); } catch (e) {} }).catch(() => {});
  })();

  // =================== 즐겨찾기·홈 화면 안내 ===================
  let deferred = null, shown = 0;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; });
  const standalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  function maybeNudge(secs) {
    if (shown || standalone() || document.querySelector('#nudge')) return;
    if (S.nudged && Date.now() - S.nudged < 30 * 864e5) return;
    if (!(doneCount() >= 2 || secs >= 180)) return;
    shown = 1; showNudge();
  }
  function showNudge() {
    const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent) && !window.MSStream;
    const mac = /Mac/i.test(navigator.platform || navigator.userAgent);
    const mobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    let msg, act = '';
    if (ios) msg = T('공유 버튼을 누르고 “홈 화면에 추가”를 고르면 앱처럼 열 수 있어요.', 'Tap Share, then “Add to Home Screen” to open Simulatio Lab like an app.');
    else if (deferred) { msg = T('시뮬라티오 랩을 홈 화면에 두면 한 번에 열 수 있어요.', 'Keep Simulatio Lab one tap away.'); act = `<button type="button" class="nd-go">${esc(T('홈 화면에 추가', 'Add to Home Screen'))}</button>`; }
    else if (mobile) return;   // 그 밖의 휴대폰 브라우저는 방법이 제각각이라 안내하지 않는다
    else msg = T('즐겨찾기({0})에 추가해 두면 다시 오기 쉬워요.', 'Bookmark this site ({0}) to find your way back easily.', mac ? '⌘D' : 'Ctrl+D');
    const el = document.createElement('div'); el.id = 'nudge'; el.setAttribute('role', 'status');
    el.innerHTML = `<span class="nd-msg">${esc(msg)}</span>${act}<button type="button" class="nd-x">${esc(T('나중에', 'Maybe later'))}</button>`;
    document.body.appendChild(el);
    const close = () => { S.nudged = Date.now(); save(); el.remove(); };
    el.querySelector('.nd-x').onclick = close;
    const go = el.querySelector('.nd-go');
    if (go) go.onclick = () => { try { deferred.prompt(); } catch (e) {} close(); };
    setTimeout(() => { if (el.isConnected) close(); }, 20000);
  }
  // 홈 화면 앱(PWA)을 쓸 수 있게 서비스 워커 등록
  if (real && 'serviceWorker' in navigator) { try { navigator.serviceWorker.register(BASE + 'sw.js', { scope: BASE }).catch(() => {}); } catch (e) {} }

  // =================== 메인 페이지 ===================
  const table = document.querySelector('.ptable');
  if (!slug && table) {
    const NEW_DAYS = 7;
    const isNew = (x) => !!x.a && Date.now() - Date.parse(x.a) < NEW_DAYS * 864e5 && !isDone(x.s);
    const sec = table.closest('.table-sec');
    const strip = document.createElement('div'); strip.className = 'eng-progress'; strip.id = 'progress';
    const mine = document.createElement('div'); mine.className = 'mine'; mine.id = 'mine'; mine.hidden = true;
    const intro = sec.querySelector('p'); (intro || sec.querySelector('h2')).after(strip); strip.after(mine);
    const tiles = [...table.querySelectorAll('.el')];
    const slugOf = (el) => { const mm = (el.getAttribute('href') || '').match(/experiments\/([^/]+)\//); return mm && mm[1]; };
    function render() {
      const total = EXPS.length, n = doneCount();
      tiles.forEach((el) => {
        const s = slugOf(el), x = byId[s]; if (!x) return;
        el.classList.toggle('is-done', isDone(s)); el.classList.toggle('is-star', isStar(s));
        let nw = el.querySelector('.new-pill'); const want = isNew(x);
        if (want && !nw) { nw = document.createElement('span'); nw.className = 'new-pill'; nw.textContent = T('NEW', 'NEW'); el.appendChild(nw); } else if (!want && nw) nw.remove();
        let ck = el.querySelector('.done-mark');
        if (isDone(s) && !ck) { ck = document.createElement('span'); ck.className = 'done-mark'; ck.textContent = '✓'; ck.title = T('해 봤어요', 'Tried'); el.appendChild(ck); } else if (!isDone(s) && ck) ck.remove();
      });
      table.querySelectorAll('.col').forEach((col) => {
        const ts = [...col.querySelectorAll('.el')], all = ts.length && ts.every((el) => isDone(slugOf(el)));
        col.classList.toggle('complete', !!all);
        let b = col.querySelector('.fh .fcomp');
        if (all && !b) { b = document.createElement('em'); b.className = 'fcomp'; b.textContent = T('✓ 모두 완료', '✓ All done'); col.querySelector('.fh').appendChild(b); } else if (!all && b) b.remove();
      });
      const fresh = prevVisit ? EXPS.filter((x) => x.a && Date.parse(x.a) > prevVisit && !isDone(x.s)).length : 0;
      const msg = n === total ? T('🎉 모든 실험을 해 봤어요!', '🎉 You tried every experiment!') : T('{1}개 중 {0}개 해 봤어요', '{0} of {1} experiments tried', n, total);
      strip.hidden = false;
      strip.innerHTML = `<div class="pg-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${n}"><i style="width:${(100 * n) / total}%"></i></div><span class="pg-t">${esc(msg)}</span>` +
        (fresh ? `<span class="pg-new">${esc(T('지난 방문 이후 새 실험 {0}개', 'New since your last visit: {0}', fresh))}</span>` : '');
      const st = S.stars.map((s) => byId[s]).filter(Boolean);
      mine.hidden = !st.length;
      mine.innerHTML = st.length ? `<h3>★ ${esc(T('내 실험실', 'My Lab'))}</h3><div class="ecards">${st.map((x) => card(x, `<button type="button" class="ec-rm" data-s="${x.s}" aria-label="${esc(T('빼기', 'Remove'))}" title="${esc(T('빼기', 'Remove'))}">✕</button>`)).join('')}</div>` : '';
      mine.querySelectorAll('.ec-rm').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); toggleStar(b.dataset.s); render(); }));
    }
    render();
    window.addEventListener('pageshow', (e) => { if (e.persisted) { try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (x) {} render(); } });
  }
})();
