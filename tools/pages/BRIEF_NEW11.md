# 새 실험 만들기 지침 (2026-10-13, 11개)

시뮬라티오 랩에 실험 1개를 만든다. 사이트: "세상을 시뮬레이션으로 돌려보며 이해한다"(왜 그럴까 · 만약에 · 뒤집어 보기). 이번 목표는 **사람들이 빠져들어 계속 만지게 되는 후킹 있는 실험**이다. 한국어가 기본이고 영어를 함께 쓴다.

## 후킹 기준 (가장 중요)
1. **리드 문단은 질문 하나와 반전 하나**: 독자의 흔한 직관을 먼저 말하고, "그런데…"로 뒤집을 것을 예고한다 (결과 숫자는 아직 말하지 않아도 된다).
2. **기본값으로 열자마자 3초 안에 흥미로운 장면**이 움직이고, 슬라이더를 만지면 결과가 바로 달라져야 한다. 첫 화면이 지루하면 기본값을 다시 튜닝한다.
3. **한 번에 하나의 큰 숫자**(예: "37%", "약 4배")가 통계 카드에 크게 보이게 한다.
4. 모델은 단순하게, 그러나 **실제로 돌려서 나온 결과만** 쓴다. 이론값이 있으면 시뮬레이션과 맞는지 `tools/validate-<slug>.js`로 비교하고 페이지 문구는 그 출력과 일치해야 한다.
5. 정직성: 이 프로젝트의 단순화된 모델임을 밝히고, 출처(논문·책)는 확실한 것만 정확히 쓴다(연도·학술지·권호를 모르면 쓰지 않는다). 역사 일화는 "흔히 인용되지만 단순화됐다"처럼 신중하게. 정치적으로 민감한 소재는 중립으로.

## 먼저 읽을 것
- `tools/pages/README.md`, `tools/pages/BRIEF_QUALITY.md` (실제 브라우저 도구 사용법·썸네일·속도·3D 규칙. **이 지침의 "수정 범위"와 "검증"을 따른다**)
- 참고 구현: `site/experiments/braess/{sim.js,app.js}`, `tools/pages/braess.py`, `tools/pages/dyn_braess.py`, `tools/validate-braess.js` (구조·문체·한/영 이중 문구·구현 메모·`thumb=True`·`?thumb=1` 처리 방식), `tools/pages/mk2.py`, `site/lib.js`

## 만들 파일 (이것만, 공유 파일은 수정 금지)
`site/experiments/<slug>/sim.js`(UMD, 시드 난수 mulberry32), `app.js`, `tools/pages/<slug>.py`, `tools/pages/dyn_<slug>.py`, `tools/validate-<slug>.js`, `site/thumbs/<slug>.jpg`
- `python3 tools/pages/<slug>.py` 로 `site/experiments/<slug>/index.html` 생성
- 수정 금지: `tools/pages/index.py`, `site/index.html`, `site/exps.js`, `site/home.*`, `site/i18n*.js`, `site/lib.js`, `site/layout.js`, `site/engage.js`, `site/style.css`, `site/predict.js`, `site/daily.js`, `docs/*`, 다른 실험 (통합은 호출한 쪽이 한다)

## 품질 기준
- 한 화면 작업대(슬라이더·버튼 + 지켜보는 애니메이션 + 숫자 카드 + 차트 2~3개). 애니메이션은 눈으로 따라갈 속도(`speedScale`/speeds 조정), 휴대폰(390px)에서도 글자 겹침 없이.
- 화면에 보이는 모든 한국어에 영어 번역: page()의 `T('ko','en')`, app.js가 만드는 문구는 `dyn_<slug>.py` (캔버스 글자 포함). 줄바꿈 함수에서 번역이 필요하면 `window.I18N.lang !== 'ko' ? window.I18N.t(text) : text`.
- 사이트 공용 장치와 맞물리므로: `thumb=True`를 가장 대표적인 캔버스 섹션에 붙이고, app.js는 `?thumb=1`이면 그 대표 장면(결과가 충분히 자란 모습)으로 바로 가서 멈춘다(자동 재생 끔). 일반 방문자 동작은 바꾸지 않는다.
- 이름에 번호 매기는 슬라이더 라벨에 `{#0}명` 같은 단수·복수 문제가 생기면 숫자 없는 표현으로.

## 검증 (모두 통과해야 보고)
`export NODE_PATH=~/.simlab-tools/node_modules` 후 (프로젝트 루트에서):
1. `node tools/validate-<slug>.js` 출력 확인 (페이지 문구의 수치와 일치)
2. `python3 tools/pages/<slug>.py && python3 tools/i18n/build_dyn.py`
3. `node tools/browser/check.js <slug> ko,en 3000` → ✓ (스크립트 오류·남은 한글·번역 누락 없음)
4. `node tools/browser/shoot.js <slug> --wait=5000 --out=$HOME/.simlab-tools/shots/<slug>` 로 데스크톱 캡처를 **직접 눈으로** 보고(Read), 휴대폰 `--mobile=1 --w=390 --h=844` 도 확인해 겹침·잘림·빈 캔버스를 고친다
5. `node tools/browser/make_thumbs.js <slug>` → `site/thumbs/<slug>.jpg`를 열어 보고 "이 실험만의 그림"인지 확인 (다른 실험과 닮지 않게)
- 커밋하지 않는다.

## 보고 (짧게, 한국어)
- slug, 전역 이름(window.Xxx), 핵심 실측 수치 3~5개(페이지 문구와 일치), 정직성 단서(한계)
- 제안 META: 기호 2글자(라틴, 아래 금지 목록 제외) · 짧은 이름(한국어/영어) · 아이콘 종류(bars, stairs, rise, grid, net, drift, tri, vote, ring, wave, grid2, pulse, stripes, spread, handshake, letters, spiral, tiles, tri2, sunflower, heat 중 하나)
- 다른 실험과의 관련(이어서 보면 좋은 기존 실험 slug 3개, 우선순위순)
- **예상 문제 1개** (복사해 붙일 수 있는 형식): `('<slug>', (T('질문','Question'), [T('보기1','Opt1'), T('보기2','Opt2'), T('보기3','Opt3')], 정답번호0부터, T('해설(검증 수치 포함)','Explanation')))` — 보기 3개, 정답은 검증 출력의 수치에 근거
- **오늘의 만약에 질문 1개**: `('<slug>', T('질문','Question'), [T('보기1','Opt1'), T('보기2','Opt2'), T('보기3','Opt3')])` — 생활 속 직관을 묻는 가벼운 3지선다(정답 없음)
- 확인하지 못한 것, 공용 파일에 필요한 요청
- 이미 쓰인 기호(금지): Tl Ws Yt Sc Ru Da Pe Vo Tr Ba Qu Ff Tu Rv Es Al Co Vl Cm Mk Zp Tp Fa Pa Ph Au Po Ap Br Rg Sv Fp Ip Ci Sk Wk Lq Bu Bn Dl Sp Wf La Fm Lc Ty Fx
