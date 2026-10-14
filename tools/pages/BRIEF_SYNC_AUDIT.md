# 점검: 위 시뮬레이션이 재생되는 동안 아래 그래프가 "정답(최종 결과)"을 미리 보여 주는가?

배경: 성공 실험(`site/experiments/talent-vs-luck/`)에서 ① 화면이 40년을 재생하는 동안 ②③④ 그래프와 통계 카드는 이미 40년 뒤 최종 결과로 그려져 있어서 어색했다. 이를 고쳐 ①이 재생되는 시점(`chartT`)까지만 아래 그래프를 그리게 했다(`app.js`의 `chartT`, `statsNow()`, `capNow()`, `drawCharts()` 참고. 축은 전체 기간 범위로 고정, 통계 카드는 재생 중 흐리게). 다른 실험들도 같은 방식으로 고치려 한다. 먼저 **점검만** 한다(코드는 고치지 않는다).

## 할 일 (실험마다)
`site/experiments/<slug>/app.js`(필요하면 `sim.js`, `index.html`)를 읽고 다음을 판단해 `tools/pages/sync_audit/<slug>.json`에 쓴다.

```json
{
 "slug": "...",
 "main_anim": true/false,           // 시간에 따라 재생되는 메인 화면(캔버스 애니메이션)이 있는가
 "progress": "재생 진행을 나타내는 변수/함수 이름 (예: anim.step, state.t)과 단위",
 "charts": [
   {"id": "c-xxx", "title": "그래프 제목(index.html에서)", 
    "kind": "run-trajectory | run-distribution | run-summary | sweep | theory",
    "spoils": true/false,            // 재생 중에 이미 최종 결과를 보여 주는가
    "syncable": true/false,          // 재생 시점까지만 그리도록 바꿀 수 있는가(그 시점의 값을 sim 기록에서 얻을 수 있는가)
    "how": "어떻게 바꾸면 되는지 한 줄 (예: history[t]로 슬라이스)"}
 ],
 "stat_cards": true/false,          // 최종 결과를 담은 통계 카드/숫자 요약이 있는가
 "effort": "low | medium | high | none",   // none = 이미 재생과 함께 그려지거나 동기화할 필요가 없는 구조
 "notes": "주의할 점(한 줄)"
}
```

분류 기준
- **run-trajectory**: 이번 실행의 시간에 따른 변화(시계열, 타임라인). **run-distribution**: 이번 실행의 지금 상태의 분포/산점도. **run-summary**: 이번 실행의 최종 숫자 카드. **sweep**: 슬라이더 값을 바꿔 가며 여러 번 돌린 비교 그래프(100번 반복, 값별 비교 등)는 본질적으로 집계라서 `syncable:false`, `spoils:false`로 두고 이유를 적는다. **theory**: 이론값 곡선.
- 메인 재생이 없고(버튼으로 한 번에 계산) 전부 정적인 실험이면 `main_anim:false`, effort `none`.
- 재생 중에 이미 그래프가 같이 자라는 실험이면(`spoils:false`) effort `none`.

한 줄로 보고(점검한 slug 개수, effort별 개수, 특이사항).
