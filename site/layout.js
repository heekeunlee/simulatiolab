// 실험 페이지 배치: 제목 + 한 줄 소개 → 바로가기 → 작업대(입력값 왼쪽 고정 + 결과 오른쪽) → 읽을거리(모델 설명, 결과 해석, 구현 메모)
// 좁은 화면(휴대폰)에서는 입력값을 아래에서 올라오는 패널로 바꾸고, 오른쪽 아래의 "설정" 버튼으로 연다.
// 입력값 패널(.controls를 가진 .panel)이 없는 페이지(메인)에서는 아무 일도 하지 않는다.
(function () {
  const main = document.querySelector('main.wrap');
  const ctl = main && main.querySelector('.panel .controls');
  if (!ctl) return;
  const panel = ctl.closest('.panel');
  if (panel.parentElement !== main) return;
  const LG = window.I18N ? window.I18N.lang : 'ko', en = LG !== 'ko', U = (ko, e) => (window.I18N ? window.I18N.u(ko, e) : ko);

  const lead = main.querySelector('p.lead') || main.querySelector('h1');
  const h2s = Array.from(main.children).filter((e) => e.tagName === 'H2');
  const nextOf = (h) => h.nextElementSibling;
  const modelH2 = h2s.find((h) => nextOf(h) && nextOf(h).tagName === 'UL' && !nextOf(h).classList.contains('small'));
  const saysH2 = h2s.find((h) => nextOf(h) && nextOf(h).classList.contains('callout'));
  const implH2 = h2s.find((h) => nextOf(h) && nextOf(h).tagName === 'UL' && nextOf(h).classList.contains('small'));
  const tryH2 = panel.previousElementSibling && panel.previousElementSibling.tagName === 'H2' ? panel.previousElementSibling : null;

  // 입력값 패널부터 다음 제목(h2)이 나오기 전까지의 형제들을 결과 쪽으로 모은다
  const rest = [];
  for (let n = panel.nextElementSibling; n && n.tagName !== 'H2'; n = n.nextElementSibling) rest.push(n);

  const bench = document.createElement('div'); bench.className = 'workbench';
  const side = document.createElement('aside'); side.className = 'wb-side';
  const body = document.createElement('div'); body.className = 'wb-main';
  bench.appendChild(side); bench.appendChild(body);
  side.appendChild(panel);
  rest.forEach((n) => body.appendChild(n));
  main.classList.add('wide');
  if (tryH2) tryH2.remove();

  // 바로가기
  const jump = document.createElement('nav'); jump.className = 'jump';
  const labels = [U('모델 설명', 'How it works'), U('결과 해석', 'What it shows'), U('이론·구현 메모', 'Theory & notes')];
  jump.innerHTML = `<a href="#model">${labels[0]}</a><a href="#insight">${labels[1]}</a><a href="#notes">${labels[2]}</a>`;
  lead.after(jump); jump.after(bench);

  // 읽을거리: 모델 설명 → 결과 해석(말하는 것 | 말하지 않는 것 나란히) → 구현 메모(접어 둠)
  let anchor = bench;
  if (modelH2) {
    const sec = document.createElement('section'); sec.className = 'story'; sec.id = 'model';
    const ul = nextOf(modelH2); // 제목을 옮기기 전에 목록을 먼저 잡아 둔다 (옮긴 뒤에는 다음 형제가 없어짐)
    sec.appendChild(modelH2); if (ul) sec.appendChild(ul);
    anchor.after(sec); anchor = sec;
  }
  if (saysH2) {
    const sec = document.createElement('section'); sec.className = 'story'; sec.id = 'insight';
    const callouts = []; for (let n = nextOf(saysH2); n && n.classList.contains('callout'); n = n.nextElementSibling) callouts.push(n);
    const grid = document.createElement('div'); grid.className = 'callouts'; callouts.forEach((c) => grid.appendChild(c));
    sec.appendChild(saysH2); sec.appendChild(grid);
    anchor.after(sec); anchor = sec;
  }
  if (implH2) {
    const det = document.createElement('details'); det.className = 'notes'; det.id = 'notes';
    const sum = document.createElement('summary'); sum.innerHTML = implH2.innerHTML;
    const ul = nextOf(implH2); implH2.remove();
    det.appendChild(sum); det.appendChild(ul);
    anchor.after(det);
    jump.querySelector('a[href="#notes"]').addEventListener('click', () => { det.open = true; });
  }

  // 휴대폰: 아래에서 올라오는 설정 패널
  const fab = document.createElement('button');
  fab.type = 'button'; fab.className = 'wb-fab';
  const label = (open) => (open ? U('✕ 닫기', '✕ Close') : U('⚙ 설정', '⚙ Settings'));
  // 아이콘만 보이는 동그란 버튼 (재생 막대의 글자를 덜 가리도록). 글자 라벨은 화면 낭독기와 툴팁용
  const setFab = (o) => { const t = label(o); fab.textContent = t.split(' ')[0]; fab.setAttribute('aria-label', t.slice(2)); fab.title = t.slice(2); fab.setAttribute('aria-expanded', String(o)); };
  setFab(false);
  fab.addEventListener('click', () => setFab(panel.classList.toggle('open')));
  document.body.appendChild(fab);
  const mq = window.matchMedia('(max-width: 980px)');
  const apply = () => { panel.classList.toggle('wb-sheet', mq.matches); if (!mq.matches) { panel.classList.remove('open'); setFab(false); } };
  (mq.addEventListener ? mq.addEventListener('change', apply) : mq.addListener(apply));
  apply();
})();

