# 영어 번역 도구

사이트는 한국어가 기본이고, 우상단 토글(한국어 | English)로 영어로 바꿉니다.

- **페이지 문구**: 각 HTML 요소의 `data-en` 속성에 영어 HTML이 들어 있고, `site/i18n.js`가 영어 모드일 때 바꿔 끼웁니다.
- **실행 중 생기는 문구**(통계 카드, 차트 글자, 안내 문장): `site/i18n-en.js`의 번역 규칙(`{0}` 일반 값, `{#0}` 숫자, `{%0}` 퍼센트)으로 번역합니다. 캔버스 글자는 `site/lib.js`가 연결합니다.

새 실험을 추가했을 때

1. `python3 tools/i18n/scan_html.py` 로 번역할 블록 목록(`blocks.json`)을 새로 만든다 (번호가 바뀔 수 있어 `en_blocks_*.py`의 키를 맞춰야 함)
2. `en_blocks_*.py`에 영어 문장, `en_dyn.py`에 실행 중 문구 규칙을 추가한다 (`scan_js.py`가 한글 문자열 목록을 뽑아줌)
3. `python3 tools/i18n/apply_html.py` 로 HTML에 `data-en`을 넣고, `en_dyn.py`로 `site/i18n-en.js`를 다시 만든다
4. 페이지 HTML을 다시 생성하면 `data-en`이 사라지므로 3번을 다시 실행한다


## 스페인어 · 프랑스어 · 일본어 · 러시아어 · 중국어 (es / fr / ja / ru / zh)

우상단 언어 메뉴는 한국어·English·Español·Français·日本語 다섯 개입니다. es/fr/ja는 **영어 문구(data-en)를 원문 키로** 삼아 번역합니다.

- `site/i18n.js`: 언어 선택, 해당 언어 사전(`i18n-es.js` 등)만 동기로 불러옴. 번역이 없으면 영어로 대체.
- `site/i18n-xx.js`: `I18N.addLang`(실행 중 문구: 한국어 키 → 번역), `I18N.addStatic`(정적 문구: 영어 HTML → 번역)을 담은 **생성 파일**.
- JS가 직접 쓰는 짧은 문구(바로가기, 링크 복사, 이전/다음 등)는 `i18n.js`의 `UI` 표와 `I18N.u(ko, en)`을 씁니다. 페이지 코드에서 `lang === 'en'`으로 분기하지 말고 `lang !== 'ko'`나 `I18N.t`를 쓰세요.

새 실험을 추가했을 때 (영어 번역 작업 3단계까지 끝낸 뒤):
1. `python3 tools/i18n/tr_extract.py` → `tools/i18n/tr/src/`에 번역 대상 묶음 생성
2. 묶음마다 `tr/GUIDE.md` 지침대로 es/fr/ja 번역을 `tr/out/<같은 이름>.json`으로 저장 (에이전트에 맡길 수 있음). 이미 번역된 문구는 `tr/memory.json`에 쌓여 있어 **새 문구만** 묶음으로 나온다
3. `python3 tools/i18n/tr_build.py` → 태그·자리표시자·한글 잔존을 검증하고 memory.json에 합쳐(out 조각은 삭제) `site/i18n-es.js`, `i18n-fr.js`, `i18n-ja.js` 생성

새 언어를 더할 때: `site/i18n.js`의 LANGS와 UI 표, `tr_build.py`의 언어 목록, `tr_extract.py`의 ALL_LANGS에 추가하고 `python3 tools/i18n/tr_extract.py <언어>`로 그 언어만 번역한다.
