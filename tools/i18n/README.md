# 영어 번역 도구

사이트는 한국어가 기본이고, 우상단 토글(한국어 | English)로 영어로 바꿉니다.

- **페이지 문구**: 각 HTML 요소의 `data-en` 속성에 영어 HTML이 들어 있고, `site/i18n.js`가 영어 모드일 때 바꿔 끼웁니다.
- **실행 중 생기는 문구**(통계 카드, 차트 글자, 안내 문장): `site/i18n-en.js`의 번역 규칙(`{0}` 일반 값, `{#0}` 숫자, `{%0}` 퍼센트)으로 번역합니다. 캔버스 글자는 `site/lib.js`가 연결합니다.

새 실험을 추가했을 때

1. `python3 tools/i18n/scan_html.py` 로 번역할 블록 목록(`blocks.json`)을 새로 만든다 (번호가 바뀔 수 있어 `en_blocks_*.py`의 키를 맞춰야 함)
2. `en_blocks_*.py`에 영어 문장, `en_dyn.py`에 실행 중 문구 규칙을 추가한다 (`scan_js.py`가 한글 문자열 목록을 뽑아줌)
3. `python3 tools/i18n/apply_html.py` 로 HTML에 `data-en`을 넣고, `en_dyn.py`로 `site/i18n-en.js`를 다시 만든다
4. 페이지 HTML을 다시 생성하면 `data-en`이 사라지므로 3번을 다시 실행한다
