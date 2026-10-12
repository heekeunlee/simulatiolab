# 시뮬라티오 랩 (Simulatio Lab)

> 성공은 운일까? 소문은 어떻게 퍼질까?
> 사람과 사회에 대한 '만약에'를 AI 시뮬레이션으로 실험합니다.

유튜브 채널 **시뮬라티오 랩 | 만약에를 실험하는 곳** (`@simulatiolab`)과 웹사이트에서
에이전트 기반 시뮬레이션 결과를 영상으로 공유하고, 시청자가 변수를 바꿔 직접 돌려볼 수 있게 만드는 프로젝트입니다.

## 직접 돌려보기

https://heekeunlee.github.io/simulatiolab/ — 슬라이더로 변수를 바꿔 시뮬레이션을 브라우저에서 바로 실행할 수 있습니다.

## 구조

- `site/` — 정적 웹사이트 (GitHub Pages로 배포). 실험 하나가 `site/experiments/<주제>/` 폴더 하나
- `tools/` — 검증 스크립트 (`node tools/validate.js`)
- `docs/` — 주제 백로그와 진행 기록
- `videos/` — 영상 대본·썸네일 (영상 원본·결과물은 깃에서 제외, [안내](videos/README.md))

## 문서

- [`CLAUDE.md`](CLAUDE.md) — 확정된 결정사항, 이름 조사, 포지셔닝, 첫 시뮬레이션 사양
- [`docs/topics.md`](docs/topics.md) — 주제 백로그와 제작 순서
- [`docs/progress.md`](docs/progress.md) — 진행 상황과 체크리스트

## 첫 콘텐츠

**성공은 재능일까, 운일까?** — Pluchino et al. (2018) Talent vs Luck 모델 재현
