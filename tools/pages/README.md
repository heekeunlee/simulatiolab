# 새 실험 만드는 법 (한국어 + 영어 동시)

한 실험 = 아래 4가지.

1. `site/experiments/<slug>/sim.js` — 시뮬레이션 (브라우저/Node 공용, UMD, 시드 난수). 기존 `peter`, `youtube`, `traffic` 참고
2. `site/experiments/<slug>/app.js` — 화면. `Lab.harness`(슬라이더·버튼·재생 루프)와 `Lab.dots/axes/line/chart/jobs`(차트) 사용. 기존 `peter/app.js`, `youtube/app.js` 참고. 화면에 보이는 문구는 한국어로 쓴다
3. `tools/pages/<slug>.py` — 페이지 문구. `from mk2 import *` 후 `page({...})`. 모든 문구는 `T('한국어','English')`. 기존 구조는 `mk2.py` 안의 설명과 이 폴더의 다른 파일 참고
4. `tools/pages/dyn_<slug>.py` — `DYN = {...}`: app.js가 실행 중 만드는 한국어 문구(통계 카드, 차트 글자, 안내 문장)의 영어 번역.
   키는 한국어 템플릿, `{0}` 일반 값(재귀 번역), `{#0}` 숫자, `{%0}` 퍼센트 숫자. `python3 tools/scan_js_keys.py site/experiments/<slug>/app.js`로 한글 문자열 목록을 뽑을 수 있다.
   숫자+단위(`60명`, `3개`, `12위` 등)는 `tools/i18n/en_dyn.py`에 공통 규칙이 이미 있다 ({#0}명, {#0}개, {#0}년, {#0}위, {#0}대, {#0}회, {#0}배, {#0}차례, {#0}라운드, {#0}단계, {#0}주째)

검증

- 수치: `tools/validate-<slug>.js` 를 만들어 핵심 결과를 출력하고 페이지의 설명 문구와 맞는지 확인 (페이지 문구는 반드시 실제 결과와 일치해야 한다)
- 한국어 화면 코드 점검: `node <scratchpad>/smoke_gen.js <slug> <GlobalName> 8000` (가짜 DOM, 예외가 없어야 함)
- 영어 모드: `python3 tools/i18n/build_dyn.py` 후 `node <scratchpad>/jsd/en_test.js <slug> en 8000` — "남은 한글", "번역 규칙에 없는 문구", "조각 치환"이 모두 '없음'이어야 한다
- 페이지가 참조하는 id가 HTML에 모두 있는지 확인 (가짜 DOM은 없는 id도 통과시킨다)

공통 규칙: 기존 파일(index.html, lib.js, i18n*.js, docs 등)은 고치지 않는다. 결과 수치를 과장하지 않고, 논문·데이터 출처가 있으면 정확히 쓰며 재현이 아니면 "이 프로젝트의 설계"라고 밝힌다. 정치적으로 민감한 주제는 중립적으로 쓴다.
