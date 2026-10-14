# 수정: 재생 중에 아래 그래프가 최종 결과를 미리 보여 주지 않게 한다

기준 예시: `site/experiments/talent-vs-luck/app.js` 의 `chartT`·`statsNow()`·`capNow()`·`drawCharts()` (이 실험은 이미 고쳐 두었다. `git log -p`로 변경 모양을 볼 수 있다). 점검 결과: `tools/pages/sync_audit/<slug>.json`(`charts[].spoils:true`인 것이 대상, `how`에 방법이 적혀 있다).

## 규칙
1. **재생이 도달한 시점까지의 값만** 그린다. 아직 오지 않은 미래(최종 결과, 사전에 끝까지 돌린 기준선)를 미리 그리지 않는다.
2. **축은 흔들리지 않게 고정**한다(전체 기간의 범위나 이론 범위를 미리 정해서). 막대·점·선만 자란다.
3. 통계 카드가 최종값이면 재생 중에는 **지금까지의 값**으로 바꾸거나 흐리게(`opacity .55`, 재생이 끝나면 원래대로) 한다. 숫자가 의미 없는 초반(표본이 너무 적을 때)은 '–'로 둔다.
4. 이론값·슬라이더 값 비교(sweep) 그래프는 건드리지 않는다. 이번 실행의 결과를 미리 알려 주는 것만 고친다.
5. 재생이 끝났을 때(또는 일시정지 후 재생 없이 계산된 최종 상태)는 원래의 최종 모습과 같아야 한다. 슬라이더 변경·"다시" 버튼·창 크기 변경(resize) 때도 깨지지 않게.
6. **새 한국어 문구는 가능한 만들지 않는다.** 꼭 필요하면 `tools/pages/dyn_<slug>.py`에 영어 번역을 같이 추가한다(형식은 그 파일의 기존 줄을 따른다). 번역 파이프라인(build_dyn/tr_*)은 돌리지 않는다(내가 한꺼번에 돌린다). 문구를 바꾸면 안 되는 곳을 바꾸지 말 것(한국어 키가 번역에 쓰인다).
7. 다른 실험·공용 파일(`site/lib.js` 등)은 건드리지 않는다. 이 실험의 `site/experiments/<slug>/` 안에서만 고친다.

## 확인
- 문법 확인: `node -e "new Function(require('fs').readFileSync('site/experiments/<slug>/app.js','utf8'))"` (sim.js를 바꿨으면 그것도).
- 가능하면 `export NODE_PATH=~/.simlab-tools/node_modules; node tools/browser/check.js <slug> ko 6000`(통과해야 함). 다른 사람이 같은 도구를 동시에 쓰므로 한 번만.
- 한 줄로 보고(무엇을 어떻게 고쳤는지, 새 한국어 문구가 생겼는지, 남은 한계).
