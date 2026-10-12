# 실험 품질 개선 지침 (2026-10-12)

운영자 요청: ① 메인 페이지 칸 썸네일을 실험마다 다르게, 자기 시뮬레이션 결과 화면으로 ② 너무 빠른 애니메이션은 조금 느리게 ③ 각 시뮬레이션의 퀄리티를 높일 것 ④ 필요한 주제는 3D 시뮬레이션.
너는 아래 "담당 실험"만 맡는다. 실제 브라우저(헤드리스 크롬)로 화면을 직접 보고 고친다. 이번에 처음으로 실제 렌더링을 볼 수 있게 됐으니, 지금까지 아무도 눈으로 확인하지 못한 문제(겹치는 글자, 잘린 라벨, 빈 캔버스, 안 보이는 색, 어색한 첫 화면, 휴대폰에서 깨짐)를 찾는 것이 핵심이다.

## 도구 (모든 명령 앞에 `export NODE_PATH=~/.simlab-tools/node_modules`)
- 화면 캡처: `node tools/browser/shoot.js <slug> --wait=6000` → `~/.simlab-tools/shots/<slug>-ko.png` (Read 도구로 이미지를 본다). 전체 페이지 `--full=1`, 휴대폰 `--mobile=1 --w=390 --h=844`, 영어 `--lang=en`. 다른 에이전트와 파일이 겹치지 않게 `--out=$HOME/.simlab-tools/shots/<slug>` 처럼 자기 폴더를 쓴다.
- 오류·번역 검사(실제 브라우저): `node tools/browser/check.js <slug,...> ko,en` → 모두 ✓ 여야 한다.
- 썸네일: `node tools/browser/make_thumbs.js <slug>` → `site/thumbs/<slug>.jpg` (480×480, 결과 캔버스를 가운데 정사각형으로 자름). 반드시 결과 jpg를 Read로 열어 보고 "이 실험만의 그림"으로 알아볼 수 있는지 확인한다.
- 수치 검증: `node tools/validate-<slug>.js` (있으면)
- 영어 규칙 재생성: `python3 tools/i18n/build_dyn.py` (dyn_<slug>.py를 고쳤을 때)
- 페이지 재생성(mk2 페이지만): `python3 tools/pages/<slug>.py`

## 해야 할 일
1. **썸네일**: 그 실험을 가장 잘 보여주는 캔버스에 `data-thumb` 속성을 붙인다 (mk2 페이지는 sections의 dict에 `thumb=True`, 손으로 쓴 HTML 페이지는 canvas 태그에 직접). 그리고 주소에 `?thumb=1`이 있으면 app.js가 **대표 장면으로 바로 가도록**(예: 분리가 끝난 셸링, 무늬가 다 자란 튜링, 결과가 쌓인 히스토그램) 처리한다: `const THUMB = /[?&]thumb=1/.test(location.search);` 후 시작 시 N단계를 즉시 진행 등. 일반 방문자 동작은 바꾸지 않는다. 썸네일 안에는 작은 글자보다 형태·색이 보이게. 다른 실험과 닮지 않게.
2. **속도**: 공용 재생 루프(Lab.harness)는 이미 전체를 0.7배로 늦췄다. 실제로 지켜보며(몇 초 간격으로 캡처) 그래도 너무 빠르면 그 실험의 speeds 값/기본값을 낮추거나 harness cfg에 `speedScale: 0.5` 같은 값을 준다. 반대로 너무 느려서 지루하면 올린다. "보통" 속도에서 변화가 눈으로 따라갈 수 있어야 한다. Lab.harness를 쓰지 않는 실험(rumor, schelling, talent-vs-luck, wealth)은 자체 루프에서 약 30% 늦춘다.
3. **퀄리티**: 데스크톱(1440×900)과 휴대폰(390×844) 캡처를 보고 고친다 — 글자 겹침·잘림, 축·범례 가독성, 색 대비, 첫 화면에서 핵심이 보이는지, 애니메이션이 의미를 전달하는지, 빈 영역, 차트 크기, 툴팁/설명 문구의 명확성. 필요하면 시각화를 더 아름답고 정보가 많게 다시 그려도 된다(예: 부드러운 전환, 강조 표시, 현재 상태 주석). 시뮬레이션 모델 자체의 버그를 발견하면 고친다.
4. 페이지 문구의 수치는 반드시 검증 결과와 일치해야 한다. 모델을 바꿔 수치가 달라지면 페이지 문구(한국어와 영어 둘 다)를 고친다. 한국어/영어 문구를 바꾸면 다른 언어(es/fr/ja/ru/zh) 번역은 호출한 쪽이 나중에 다시 만들므로 신경 쓰지 않아도 된다. 화면에 새로 나오는 한국어 문구는 반드시 영어 번역을 넣는다 (mk2의 T('ko','en'), 실행 중 문구는 dyn_<slug>.py; 손으로 쓴 HTML 페이지는 data-en 속성; 기존 11개 실험의 실행 중 문구는 tools/i18n/en_dyn.py에 있으므로 그 실험 관련 키만 추가/수정 가능).

## 3D 담당이면 (담당 메시지에 3D가 적힌 경우만)
- 기존 2D 화면은 그대로 두고 **"3D로 보기" 섹션을 하나 추가**한다. 3D는 장식이 아니라 2D로는 안 보이던 것을 보여줘야 한다(높이로 본 무늬의 지형, 공간 속 군집, 관계망의 입체 구조 등).
- 공용 도구 `site/lab3d.js` (three.js r160, `site/vendor/three/`)를 쓴다: 실험 폴더에 `app3d.js`(ES 모듈)를 만들고 `import { THREE, create3D } from '../../lab3d.js';`. mk2 페이지는 `page(..., three=True)`, 해당 섹션 dict에 `three=True`(캔버스에 class="view3d"가 붙음). 손으로 쓴 HTML이면 `<script type="module" src="app3d.js"></script>`를 app.js 뒤에 직접 넣는다.
- 2D 시뮬레이션 상태를 재사용하려면 app.js에서 `window.<전역>` 으로 필요한 상태를 노출하거나 sim.js를 다시 돌린다. 성능: InstancedMesh 사용, 객체 수 제한, 휴대폰에서도 부드럽게. WebGL이 없으면 create3D가 안내 문구를 띄우고 null을 반환하니 그 경우 조용히 끝낸다.
- 3D 섹션 제목 옆에 `<span class="badge3d">3D</span>`, 아래에 조작 안내(드래그로 회전·휠로 확대)를 `.hint3d`로. 3D 캔버스는 헤드리스에서도 swiftshader로 그려지므로 캡처로 확인한다.

## 수정 범위
- 고쳐도 되는 파일: `site/experiments/<담당 slug>/*`, `tools/pages/<slug>.py`, `tools/pages/dyn_<slug>.py`, `tools/validate-<slug>.js`, `site/thumbs/<slug>.jpg`, (기존 11개 실험만) `tools/i18n/en_dyn.py`의 그 실험 키.
- 고치면 안 되는 파일: `site/lib.js, layout.js, style.css, home.*, i18n*.js, lab3d.js, vendor/`, `tools/pages/mk2.py, index.py`, `site/index.html`, `docs/*`, 다른 실험. 공용 파일 수정이 꼭 필요하면 고치지 말고 보고에 적는다.
- 커밋하지 않는다.

## 보고 (짧게)
실험별로: 고친 것(눈으로 확인한 전/후), 속도 조정, 썸네일에 쓴 장면, 바뀐 수치(있으면 페이지 문구 반영 여부), 3D 내용(해당 시), 남은 문제·공용 파일 요청.