// ---------- 실험 페이지 더하기: 주소로 설정 공유, 단축키, 이전/다음 실험 ----------
(function () {
  const main = document.querySelector('main.wrap');
  const ctl = main && main.querySelector('.panel .controls');
  if (!ctl) return;
  const LG = window.I18N ? window.I18N.lang : 'ko', en = LG !== 'ko', U = (ko, e) => (window.I18N ? window.I18N.u(ko, e) : ko);
  const $ = (id) => document.getElementById(id);
  const inputs = () => Array.from(ctl.querySelectorAll('input[type=range], select'));

  // 1) 주소의 ?s=id:값,id:값 으로 들어오면 그 설정으로 시작 (app.js가 읽기 전에 값만 바꿔 둔다)
  try {
    const s = new URLSearchParams(location.search).get('s');
    if (s) s.split(',').forEach((kv) => { const i = kv.indexOf(':'); const el = i > 0 && $(kv.slice(0, i)); if (el && el.closest('.controls')) el.value = decodeURIComponent(kv.slice(i + 1)); });
  } catch (e) {}

  // 2) "링크 복사" 버튼: 현재 설정을 담은 주소를 복사
  const btns = ctl.parentElement.querySelector('.btns');
  if (btns) {
    const b = document.createElement('button'); b.type = 'button'; b.id = 'share';
    const base = U('🔗 링크 복사', '🔗 Copy link');
    b.textContent = base; b.title = U('지금 설정 그대로 열리는 주소를 복사해요', 'Copies a link that opens this experiment with the current settings');
    b.addEventListener('click', () => {
      const q = inputs().map((el) => el.id + ':' + encodeURIComponent(el.value)).join(',');
      const u = new URL(location.href); u.searchParams.set('s', q); if (en) u.searchParams.set('lang', LG);
      const done = () => { b.textContent = U('✓ 복사했어요', '✓ Copied'); setTimeout(() => { b.textContent = base; }, 1800); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(u.toString()).then(done, () => prompt(U('이 주소를 복사하세요:', 'Copy this link:'), u.toString()));
      else prompt(U('이 주소를 복사하세요:', 'Copy this link:'), u.toString());
    });
    const seed = $('seedinfo'); btns.insertBefore(b, seed || null);
  }

  // 3) 단축키: 스페이스 = 재생/일시정지, R = 처음부터, N/P = 다음/이전 실험
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, select, textarea, button') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === 'Space') { const p = $('play'); if (p) { e.preventDefault(); p.click(); } }
    else if (e.key === 'r' || e.key === 'R') { const r = $('restart'); if (r) r.click(); }
    else if (e.key === 'n' || e.key === 'N' || e.key === 'p' || e.key === 'P') { const a = document.querySelector(e.key.toLowerCase() === 'n' ? '.xnav .next' : '.xnav .prev'); if (a) location.href = a.href; }
  });

  // 4) 이전 / 다음 실험
  const list = window.LAB_EXPS;
  if (list && list.length) {
    const slug = location.pathname.replace(/\/+$/, '').split('/').pop();
    const i = list.findIndex((x) => x.s === slug);
    if (i >= 0) {
      const prev = list[(i - 1 + list.length) % list.length], next = list[(i + 1) % list.length];
      const nav = document.createElement('nav'); nav.className = 'xnav';
      const card = (x, cls, lab) => `<a class="${cls}" href="../${x.s}/" style="--c:${x.c}"><small>${lab}</small><b><span class="sym">${x.sym}</span> ${en ? window.I18N.st(x.en) : x.ko}</b></a>`;
      nav.innerHTML = card(prev, 'prev', U('← 이전 실험 (P)', '← Previous (P)')) + `<a class="all" href="../../">${U('실험 목록', 'All experiments')}</a>` + card(next, 'next', U('다음 실험 (N) →', 'Next (N) →'));
      main.appendChild(nav);
    }
  }
})();
