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

# ---- 2026-10-13 새 실험 11개 (정답·해설의 숫자는 각 validate 출력 기준) ----
PRED.update({
 'secretary': (  # validate-secretary: n=100, r=37 → 37.1%; n=40: r=4 24.2%, r=24 31.2%, r=32 18.1%
  T('후보를 한 명씩 만나고 되돌아갈 수 없을 때, 처음 몇 %를 거절만 하며 지켜본 뒤 고르면 최고를 만날 확률이 가장 높을까요?', 'When you meet candidates one at a time and cannot go back, what share should you only watch before choosing to have the best chance of the very best?'),
  [T('약 10%', 'About 10%'), T('약 37%', 'About 37%'), T('약 70%', 'About 70%')], 1,
  T('후보 100명에서 37명(37%)을 관찰할 때 최고를 고를 확률이 37.1%로 가장 높았습니다. 후보 40명에서 4명(10%)은 24.2%, 24명(60%)은 31.2%, 32명(80%)은 18.1%였습니다.', 'With 100 candidates, watching 37 (37%) gave the highest chance of the best, 37.1%. With 40 candidates, watching 4 (10%) gave 24.2%, 24 (60%) gave 31.2% and 32 (80%) gave 18.1%.')),
 'weakties': (  # validate-weakties: 약한 연결 0%에서 58.1턴 → 2%에서 16.2턴 (40번 평균)
  T('원 위의 300명이 가까운 이웃 6명과만 이어져 있습니다. 먼 사람과 이은 선을 전체 연결의 2%(약 18개)만 보태면 소식이 90%에 퍼지는 데 걸리는 시간은 어떻게 될까요?', 'In a ring of 300 people tied only to 6 close neighbors, you add ties to far-away people for just 2% of all ties (about 18). What happens to the time for news to reach 90% of people?'),
  [T('거의 그대로이다', 'Barely changes'), T('약 3분의 1로 줄어든다', 'Falls to about a third'), T('절반 정도 줄어든다', 'Falls by about half')], 1,
  T('약한 연결이 없을 때 평균 58.1턴이던 것이 2%에서 16.2턴(3.6배 빠름)이 되었습니다(40번 평균). 평균 거리는 25.4걸음에서 33%로 줄었지만 친구 무리의 촘촘함은 94%로 거의 그대로였습니다.', 'Without weak ties it took 58.1 turns on average; with 2% it took 16.2 (3.6 times faster, 40-run average). The average distance fell to 33% of 25.4 steps while the tightness of friend circles stayed at 94%.')),
 'checkout': (  # validate-checkout: 4대·90%: 한 줄 6.1분, 짧은 줄 6.9분(×1.13), 추월당한 손님 44%, 무작위 줄 29.9분
  T('계산대 4개, 붐비는 정도 90%에서 손님이 "사람 수가 가장 적은 줄"을 골라 따로 서면, 한 줄로 서는 가게보다 평균 대기시간은 어떻게 될까요?', 'With 4 cashiers at 90% busy, if customers join the line with the fewest people, how does the average wait compare with a single shared line?'),
  [T('거의 같다 (5% 이내)', 'About the same (within 5%)'), T('약 13% 길다', 'About 13% longer'), T('두 배 이상 길다', 'More than twice as long')], 1,
  T('시뮬레이션에서 한 줄은 평균 6.1분, 사람 적은 줄은 6.9분(×1.13)이었습니다. 평균 차이는 작아도 손님의 44%는 뒤에 온 사람에게 추월당했고, 아무 줄이나 서면 29.9분(×4.9)이었습니다.', 'In the simulation the single line averaged 6.1 minutes and the fewest-people rule 6.9 (1.13 times). The average gap is small, but 44% of customers were overtaken by someone who came later, and joining any line averaged 29.9 minutes (4.9 times).')),
 'bunching': (  # validate-bunching: CV 0.04 → 2.10(360분), 평균 기다림 8.7분 vs 고른 간격 2.3분 (약 3.8배)
  T('버스 6대가 처음엔 똑같은 간격으로 달립니다. 승객이 많아 정차가 길어지는 규칙만 있을 때, 몇 시간 뒤 버스 간격은 어떻게 될까요?', 'Six buses start evenly spaced. If the only rule is that stops last longer when more passengers wait, what happens to the gaps after a few hours?'),
  [T('계속 거의 고르다', 'They stay nearly even'), T('몇 대씩 뭉치고 평균 기다림이 3배 넘게 늘어난다', 'Buses clump and the average wait grows more than threefold'), T('모두 정확히 두 대씩 짝이 된다', 'They pair up exactly in twos')], 1,
  T('처방이 없을 때 간격 변동계수가 0.04에서 2.10(360분)으로 커지고, 평균 기다림은 8.7분으로 간격이 고를 때(2.3분)의 약 3.8배였습니다.', 'With no remedy, the coefficient of variation of the gaps grew from 0.04 to 2.10 (minute 360), and the average wait was 8.7 minutes, about 3.8 times the 2.3 minutes of even spacing.')),
 'seating': (  # validate-seating: g=1 이론 0.4323, 시뮬 0.4327
  T('서로 한 칸씩 띄우고 앉기로 한 사람들이 아주 긴 벤치에 무작위로 한 명씩 앉으면, 끝내 자리의 몇 %가 찰까요?', 'If people who agree to leave one empty seat between them sit one at a time at random on a very long bench, what share of the seats ends up filled?'),
  [T('약 33%', 'About 33%'), T('약 43%', 'About 43%'), T('50% (모든 자리의 절반)', '50% (every other seat)')], 1,
  T('이론값은 (1−e^−2)/2≈43.2%이고 시뮬레이션은 43.3%였습니다. 한 칸씩 띄워 정돈해 앉으면 50%까지 가능하지만 무작위로 앉으면 그만큼 못 채웁니다.', 'Theory gives (1−e^−2)/2 ≈ 43.2% and the simulation 43.3%. Orderly seating could reach 50%, but random seating cannot.')),
 'dla': (  # validate-dla: 4,000개, 반지름 평균 123칸, 8.6%만 채워짐
  T('무작위로 떠돌던 입자가 덩어리에 닿으면 붙기만 하는 규칙으로 4,000개를 키우면, 덩어리는 반지름 안의 몇 %를 채울까요?', 'If 4,000 randomly wandering particles stick on touching a cluster, what share of the circle out to its farthest tip do they fill?'),
  [T('약 50% (꽉 찬 덩어리)', 'About 50% (a solid blob)'), T('약 25%', 'About 25%'), T('약 9% (대부분 빈틈)', 'About 9% (mostly gaps)')], 2,
  T('시뮬레이션에서 가장 먼 끝까지의 원(반지름 평균 123칸) 중 평균 8.6%만 채워졌습니다. 바깥 가지 끝이 안쪽 틈을 가리기 때문입니다.', 'In the simulation only 8.6% on average of the circle out to the farthest tip (mean radius 123 cells) was filled, because the outer branch tips shade the inner gaps.')),
 'sandpile': (  # validate-sandpile: 40x40, 안정기 이후 57%의 알은 아무 칸도 무너뜨리지 못함
  T('모래를 한 알씩 쌓는 판(40×40)에서 안정기 이후 떨어뜨린 알 중, 아무 칸도 무너지지 않고 지나간 알은 몇 %일까요?', 'On a 40×40 board where grains are added one at a time, what share of grains dropped after the pile has settled cause no toppling at all?'),
  [T('약 10%', 'About 10%'), T('약 57%', 'About 57%'), T('약 90%', 'About 90%')], 1,
  T('시드 1~5 평균 57%였습니다. 무너짐이 있었던 눈사태의 중앙값은 20번인데 가장 큰 것은 3,778~4,760번(중앙값의 약 208배)까지 나왔습니다.', 'The average over seeds 1 to 5 was 57%. Among avalanches that did topple, the median was 20 topplings while the largest reached 3,778 to 4,760 (about 208 times the median).')),
 'wildfire': (  # validate-wildfire: 큰 불 1만 단계당 21.4번 → 125.1번 (90% 끄기)
  T('작은 산불을 90% 꺼 주는 숲은, 그냥 두는 숲과 비교해 큰 불(숲의 10% 이상)이 얼마나 자주 날까요?', 'Compared with a forest left alone, how often do big fires (10% or more of the forest) occur in a forest where 90% of small fires are put out?'),
  [T('거의 달라지지 않는다', 'Barely changes'), T('훨씬 줄어든다', 'Becomes much rarer'), T('훨씬 늘어난다', 'Becomes much more frequent')], 2,
  T('1만 단계당 21.4번에서 125.1번으로 약 6배 늘었습니다. 매 단계 타는 면적은 0.63%와 0.61%로 거의 같았고, 큰 불이 태운 면적의 비중이 4%에서 27%로 커졌습니다.', "It rose about 6 times, from 21.4 to 125.1 per 10,000 steps. The area burning per step was almost the same, 0.63% versus 0.61%, but the big fires' share of the burned area grew from 4% to 27%.")),
 'ant': (  # validate-ant: 빈 판 9,976걸음에 고속도로 시작
  T('빈 판에서 출발한 규칙 두 줄짜리 개미가 대각선으로 곧게 뻗는 길(고속도로)을 내기 시작하는 건 몇 걸음쯤일까요?', 'On a blank grid, about how many steps does a two-rule ant take before it starts building a straight diagonal road (the highway)?'),
  [T('약 100걸음', 'About 100 steps'), T('약 1만 걸음', 'About 10,000 steps'), T('길을 내지 않는다', 'It never builds one')], 1,
  T('이 시뮬레이션에서는 9,976걸음째부터 104걸음마다 같은 동작을 되풀이하며 대각선으로 나아갔고 40,000걸음까지 이어졌습니다. 처음 약 500걸음은 대칭 무늬, 그 뒤는 혼돈이었습니다. 항상 길이 생긴다는 것은 증명되지 않은 추측입니다.', 'In this simulation, from step 9,976 the ant repeated the same 104-step routine and moved diagonally, continuing to step 40,000. The first ~500 steps were symmetric patterns and the rest chaos. That it always builds a road is an unproved conjecture.')),
 'farming': (  # validate-farming: 전선 속도 2√(rD)=1.00km/년, 시뮬 1.03, 흡수 반영 이론 1.12
  T('농사가 번지는 속도는 무엇으로 정해질까요?', 'What sets the speed at which farming spreads?'),
  [T('사람이 걷는 속도', 'How fast people walk'), T('인구가 느는 속도와 이웃으로 흩어지는 정도', 'How fast the population grows and how far it scatters'), T('처음 농부가 몇 명이었는지', 'How many farmers there were at the start')], 1,
  T('전선 속도는 2√(rD)로, 성장률 r과 확산 D만으로 정해집니다. 기본값에서 이론 1.00km/년, 시뮬레이션에서 잰 값 1.03km/년(토착민 흡수를 반영한 이론은 1.12)이었습니다.', 'The front speed is 2√(rD), set by growth rate r and dispersal D alone. With the defaults the theory gives 1.00 km/year and the simulation measured 1.03 km/year (1.12 for the theory with assimilation).')),
 'lanchester': (  # validate-lanchester: 200 대 100, 질 같음 → 이론 173명(87%), 시뮬 172명(86%); 선형이면 50%
  T('질이 같은 두 군대가 서로 겨누어 쏘며 싸웁니다. 파랑이 200명, 빨강이 100명이면 이긴 파랑에는 처음 병력의 얼마쯤이 남을까요?', 'Two armies of equal quality aim and fire at each other. With 200 blue and 100 red soldiers, about what share of its starting force does the winning blue army keep?'),
  [T('약 50%', 'About 50%'), T('약 70%', 'About 70%'), T('약 87%', 'About 87%')], 2,
  T('사각 법칙에서는 α·A²−β·B²가 보존되어 남는 병력이 √(200²−100²)≈173명, 즉 87%입니다. 시뮬레이션 300회 평균은 약 172명(86%)이었습니다. 일대일로 맞붙는 선형 법칙이면 50%만 남습니다.', 'Under the square law, α·A²−β·B² is conserved, so the survivors number √(200²−100²)≈173, or 87%. The average of 300 simulated fights was about 172 (86%). Under the one-to-one linear law only 50% would be left.')),
})


