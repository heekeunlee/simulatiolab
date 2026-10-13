# 그래프 범례가 결과를 가리는 곳 고치기 (2026-10-14)

`node tools/browser/legend_audit.js`(범례 상자 밑에 깔린 데이터 픽셀 비율을 기본값과 슬라이더 양 끝값에서 잼)로 전체를 점검한 결과가 `tools/pages/legend_audit_2026-10-14.txt`에 있다(형식: `실험  데스크톱/모바일  캔버스id  구석  가림비율  (어느 상태에서)`). 맡은 slug의 **5% 이상** 항목을 고친다. 100%는 색 면(채움 그래프·지도) 위에 범례가 얹힌 경우다.

## 고치는 방법 (우선순위)
1. **그래프 아래 가로 범례(권장)**: `site/lib.js`에 있는 `Lab.belowSpace(canvas, items)`와 `Lab.drawLegendBelow(c, items)`를 쓴다. 예:
   `const items = [{kind:'line'|'dash'|'dot'|'box', color, label}, …]; const sp = L.belowSpace(canvas, items); const c = L.chart(canvas, aspect + sp.extra / (canvas.clientWidth || 400), { …기존 margin…, b: sp.b }); … 그래프를 다 그린 뒤 … L.drawLegendBelow(c, items);` 그리고 그 그래프의 기존 `L.legend(c, …)`(또는 `legend:` 옵션)는 지운다. 범례 글자는 기존 것 그대로(번역 키가 바뀌지 않게). x축 이름(`xLabel`)은 그대로 맨 아래 오른쪽에 써진다. `site/experiments/alliance/app.js`의 `drawTime`이 적용 예다(그곳은 같은 코드를 지역 함수로 갖고 있다; 공용 `L.…`을 쓰면 된다).
2. 기본적으로 데이터가 있을 자리를 피할 수 없는 그래프(막대가 커지거나 선이 위로 가는 그래프, 색 면 그래프, 지도)는 1번으로. 선이 약간만 걸치는 5~8% 정도의 곳은 구석을 바꾸거나 범례를 줄여도 되지만, 슬라이더 양 끝값에서도 안 가려야 한다.
3. 캔버스가 직접 그리는 범례(`hLegend`, `pickPos` 등)도 같은 원칙으로.

## 하지 말 것
공용 파일(`site/lib.js`, `layout.js`, `style.css` 등)·시뮬레이션 계산(`sim.js`)·문구(제목, 설명, 번역 키)를 바꾸지 않는다. 맡은 `site/experiments/<slug>/app.js`(과 필요하면 `app3d.js`)만 고친다. 새 글자가 필요하면 `dyn_<slug>.py`에 영어도 같이 넣는다(가능하면 새 글자 없이). 커밋하지 않는다.

## 검증
`export NODE_PATH=~/.simlab-tools/node_modules`, 프로젝트 루트에서: `node tools/browser/legend_audit.js <맡은 slug들(쉼표)> --t=0.05 --j=2` 결과에 맡은 캔버스가 더 이상 나오지 않을 것(100%였던 색 면 그래프도). 그리고 `node tools/browser/check.js <slug> ko,en 4000` 통과, 바뀐 그래프를 휴대폰(390px)과 데스크톱 화면으로 한 번씩 눈으로 확인(예상 게이트는 `.pskip`을 눌러 건너뛴다). 한 줄로 보고(고친 캔버스 수, 남은 것).
