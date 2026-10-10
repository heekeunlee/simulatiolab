// 실험 페이지 배치: 제목 + 한 줄 소개 → 바로가기 → 작업대(입력값 왼쪽 고정 + 결과 오른쪽) → 읽을거리(모델 설명, 결과 해석, 구현 메모)
// 좁은 화면(휴대폰)에서는 입력값을 아래에서 올라오는 패널로 바꾸고, 오른쪽 아래의 "설정" 버튼으로 연다.
// 입력값 패널(.controls를 가진 .panel)이 없는 페이지(메인)에서는 아무 일도 하지 않는다.
(function () {
  const main = document.querySelector('main.wrap');
  const ctl = main && main.querySelector('.panel .controls');
  if (!ctl) return;
  const panel = ctl.closest('.panel');
  if (panel.parentElement !== main) return;
  const en = window.I18N && window.I18N.lang === 'en';

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
  const labels = en ? ['How it works', 'What it shows', 'Notes'] : ['모델 설명', '결과 해석', '구현 메모'];
  jump.innerHTML = `<a href="#model">${labels[0]}</a><a href="#insight">${labels[1]}</a><a href="#notes">${labels[2]}</a>`;
  lead.after(jump); jump.after(bench);

  // 읽을거리: 모델 설명 → 결과 해석(말하는 것 | 말하지 않는 것 나란히) → 구현 메모(접어 둠)
  let anchor = bench;
  if (modelH2) {
    const sec = document.createElement('section'); sec.className = 'story'; sec.id = 'model';
    sec.appendChild(modelH2); sec.appendChild(nextOf(modelH2) || document.createTextNode(''));
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
  const label = (open) => (open ? (en ? '✕ Close' : '✕ 닫기') : (en ? '⚙ Settings' : '⚙ 설정'));
  fab.textContent = label(false);
  fab.addEventListener('click', () => { const o = panel.classList.toggle('open'); fab.textContent = label(o); });
  document.body.appendChild(fab);
  const mq = window.matchMedia('(max-width: 980px)');
  const apply = () => { panel.classList.toggle('wb-sheet', mq.matches); if (!mq.matches) { panel.classList.remove('open'); fab.textContent = label(false); } };
  (mq.addEventListener ? mq.addEventListener('change', apply) : mq.addListener(apply));
  apply();
})();
