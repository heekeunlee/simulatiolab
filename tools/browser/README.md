# 실제 브라우저 도구 (헤드리스 크롬)

화면 캡처, 오류·번역 검사, 메인 페이지 썸네일 생성을 실제 브라우저로 한다.

## 설치 (한 번만, 저장소 밖에 설치)
```
mkdir -p ~/.simlab-tools && cd ~/.simlab-tools
echo '{"name":"simlab-tools","private":true}' > package.json
npm i playwright jsdom@24 @resvg/resvg-js@2 three@0.160.0
npx playwright install chromium
```
명령마다 앞에 `export NODE_PATH=~/.simlab-tools/node_modules` 를 붙인다.

## 명령
| 명령 | 하는 일 |
|---|---|
| `node tools/browser/check.js all` | 전체 페이지 × 7개 언어를 열어 스크립트 오류, 남은 한글, 번역 누락을 검사 |
| `node tools/browser/check.js braess,turing ko,en` | 일부 페이지·언어만 |
| `node tools/browser/shoot.js braess --wait=6000` | 화면 캡처 → `~/.simlab-tools/shots/` (`--full=1`, `--mobile=1 --w=390 --h=844`, `--lang=en`) |
| `node tools/browser/make_thumbs.js [slug,...]` | 실험의 실제 결과 화면으로 메인 썸네일 생성 → `site/thumbs/<slug>.jpg`, 그 뒤 `python3 tools/pages/index.py` |

## 썸네일 규칙
- 찍는 캔버스: `data-thumb` 속성이 붙은 캔버스 (mk2 페이지는 섹션 dict에 `thumb=True`), 없으면 첫 번째 차트
- `?thumb=1` 로 열면 실험이 대표 장면으로 바로 간다 (각 app.js가 처리)
- **직접 고른 그림을 쓰려면** `site/thumbs/custom/<slug>.jpg`(또는 png/webp)를 넣고 `python3 tools/pages/index.py` — 자동 썸네일보다 우선한다
