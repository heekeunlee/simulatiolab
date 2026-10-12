"""'먼저 예상해 보세요' 질문 데이터. 실행하면 site/predict.js(한국어 질문·보기·해설)와 tools/pages/dyn_predict.py(한국어→영어)를 만든다.
정답과 해설의 숫자는 반드시 그 실험의 validate 결과·페이지 문구와 맞아야 한다 (근거를 why 옆 주석에).
새 질문을 더하려면 PRED에 항목을 추가하고 `python3 tools/pages/predict.py` 후 번역 작업(tr_extract/tr_build)을 한다."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); SITE = os.path.join(HERE, '..', '..', 'site')
sys.path.insert(0, HERE)
from mk2 import T

# slug: (질문 T, [보기 T ...], 정답 번호(0부터), 해설 T)
PRED = {
 'braess': (  # validate-braess: 4000명 지름길 닫힘 65.0분 → 열림 80.0분
  T('운전자 4,000명이 모두 자기에게 가장 빠른 길을 고르는 도로망에 공짜 지름길을 새로 열면, 평균 출근 시간은 어떻게 될까요?',
    'In a road network where 4,000 drivers each pick their own fastest route, what happens to the average commute when a free shortcut opens?'),
  [T('짧아진다', 'It gets shorter'), T('그대로다', 'It stays the same'), T('오히려 길어진다', 'It actually gets longer')], 2,
  T('65분에서 80분으로 길어져요. 모두가 자기에게 가장 빠른 길(지름길)을 고르다 보니, 오히려 모두가 막히는 길을 함께 타게 돼요.',
    'It rises from 65 to 80 minutes. Because everyone picks the route that is fastest for them, they all end up sharing the congested roads.')),
 'regression': (  # validate-regression: 효과 0일 때 칭찬받은 쪽 -6.97, 혼난 쪽 +7.08
  T('말(칭찬·꾸중)에는 아무 효과가 없다면, 방금 칭찬받은 사람의 다음 점수는 어떻게 될까요?',
    'If praise and scolding have no effect at all, what happens to the next score of someone who was just praised?'),
  [T('더 오른다', 'It goes up'), T('비슷하다', 'It stays about the same'), T('오히려 내려간다', 'It actually goes down')], 2,
  T('평균 약 7점 내려가요(반대로 혼난 사람은 약 7점 올라요). 잘한 때는 운이 좋았을 가능성이 커서, 다음에는 평균 쪽으로 돌아오기 때문이에요.',
    'It drops by about 7 points on average (and the scolded gain about 7). A great result is often partly luck, so the next one drifts back toward the average.')),
 'survivor': (  # validate-survivor: 무장갑 67.9% / 구멍 많은 곳 71.3% / 구멍 없는 곳 83.3%
  T('돌아온 비행기에는 날개와 동체에 총탄 자국이 가장 많아요. 철판을 어디에 덧대야 생존율이 가장 많이 오를까요?',
    'The planes that came back have the most bullet holes in the wings and fuselage. Where should the armor go to raise survival the most?'),
  [T('구멍이 많은 날개·동체', 'The wings and fuselage, where the holes are'), T('구멍이 거의 없는 엔진·조종석', 'The engine and cockpit, where there are almost no holes'), T('어디든 효과가 비슷하다', 'Anywhere, the effect is about the same')], 1,
  T('엔진·조종석을 보강하면 생존율이 67.9%에서 83.3%로 올라요(구멍이 많은 곳을 보강하면 71.3%). 그곳에 맞은 비행기는 돌아오지 못했기 때문에 구멍이 안 보이는 거예요.',
    'Armoring the engine and cockpit lifts survival from 67.9% to 83.3% (armoring where the holes are gives 71.3%). Planes hit there never came back, which is why no holes show.')),
 'friendship': (  # validate-friendship: 82.6% (기본 설정, 관계망 300개)
  T('이 관계망에서 "내 친구들은 나보다 친구가 더 많다"에 해당하는 사람은 몇 %일까요?',
    'In this network, what share of people have friends who, on average, have more friends than they do?'),
  [T('약 20%', 'About 20%'), T('약 50%', 'About 50%'), T('약 80%', 'About 80%')], 2,
  T('약 83%예요. 인기 있는 사람은 많은 사람의 친구 목록에 오르기 때문에, 내 친구는 평균적으로 나보다 친구가 많아요.',
    'About 83%. Popular people appear on many friend lists, so on average your friends have more friends than you.')),
 'inspection': (  # validate-inspection: 불규칙도 1.0, 평균 간격 10분 → 평균 대기 10.1분 (일정하면 5분)
  T('버스가 평균 10분마다 오고 도착 시각이 무작위일 때, 아무 때나 정류장에 가면 평균 몇 분을 기다릴까요?',
    'A bus comes every 10 minutes on average, with random arrival times. If you show up at any moment, how long do you wait on average?'),
  [T('약 5분', 'About 5 minutes'), T('약 7분', 'About 7 minutes'), T('약 10분', 'About 10 minutes')], 2,
  T('약 10분이에요(간격이 일정하다면 5분). 긴 간격에 걸릴 확률이 더 높아서, 승객이 만나는 간격은 평균보다 길어요.',
    'About 10 minutes (it would be 5 if the gaps were even). You are more likely to land in a long gap, so the gap you meet is longer than the average.')),
 'coincidence': (  # validate-coincidence: 23명 50.7%, 나와 같을 확률 5.9%
  T('23명이 모였을 때, 그중 두 사람 이상의 생일이 같을 확률은 얼마일까요?',
    'With 23 people in a room, what is the chance that at least two share a birthday?'),
  [T('약 6%', 'About 6%'), T('약 50%', 'About 50%'), T('약 90%', 'About 90%')], 1,
  T('약 50.7%예요. 23명이면 가능한 짝이 253쌍이나 되기 때문이에요. (내 생일과 같은 사람이 있을 확률은 5.9%뿐이에요.)',
    'About 50.7%. With 23 people there are 253 possible pairs. (The chance that someone shares your own birthday is only 5.9%.)')),
 'talent-vs-luck': (  # validate.js: 300회 반복에서 최고 부자가 최고 재능자였던 비율 0.3%
  T('재능이 가장 높은 사람이 40년 뒤 가장 부자가 되는 경우는 얼마나 될까요? (300번 돌려 본 결과예요)',
    'How often does the most talented person end up the richest after 40 years? (Based on 300 runs.)'),
  [T('대부분(70% 이상)', 'Most of the time (70% or more)'), T('절반쯤', 'About half the time'), T('거의 없다(1% 미만)', 'Almost never (under 1%)')], 2,
  T('300번 중 최고 재능자가 최고 부자가 된 경우는 0.3%뿐이었어요. 재능은 평균 근처에 모여 있어도, 운이 몇 번 겹친 사람이 크게 앞서가요.',
    'Out of 300 runs, the most talented person became the richest only 0.3% of the time. Talent clusters near the average, but a few lucky breaks can put someone far ahead.')),
 'schelling': (  # validate-schelling: 원하는 비율 30% → 같은 이웃 비율 50% → 75%
  T('"이웃의 30%만 나와 같은 편이면 만족"이라는 약한 바람만 가진 사람들이 이사를 반복하면, 같은 편 이웃 비율은 처음 50%에서 얼마가 될까요?',
    'If people only want "at least 30% of my neighbors are like me" and keep moving, what share of neighbors end up being like them, starting from 50%?'),
  [T('약 55%', 'About 55%'), T('약 75%', 'About 75%'), T('약 95%', 'About 95%')], 1,
  T('약 75%까지 올라가요. 아무도 분리를 원하지 않았는데도, 작은 바람이 쌓여 동네가 크게 갈라져요.',
    'It climbs to about 75%. Nobody wanted segregation, yet small preferences add up until the neighborhood splits apart.')),
 'auction': (  # validate-auction: 10명, 오차 20%, 낙찰자 평균 -30.9 (가치 100 기준)
  T('입찰자 10명, 추정 오차 20%일 때 모두가 자기 추정치 그대로 입찰하면, 낙찰자는 평균적으로 어떻게 될까요?',
    'With 10 bidders and a 20% estimation error, if everyone bids exactly their own estimate, what happens to the winner on average?'),
  [T('이익을 본다', 'Makes a profit'), T('본전이다', 'Breaks even'), T('손해를 본다', 'Loses money')], 2,
  T('평균 −30.9(가치 100 기준)로 손해예요. 이겼다는 것은 "내 추정치가 가장 높게 틀렸다"는 뜻이기 때문이에요.',
    'An average of −30.9 (on a value of 100): a loss. Winning means "my estimate was the most overestimated."')),
 'wealth': (  # validate-wealth: 공정한 거래 300라운드 지니 0.90, 상위 10% 86%
  T('모든 거래가 동전 던지기처럼 공정해도, 300번째 거래 뒤 가장 부자인 10%는 전체 재산의 몇 %를 가질까요?',
    'Even if every trade is as fair as a coin flip, after 300 rounds what share of all wealth does the richest 10% hold?'),
  [T('약 10%', 'About 10%'), T('약 40%', 'About 40%'), T('약 86%', 'About 86%')], 2,
  T('약 86%예요. 공정한 거래만으로도 작은 우연이 쌓여 부가 한쪽으로 쏠려요(지니계수 0.90).',
    'About 86%. Even perfectly fair trades let small bits of luck pile up until wealth concentrates (Gini 0.90).')),
 'traffic': (  # traffic 페이지: 정체파는 거꾸로 이동
  T('사고도 공사도 없는데 생긴 정체 덩어리는 어느 쪽으로 움직일까요?',
    'A traffic jam forms with no accident or roadwork. Which way does the jam itself move?'),
  [T('차들이 가는 방향으로', 'The same direction the cars travel'), T('제자리에 머문다', 'It stays put'), T('차들이 가는 반대 방향으로', 'Backward, against the traffic')], 2,
  T('반대 방향으로(뒤로) 물러나요. 앞차가 출발해도 뒤차는 조금 늦게 출발해서, 정체의 앞쪽 끝은 풀리고 뒤쪽 끝은 계속 늘어나요.',
    'It drifts backward. The front of the jam clears as cars pull away while the back keeps growing, so the whole jam moves against the traffic.')),
}
# 카드에 쓰는 문구 (한국어 → 영어)
UI = [
 (T('🔮 먼저 예상해 보세요', '🔮 Make a prediction first')),
 (T('내 예상: {0}', 'My prediction: {0}')),
 (T('이제 아래 실험을 돌려 보세요. 결과를 본 뒤 정답을 확인할 수 있어요.', 'Now run the experiment below. After you see the result, check the answer.')),
 (T('정답 보기', 'Show the answer')),
 (T('건너뛰고 바로 보기', 'Skip and see it now')),
 (T('예상을 고르면 실험 결과가 열려요.', 'Pick an answer to unlock the results.')),
 (T('건너뛰었어요. 지금 골라도 돼요.', 'You skipped ahead. You can still pick now.')),
 (T('정답: {0}', 'Answer: {0}')),
 (T('🎯 맞혔어요!', '🎯 You got it!')),
 (T('🤔 틀렸어도 괜찮아요. 이 반전이 바로 이 실험이에요.', '🤔 Not quite, and that is the point. This twist is what the experiment is about.')),
 (T('다른 방문자 {#0}명의 예상', 'What {0} other visitors predicted')),
 (T('정답을 맞힌 사람: {%0}', 'Got it right: {0}')),
 (T('예상 적중 {#0}/{#1}', 'Predictions right: {0}/{1}')),
]
data = {}
dyn = {}
for slug, (q, opts, ans, why) in PRED.items():
    data[slug] = {'q': q[0], 'o': [o[0] for o in opts], 'a': ans, 'w': why[0]}
    dyn[q[0]] = q[1]; dyn[why[0]] = why[1]
    for o in opts: dyn[o[0]] = o[1]
for t in UI: dyn[t[0]] = t[1]
open(os.path.join(SITE, 'predict.js'), 'w', encoding='utf-8').write('// 먼저 예상해 보세요 질문 데이터 (tools/pages/predict.py 가 만든다)\nwindow.LAB_PREDICT = ' + json.dumps(data, ensure_ascii=False) + ';\n')
open(os.path.join(HERE, 'dyn_predict.py'), 'w', encoding='utf-8').write('# tools/pages/predict.py 가 만든다 (직접 고치지 말 것)\nDYN = ' + json.dumps(dyn, ensure_ascii=False, indent=1) + '\n')
print(len(data), '개 질문,', len(dyn), '개 문구')
