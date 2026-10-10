# 진행 상황 기록

## 2026-10-10

- 브랜드명 확정: 시뮬라티오 랩 (Simulatio Lab), 핸들 `@simulatiolab`
- 이름·도메인·핸들 조사 완료 (상세는 `CLAUDE.md`)
- 차별화 포지셔닝 정리: 사람·사회를 다루는 "생각거리" 시뮬레이션 + 웹에서 직접 돌려보기
- 주제 백로그 12개 정리 → `docs/topics.md`
- GitHub 저장소 `simulatiolab` 생성
- 저장소를 공개로 전환, GitHub Pages(GitHub Actions 배포)로 사이트 공개 → https://heekeunlee.github.io/simulatiolab/
- 사이트 구조 확정: `site/` 폴더가 그대로 배포됨. 실험 하나 = `site/experiments/<주제>/` 폴더 하나 (HTML + JS)
- 논문(arXiv 1802.07068) 원문으로 Talent vs Luck 규칙 재확인 후 구현 (`site/experiments/talent-vs-luck/sim.js`)
- 검증(`node tools/validate.js`, 300회): 상위 20% 자본 비중 약 79%(논문 80%), 최고 부자 재능 중앙값 약 0.67(평균 0.6), 최고 재능자가 최고 부자인 비율 0.3%
- 웹 인터랙티브 버전 1차 완성: 슬라이더 4개, 애니메이션, 히스토그램, 산점도, 타임라인, 100번 반복

## 체크리스트

- [ ] 유튜브 `@simulatiolab` 핸들 등록, 같은 날 인스타 등 SNS 핸들 확보
- [ ] 가비아/Cloudflare에서 `simulatiolab` 도메인 조회 후 구매
- [ ] KIPRIS에서 '시뮬라티오/SIMULATIO' 상표 검색
- [x] 프로젝트 구조 정하기 (웹사이트·시뮬레이션은 `site/`, 검증 도구는 `tools/`)
- [ ] 영상용 렌더링 방식 정하기 (화면 녹화 vs Python 렌더링)
- [x] Talent vs Luck 시뮬레이션 구현 (원 논문 설정 재확인 후)
- [x] 시각화 (히스토그램, 산점도, 타임라인, 애니메이션)
- [x] 웹 인터랙티브 버전 (실제 브라우저에서 눈으로 확인 필요)
- [ ] 첫 영상 대본·촬영·업로드

## 에피소드 현황

| 순서 | 주제 | 상태 |
|---|---|---|
| 1 | 성공은 재능일까 운일까 | 웹 버전 공개, 영상 제작 전 |
| 2 | 끼리끼리 모이는 이유 | 대기 |
| 3 | 단톡방 소문 확산 | 대기 |
| 4 | 부의 쏠림 | 대기 |
| 5 | 신뢰 게임 | 대기 |
