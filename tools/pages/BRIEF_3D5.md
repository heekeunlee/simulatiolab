# 3D 보기 추가 5개 (2026-10-14)

운영자 요청: **모래더미(sandpile), 산불(wildfire), 번개·산호(dla), 끼리끼리(schelling), 아파트 가격(apartment)** 실험에 **3D 보기**를 추가한다. 기존 2D 화면과 시뮬레이션·숫자는 **그대로 두고**, 같은 시뮬레이션 상태를 입체로 보여 주는 섹션을 추가한다(새 계산·새 수치·새 주장 금지).

## 먼저 읽을 것 (구현 패턴)
- `site/lab3d.js`(공용 three.js 도구: `create3D`), `site/lazy3d.js`(3D 모듈을 화면 가까이 올 때 불러옴)
- 참고 구현: `tools/pages/firefly.py`(섹션 정의에서 `id='c-3d', three=True`, `badge3d`, `hint3d`)·`site/experiments/firefly/app3d.js`, `tools/pages/sunflower.py`·`site/experiments/sunflower/app3d.js`(2D가 `window.<X>State`로 상태를 내보내고 3D가 따라가는 방식), `site/experiments/traffic/app3d.js`
- `BRIEF_ART6.md`의 규칙 5~9(범례·쉬운 말·정직성·번역·모바일), `BRIEF_SYNC_FIX.md`

**주의:** `schelling`은 생성기(`tools/pages/schelling.py`)가 없고 `site/experiments/schelling/index.html`을 직접 쓴 페이지다. 이 실험은 HTML을 직접 고치고(`data-en` 속성으로 영어, `traffic/index.html`의 3D 섹션이 참고), 한국어 고정 문구는 `data-en`을 빠뜨리지 않는다. 번역 파이프라인이 `data-en`을 읽는다.

## 요구사항
1. **새 섹션** "N) 3D로 보기: <한눈에 보이는 후킹 부제> `<span class="badge3d">3D</span>`" 를 해당 페이지 생성기(`tools/pages/<slug>.py`)에 추가하고 `site/experiments/<slug>/app3d.js`를 만든다(ES 모듈, `lab3d.js` 사용, `lazy3d.js`로 지연 로딩, 캔버스 `id="c-3d" class="view3d" data-thumb`). 기존 섹션 번호가 밀리면 번호를 고친다. 한국어는 `T('ko','en')`, 실행 중 문구는 `dyn_<slug>.py`.
2. **2D와 같은 상태를 따라간다.** 2D의 재생/일시정지/슬라이더/처음부터 다시를 그대로 따라야 한다. 2D `app.js`가 `window.<Slug>State`(또는 이미 있는 전역)를 내보내고 3D가 읽는다. 3D가 시뮬레이션을 따로 돌려 다른 결과를 내면 안 된다.
3. **동기화·스포일러 금지**: 3D는 재생이 도달한 시점의 상태만 보여 준다(미래·최종 결과 미리 보이기 금지).
4. **입체가 정보를 더해야 한다.** 장식이 아니라 높이/깊이가 의미를 갖게(아래 설계). 한 화면에 모양 종류 2개 이하, 깨알 기호 금지, 범례는 그래프 아래/캔버스 아래 한 줄, 색 2~3종.
5. **성능**: 인스턴스드 메시 사용, 모바일(390px) 부드럽게. 화면 밖이면 그리지 않음(create3D가 처리). `?thumb=1`에서 예외 없이.
6. 사람 말투 "쉬운 말", 정직성: 3D는 "같은 결과를 입체로 본 것"이라고 한 줄(`hint3d` 또는 이론 메모)로 밝히고 3D에서 새 숫자를 만들지 않는다. 힌트: 드래그 회전·휠/핀치 확대, 휴대폰에서 세로 쓸기는 페이지 스크롤(`canvas.view3d` 스타일이 처리).
7. 번역은 호출한 쪽이 한다(너는 ko/en만). **`tools/i18n/build_dyn.py`는 실행하지 말 것**(다른 에이전트와 `site/i18n-en.js`를 동시에 덮어써 충돌한다. 생성기 `python3 tools/pages/<slug>.py`만 돌린다). 공용 파일(`index.py`, `predict.py`, `daily.py`, `style.css`, `engage.js`, `lab3d.js`) 수정 금지. 커밋·푸시 금지. 해당 실험의 기존 `validate-<slug>.js` 숫자는 그대로여야 한다(변경하지 않았음을 실행해 확인).

## 실험별 3D 설계
- **sandpile(모래더미)**: 격자 칸마다 쌓인 모래 수를 **기둥 높이**로(지형처럼), 알이 떨어지는 칸 표시, 무너질 때 기둥이 낮아지는 모습. 임계값(4개)에 가까운 칸은 색이 달라지게. 2D 눈사태 크기 그래프는 그대로 2D에.
- **wildfire(산불)**: 격자 칸마다 나무 **기둥/원뿔**(살아 있음=초록, 불타는 중=주황 큰 불꽃/높이, 탄 땅=낮고 짙은 회색, 빈 땅=납작). 불이 번지는 최전선이 높이로 보이게.
- **dla(번개·산호)**: 붙은 입자가 **3D 가지**로 자라는 모습(2D 격자의 붙은 순서를 높이 y로 쌓아 시간 탑처럼, 또는 2D 결과를 입체 구슬로). **2D와 같은 결과**를 쓰고 붙은 순서에 색 그라데이션. 새 3D DLA를 따로 돌리지 말 것.
- **schelling(끼리끼리)**: 동네를 **블록 도시**로: 집 한 채 = 작은 건물 상자(두 색), 불만족한 집은 높이가 낮거나 윗면 표시, 같은 색끼리 모인 정도가 높을수록 눈에 띄게. 이사하는 집은 움직임이 보이게(상태 변화 시 부드럽게).
- **apartment(아파트 가격)**: 동네별(격자) 가격을 **막대 높이 지형**으로, 가격 번짐이 높이 파도처럼 번지는 모습, 시간 흐름은 2D 재생을 따른다. 높이=가격(축/눈금 안내 한 줄).

## 검증 (모두 통과해야 보고)
`export NODE_PATH=~/.simlab-tools/node_modules` 후 프로젝트 루트에서:
1. `python3 tools/pages/<slug>.py` 성공, 기존 `node tools/validate-<slug>.js` 출력 변화 없음.
2. `node tools/browser/check.js <slug> ko,en 3500` ✓ (콘솔 에러 없음). 3D 모듈 로드 실패 메시지 없어야 한다.
3. `node tools/browser/shoot.js <slug> --wait=5000 --out=$HOME/.simlab-tools/shots/<slug>_3d` (PC)와 `--mobile=1 --w=390 --h=844`로 캡처를 **직접 열어** 3D 캔버스가 비어 있지 않고 겹침·잘림이 없는지 확인. 재생 중간과 끝 모두.
4. 2D 부분이 달라지지 않았는지(캡처 비교로) 확인.

## 보고 (짧게, 한국어)
만든/수정한 파일, 새 섹션 제목(ko/en), 3D가 보여 주는 것 한 줄, 검증 결과, 정직성 단서, 막힌 점.
