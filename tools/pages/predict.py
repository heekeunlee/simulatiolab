"""'먼저 예상해 보세요' 질문 데이터. 실행하면 site/predict.js(한국어 질문·보기·해설)와 tools/pages/dyn_predict.py(한국어→영어)를 만든다.
정답과 해설의 숫자는 반드시 그 실험의 validate 결과·페이지 문구와 맞아야 한다 (근거를 why 옆 주석에).
새 질문을 더하려면 PRED에 항목을 추가하고 `python3 tools/pages/predict.py` 후 번역 작업(tr_extract/tr_build)을 한다."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); SITE = os.path.join(HERE, '..', '..', 'site')
sys.path.insert(0, HERE)
from mk2 import T

# slug: (질문 T, [보기 T ...], 정답 번호(0부터), 해설 T)

# slug: (질문 T, [보기 T ...], 정답 번호(0부터), 해설 T)
PRED = {
 'braess': (  # validate-braess: 4000명 지름길 닫힘 65.0분 → 열림 80.0분
  T('운전자 4,000명이 저마다 가장 빠른 길을 고르는 도로에 공짜 지름길을 새로 열면, 평균 출근 시간은 어떻게 될까요?',
    'On a road network where 4,000 drivers each pick their own fastest route, a free shortcut opens. What happens to the average commute?'),
  [T('짧아진다', 'It gets shorter'), T('그대로다', 'It stays the same'), T('오히려 길어진다', 'It actually gets longer')], 2,
  T('65분에서 80분으로 길어져요. 모두가 지름길로 몰리다 보니, 결국 다 같이 막히는 길을 타게 돼요.',
    'It goes from 65 to 80 minutes. Everyone rushes to the shortcut, so they all end up in the same traffic jam.')),
 'regression': (  # validate-regression: 효과 0일 때 칭찬받은 쪽 -6.97, 혼난 쪽 +7.08
  T('칭찬과 꾸중에 아무 효과가 없다면, 방금 칭찬받은 사람의 다음 점수는 어떻게 될까요?',
    'Say praise and scolding have no effect at all. What happens to the next score of someone who was just praised?'),
  [T('더 오른다', 'It goes up'), T('비슷하다', 'It stays about the same'), T('오히려 내려간다', 'It actually goes down')], 2,
  T('평균 약 7점 내려가요(혼난 사람은 약 7점 올라요). 잘한 때는 운이 좋았을 가능성이 커서, 다음에는 평균에 가까워져요.',
    'It drops by about 7 points on average (the scolded gain about 7). A great result is often partly luck, so the next one moves back toward the average.')),
 'survivor': (  # validate-survivor: 무장갑 67.9% / 구멍 많은 곳 71.3% / 구멍 없는 곳 83.3%
  T('돌아온 비행기는 날개와 몸통에 총탄 자국이 가장 많아요. 철판을 어디에 덧대야 살아 돌아올 확률이 가장 많이 오를까요?',
    'Planes that came back have the most bullet holes in the wings and body. Where should you add armor to raise survival the most?'),
  [T('구멍 많은 날개·몸통', 'Wings and body (most holes)'), T('구멍 적은 엔진·조종석', 'Engine and cockpit (few holes)'), T('어디든 비슷하다', 'Anywhere, about the same')], 1,
  T('엔진·조종석을 보강하면 생존율이 67.9%에서 83.3%로 올라요(구멍 많은 곳을 보강하면 71.3%). 그곳에 맞은 비행기는 돌아오지 못해서, 구멍이 안 보이는 거예요.',
    'Armoring the engine and cockpit raises survival from 67.9% to 83.3% (armoring where the holes are gives 71.3%). Planes hit there never came back, so we never see those holes.')),
 'friendship': (  # validate-friendship: 82.6% (기본 설정, 관계망 300개)
  T('이 관계망에서 "내 친구들은 평균적으로 나보다 친구가 더 많다"에 해당하는 사람은 몇 %일까요?',
    'In this network, what share of people have friends who, on average, have more friends than they do?'),
  [T('약 20%', 'About 20%'), T('약 50%', 'About 50%'), T('약 80%', 'About 80%')], 2,
  T('약 83%예요. 인기 많은 사람은 여러 사람의 친구 목록에 들어 있어요. 그래서 내 친구는 보통 나보다 친구가 많아요.',
    'About 83%. Popular people show up on many friend lists, so your friends usually have more friends than you.')),
 'inspection': (  # validate-inspection: 불규칙도 1.0, 평균 간격 10분 → 평균 대기 10.1분 (일정하면 5분)
  T('버스가 평균 10분마다 오지만 도착 시각은 제멋대로예요. 아무 때나 정류장에 가면 평균 몇 분을 기다릴까요?',
    'A bus comes every 10 minutes on average, but at random times. If you arrive at any moment, how long do you wait on average?'),
  [T('약 5분', 'About 5 minutes'), T('약 7분', 'About 7 minutes'), T('약 10분', 'About 10 minutes')], 2,
  T('약 10분이에요(간격이 일정하다면 5분). 긴 간격에 걸릴 가능성이 더 커서, 내가 만나는 간격은 평균보다 길어요.',
    'About 10 minutes (it would be 5 if the gaps were even). You are more likely to land in a long gap, so the gap you meet is longer than average.')),
 'coincidence': (  # validate-coincidence: 23명 50.7%, 나와 같을 확률 5.9%
  T('23명이 모였을 때, 두 사람 이상의 생일이 같을 확률은 얼마일까요?',
    'With 23 people in a room, what is the chance that at least two share a birthday?'),
  [T('약 6%', 'About 6%'), T('약 50%', 'About 50%'), T('약 90%', 'About 90%')], 1,
  T('약 50.7%예요. 23명이면 둘씩 짝지을 수 있는 경우가 253쌍이나 되기 때문이에요. (나와 생일이 같은 사람이 있을 확률은 5.9%뿐이에요.)',
    'About 50.7%. With 23 people there are 253 possible pairs. (The chance that someone shares your own birthday is only 5.9%.)')),
 'talent-vs-luck': (  # validate.js: 300회 반복에서 최고 부자가 최고 노력자였던 비율 0.3%
  T('노력이 가장 높은 사람이 40년 뒤 가장 부자가 되는 경우는 얼마나 될까요? (300번 돌려 본 결과예요)',
    'How often is the highest-effort person the richest after 40 years? (Based on 300 runs.)'),
  [T('대부분(70% 이상)', 'Most of the time (70%+)'), T('절반쯤', 'About half the time'), T('거의 없다(1% 미만)', 'Almost never (under 1%)')], 2,
  T('300번 중 0.3%뿐이었어요. 노력은 다들 비슷비슷해도, 운이 몇 번 겹친 사람이 크게 앞서가요.',
    'Only 0.3% of the 300 runs. Most people have similar effort, but a few lucky breaks can put someone far ahead.')),
 'schelling': (  # validate-schelling: 원하는 비율 30% → 같은 이웃 비율 50% → 75%
  T('"이웃의 30%만 나와 같은 편이면 만족"이라는 작은 바람을 가진 사람들이 계속 이사하면, 같은 편 이웃 비율은 처음 50%에서 얼마가 될까요?',
    'People only want "at least 30% of my neighbors are like me" and keep moving. Starting from 50%, what share of neighbors end up like them?'),
  [T('약 55%', 'About 55%'), T('약 75%', 'About 75%'), T('약 95%', 'About 95%')], 1,
  T('약 75%까지 올라가요. 아무도 갈라서길 원하지 않았는데, 작은 바람이 쌓여서 동네가 크게 나뉘어요.',
    'It climbs to about 75%. Nobody wanted to split up, but small wishes add up until the neighborhood divides.')),
 'auction': (  # validate-auction: 10명, 오차 20%, 낙찰자 평균 -30.9 (가치 100 기준)
  T('입찰자 10명이 물건 가치를 20%쯤 틀리게 어림하고, 모두 자기 어림값 그대로 입찰하면 낙찰자는 평균적으로 어떻게 될까요?',
    'Ten bidders each guess an item\'s value with about a 20% error and bid exactly their guess. What happens to the winner on average?'),
  [T('이익을 본다', 'Makes a profit'), T('본전이다', 'Breaks even'), T('손해를 본다', 'Loses money')], 2,
  T('물건 가치 100 기준으로 평균 −30.9, 즉 손해예요. 낙찰됐다는 건 내가 가장 높게 잘못 어림했다는 뜻이기 때문이에요.',
    'On an item worth 100, the winner averages −30.9, a loss. Winning means your guess was the highest, which means it was the most too high.')),
 'wealth': (  # validate-wealth: 공정한 거래 300라운드 지니 0.90, 상위 10% 86%
  T('모든 거래가 동전 던지기처럼 공정해도, 300번 거래한 뒤 가장 부자인 10%는 전체 재산의 몇 %를 가질까요?',
    'Even if every trade is as fair as a coin flip, how much of all wealth does the richest 10% hold after 300 rounds?'),
  [T('약 10%', 'About 10%'), T('약 40%', 'About 40%'), T('약 86%', 'About 86%')], 2,
  T('약 86%예요. 공정한 거래만 해도 작은 우연이 쌓여서 재산이 한쪽으로 쏠려요(지니계수 0.90, 1에 가까울수록 불평등해요).',
    'About 86%. Even fair trades let small bits of luck pile up until wealth gathers on one side (Gini 0.90; closer to 1 means more unequal).')),
 'traffic': (  # traffic 페이지: 정체파는 거꾸로 이동
  T('사고도 공사도 없이 생긴 정체 덩어리는 어느 쪽으로 움직일까요?',
    'A traffic jam forms with no accident or roadwork. Which way does the jam itself move?'),
  [T('차들이 가는 방향', 'Same way as the cars'), T('제자리에 머문다', 'It stays put'), T('차들과 반대 방향', 'Backward, against the cars')], 2,
  T('반대 방향, 즉 뒤로 밀려나요. 앞차가 출발해도 뒤차는 조금 늦게 출발해서, 정체의 앞쪽은 풀리고 뒤쪽은 계속 늘어나요.',
    'It moves backward. The front of the jam clears as cars pull away, while the back keeps growing, so the whole jam drifts against the traffic.')),
}

# ---- 2026-10-13 새 실험 11개 (정답·해설의 숫자는 각 validate 출력 기준) ----
PRED.update({
 'secretary': (  # validate-secretary: n=100, r=37 → 37.1%; n=40: r=4 24.2%, r=24 31.2%, r=32 18.1%
  T('후보를 한 명씩 만나고 지나간 사람은 다시 못 고를 때, 처음 몇 %는 일단 거절만 하며 지켜본 뒤 골라야 최고를 만날 확률이 가장 높을까요?',
    'You meet candidates one at a time and cannot go back. How many should you just watch and turn down first to have the best chance of picking the very best?'),
  [T('약 10%', 'About 10%'), T('약 37%', 'About 37%'), T('약 70%', 'About 70%')], 1,
  T('후보 100명이면 37명(37%)을 지켜볼 때 최고를 고를 확률이 37.1%로 가장 높았어요. 후보 40명일 때는 4명(10%)이면 24.2%, 24명(60%)이면 31.2%, 32명(80%)이면 18.1%였어요.',
    'With 100 candidates, watching 37 (37%) gave the best chance of picking the best one: 37.1%. With 40 candidates, watching 4 (10%) gave 24.2%, 24 (60%) gave 31.2%, and 32 (80%) gave 18.1%.')),
 'weakties': (  # validate-weakties: 약한 연결 0%에서 58.1턴 → 2%에서 16.2턴 (40번 평균)
  T('300명이 동그랗게 서서 가까운 이웃 6명과만 이어져 있어요. 먼 사람과 잇는 선을 전체의 2%(약 18개)만 더하면, 소식이 90%에게 퍼지는 시간은 어떻게 될까요?',
    '300 people stand in a ring, linked only to their 6 closest neighbors. If you add links to far-away people, just 2% of all links (about 18), what happens to the time for news to reach 90%?'),
  [T('거의 그대로', 'Barely changes'), T('약 3분의 1로 준다', 'Drops to about a third'), T('절반쯤 준다', 'Drops by about half')], 1,
  T('먼 연결이 없을 때 평균 58.1턴이던 것이 2%에서는 16.2턴(3.6배 빠름)이 되었어요(40번 평균). 평균 거리는 25.4걸음에서 33%로 줄었지만, 친구 무리의 촘촘함은 94%로 거의 그대로였어요.',
    'With no far links it took 58.1 turns on average. With 2% it took 16.2 turns (3.6 times faster; average of 40 runs). The average distance fell to 33% of 25.4 steps, but how tightly friend groups were knit stayed almost the same, at 94%.')),
 'checkout': (  # validate-checkout: 4대·90%: 한 줄 6.1분, 짧은 줄 6.9분(×1.13), 추월당한 손님 44%, 무작위 줄 29.9분
  T('계산대 4개가 90% 붐비는 가게예요. 손님이 "사람이 가장 적은 줄"을 골라 따로 서면, 모두 한 줄로 서는 가게보다 평균 대기시간이 어떻게 될까요?',
    'A store has 4 cashiers, 90% busy. If customers each join the shortest line, how does the average wait compare with one shared line?'),
  [T('거의 같다 (5% 이내)', 'About the same (within 5%)'), T('약 13% 길다', 'About 13% longer'), T('두 배 이상 길다', 'More than double')], 1,
  T('시뮬레이션에서 한 줄은 평균 6.1분, 가장 짧은 줄은 6.9분(×1.13)이었어요. 평균 차이는 작아도 손님의 44%는 뒤에 온 사람에게 추월당했고, 아무 줄에나 서면 29.9분(×4.9)이었어요.',
    'In the simulation, one shared line averaged 6.1 minutes and the shortest-line rule 6.9 (1.13 times). The average gap is small, but 44% of customers were passed by someone who arrived later. Joining any line at random averaged 29.9 minutes (4.9 times).')),
 'bunching': (  # validate-bunching: CV 0.04 → 2.10(360분), 평균 기다림 8.7분 vs 고른 간격 2.3분 (약 3.8배)
  T('버스 6대가 처음에는 똑같은 간격으로 달려요. 승객이 많으면 오래 서는 규칙만 있을 때, 몇 시간 뒤 버스 간격은 어떻게 될까요?',
    'Six buses start evenly spaced. The only rule is that they stop longer when more passengers are waiting. What do the gaps look like after a few hours?'),
  [T('계속 거의 고르다', 'Stay nearly even'), T('뭉치고, 기다림이 3배 넘게 는다', 'Clump up; waits more than triple'), T('정확히 두 대씩 짝이 된다', 'Pair up exactly in twos')], 1,
  T('아무 처방이 없으면 간격의 들쭉날쭉한 정도(변동계수)가 0.04에서 2.10(360분)으로 커졌어요. 평균 기다림은 8.7분으로, 간격이 고를 때(2.3분)의 약 3.8배였어요.',
    'With no fix, how uneven the gaps are (the coefficient of variation) grew from 0.04 to 2.10 (at minute 360). The average wait was 8.7 minutes, about 3.8 times the 2.3 minutes with even gaps.')),
 'seating': (  # validate-seating: g=1 이론 0.4323, 시뮬 0.4327
  T('서로 한 칸씩 띄우고 앉기로 한 사람들이 아주 긴 벤치에 무작위로 한 명씩 앉으면, 결국 자리의 몇 %가 찰까요?',
    'People who agree to leave one empty seat between them sit down one at a time, at random, on a very long bench. What share of the seats ends up filled?'),
  [T('약 33%', 'About 33%'), T('약 43%', 'About 43%'), T('50% (한 칸 걸러)', '50% (every other seat)')], 1,
  T('이론값은 (1−e^−2)/2≈43.2%이고 시뮬레이션은 43.3%였어요. 가지런히 앉으면 50%까지 채울 수 있지만, 무작위로 앉으면 그만큼은 못 채워요.',
    'Theory gives (1−e^−2)/2 ≈ 43.2%, and the simulation gave 43.3%. Neat seating could fill 50%, but random seating cannot.')),
 'dla': (  # validate-dla: 4,000개, 반지름 평균 123칸, 8.6%만 채워짐
  T('이리저리 떠돌던 입자가 덩어리에 닿으면 붙는 규칙으로 4,000개를 키우면, 덩어리는 가장 먼 끝까지의 원 안을 몇 %나 채울까요?',
    'Particles wander at random and stick when they touch the cluster. After 4,000 stick, how much of the circle out to the cluster\'s farthest tip do they fill?'),
  [T('약 50% (꽉 찬 덩어리)', 'About 50% (solid blob)'), T('약 25%', 'About 25%'), T('약 9% (빈틈이 많다)', 'About 9% (mostly gaps)')], 2,
  T('시뮬레이션에서 가장 먼 끝까지의 원(반지름 평균 123칸) 중 평균 8.6%만 채워졌어요. 바깥쪽 가지 끝이 안쪽 틈을 가려 주기 때문이에요.',
    'In the simulation, on average only 8.6% of the circle out to the farthest tip (average radius 123 cells) was filled. The outer branch tips block particles from reaching the gaps inside.')),
 'sandpile': (  # validate-sandpile: 40x40, 안정기 이후 57%의 알은 아무 칸도 무너뜨리지 못함
  T('모래를 한 알씩 쌓는 판(40×40)이 안정된 뒤에 떨어뜨린 알 중, 아무 칸도 무너뜨리지 않은 알은 몇 %일까요?',
    'Grains are added one at a time to a 40×40 board. After the pile settles, what share of new grains cause no collapse at all?'),
  [T('약 10%', 'About 10%'), T('약 57%', 'About 57%'), T('약 90%', 'About 90%')], 1,
  T('시드(무작위 출발값) 1~5의 평균이 57%였어요. 무너짐이 있었던 눈사태 중 중앙값은 20번인데, 가장 큰 것은 3,778~4,760번(중앙값의 약 208배)까지 나왔어요.',
    'The average over seeds 1 to 5 (different random starts) was 57%. Among avalanches that did happen, the median was 20 collapses, but the largest reached 3,778 to 4,760 (about 208 times the median).')),
 'wildfire': (  # validate-wildfire: 큰 불 1만 단계당 21.4번 → 125.1번 (90% 끄기)
  T('작은 산불을 90% 꺼 주는 숲은, 그냥 두는 숲보다 큰 불(숲의 10% 이상)이 얼마나 자주 날까요?',
    'In a forest where 90% of small fires are put out, how often do big fires (10% or more of the forest) happen compared with a forest left alone?'),
  [T('거의 같다', 'About the same'), T('훨씬 줄어든다', 'Much less often'), T('훨씬 늘어난다', 'Much more often')], 2,
  T('1만 단계당 21.4번에서 125.1번으로 약 6배 늘었어요. 매 단계 타는 면적은 0.63%와 0.61%로 거의 같았지만, 큰 불이 태운 면적의 비중은 4%에서 27%로 커졌어요.',
    "It rose about 6 times, from 21.4 to 125.1 per 10,000 steps. The area burned per step was almost the same, 0.63% versus 0.61%, but the big fires' share of the burned area grew from 4% to 27%.")),
 'ant': (  # validate-ant: 빈 판 9,976걸음에 고속도로 시작
  T('빈 판에서 출발한 규칙 두 줄짜리 개미가 대각선으로 곧게 뻗는 길(고속도로)을 내기 시작하는 건 몇 걸음쯤일까요?',
    'An ant follows just two rules on a blank grid. About how many steps pass before it starts building a straight diagonal road (the highway)?'),
  [T('약 100걸음', 'About 100 steps'), T('약 1만 걸음', 'About 10,000 steps'), T('길을 내지 않는다', 'It never does')], 1,
  T('이 시뮬레이션에서는 9,976걸음째부터 104걸음마다 같은 동작을 되풀이하며 대각선으로 나아갔고, 40,000걸음까지 이어졌어요. 처음 약 500걸음은 좌우 대칭 무늬, 그 뒤는 뒤죽박죽이었어요. 언제나 길이 생긴다는 건 아직 증명되지 않은 추측이에요.',
    'In this simulation, from step 9,976 the ant repeated the same 104-step routine and moved diagonally, all the way to step 40,000. The first ~500 steps made symmetric patterns, and after that it looked like chaos. That it always builds a road is an unproven guess.')),
 'farming': (  # validate-farming: 전선 속도 2√(rD)=1.00km/년, 시뮬 1.03, 흡수 반영 이론 1.12
  T('농사가 퍼져 나가는 속도는 무엇으로 정해질까요?', 'What sets the speed at which farming spreads?'),
  [T('사람이 걷는 속도', 'How fast people walk'), T('인구가 느는 속도와 이웃으로 퍼지는 정도', 'Population growth and how far people spread'), T('처음 농부가 몇 명이었는지', 'How many farmers there were at first')], 1,
  T('퍼지는 속도는 2√(rD)로, 인구가 느는 속도 r과 흩어지는 정도 D만으로 정해져요. 기본값에서 이론은 1.00km/년, 시뮬레이션에서 잰 값은 1.03km/년이었어요(원래 살던 사람들이 농부가 되는 것까지 넣은 이론은 1.12).',
    'The speed is 2√(rD), set only by the growth rate r and how far people scatter, D. With the defaults, theory gives 1.00 km/year and the simulation measured 1.03 km/year (1.12 for the theory that also counts local people taking up farming).')),
 'lanchester': (  # validate-lanchester: 200 대 100, 질 같음 → 이론 173명(87%), 시뮬 172명(86%); 선형이면 50%
  T('실력이 같은 두 군대가 서로 겨누어 쏘며 싸워요. 파랑 200명, 빨강 100명이면, 이긴 파랑에는 처음 병력의 얼마쯤이 남을까요?',
    'Two equally skilled armies fire at each other. Blue has 200 soldiers and red has 100. About how much of its starting force does the winning blue army have left?'),
  [T('약 50%', 'About 50%'), T('약 70%', 'About 70%'), T('약 87%', 'About 87%')], 2,
  T('제곱 법칙(병력의 제곱이 힘을 정하는 법칙)에서는 α·A²−β·B²가 변하지 않아서, 남는 병력이 √(200²−100²)≈173명, 즉 87%예요. 시뮬레이션 300번의 평균은 약 172명(86%)이었어요. 일대일로 맞붙는 선형 법칙이라면 50%만 남아요.',
    'Under the square law (strength grows with the square of troop numbers), α·A²−β·B² stays constant, so the survivors number √(200²−100²)≈173, or 87%. The average of 300 simulated fights was about 172 (86%). Under the one-on-one linear law, only 50% would be left.')),
})


PRED.update({
 'treasury': (
  T('단기금리가 1%p 뛰면, 이 모델에서 10년 금리는 얼마나 오를까요?','If the short-term rate jumps 1 percentage point, how much does the 10-year rate rise in this model?'), [T('거의 1%p','Nearly 1 point'), T('약 0.33%p','About 0.33 points'), T('거의 안 오른다(0.01%p 이하)','Hardly at all (0.01 or less)')], 1, T('되돌아오는 속도가 0.3일 때, 계산식과 시뮬레이션 모두 0.33%p였어요. 10년 금리는 앞으로 10년 동안 단기금리의 평균 예상치라서, 단기금리가 오르더라도 다시 평균으로 돌아오며 영향이 옅어져요. 되돌아오는 속도가 0.05면 0.81%p, 1.2면 0.09%p예요.','Both the formula and the simulation gave 0.33 points when the pull back to normal was 0.3. The 10-year rate is the expected average short-term rate over 10 years, so a jump fades as the rate drifts back. It is 0.81 points at a speed of 0.05 and 0.09 at 1.2.')),
 'fxrate': (
  T('금리 차이가 클수록 이자는 더 벌지만, 캐리 거래(금리 낮은 나라 돈을 빌려 높은 나라에 맡기는 투자)에서 가장 나쁜 한 주의 손실은 어떻게 될까요?', 'A bigger interest gap earns more interest. In a carry trade (borrowing a low-rate currency to invest in a high-rate one), what happens to the loss in the worst week?'), [T('그대로거나 오히려 줄어든다', 'Stays the same or shrinks'), T('이자와 함께 커진다(약 3.6% → 10.5%)', 'Grows with the interest (about 3.6% to 10.5%)'), T('늘 3.5% 안팎이다', 'Always around 3.5%')], 1, T('금리 차이 0, 4, 10%p에서 연 평균 이자 수익은 0.20%, 3.06%, 7.70%로 늘었고, 가장 나쁜 한 주의 평균 손실도 3.6%, 10.1%, 10.5%로 커졌어요. 수익이 좋아 보일수록 사람들이 빨리 몰려서 급락도 더 크기 때문이에요.', 'With gaps of 0, 4 and 10 points, the average yearly gain rose to 0.20%, 3.06% and 7.70%, and the average loss in the worst week also grew to 3.6%, 10.1% and 10.5%. The better it looks, the faster a crowd piles in, and the bigger the crash.')),
})


PRED.update({
 'war': (
  T('전쟁은 양쪽 모두에게 손해라서, 싸우지 않고 나누는 합의가 늘 있어요. 그런데 한쪽이 상대의 힘을 정확히 모르고(오차 ±25%, 전쟁 비용 15%) 자기에게 가장 유리하게 요구하면, 분쟁의 몇 %가 전쟁이 될까요?','War costs both sides, so a deal that beats fighting always exists. If one side cannot tell the other\'s strength exactly (uncertainty ±25%, war cost 15%) and makes its most favorable demand, what share of disputes turn into war?'), [T('0% (합의가 있으니 없다)','0% (a deal exists, so none)'), T('약 40%','About 40%'), T('약 90%','About 90%')], 1, T('이론으로는 40.0%, 시뮬레이션에서는 39.8%예요. 합의할 수 있는 범위가 있어도, A가 더 많이 가지려 욕심낸 요구를 힘센 상대가 거절하기 때문이에요. 정보가 정확하면 0%였어요.','Theory gives 40.0%, and the simulation 39.8%. Even when a deal is possible, A asks for too much, hoping for a bigger share, and a stronger opponent turns it down. With accurate information it was 0%.')),
})


PRED.update({
 'hagwon': (
  T('모든 집이 학원을 한 개씩 더 보내면, 상대평가에서 평균 순위는 어떻게 될까?', 'If every family sends their child to one more class, what happens to the average rank when grades are relative?'), [T('모두 올라간다', 'Everyone rises'), T('그대로, 학원비만 는다', 'Same; only the bill grows'), T('모두 내려간다', 'Everyone falls')], 1, T('모두가 같은 만큼 보내면 점수가 똑같이 올라서 순위는 최대 0만큼 바뀌어요. 한 집만 보내면 +7.5%p 오르지만, 기본 설정에서 학원비는 처음의 5.0배가 되었는데도 평균 순위는 50% 그대로였어요.', 'If everyone sends the same number, all scores rise equally, so the largest rank change is 0. One family alone gains 7.5 points. In the default run the bill grew to 5.0 times the start, yet the average rank stayed at 50%.')),
 'daycare': (
  T('어린이집에서 아프면 쉬는 아이의 비율을 0%에서 70%로 올리면, 한 해 동안 걸리는 횟수는 어떻게 될까요? (반 20명, 예시 설정)','If the share of children who stay home when sick goes from 0% to 70%, what happens to the number of infections per year? (class of 20, example settings)'), [T('거의 0회가 된다','Almost zero'), T('절반 아래로 준다','Drops by more than half'), T('5.0회에서 3.5회로 약 30% 준다','Drops about 30%, from 5.0 to 3.5')], 2, T('시드(무작위 출발값) 20개의 평균으로 5.0회에서 3.5회였어요. 100%가 쉬어도 2.5회로 절반쯤만 줄어요. 증상이 나타나기 하루 전에 이미 옮기고, 반 밖에서도 병이 들어오기 때문이에요.','Averaged over 20 seeds (different random starts), it went from 5.0 to 3.5. Even with 100% staying home it was 2.5, only about half. Kids spread it the day before symptoms show, and illness also comes in from outside the class.')),
 'admission': (
  T('아이들이 지망 순위를 솔직하게 적었을 때, 다른 아이는 그대로 두고 한 아이만 순서를 바꿔 적어서 더 나은 학교에 갈 수 있는 아이는 보스턴 방식과 지연 수락 방식에서 각각 얼마나 될까?','Everyone lists their true preferences. If just one child reorders their list, how many could get a better school under the Boston method and under deferred acceptance?'), [T('둘 다 비슷하게 40% 안팎','Both around 40%'), T('보스턴 43%, 지연 수락 0%','Boston 43%, deferred 0%'), T('보스턴 0%, 지연 수락 43%','Boston 0%, deferred 43%')], 1, T('아이 60명 표본에서 보스턴 방식은 43%(26명)가 이득을 봤고 지연 수락 방식은 0%였어요(시드 1~12 평균 보스턴 34.3%). 지연 수락 방식은 솔직하게 적는 것이 가장 좋은 구조예요.','In a sample of 60 children, 43% (26) gained under the Boston method and 0% under deferred acceptance (Boston averaged 34.3% over seeds 1 to 12). Deferred acceptance is built so that honesty is the best choice.')),
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
