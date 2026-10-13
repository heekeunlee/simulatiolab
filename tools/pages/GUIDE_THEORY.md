# "이론적 근거" 작성 지침

모든 실험 페이지 맨 아래 접이식 칸("이론적 근거와 구현 메모")의 **맨 위에** 같은 다섯 칸을 넣는다. 독자는 교양 독자이지만 출처를 따라가 보려는 사람(학생, 교사, 연구자, 영상 제작 시 인용)도 있다. 그래서 **정확하고 검증 가능하게** 쓴다.

## 다섯 칸 (이 순서, 각 칸 1~3문장, 한국어와 영어를 함께)
| 키 | 라벨(자동) | 쓸 것 |
|---|---|---|
| `root` | 모델의 뿌리 | 이 모델이 나온 이론·고전 모델의 이름, 제안자, 연도, 출처(논문/책), 한 줄 요지 |
| `model` | 핵심 가정과 수식 | 모델이 서 있는 가정과 핵심 식·법칙(필요하면 `<code>`나 `<i>`, `<sup>`)과 슬라이더가 식의 어느 부분인지 |
| `simplify` | 이 프로젝트의 단순화 | 원 이론·현실과 다르게 단순화한 점, 이 프로젝트가 임의로 정한 값(예: "소득 수준은 이 프로젝트가 정한 값") |
| `check` | 이론값과 시뮬레이션 | 이론값(닫힌 해, 논문 값)이 있으면 시뮬레이션과 비교한 **실측 숫자**(validate 스크립트 출력). 이론값이 없으면 "이론적 기준값이 없어 시뮬레이션만으로 확인했다"처럼 정직하게 |
| `read` | 더 읽을거리 | 처음 읽기 좋은 원 논문·책·개설 자료 1~3개 (저자, 연도, 제목, 학술지·출판사) |

## 정확성 규칙 (가장 중요)
1. **확실히 아는 서지만 쓴다.** 저자·연도·제목·학술지·권(호)·쪽을 정확히 아는 것만 그렇게 쓴다. 일부만 확실하면 아는 만큼만 쓰고(예: "Granovetter (1973), 『The Strength of Weak Ties』, American Journal of Sociology"), 권·쪽처럼 불확실한 세부는 **빼라.** 지어내지 말고, 기억이 불확실하면 그 출처 자체를 쓰지 않는다. (페이지에 이미 있는 서지가 있으면 그대로 활용하되 틀린 곳을 알면 고친다.)
2. 숫자는 `node tools/validate-<slug>.js`(또는 페이지의 기존 검증된 수치)와 일치해야 한다. 이론값은 계산해서 확인한다(손으로 확인 가능한 식은 직접 계산해 본다).
3. 역사적 일화·실제 사건은 "흔히 인용되지만 해석이 갈린다"처럼 신중하게. 이 모델이 실제 현상의 **원인을 증명한다고** 쓰지 않는다 ("이런 메커니즘이 만들 수 있음을 보여 준다").
4. 이미 페이지 본문(model/says/not/memo)에 있는 내용과 중복되면, 본문은 그대로 두고 이론 칸은 이론 쪽 정보에 집중한다. 기존 `memo` 항목 중 이론 칸으로 옮기는 게 자연스러운 서지 항목은 `theory`로 옮기고 `memo`에서는 뺀다(구현 방법·검증 명령 같은 구현 정보만 `memo`에 남긴다).
5. 문체: 한국어는 간결한 설명체("~입니다/~예요" 중 그 페이지 문체에 맞춤), 영어는 담백한 학술 교양체. 수식은 평문 기호나 `<code>`로. 한 칸이 4줄을 넘지 않게.

## 넣는 방법
- mk2 페이지(`tools/pages/<slug>.py`): `page(dict(..., theory=[('root', T('한국어','English')), ('model', T(..)), ('simplify', T(..)), ('check', T(..)), ('read', T(..))], ...))` → `python3 tools/pages/<slug>.py`로 다시 생성. (`memo=`는 구현 정보만 남긴다.)
- 손으로 쓴 HTML 페이지(talent-vs-luck, wealth, youtube, schelling, rumor, dating, peter, voting, traffic, bar, queue): `site/experiments/<slug>/index.html`의 `<ul class="small">`(구현 메모) **맨 앞에** 다섯 칸을 `<li class="memo theory" data-en="<b>English label:</b> English text"><b>한국어 라벨:</b> 한국어 본문</li>` 형식으로 넣고(속성 안 따옴표·꺾쇠는 `&quot; &lt; &gt;`로 이스케이프), 같은 줄의 제목 `<h2>구현 메모</h2>`를 `<h2 data-en="Theory and implementation notes">이론적 근거와 구현 메모</h2>`로 바꾼다. 라벨 영어: Where the model comes from / Key assumptions and formulas / What this project simplifies / Theory versus simulation / Further reading. 한국어 라벨: 모델의 뿌리 / 핵심 가정과 수식 / 이 프로젝트의 단순화 / 이론값과 시뮬레이션 / 더 읽을거리.
- 검증: `export NODE_PATH=~/.simlab-tools/node_modules; python3 tools/i18n/build_dyn.py; node tools/browser/check.js <slug,...> ko,en 2500` → 모두 ✓ (한글이 영어 화면에 남지 않아야 함)
- 수정 범위: 담당 페이지 파일만. 공유 파일(index.py, mk2.py, style.css, layout.js 등)은 고치지 않는다. 커밋하지 않는다. 다른 언어(es/fr/ja/ru/zh) 번역은 호출한 쪽이 나중에 한다.

## 보고 (짧게, 한국어)
실험별로: 가장 중요하게 짚은 이론(한 줄), 확인하지 못해 뺀 출처나 불확실한 점, 본문과 어긋나 고친 곳(있다면), 이론값이 시뮬레이션과 맞지 않은 곳(있다면).