PRED.update({
 'treasury': (
  T('단기금리가 1%p 뛰면, 이 모델에서 10년 금리는 얼마나 오를까요?','If the short rate jumps 1 percentage point, how much does the 10-year yield rise in this model?'), [T('거의 1%p','Nearly 1 point'), T('약 0.33%p','About 0.33 points'), T('거의 오르지 않는다(0.01%p 이하)','Hardly at all (0.01 points or less)')], 1, T('회귀 속도 0.3일 때 닫힌 해와 시뮬레이션 모두 0.33%p였습니다. 10년 금리는 앞으로 10년 단기금리 예상 평균이라 단기금리 충격이 평균으로 돌아오면서 희석됩니다. 회귀 속도 0.05면 0.81%p, 1.2면 0.09%p입니다.','Both the closed form and the simulation gave 0.33 points at reversion speed 0.3. The 10-year yield is the expected average short rate, so a short-rate shock fades as it reverts. It is 0.81 points at speed 0.05 and 0.09 at 1.2.')),
 'fxrate': (
  T('금리 차이가 크면 이자를 더 벌지만, 캐리 거래에서 가장 나쁜 한 주의 손실은 어떻게 될까요?', 'A bigger interest gap earns more interest. What happens to the loss in the carry trade\'s worst week?'), [T('거의 그대로이거나 오히려 줄어든다', 'It stays about the same or even shrinks'), T('이자가 늘어난 만큼 함께 커진다(약 3.6% → 10.5%)', 'It grows along with the interest (about 3.6% to 10.5%)'), T('금리 차이와 상관없이 늘 3.5% 안팎이다', 'It is always around 3.5% whatever the gap')], 1, T('금리 차이 0, 4, 10%p에서 연 평균 캐리는 0.20%, 3.06%, 7.70%로 늘었고 가장 나쁜 한 주의 평균 손실도 3.6%, 10.1%, 10.5%로 커졌습니다. 캐리가 매력적일수록 사람이 빨리 몰려 급락이 커지기 때문입니다.', 'With gaps of 0, 4 and 10 points the average yearly carry rose to 0.20%, 3.06% and 7.70%, and the average loss in the worst week also grew to 3.6%, 10.1% and 10.5%. The more attractive the carry, the faster the crowd piles in and the bigger the crash.')),
})

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
