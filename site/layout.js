// 실험 페이지의 "작업대" 배치: 입력값(왼쪽, 화면에 고정) + 결과(오른쪽).
// 좁은 화면(휴대폰)에서는 입력값을 아래에서 올라오는 패널로 바꾸고, 오른쪽 아래의 "설정" 버튼으로 연다.
// 입력값 패널(.controls를 가진 .panel)이 없는 페이지(메인)에서는 아무 일도 하지 않는다.
(function () {
  const main = document.querySelector('main.wrap');
  const ctl = main && main.querySelector('.panel .controls');
  if (!ctl) return;
  const panel = ctl.closest('.panel');
  if (panel.parentElement !== main) return;

  // 입력값 패널부터 다음 제목(h2)이 나오기 전까지의 형제들을 결과 쪽으로 모은다
  const rest = [];
  for (let n = panel.nextElementSibling; n && n.tagName !== 'H2'; n = n.nextElementSibling) rest.push(n);

  const bench = document.createElement('div'); bench.className = 'workbench';
  const side = document.createElement('aside'); side.className = 'wb-side';
  const body = document.createElement('div'); body.className = 'wb-main';
  main.insertBefore(bench, panel);
  bench.appendChild(side); bench.appendChild(body);
  side.appendChild(panel);
  rest.forEach((n) => body.appendChild(n));
  main.classList.add('wide');

  // 휴대폰: 아래에서 올라오는 설정 패널
  const en = window.I18N && window.I18N.lang === 'en';
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
