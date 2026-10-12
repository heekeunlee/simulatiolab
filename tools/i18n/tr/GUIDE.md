# 번역 지침 (es / fr / ja / ru / zh)

> **이번 작업의 대상 언어는 호출 메시지에 적힌 언어뿐이다** (예: ru, zh). 출력 JSON에는 그 언어 키만 넣는다: `{"s0012": {"ru": "...", "zh": "..."}}`.
> ru = 러시아어, zh = 중국어 **간체**(중국 대륙 표준).

사이트: "Simulatio Lab" — 사람·사회·역사·예술에 대한 "what if" 질문을 시뮬레이션으로 실험하는 교육·교양 웹사이트. 독자는 일반 대중(비전문가). 어조는 친절하고 간결한 설명체(과장·광고 투 금지).

## 입력
- `static_NN.json`: `[{"id","en"}]` — `en`은 **영어 HTML 조각**이다. 이것을 스페인어(es), 프랑스어(fr), 일본어(ja)로 옮긴다.
- `dyn_NN.json`: `[{"id","ko","en"}]` — 화면에 실행 중 나타나는 짧은 문구. `ko`는 원문(한국어), `en`은 이미 있는 영어 번역. **영어(와 한국어 뜻)를 보고** es/fr/ja 값을 만든다.

## 출력
`tools/i18n/tr/out/<입력파일 이름>`(예: `out/static_03.json`)에 JSON 하나를 Write 도구로 저장한다:
```
{"s0012": {"es": "...", "fr": "...", "ja": "..."}, ...}
```
입력의 **모든 id**가 빠짐없이, 세 언어 모두 들어가야 한다. 유효한 JSON이어야 한다(따옴표는 `\"`로 이스케이프, 줄바꿈 금지·필요하면 `\n`).

## 반드시 지킬 것
1. **HTML 태그·속성·엔티티를 그대로 유지**한다: `<b>`, `<i class="live">`, `<a href="...">`, `<code>`, `&amp;` `&lt;` 등. 태그의 개수·순서·속성값(href, id, class)은 바꾸지 말고, 태그 안의 **사람이 읽는 글만** 번역한다. 태그 사이의 어순은 언어에 맞게 바꿔도 되지만 태그 쌍은 유지.
2. **플레이스홀더 `{0}` `{1}` 등은 그대로** 두고 모두 포함한다(순서는 문법에 맞게 바꿔도 됨). `{#0}`·`{%0}` 같은 표기는 dyn의 키(ko)에만 있고 값에는 `{0}` 형태로만 쓴다.
3. **숫자·수식·기호·이모지·단위 기호(%, σ, γ, ×, →, ⏸, ▶ 등)·코드·변수명(Gini, SIR 등)**은 그대로. 소수점 표기도 원문을 따른다(그대로 숫자 유지).
4. 고유명사는 그대로 두거나 해당 언어의 통용 표기를 쓴다: Simulatio Lab(브랜드, 번역 금지; ru·zh도 라틴 문자 그대로), 인명·논문 제목·학술 용어는 통용 표기(예: ja는 シェリング, ピーターの法則 / fr·es는 modèle de Schelling·modelo de Schelling).
5. 짧은 UI 문구(버튼·라벨·차트 축 이름)는 **짧게**: 레이아웃이 좁다. 원문보다 지나치게 길어지지 않게 한다. 일본어는 자연스러운 です・ます체, 프랑스어는 vouvoiement 없이 중립 설명체, 스페인어는 중립(라틴/이베리아 공통) 표현.
6. 의미를 덧붙이거나 빼지 않는다. 과학적 주장의 강도(“may”, “in this model” 등)를 보존한다.
7. 용어 통일(같은 뜻은 같은 단어로):
   - experiment → es: experimento / fr: expérience / ja: 実験 / ru: эксперимент / zh: 实验
   - simulation → simulación / simulation / シミュレーション / симуляция / 模拟
   - agent-based model → modelo basado en agentes / modèle à base d'agents / エージェントベースモデル / агентная модель / 基于主体的模型
   - seed(운의 번호) → semilla / graine / シード / зерно (seed) / 随机种子
   - run / start → ejecutar / lancer / 実行 / запустить / 运行
   - reset → reiniciar / réinitialiser / リセット / сбросить / 重置
   - talent → talento / talent / 才能 ; luck → suerte / chance / 運
   - wealth → riqueza / richesse / 富 ; inequality → desigualdad / inégalité / 不平等
   - slider → control deslizante / curseur / スライダー
   - model → modelo / modèle / モデル
8. 한글 문자(가-힣)가 결과에 남으면 안 된다.
9. 확신이 없는 사실(연도·수치)은 만들지 말고 원문 그대로 옮긴다.

10. ru: 중립 설명체(вы 존칭 없이 일반 서술, 명령형은 2인칭 복수형 사용 가능), 숫자의 소수점은 원문 그대로 점(.)을 유지. zh: 간체, 중국어 문장부호(，。？！：)를 쓰되 HTML·플레이스홀더 주변은 원문 형식 유지.
