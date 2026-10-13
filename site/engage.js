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
  const $ = (id) => document.getElementById(id);

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
  let S = { done: {}, stars: [], days: [], last: 0, nudged: 0, pred: {}, polls: {}, subscribed: 0 };
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
      ran = true; markDone(slug); document.dispatchEvent(new Event('lab:ran'));
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

    // ---------- 영상 연결: site/videos.js 에 실험별 유튜브 영상 ID가 있으면 "이 실험을 영상으로" 칸을 보여준다 ----------
    { const vs = document.createElement('script'); vs.src = BASE + 'videos.js';
      vs.onload = () => {
        const id = (window.LAB_VIDEOS || {})[slug]; if (!id || !/^[\w-]{6,20}$/.test(id)) return;
        const tv = (ko) => (I.t ? I.t(ko) : ko);
        const sec = document.createElement('section'); sec.className = 'vidbox';
        sec.innerHTML = `<h2>${esc(tv('▶ 이 실험을 영상으로 보기'))}</h2><button type="button" class="vid" aria-label="${esc(tv('영상 재생'))}"><img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="" loading="lazy"><span class="vplay">▶</span></button>`;
        const anchor = document.querySelector('.more-like') || document.querySelector('.xnav'); if (anchor) anchor.before(sec); else document.querySelector('main').appendChild(sec);
        sec.querySelector('.vid').addEventListener('click', (e) => { e.currentTarget.outerHTML = `<iframe class="vframe" src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0" title="YouTube" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`; });
      };
      document.head.appendChild(vs); }

    // ---------- 먼저 예상해 보세요 ----------
    // 질문 데이터(predict.js, 한국어)를 필요할 때만 불러온다. 번역은 I18N.t(한국어 문구)로 한다.
    const tt = (ko) => (I.t ? I.t(ko) : ko);
    const wb = document.querySelector('.workbench');
    if (wb && !/[?&]thumb=1/.test(location.search)) {
      const ps = document.createElement('script'); ps.src = BASE + 'predict.js';
      ps.onload = () => { const P = (window.LAB_PREDICT || {})[slug]; if (P) predictCard(P); };
      document.head.appendChild(ps);
    }
    function predictCard(P) {
      S.pred = S.pred || {}; const mine = S.pred[slug] || null;
      const el = document.createElement('section'); el.className = 'predict'; el.id = 'predict';
      wb.before(el);
      let timer = null;
      const optTxt = (i) => esc(tt(P.o[i]));
      const lead = document.querySelector('main p.lead');
      // 답을 고르거나 건너뛰기 전까지 정답이 들어 있는 소개 글을 숨기고 실험 화면을 흐리게 한다
      const gate = (on) => { wb.classList.toggle('pgated', on); if (lead) lead.classList.toggle('pgated-lead', on); };
      function send(choice) {
        const url = window.LAB_LOG_URL; if (!url || !real || !(window.LAB_LOG_VER >= 3)) return;
        let cc = 'ZZ'; try { cc = sessionStorage.getItem('lab-cc') || 'ZZ'; } catch (e) {}
        try { fetch(url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ type: 'predict', page: slug, choice, country: cc, device: /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop' }), keepalive: true }); } catch (e) {}
      }
      function render() {
        const m = S.pred[slug];
        let h = `<h2>${esc(tt('🔮 먼저 예상해 보세요'))}</h2><p class="pq">${esc(tt(P.q))}</p>`;
        gate(!m);
        if (!m) {
          h += `<div class="popts">${P.o.map((o, i) => `<button type="button" class="popt" data-i="${i}">${optTxt(i)}</button>`).join('')}</div><p class="pnote">${esc(tt('예상을 고르면 실험 결과가 열려요.'))} <button type="button" class="pskip">${esc(tt('건너뛰고 바로 보기'))}</button></p>`;
        } else if (m.skip) {
          h += `<div class="popts">${P.o.map((o, i) => `<button type="button" class="popt" data-i="${i}">${optTxt(i)}</button>`).join('')}</div><p class="pnote">${esc(tt('건너뛰었어요. 지금 골라도 돼요.'))}</p>`;
        } else if (!m.r) {
          h += `<p class="pmine">${esc(tt('내 예상: ' + P.o[m.c]))}</p><p class="pnote">${esc(tt('이제 아래 실험을 돌려 보세요. 결과를 본 뒤 정답을 확인할 수 있어요.'))}</p><button type="button" class="preveal">${esc(tt('정답 보기'))}</button>`;
        } else {
          const ok = m.c === P.a;
          h += `<div class="popts">${P.o.map((o, i) => `<span class="popt ${i === P.a ? 'right' : (i === m.c ? 'wrong' : 'off')}${i === m.c ? ' mine' : ''}">${i === P.a ? '✓ ' : ''}${optTxt(i)}${i === m.c ? ' ◀' : ''}</span>`).join('')}</div>` +
            `<p class="pres ${ok ? 'ok' : 'no'}">${esc(tt(ok ? '🎯 맞혔어요!' : '🤔 틀렸어도 괜찮아요. 이 반전이 바로 이 실험이에요.'))}</p>` +
            `<p class="pwhy"><b>${esc(tt('정답: ' + P.o[P.a]))}</b> — ${esc(tt(P.w))}</p><div id="pothers"></div>`;
        }
        el.innerHTML = h;
        el.querySelectorAll('.popt[data-i]').forEach((b) => b.addEventListener('click', () => choose(+b.dataset.i)));
        const rv = el.querySelector('.preveal'); if (rv) rv.addEventListener('click', reveal);
        const sk = el.querySelector('.pskip'); if (sk) sk.addEventListener('click', () => { S.pred[slug] = { skip: 1, r: 0, t: Date.now() }; save(); render(); });
        if (m && m.r && !m.late) others();
      }
      function choose(i) { const late = !!(S.pred[slug] && S.pred[slug].skip); S.pred[slug] = { c: i, r: 0, t: Date.now(), late: late ? 1 : 0 }; save(); if (!late) send(i); render(); }   // 건너뛴 뒤에 고른 답은 투표·적중에 세지 않는다
      function reveal() { clearTimeout(timer); const m = S.pred[slug]; if (!m || m.r || m.c == null) return; m.r = 1; m.ok = m.c === P.a ? 1 : 0; save(); render(); }
      // 다른 방문자들의 예상 (구글 시트가 v3일 때만, 5명 이상 모였을 때만)
      function others() {
        const url = window.LAB_LOG_URL; if (!url || !real) return;
        fetch(url + '?a=pred&slug=' + encodeURIComponent(slug)).then((r) => r.json()).then((j) => {
          const c = j && j.counts; if (!c || c.length !== P.o.length) return;
          const n = c.reduce((a, b) => a + b, 0); if (n < 5) return;
          const box = document.getElementById('pothers'); if (!box) return;
          const pct = (v) => Math.round((100 * v) / n);
          box.innerHTML = `<p class="poth-t">${esc(tt('다른 방문자 ' + n + '명의 예상'))}</p>` + P.o.map((o, i) => `<div class="pbar${i === P.a ? ' right' : ''}"><span class="pl">${optTxt(i)}</span><span class="pb"><i style="width:${pct(c[i])}%"></i></span><span class="pv">${pct(c[i])}%</span></div>`).join('') +
            `<p class="poth-s">${esc(tt('정답을 맞힌 사람: ' + pct(c[P.a]) + '%'))}</p>`;
        }).catch(() => {});
      }
      // 답을 고른 뒤 실험을 돌려 보면 몇 초 뒤 정답을 자동으로 보여준다
      document.addEventListener('lab:ran', () => { const m = S.pred[slug]; if (m && m.c != null && !m.r && !timer) timer = setTimeout(reveal, 9000); });
      render();
    }
  }

  // 시트가 v2(머문 시간 기록을 받는 버전)인지 확인 — 하루 한 번만 물어 본다
  (function () {
    const url = window.LAB_LOG_URL; if (!url || !real) return;
    let v = null; try { v = sessionStorage.getItem('lab-v2'); } catch (e) {}
    const set = (n) => { window.LAB_LOG_VER = n; window.LAB_LOG_V2 = n >= 2; };
    if (v != null) { set(+v || 0); return; }
    fetch(url + '?a=v').then((r) => r.json()).then((j) => { const n = (j && j.v) || 1; set(n); try { sessionStorage.setItem('lab-v2', String(n)); } catch (e) {} }).catch(() => {});
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
      const pr = Object.values(S.pred || {}).filter((x) => x && x.r && !x.late), prOk = pr.filter((x) => x.ok).length;
      strip.hidden = false;
      strip.innerHTML = `<div class="pg-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${n}"><i style="width:${(100 * n) / total}%"></i></div><span class="pg-t">${esc(msg)}</span>` +
        (pr.length ? `<span class="pg-pred">🔮 ${esc(I.t ? I.t('예상 적중 ' + prOk + '/' + pr.length) : '')}</span>` : '') +
        (fresh ? `<span class="pg-new">${esc(T('지난 방문 이후 새 실험 {0}개', 'New since your last visit: {0}', fresh))}</span>` : '');
      const st = S.stars.map((s) => byId[s]).filter(Boolean);
      mine.hidden = !st.length;
      mine.innerHTML = st.length ? `<h3>★ ${esc(T('내 실험실', 'My Lab'))}</h3><div class="ecards">${st.map((x) => card(x, `<button type="button" class="ec-rm" data-s="${x.s}" aria-label="${esc(T('빼기', 'Remove'))}" title="${esc(T('빼기', 'Remove'))}">✕</button>`)).join('')}</div>` : '';
      mine.querySelectorAll('.ec-rm').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); toggleStar(b.dataset.s); render(); }));
    }
    render();
    // ---------- 오늘의 만약에 · 다음 실험 투표 · 새 실험 알림 ----------
    const tt = (ko) => (I.t ? I.t(ko) : ko);
    const send = (type, extra) => {
      const url = window.LAB_LOG_URL; if (!url || !real) return;
      let cc = 'ZZ'; try { cc = sessionStorage.getItem('lab-cc') || 'ZZ'; } catch (e) {}
      try { fetch(url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ type, country: cc, lang: LANG, device: /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop' }, extra)), keepalive: true }); } catch (e) {}
    };
    const counts = (id, n) => { const url = window.LAB_LOG_URL; if (!url || !real) return Promise.resolve(null); return fetch(url + '?a=pred&slug=' + encodeURIComponent(id) + '&n=' + n).then((r) => r.json()).then((j) => (j && j.counts && j.counts.length === n ? j.counts : null)).catch(() => null); };
    const kstDay = (offset) => { const d = new Date(Date.now() + (offset || 0) * 864e5); try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(d).replace(/-/g, ''); } catch (e) { return d.toISOString().slice(0, 10).replace(/-/g, ''); } };
    const dayIndex = (ymd) => Math.floor(Date.parse(ymd.slice(0, 4) + '-' + ymd.slice(4, 6) + '-' + ymd.slice(6, 8) + 'T00:00:00+09:00') / 864e5);
    // daily.js는 메인 페이지 HTML에서 engage.js보다 먼저 불러오므로 바로 카드를 만든다 (없을 때만 따로 불러온다)
    if (window.LAB_DAILY) setTimeout(() => buildDaily(window.LAB_DAILY), 0);
    else { const ds = document.createElement('script'); ds.src = BASE + 'daily.js'; ds.onload = () => { if (window.LAB_DAILY) buildDaily(window.LAB_DAILY); }; document.head.appendChild(ds); }
    function bars(opts, c, mark) {
      const n = c.reduce((a, b) => a + b, 0), pct = (v) => Math.round((100 * v) / n);
      return opts.map((o, i) => `<div class="pbar${mark === i ? ' right' : ''}"><span class="pl">${esc(tt(o))}${mark === i ? ' ◀' : ''}</span><span class="pb"><i style="width:${pct(c[i])}%"></i></span><span class="pv">${pct(c[i])}%</span></div>`).join('');
    }
    // 오늘의 만약에용 결과: 한 줄짜리 가로 막대 + 범례 (투표 화면과 비슷한 높이를 유지)
    function sbar(opts, c, mark) {
      const n = c.reduce((a, b) => a + b, 0), pct = (v) => Math.round((100 * v) / n), col = ['#7f8de0', '#b3bce9', '#d3d9f1'];
      const seg = opts.map((o, i) => `<i style="width:${(100 * c[i]) / n}%;background:${mark === i ? '#1fa463' : col[i % 3]}"></i>`).join('');
      const leg = opts.map((o, i) => `<span class="sl${mark === i ? ' right' : ''}"><b style="background:${mark === i ? '#1fa463' : col[i % 3]}"></b>${esc(tt(o))}${mark === i ? ' ◀' : ''} <em>${pct(c[i])}%</em></span>`).join('');
      return `<div class="sbar">${seg}</div><div class="slegend">${leg}</div>`;
    }
    function pollCard(box, id, q, opts, extra) {
      const render = (c) => {
        const mine = S.polls[id];
        let h = extra.head + `<p class="pq">${esc(tt(q))}</p>`;
        if (mine == null) h += `<div class="popts">${opts.map((o, i) => `<button type="button" class="popt" data-i="${i}">${esc(tt(o))}</button>`).join('')}</div>`;
        else {
          const n = c ? c.reduce((a, b) => a + b, 0) : 0;
          h += n >= 5 ? bars(opts, c, mine) + `<p class="poth-s">${esc(tt('지금까지 ' + n + '명이 투표했어요'))}</p>` : `<p class="pmine">${esc(tt('투표해 주셔서 고마워요! 더 많이 모이면 결과가 보여요.'))}</p>`;
        }
        box.innerHTML = h + (extra.foot ? extra.foot() : '');
        box.querySelectorAll('.popt[data-i]').forEach((b) => b.addEventListener('click', () => {
          S.polls[id] = +b.dataset.i; save(); send('predict', { page: id, choice: +b.dataset.i });
          render(null); setTimeout(() => counts(id, opts.length).then((cc) => render(cc)), 1500);
        }));
      };
      render(null); if (S.polls[id] != null) counts(id, opts.length).then((cc) => { if (cc) render(cc); });
    }
    function buildDaily(D) {
      const row = document.createElement('section'); row.className = 'dailyrow';
      row.innerHTML = '<div class="dcard" id="daily"></div><div class="dcard" id="topic"></div>';
      // 첫 화면에는 주기율표가 보이도록, 오늘의 만약에·투표는 주기율표와 실험 노트 아래에 둔다
      const nbEl = document.getElementById('nb'); if (nbEl) nbEl.after(row); else (document.querySelector('main') || document.body).prepend(row);
      // 넓은 화면에서는 오늘의 만약에 카드를 소개 영역 오른쪽(빈 자리)에 둔다. 좁은 화면에서는 표 아래에 둔다.
      const heroIn = document.querySelector('.hero-in'), dcard = row.querySelector('#daily');
      if (heroIn && dcard && window.matchMedia) {
        const mq = matchMedia('(min-width: 1060px)'), mqs = matchMedia('(max-width: 760px)');
        const place = () => {
          if (mq.matches) { heroIn.appendChild(dcard); dcard.classList.add('hero-daily'); dcard.classList.remove('mob-daily'); }
          else { row.prepend(dcard); dcard.classList.remove('hero-daily', 'mob-daily'); }
          row.classList.toggle('solo', mq.matches || mqs.matches);
          const sk = document.getElementById('daily-sk'); if (sk) sk.remove();
        };
        place(); [mq, mqs].forEach((q) => (q.addEventListener ? q.addEventListener('change', place) : q.addListener(place)));
      }
      // ---- 오늘의 만약에: 방문할 때마다 다른 질문이 나오고, 몇 초마다 다음 질문으로 바뀐다 ----
      const box = $('daily'), ROTATE_MS = 7000;
      box.style.setProperty('--dur', ROTATE_MS + 'ms');   // 진행 막대가 차는 시간 = 다음 질문으로 넘어가는 시간
      const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
      const idOf = (q) => 'q-' + q.s;
      // 순서: 아직 안 답한 질문을 먼저, 연이어 같은 분야가 나오지 않게 섞는다. 지난 방문의 첫 질문은 피한다.
      const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
      const fieldOf = (q) => (byId[q.s] || {}).f;
      let pool = shuffle(D.daily.slice());
      pool = pool.filter((q) => S.polls[idOf(q)] == null).concat(pool.filter((q) => S.polls[idOf(q)] != null));
      const order = [];
      while (pool.length) { const prev = order.length ? fieldOf(order[order.length - 1]) : null; let k = pool.findIndex((q) => fieldOf(q) !== prev); if (k < 0) k = 0; order.push(pool.splice(k, 1)[0]); }
      let last = null; try { last = localStorage.getItem('lab-dstart'); } catch (e) {}
      if (order.length > 1 && order[0].s === last) order.push(order.shift());
      try { localStorage.setItem('lab-dstart', order[0].s); } catch (e) {}
      let pos = 0, timer = null, paused = false, stopped = false;
      const rotating = () => !reduce && !stopped;
      function schedule() { clearTimeout(timer); if (!rotating() || paused) return; timer = setTimeout(() => { if (document.hidden) { schedule(); return; } go(1); }, ROTATE_MS); }
      // 카드 안쪽 HTML (표시용과 높이 재기용이 같은 것을 쓴다)
      function build(Q, mine, c) {
        const e = byId[Q.s];
        let h = `<h3>${esc(tt('🎯 내 직관, 맞을까?'))}<span class="dnav"><button type="button" class="dprev" aria-label="${esc(tt('이전 질문'))}" title="${esc(tt('이전 질문'))}">‹</button><button type="button" class="dnext" aria-label="${esc(tt('다음 질문'))}" title="${esc(tt('다음 질문'))}">›</button></span></h3>`;
        h += `<div class="dprog${rotating() && !paused ? ' run' : ''}"><i></i></div><div class="dbody"><p class="pq">${esc(tt(Q.q))}</p>`;
        if (mine == null) h += `<div class="popts">${Q.o.map((o, i) => `<button type="button" class="popt" data-i="${i}">${esc(tt(o))}</button>`).join('')}</div>`;
        let cap = '';
        const link = e ? `<a class="dlink" href="${BASE}experiments/${e.s}/">${esc(tt('이 질문, 실험해 볼까요? →'))}</a>` : '';
        if (mine != null) { const n = c ? c.reduce((a, b) => a + b, 0) : 0; if (n >= 5) { h += sbar(Q.o, c, mine); cap = `<p class="poth-s">${esc(tt('지금까지 ' + n + '명이 투표했어요'))}</p>`; } else h += `<p class="pmine">${esc(tt('투표해 주셔서 고마워요! 더 많이 모이면 결과가 보여요.'))}</p>`; }
        h += cap ? `<div class="dfoot">${cap}${link}</div>` : link;
        return h + '</div>';
      }
      function render(c) {
        const Q = order[pos], id = idOf(Q), mine = S.polls[id];
        const h0 = build(Q, mine, c);
        box.innerHTML = h0;
        box.querySelector('.dprev').addEventListener('click', () => go(-1, true));
        box.querySelector('.dnext').addEventListener('click', () => go(1, true));
        box.querySelectorAll('.popt[data-i]').forEach((b) => b.addEventListener('click', () => {
          S.polls[id] = +b.dataset.i; save(); send('predict', { page: id, choice: +b.dataset.i });
          stopped = true; clearTimeout(timer);        // 답을 골랐으면 결과를 읽을 수 있게 자동 전환을 멈춘다 (›를 누르면 계속)
          render(null); setTimeout(() => counts(id, Q.o.length).then((cc) => { if (order[pos] === Q) render(cc); }), 1500);
        }));
        if (mine != null && !c) counts(id, Q.o.length).then((cc) => { if (cc && order[pos] === Q) render(cc); });
        schedule();
      }
      // 부드럽게 바꾸기: 살짝 사라졌다가 다음 질문이 나타난다
      function go(d, manual) {
        if (manual) { stopped = false; }
        const body = box.querySelector('.dbody'); if (body && !reduce) { body.classList.add('fade'); }
        setTimeout(() => { pos = (pos + d + order.length) % order.length; render(null); }, body && !reduce ? 220 : 0);
      }
      box.addEventListener('mouseenter', () => { paused = true; clearTimeout(timer); const pr = box.querySelector('.dprog'); if (pr) pr.classList.remove('run'); });
      box.addEventListener('mouseleave', () => { paused = false; const pr = box.querySelector('.dprog'); if (pr && rotating()) { void pr.offsetWidth; pr.classList.add('run'); } schedule(); });
      box.addEventListener('focusin', () => { paused = true; clearTimeout(timer); const pr = box.querySelector('.dprog'); if (pr) pr.classList.remove('run'); });
      box.addEventListener('focusout', () => { paused = false; const pr = box.querySelector('.dprog'); if (pr && rotating()) { void pr.offsetWidth; pr.classList.add('run'); } schedule(); });
      // 카드 크기 고정: 모든 질문(투표 전·결과 화면)을 숨은 상자에 그려 가장 큰 높이로 맞춘다 → 질문이 바뀌어도 상자 크기가 변하지 않는다
      function lockHeight() {
        if (!box.clientWidth) return;
        const probe = box.cloneNode(false); probe.removeAttribute('id'); probe.className = box.className;
        probe.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;pointer-events:none;width:' + box.getBoundingClientRect().width + 'px;min-height:0;height:auto';
        const prof = getComputedStyle(box); probe.style.background = 'none';
        box.parentNode.appendChild(probe);
        let max = 0;
        D.daily.forEach((Q) => { [[null, null], [0, [3, 2, 1]]].forEach(([mine, c]) => { probe.innerHTML = build(Q, mine, c); max = Math.max(max, probe.getBoundingClientRect().height); }); });
        probe.remove();
        box.style.minHeight = Math.ceil(max) + 'px';
      }
      let lockT = null; const relock = () => { clearTimeout(lockT); lockT = setTimeout(lockHeight, 150); };
      window.addEventListener('resize', relock); if (document.fonts && document.fonts.ready) document.fonts.ready.then(relock);
      lockHeight();
      render(null);
      // 다음 실험 주제 투표
      pollCard($('topic'), D.topic.id, D.topic.q, D.topic.o, { head: `<h3>${esc(tt('🗳 다음 실험 투표'))}</h3>` });
    }
    // 새 실험 알림 신청 (시트가 v4일 때만 이메일 칸을 보여준다. 아니면 RSS·유튜브 링크만)
    const nb = document.getElementById('nb');
    if (nb) {
      const sec = document.createElement('section'); sec.className = 'notify'; sec.id = 'notify'; nb.parentNode.appendChild(sec);
      const rss = BASE + (LANG === 'ko' ? 'feed.xml' : 'feed-en.xml');
      const links = `<p class="nlinks"><a href="${rss}">${esc(tt('RSS로 받기'))}</a> · <a href="https://www.youtube.com/@simulatiolab?sub_confirmation=1" target="_blank" rel="noopener">${esc(tt('유튜브 구독'))}</a></p>`;
      const paint = (form) => {
        sec.innerHTML = `<h3>${esc(tt('📬 새 실험이 나오면 알려드릴게요'))}</h3>` + (S.subscribed ? `<p class="nok">${esc(tt('신청했어요! 새 실험이 나오면 알려드릴게요.'))}</p>` : form ? `<form class="nform" novalidate><input type="email" name="email" autocomplete="email" placeholder="${esc(tt('이메일 주소'))}" aria-label="${esc(tt('이메일 주소'))}" maxlength="120"><label class="nconsent"><input type="checkbox" name="consent"> <span>${esc(tt('새 실험 소식을 이메일로 받는 데 동의합니다'))}</span></label><button type="submit" class="btn big">${esc(tt('알림 신청'))}</button></form><p class="nnote">${esc(tt('이메일은 새 실험 소식을 보내는 데에만 쓰고, 받고 싶지 않으면 메일에 회신해 주시면 바로 지워요.'))}</p><p class="nmsg" role="status"></p>` : '') + links;
        const f = sec.querySelector('.nform');
        if (f) f.addEventListener('submit', (ev) => {
          ev.preventDefault(); const msg = sec.querySelector('.nmsg'), em = f.email.value.trim().toLowerCase();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) { msg.textContent = tt('이메일 주소를 확인해 주세요.'); return; }
          if (!f.consent.checked) { msg.textContent = tt('동의에 체크해 주세요.'); return; }
          if (!window.LAB_LOG_URL || !real) { msg.textContent = tt('지금은 신청할 수 없어요. 잠시 뒤에 다시 해 주세요.'); return; }
          send('subscribe', { email: em, consent: 1 }); S.subscribed = 1; save(); paint(false);
        });
      };
      paint(false);
      // 시트 버전 확인이 끝나면(최대 4초) 이메일 칸을 보여줄지 정한다
      let tries = 0; const wait = setInterval(() => { tries++; if (window.LAB_LOG_VER >= 4) { clearInterval(wait); paint(true); } else if (tries > 13) clearInterval(wait); }, 300);
    }
    window.addEventListener('pageshow', (e) => { if (e.persisted) { try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (x) {} render(); } });
  }
})();
