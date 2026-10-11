# 새 실험 공통 지침 ("이렇게도 해석할 수 있구나" 분야)

시뮬라티오 랩에 실험 1개를 만든다. 이 분야의 목적: **직관과 반대로 보이는 현상을, 간단한 모델로 돌려 보며 "아, 이렇게 해석할 수도 있구나" 하고 무릎을 치게 하는 것.** 페이지의 첫 화면(리드)은 독자가 가진 흔한 해석을 먼저 제시하고, 실험이 그것을 뒤집거나 다시 읽게 만드는 구성으로 쓴다.

## 먼저 읽을 것
- `tools/pages/README.md` (만드는 법과 검증 방법, 반드시 따른다)
- 참고 구현: `site/experiments/auction/{sim.js,app.js}`, `tools/pages/auction.py`, `tools/pages/dyn_auction.py`, `tools/validate-auction.js` (구조·문체·한/영 이중 문구·접이식 구현 메모 형식을 그대로 따라 한다)
- `tools/pages/mk2.py` (page() 인자 형식), `site/lib.js` (Lab.* 도구)

## 만들 파일 (이것만 만들고, 기존 공유 파일은 절대 수정하지 않는다)
`site/experiments/<slug>/sim.js`, `app.js`, `tools/pages/<slug>.py`, `tools/pages/dyn_<slug>.py`, `tools/validate-<slug>.js`
`python3 tools/pages/<slug>.py` 로 `site/experiments/<slug>/index.html` 이 생성된다.
수정 금지: `tools/pages/index.py`, `site/index.html`, `site/exps.js`, `site/home.js`, `site/i18n*.js`, `site/lib.js`, `site/layout.js`, `site/style.css`, `docs/*`, 다른 실험 폴더. (통합은 호출한 쪽이 한다)

## 품질 기준
- 한 화면 작업대 구성(슬라이더/버튼 + 지켜보는 애니메이션 + 숫자 카드). 기본값으로 열자마자 핵심 반전이 눈에 보이게 튜닝한다.
- 시뮬레이션은 시드 난수(mulberry32), 같은 시드 → 같은 결과. UMD로 Node에서도 로드된다.
- 페이지의 모든 수치·주장은 `tools/validate-<slug>.js`로 실제 돌린 결과와 일치해야 한다(“says” 문단에 쓰는 숫자는 반드시 검증 스크립트 출력). 이론값이 있으면 시뮬레이션과 맞는지 비교해 쓴다.
- 정직성: 현상의 출처(논문/책/역사 일화)가 있으면 정확히 쓰고, 확실하지 않은 서지·수치는 쓰지 않는다. 일화가 단순화/논쟁적이면 그렇게 밝힌다. 실제 사건을 그대로 재현한 게 아니라면 "이 프로젝트의 단순화된 모델"이라고 쓴다. 정치적으로 민감한 소재는 중립으로.
- 화면에 보이는 모든 한국어는 영어 번역이 있어야 한다: page()의 T('ko','en'), 그리고 app.js가 만드는 문구(통계 카드·차트 글자·안내 문장)는 `dyn_<slug>.py`의 DYN에. 캔버스에 쓰는 글자도 같다. 줄바꿈 함수에서 번역이 필요하면 `window.I18N.lang !== 'ko' ? window.I18N.t(text) : text` 로 (lang === 'en' 로 분기하지 말 것).
- 페이지에 쓰는 id는 모두 HTML에 존재해야 한다(가짜 DOM은 없는 id도 통과시킨다).

## 검증 (모두 통과해야 보고)
(SCR = 임시 작업 폴더 `/private/tmp/claude-501/-Users-dasepa-projects-simulatiolab/74ec04b0-8f14-44d3-894a-b1507b913c61/scratchpad`)
1. `node tools/validate-<slug>.js` 출력 확인
2. `node SCR/smoke_gen.js <slug> <GlobalName> 8000` 예외 없음
3. `python3 tools/i18n/build_dyn.py` 후 `node SCR/jsd/en_test.js <slug> en 8000` 에서 "남은 한글", "번역 규칙에 없는 문구", "조각 치환"이 모두 '없음'. 
4. 구조 확인: `python3 tools/pages/<slug>.py` 후 HTML의 id 참조 점검

## 보고 (짧게)
slug, 전역 이름, 핵심 실측 수치 3~5개(페이지 문구와 일치), 제안 META(기호 2글자 · 짧은 이름 한국어/영어 · 아이콘 종류는 기존 중 선택: bars, stairs, rise, grid, net, drift, tri, vote, ring, wave, grid2, pulse, stripes, spread, handshake, letters, spiral, tiles, tri2, sunflower, heat), 정직성 단서(한계) 목록, 확인하지 못한 것.
