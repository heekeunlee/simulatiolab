"""메인 페이지(site/index.html) 생성기: 살아 있는 실험실 주기율표, 한국어 + 영어. 실험을 추가하면 CATS와 META에 한 줄씩 추가."""
import sys, os, re, html as H
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mk2 import T, esc, da, _shell, EXP

ROOT = os.path.join(EXP, '..')
# (id, 색, 아이콘, 분야 T, 설명 T, [(slug, 모델 T, 제목 T, 설명 T)])
CATS = [
 ('daily', '#1fa463', '🚦', T('일상의 선택과 질서', 'Everyday Choices &amp; Order'), T('길, 식당, 줄에서 우리가 매일 겪는 일', 'What we run into every day on the road, at restaurants and in lines'), [
  ('traffic', T('나겔-슈레켄베르크 모델', 'Nagel–Schreckenberg model'), T('유령 정체: 사고도 공사도 없는데 왜 막힐까', 'Phantom Traffic Jams: Why Does Traffic Stop Without an Accident?'), T('가끔 밟는 브레이크 하나가 도로 전체를 막는 과정을 지켜봐요.', 'Watch how one occasional tap on the brakes can jam a whole road.')),
  ('bar', T('엘 파롤 바 문제', 'El Farol Bar problem'), T('다 같이 가는 식당은 왜 늘 붐빌까', 'Why Is the Popular Restaurant Always Packed?'), T('모두가 같은 생각을 하면 왜 모두 손해일까? 예측이 제각각이면 어떻게 될까?', 'Why does everyone lose when everyone thinks alike? And what if predictions differ?')),
  ('queue', T('공간 진화 게임', 'Spatial evolutionary game'), T('새치기가 늘면 줄은 어떻게 될까', 'What Happens When Queue-Jumping Spreads?'), T('질서는 가만히 지켜지지 않고 누군가 비용을 치르며 지켜진다는 걸 실험해요.', "Test the idea that order isn't kept by itself but by someone paying a price to keep it.")),
  ('checkout', T('대기행렬 모델 (M/M/c)', 'Queueing model (M/M/c)'), T('마트 계산대, 줄을 하나로 서면 왜 더 빠를까', 'Why Is One Shared Checkout Line Faster?'), T('같은 계산대, 같은 손님인데 줄을 하나로 세우느냐 따로 세우느냐에 따라 대기시간과 공정함이 크게 달라져요.', 'Same cashiers, same customers: one shared line or many separate ones changes both waiting time and fairness.')),
  ('bunching', T('버스 군집 모델', 'Bus-bunching model'), T('버스는 왜 꼭 두 대씩 몰려올까', 'Why Do Buses Always Come in Pairs?'), T('같은 간격으로 출발한 버스가 왜 뭉쳐 다니게 될까요? 승객이 많을수록 늦어지는 되먹임을 돌려 보고 해결책도 시험해요.', 'Why do evenly spaced buses end up in clumps? Run the feedback where more passengers means more delay, and test remedies.')),
  ('seating', T('무작위 순차 채우기 (렌니 주차 문제)', 'Random sequential filling (Rényi parking problem)'), T('모르는 사람끼리 벤치에 앉으면 몇 명이나 앉을 수 있을까', 'How Many Strangers Can Fit on a Bench?'), T('모두가 예의 바르게 거리를 두고 앉았는데도 벤치가 이만큼 남는 이유를, 앉는 방식 네 가지를 나란히 돌려 알아봐요.', 'Everyone sat politely apart, yet seats go unused. Compare four ways of sitting side by side to see why.')),
 ]),
 ('people', '#2f6fed', '🧑‍🤝‍🧑', T('인간관계', 'Relationships'), T('소문, 편견, 만남은 어떻게 퍼지고 갈라질까?', 'How do rumors, bias and encounters spread and split us apart?'), [
  ('schelling', T('셸링 분리 모델', 'Schelling segregation model'), T('끼리끼리 모이는 이유', 'Why Birds of a Feather Flock Together'), T('"소수가 되기 싫다" 정도의 약한 바람만으로도 동네가 완전히 갈라질까?', 'Can a mild wish like "I don\'t want to be a minority" split a neighborhood completely apart?')),
  ('rumor', T('소문 전파 모델 (SIR)', 'Rumor spreading model (SIR)'), T('단톡방 소문 확산', 'Rumor Spread in Group Chats'), T('소문은 얼마나 빨리, 누구를 거쳐 퍼질까? 정정 글은 언제까지 올려야 소용이 있을까?', 'How fast does a rumor spread, and through whom? How late can a correction come and still matter?')),
  ('dating', T('매칭·탐색 모델', 'Matching &amp; search model'), T('눈을 낮추면 짝을 찾을까', 'Does Lowering Your Standards Help You Find a Match?'), T('서로 동의해야 맺어지는 시장에서 눈높이가 짝 찾는 시간에 미치는 영향을 봐요.', 'See how aspiration level affects the time to find a partner in a market where both sides must agree.')),
  ('friendship', T('관계망 성장 모델', 'Growing social network model'), T('내 친구들은 왜 나보다 친구가 많을까', 'Why Do My Friends Have More Friends Than I Do?'), T('인기 있는 사람은 많은 친구 목록에 등장해요. 사람을 눌러 확인해 보세요.', 'Popular people appear on many friend lists. Click a person to check.')),
 ]),
 ('success', '#e0a100', '💰', T('성공과 불평등', 'Success &amp; Inequality'), T('운과 재능, 부와 인기는 왜 소수에게 쏠릴까?', 'Why do luck, talent, wealth and popularity pile up in a few hands?'), [
  ('talent-vs-luck', T('Talent vs Luck 모델', 'Talent vs Luck model'), T('성공은 재능일까, 운일까?', 'Is Success Talent or Luck?'), T('재능은 평균 근처에 모여 있는데 부는 왜 몇 사람에게 쏠릴까요? 최고 부자는 정말 최고 재능자일까?', 'Talent clusters around the average, so why does wealth pile up in a few hands? Is the richest person really the most talented?')),
  ('wealth', T('야드세일 교환 모델', 'Yard-sale exchange model'), T('부의 쏠림', 'Wealth Concentration'), T('모든 거래가 동전 던지기처럼 공정해도 부는 쏠릴까? 얼마나 나누면 막을 수 있을까?', 'Even if every trade is as fair as a coin flip, does wealth concentrate? How much sharing does it take to stop it?')),
  ('youtube', T('선호적 연결 모델', 'Preferential attachment model'), T('유튜브는 왜 상위 1%만 뜰까', 'Why Do Only the Top 1% of YouTubers Break Through?'), T('좋은 콘텐츠가 이길까, 먼저 뜬 채널이 이길까? 같은 채널로 시작한 평행우주를 비교해요.', 'Does good content win, or do channels that broke out first keep winning? Compare parallel universes that start with the same channels.')),
 ]),
 ('economy', '#0369a1', '💹', T('경제', 'Economy'), T('경매, 집값, 금리, 환율은 왜 그렇게 움직일까?', 'Why do auctions, home prices, interest rates and exchange rates move the way they do?'), [
  ('auction', T('승자의 저주 모델', "Winner's curse model"), T('경매에서 이기면 왜 손해일까', 'Why Does Winning an Auction Cost You?'), T('가장 높게 쓴 사람이 이기는데, 왜 이긴 사람이 평균적으로 손해일까요? 얼마나 깎아 써야 본전일까요?', 'The highest bidder wins, so why does the winner lose on average? How much should you shade your bid to break even?')),
  ('apartment', T('공간 확산 모델', 'Spatial contagion model'), T('아파트 가격은 어떻게 번질까', 'How Do Apartment Prices Spread?'), T('한 동네의 상승이 이웃으로 번지는 과정과, 대출 규제·금리가 미치는 영향을 장난감 모델로 봐요.', 'See, in a toy model, how a rise in one neighborhood spreads to the next, and what lending limits and interest rates do.')),
  ('treasury', T('평균회귀 금리 모델 (바시첵)', 'Mean-reverting rate model (Vasicek)'), T('금리가 오르면 내 채권값은 왜 떨어질까: 10년 국채 금리', 'Why Does My Bond Fall When Rates Rise? The 10-Year Treasury Yield'), T('단기금리 경로로 10년 금리가 정해지는 과정과, 금리가 1%p 오를 때 이미 산 채권값이 얼마나 떨어지는지 돌려 봐요. (예시 숫자, 예측 아님)', 'See how short-rate paths set the 10-year yield and how much a bond you already hold falls when rates rise one point. (Example numbers, not a forecast.)')),
  ('fxrate', T('캐리 트레이드 쏠림 모델', 'Carry-trade crowding model'), T('금리 높은 통화를 샀더니: 계단으로 오르고 엘리베이터로 떨어지는 캐리 트레이드', 'Buying the High-Rate Currency: The Carry Trade That Takes the Stairs Up and the Elevator Down'), T('이자를 더 주는 통화를 사면 오래 조금씩 벌다 한 번에 크게 잃을 수 있어요. 쏠림과 청산이 만드는 모양을 돌려 봐요. (예시 숫자, 투자 조언 아님)', 'Holding a higher-yield currency can earn a little for years and lose a lot at once. See the shape crowding and unwinding create. (Example numbers, not investment advice.)')),
 ]),
 ('parenting', '#e0527a', '🍼', T('육아', 'Parenting'), T('아이를 키우며 마주치는 경쟁, 감기, 줄서기의 구조', 'The structures behind the races, colds and waiting lists parents run into'), [
  ('hagwon', T('순위재 경쟁 모델', 'Positional-goods race model'), T('모두가 학원을 하나 더 보내면 왜 아무도 순위가 안 오를까', 'Why Does Everyone Adding One More Class Move Nobody Up?'), T('한 집만 하면 순위가 오르는데, 다 같이 하면 비용만 늘어요. 상대평가와 절대평가를 바꿔 구조를 비교해 봐요. (예시 숫자, 처방 아님)', 'One family alone climbs, but when all do it only the bill grows. Compare relative and absolute grading. (Example numbers, no advice.)')),
  ('daycare', T('교실 감염 모델 (SEIR형)', 'Classroom infection model (SEIR-type)'), T('어린이집에 가면 왜 자꾸 아플까: 반 크기와 아프면 쉬기', 'Why Do Kids Keep Getting Sick at Daycare? Class Size and Staying Home'), T('반 크기, 아프면 쉬는 비율, 면역이 쌓이는 정도에 따라 한 해 감기 횟수가 달라지는 모습을 돌려 봐요. (참고용 모델)', 'See how class size, staying home when sick and built-up immunity change the colds in a year. (Reference model only.)')),
  ('admission', T('배정 방식 비교 (보스턴·지연 수락)', 'Matching mechanisms (Boston vs deferred acceptance)'), T('입소 배정, 선착순·추첨·선호 반영 중 무엇이 공정할까', 'Who Gets the Seat? First-Come, Lottery or Preference-Based Matching'), T('지망 순위를 바꿔 적으면 이득일까? 네 가지 배정 방식을 나란히 돌려 봐요. (실제 입소 제도가 아님)', 'Does misreporting your ranking pay? Run four matching methods side by side. (Not the real admission system.)')),
 ]),
 ('work', '#7c5cff', '🏢', T('일터와 제도', 'Work &amp; Institutions'), T('조직과 규칙이 결과를 바꾸는 방식', 'How organizations and rules change outcomes'), [
  ('peter', T('피터의 원리 모델', 'Peter principle model'), T('무능한 상사는 왜 생길까', 'Why Do Incompetent Bosses Exist?'), T('일 잘하는 사람을 승진시키면 조직이 좋아질까? 승진 방식을 바꿔 비교해요.', 'Does promoting your best performers make an organization better? Compare promotion methods.')),
  ('secretary', T('최적 멈춤 모델 (비서 문제)', 'Optimal stopping model (secretary problem)'), T('몇 명을 만나 보고 정해야 최고의 사람을 만날까: 37%의 법칙', 'How Many Should You Meet Before Choosing? The 37% Rule'), T('되돌아갈 수 없는 만남에서, 몇 %를 지켜본 뒤 고르면 최고를 만날 확률이 가장 높을까요? 약 37%라는 답을 직접 확인해요.', 'When you cannot go back, how much should you watch before choosing to have the best chance at the very best? Check the famous 37% answer yourself.')),
  ('weakties', T('스몰월드 네트워크 (와츠–스트로가츠)', 'Small-world network (Watts–Strogatz)'), T('새 일자리 소식은 왜 친한 친구가 아니라 얼굴만 아는 사람에게서 올까: 약한 유대의 힘', 'Why Do Job Tips Come from Acquaintances, Not Close Friends? The Strength of Weak Ties'), T('친한 친구 무리에 얼굴만 아는 사람 몇 명만 이어도 소식이 퍼지는 속도가 몇 배로 빨라져요.', 'Tie just a few acquaintances into tight friend circles and news spreads several times faster.')),
 ]),
 ('society', '#475569', '🏙️', T('사회 현안', 'Society Today'), T('수치로 따져 보는 우리 사회의 큰 흐름', 'Big trends in society, worked through with numbers'), [
  ('population', T('코호트 인구 모델', 'Cohort-component model'), T('저출산이 계속되면 2070년 인구 구조는?', "What If Korea's Birth Rate Stays This Low Until 2070?"), T('출산율이 이대로면 인구 피라미드는 어떻게 바뀔까? 출산율과 이민을 바꿔 보세요.', 'If fertility stays as it is, how does the population pyramid change? Try other fertility and migration levels.')),
  ('voting', T('공간 투표 모델', 'Spatial voting model'), T('투표 방식이 달라지면 당선자가 바뀔까', 'Does the Voting Method Change the Winner?'), T('같은 표를 단순다수·결선·선호투표·보르다로 세면 당선자가 달라질 수 있을까요?', 'Count the same votes by plurality, runoff, ranked-choice and Borda. Can the winner change?')),
  ('war', T('협상 실패·군비 경쟁·번짐 모델', 'Bargaining failure, arms race and spread'), T('아무도 원하지 않는데 전쟁이 난다: 협상 실패와 군비 경쟁, 그리고 번짐', 'Nobody Wants It, Yet War Happens: Failed Bargains, Arms Races, and Spreading'), T('전쟁은 양쪽 모두에게 손해인데도 왜 일어날까요? 이름 없는 추상 국가들로 협상 실패, 군비 경쟁, 번짐을 돌려 봐요. (실제 전쟁을 설명하지 않아요)', 'War costs both sides, so why does it happen? Run failed bargaining, arms races and spreading among nameless abstract states. (It does not explain any real war.)')),
 ]),
 ('history', '#c2410c', '📜', T('역사', 'History'), T('작은 계기가 큰 흐름으로 번지는 순간', 'When a small spark turns into a big movement'), [
  ('revolution', T('문턱 모델 (Granovetter)', 'Threshold model (Granovetter)'), T('혁명은 어떻게 시작될까', 'How Does a Revolution Begin?'), T('사람마다 "몇 명이 나서면 나도 나선다"는 문턱이 다를 때, 한 사람의 차이가 광장 전체를 바꿀 수 있을까요?', 'When everyone has a different "I\'ll join if this many others do" threshold, can one person change the whole square?')),
  ('easter', T('자원-인구 과잉 모델', 'Resource–population overshoot model'), T('이스터섬은 왜 몰락했을까', 'Why Did Easter Island Collapse?'), T('숲과 사람이 함께 늘다가 한꺼번에 무너지는 과잉-붕괴의 곡선을 그려요. (실제 역사는 아직 논쟁 중이에요)', 'Forest and people grow together, then crash: trace the overshoot-and-collapse curve. (The real history is still debated.)')),
  ('alliance', T('동맹 네트워크 연쇄 모델', 'Alliance-network cascade model'), T('한 발의 총성이 세계대전이 되려면', 'How Does a Single Shot Become a World War?'), T('동맹이 촘촘해지면 작은 충돌이 어디까지 번질까요? 이름 없는 나라들로 해 보는 연쇄 실험이에요.', 'How far does a small clash spread as alliances get denser? A cascade experiment with anonymous states.')),
  ('farming', T('진행파 모델 (피셔–콜모고로프)', 'Wave-of-advance model (Fisher–Kolmogorov)'), T('농사는 어떻게 대륙을 건넜을까: 한 해에 1킬로미터씩 번진 농경', 'How Did Farming Cross a Continent? About One Kilometer a Year'), T('인구가 늘고 조금씩 흩어지는 두 규칙만으로 농경이 한 해 1킬로미터쯤의 속도로 땅을 덮는 모습을 지도 위에서 봐요.', 'Population growth plus a little dispersal is enough for farming to cover the land at about a kilometer a year. Watch it on a map.')),
  ('lanchester', T('란체스터 제곱 법칙', "Lanchester's square law"), T('병력이 두 배면 왜 네 배 강할까: 나눠 싸우면 지는 이유', 'Why Double the Soldiers Is Four Times as Strong: Why Splitting Up Loses'), T('병력이 두 배면 전투력은 네 배. 서로 병력을 깎는 두 군대로 제곱 법칙과, 힘을 나누면 지는 이유를 확인해요.', 'Twice the numbers means four times the strength. See the square law and why splitting your force loses, with two armies wearing each other down.')),
 ]),
 ('science', '#0ea5a5', '🔬', T('과학', 'Science'), T('자연이 스스로 질서와 무늬를 만드는 방식', 'How nature makes order and pattern by itself'), [
  ('firefly', T('펄스 결합 진동자', 'Pulse-coupled oscillators'), T('반딧불이는 왜 동시에 깜빡일까', 'Why Do Fireflies Flash in Unison?'), T('지휘자 없이도 수백 마리가 같은 박자로 빛나는 과정을 지켜봐요.', 'Watch hundreds of fireflies fall into the same rhythm with no conductor.')),
  ('turing', T('튜링 반응-확산 (Gray–Scott)', 'Turing reaction–diffusion (Gray–Scott)'), T('얼룩말 무늬는 어떻게 생길까', 'How Does a Zebra Get Its Stripes?'), T('두 물질의 단순한 반응만으로 점, 줄무늬, 미로 무늬가 저절로 생겨요. 직접 씨앗을 뿌려 보세요.', 'Two simple reacting chemicals can form spots, stripes and mazes by themselves. Drop your own seeds.')),
  ('dla', T('확산 제한 응집 (DLA)', 'Diffusion-limited aggregation (DLA)'), T('번개, 산호, 눈송이는 왜 서로 닮았을까', 'Why Do Lightning, Coral and Snowflakes Look Alike?'), T('떠돌던 입자가 닿으면 붙기만 하는 규칙이 번개와 산호를 닮은 가지 모양을 키워요. 붙는 확률을 바꿔 직접 키워 보세요.', 'A rule as simple as "stick on touch" grows branching shapes like lightning and coral. Change the stickiness and grow your own.')),
  ('sandpile', T('모래더미 모델 (BTW)', 'Sandpile model (BTW)'), T('모래 한 알이 눈사태를 일으킬 수 있을까', 'Can a Single Grain of Sand Cause an Avalanche?'), T('모래를 한 알씩 쌓기만 해도 더미가 스스로 임계 상태가 되어, 대부분은 조용하다가 가끔 거대한 눈사태가 나요.', 'Adding sand one grain at a time, the pile organizes itself to a critical state: mostly quiet, now and then a huge avalanche.')),
  ('wildfire', T('숲불 모델 (Drossel–Schwabl)', 'Forest-fire model (Drossel–Schwabl)'), T('작은 산불을 다 끄면 왜 나중에 더 큰 불이 날까', 'Why Putting Out Every Small Fire Can Lead to Bigger Ones Later'), T('작은 불을 끄면 연료가 쌓여 큰 불이 늘어나는 과정을, 두 숲을 나란히 돌려 확인해요.', 'See how putting out small fires lets fuel pile up and big fires multiply, with two forests running side by side.')),
  ('ant', T('랭턴의 개미 (세포 자동자)', "Langton's ant (cellular automaton)"), T('규칙 두 줄짜리 개미가 만 걸음 뒤 갑자기 길을 낸다: 랭턴의 개미', "A Two-Rule Ant Suddenly Builds a Road After 10,000 Steps: Langton's Ant"), T('규칙이 두 줄뿐인 개미가 대칭 무늬, 혼돈을 거쳐 약 만 걸음 뒤 갑자기 대각선 길을 내요.', 'An ant with just two rules makes symmetry, then chaos, then suddenly a diagonal road after about 10,000 steps.')),
 ]),
 ('philosophy', '#be185d', '🧠', T('철학', 'Philosophy'), T('도덕과 신뢰는 어떻게 살아남을까', 'How do morality and trust survive?'), [
  ('cooperation', T('반복 죄수의 딜레마', "Iterated prisoner's dilemma"), T('착한 사람은 살아남을까', 'Do Nice People Survive?'), T('배신하는 사람이 많은 세상에서 협력과 신뢰는 어떻게 되살아날까? 실수가 끼어들면 어떻게 될까?', 'In a world full of defectors, how do cooperation and trust come back? What changes when mistakes creep in?')),
  ('veil', T('롤스·하사니 선택 모델', 'Rawls–Harsanyi choice model'), T('무지의 베일 뒤에서 어떤 사회를 고를까', 'Which Society Would You Choose Behind the Veil of Ignorance?'), T('내가 누구로 태어날지 모른다면 어떤 사회를 고를까요? 위험을 싫어하는 정도에 따라 선택이 뒤집혀요.', "If you didn't know who you'd be, which society would you pick? The choice flips with how much you dislike risk.")),
  ('commons', T('공유지 게임 (하딘 vs 오스트롬)', 'Commons game (Hardin vs Ostrom)'), T('공유지의 비극은 피할 수 없을까', 'Is the Tragedy of the Commons Inevitable?'), T('모두의 목초지는 반드시 망할까, 감시와 규칙이 지켜 줄까? 두 관점을 나란히 돌려 봐요.', 'Is a shared pasture doomed, or can monitoring and rules save it? Run both views side by side.')),
 ]),
 ('paradox', '#4d7c0f', '🔄', T('뒤집어 보기', 'Flip the View'), T('"이렇게도 해석할 수 있구나" 싶은 직관의 반전', 'Counterintuitive twists that make you say "oh, so that\'s how to read it"'), [
  ('braess', T('브라에스 네트워크 모델', 'Braess network model'), T('새 길을 뚫었더니 모두가 느려졌다', 'A New Road Made Everyone Slower'), T('지름길을 열었더니 모두의 출근 시간이 늘어난다? 운전자들이 스스로 길을 고르게 두고 확인해요.', 'Open a shortcut and everyone\'s commute gets longer? Let drivers pick their own routes and see.')),
  ('regression', T('평균으로의 회귀 모델', 'Regression-to-the-mean model'), T('칭찬했더니 못하고, 혼냈더니 잘하더라', 'Praise Them and They Slip, Scold Them and They Improve'), T('말에 아무 효과가 없어도 혼낸 뒤엔 좋아지고 칭찬한 뒤엔 나빠져 보여요. 코치는 무엇을 배우게 될까요?', 'Even if words do nothing, scolding seems to work and praise seems to backfire. What does the coach learn?')),
  ('survivor', T('생존자 편향 모델', 'Survivorship-bias model'), T('돌아온 비행기의 총탄 자국, 어디를 보강할까', 'Bullet Holes on Returning Planes: Where Does the Armor Go?'), T('구멍이 없는 곳이 진짜 약점일 수 있어요. 돌아오지 못한 비행기를 함께 놓고 비교해요.', 'The places with no holes may be the real weak spots. Add the planes that never came back.')),
  ('inspection', T('검사 역설 모델', 'Inspection-paradox model'), T('버스는 왜 늘 더 오래 기다릴까', 'Why Does the Bus Always Make You Wait Longer?'), T('평균 10분마다 오는 버스를 기다리면 평균 몇 분을 기다릴까요? 내 반이 늘 붐비는 이유도 같아요.', 'If a bus comes every 10 minutes on average, how long do you wait on average? It is also why your class always seems crowded.')),
  ('coincidence', T('생일 문제 모델', 'Birthday-problem model'), T('우연의 일치는 우연이 아니다?', "A Coincidence That Isn't a Coincidence?"), T('23명이면 생일이 겹칠 확률이 50%. 그런데 "나와 겹칠" 확률은 얼마나 다를까요?', "With 23 people, there's a 50% chance that two share a birthday. But how different is the chance that someone shares yours?")),
 ]),
 ('literature', '#a16207', '📖', T('문학', 'Literature'), T('우연과 선택이 글을 쓸 수 있을까', 'Can chance and selection write a text?'), [
  ('monkey', T('무한 원숭이 vs 누적 선택', 'Infinite monkeys vs cumulative selection'), T('원숭이가 햄릿을 쓸 수 있을까', 'Can Monkeys Write Hamlet?'), T('무작위로 타자를 치는 원숭이와, 조금씩 고르며 나아가는 진화를 나란히 비교해요.', 'Compare monkeys typing at random with evolution that keeps the best at every step.')),
  ('zipf', T('지프의 법칙 · 사이먼 모델', "Zipf's law · Simon model"), T('왜 소수의 단어만 자주 쓰일까', 'Why Are a Few Words Used Constantly?'), T('왜 어느 언어에서나 소수의 단어가 글의 대부분을 차지할까? 부익부 규칙으로 직접 글을 써 봐요.', 'Why do a few words make up most of any text? Generate one yourself with a rich-get-richer rule.')),
  ('telephone', T('전달 게임 (연쇄 재현)', 'Serial reproduction'), T('이야기는 전해지며 어떻게 변할까', "How Do Stories Change as They're Retold?"), T('입에서 입으로 전해지는 이야기에서 무엇이 살아남을까요? 기억에 남는 것만 남는 과정을 지켜봐요.', 'What survives as a story passes from mouth to mouth? Watch as only the memorable parts remain.')),
 ]),
 ('art', '#9333ea', '🎨', T('예술', 'Art'), T('취향과 화풍은 어떻게 변하고 사라질까', 'How do taste and style change and disappear?'), [
  ('fashion', T('모방과 차별화 모델', 'Imitation–distinction model'), T('유행은 왜 돌고 돌까', 'Why Does Fashion Go in Cycles?'), T('따라 하는 대중과 도망가는 선두가 만드는 색의 순환을 색상환 위에서 봐요.', 'On a color wheel, watch the cycle created by a copying crowd and trendsetters running away.')),
  ('painters', T('문화 전파 모델', 'Cultural transmission model'), T('AI 화가 100명이 서로 따라 그리면', 'What If 100 AI Painters Copy Each Other?'), T('모방이 늘수록 화풍은 하나로 수렴할까? 100점의 그림이 어떻게 달라지는지 지켜봐요.', 'Does imitation collapse styles into one? Watch 100 paintings change.')),
  ('sunflower', T('황금각 잎차례 모델', 'Golden-angle phyllotaxis'), T('해바라기 씨는 왜 그 각도로 배열될까', 'Why Do Sunflower Seeds Sit at That Angle?'), T('씨앗을 137.5°씩 돌려 놓으면 틈 없이 빽빽해져요. 각도를 조금만 바꿔도 무늬가 무너지는 걸 보세요.', 'Turn each seed by 137.5° and they pack with no gaps. Nudge the angle and watch the pattern fall apart.')),
 ]),
]


# 칸 썸네일: 각 실험의 실제 결과 화면 (tools/browser/make_thumbs.js가 site/thumbs/<slug>.jpg로 만든다).
# 직접 고른 그림을 쓰려면 site/thumbs/custom/<slug>.jpg (또는 .png/.webp)를 넣으면 그것이 우선한다. 둘 다 없으면 미니 애니메이션.
def thumb(slug):
    base = os.path.join(EXP, '..', 'thumbs')
    for f in [f'custom/{slug}.jpg', f'custom/{slug}.png', f'custom/{slug}.webp', f'{slug}.jpg']:
        fp = os.path.join(base, f)
        if os.path.exists(fp): return f'thumbs/{f}?v={int(os.path.getmtime(fp))}'
    return None

# 주제로 이어지는 "이게 흥미로웠다면" 추천 (앞의 것이 더 가까운 주제)
RELATED = {
 'hagwon': ['cooperation','commons','war'],
 'daycare': ['rumor','weakties','schelling'],
 'admission': ['dating','secretary','queue'],
 'war': ['alliance','cooperation','lanchester'],
 'treasury': ['fxrate','regression','wealth'],
 'fxrate': ['treasury','bar','braess'],
 'lanchester': ['alliance', 'cooperation', 'braess'],
 'farming': ['easter', 'population', 'wildfire'],
 'ant': ['turing', 'sandpile', 'firefly'],
 'wildfire': ['sandpile', 'rumor', 'commons'],
 'sandpile': ['wildfire', 'dla', 'revolution'],
 'dla': ['turing', 'sunflower', 'sandpile'],
 'seating': ['queue', 'schelling', 'bar'],
 'bunching': ['traffic', 'braess', 'inspection'],
 'checkout': ['queue', 'inspection', 'bar'],
 'weakties': ['rumor', 'friendship', 'schelling'],
 'secretary': ['dating', 'peter', 'auction'],
 'talent-vs-luck': ['wealth', 'regression', 'youtube'], 'wealth': ['talent-vs-luck', 'veil', 'youtube'], 'youtube': ['wealth', 'friendship', 'talent-vs-luck'],
 'schelling': ['rumor', 'fashion', 'friendship', 'seating'], 'rumor': ['schelling', 'revolution', 'telephone', 'weakties'], 'dating': ['auction', 'bar', 'schelling', 'secretary'],
 'peter': ['regression', 'voting', 'cooperation', 'secretary'], 'voting': ['veil', 'revolution', 'alliance'],
 'traffic': ['braess', 'queue', 'firefly', 'bunching'], 'bar': ['traffic', 'braess', 'dating'], 'queue': ['cooperation', 'commons', 'traffic', 'checkout'],
 'firefly': ['turing', 'sunflower', 'revolution', 'ant'], 'turing': ['sunflower', 'firefly', 'zipf', 'dla'],
 'revolution': ['rumor', 'alliance', 'fashion'], 'easter': ['commons', 'population', 'apartment', 'farming'], 'alliance': ['revolution', 'rumor', 'veil', 'lanchester'],
 'cooperation': ['queue', 'commons', 'veil'], 'veil': ['wealth', 'cooperation', 'voting'], 'commons': ['easter', 'cooperation', 'queue'],
 'monkey': ['zipf', 'telephone', 'painters'], 'zipf': ['monkey', 'telephone', 'youtube'], 'telephone': ['rumor', 'monkey', 'painters'],
 'fashion': ['painters', 'schelling', 'rumor'], 'painters': ['fashion', 'telephone', 'sunflower'], 'sunflower': ['turing', 'firefly', 'painters', 'dla'], 'auction': ['dating', 'survivor', 'regression'],
 'population': ['apartment', 'easter', 'wealth'], 'apartment': ['population', 'rumor', 'auction'],
 'braess': ['traffic', 'bar', 'queue'], 'regression': ['survivor', 'talent-vs-luck', 'peter'], 'survivor': ['regression', 'talent-vs-luck', 'auction'],
 'friendship': ['inspection', 'rumor', 'youtube', 'weakties'], 'inspection': ['friendship', 'coincidence', 'traffic', 'checkout'], 'coincidence': ['inspection', 'friendship', 'regression'],
}
# 새 실험을 추가한 날 (NEW 표시는 이 날짜부터 7일 동안, 그리고 "지난 방문 이후 새 실험" 계산에 쓴다). 새 실험을 만들면 한 줄 추가.
ADDED = {s: '2026-10-12' for s in ['braess', 'regression', 'survivor', 'friendship', 'inspection', 'coincidence']}
ADDED.update({s: '2026-10-13' for s in ['secretary', 'weakties', 'checkout', 'bunching', 'seating', 'dla', 'sandpile', 'wildfire', 'ant', 'farming', 'lanchester', 'treasury', 'fxrate', 'war', 'hagwon', 'daycare', 'admission']})

# slug -> (기호, 짧은 이름 T, 미니 애니메이션 종류)
# 쉬운 말로 다듬은 칸 제목·설명(tools/pages/simple/<slug>.json)이 있으면 그것을 쓴다
import json as _json
for _cat in CATS:
    _items = _cat[5]
    for _k, (_slug, _m, _t, _d) in enumerate(list(_items)):
        _f = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'simple', _slug + '.json')
        if os.path.exists(_f):
            _j = _json.load(open(_f, encoding='utf-8'))
            _items[_k] = (_slug, _m, T(_j['title_ko'], _j['title_en']) if 'title_ko' in _j else _t, T(_j['desc_ko'], _j['desc_en']) if 'desc_ko' in _j else _d)

META = {
 'talent-vs-luck': ('Tl', T('재능 vs 운', 'Talent vs Luck'), 'bars'),
 'wealth': ('Ws', T('부의 쏠림', 'Wealth'), 'stairs'),
 'youtube': ('Yt', T('유튜브 쏠림', 'Creators'), 'rise'),
 'schelling': ('Sc', T('끼리끼리', 'Segregation'), 'grid'),
 'rumor': ('Ru', T('소문 확산', 'Rumors'), 'net'),
 'dating': ('Da', T('짝 찾기', 'Matching'), 'drift'),
 'peter': ('Pe', T('무능한 상사', 'Peter Principle'), 'tri'),
 'voting': ('Vo', T('투표 방식', 'Voting'), 'vote'),
 'traffic': ('Tr', T('유령 정체', 'Phantom Jams'), 'ring'),
 'bar': ('Ba', T('붐비는 식당', 'El Farol'), 'wave'),
 'queue': ('Qu', T('새치기', 'Queue Jumping'), 'grid2'),
 'firefly': ('Ff', T('반딧불이', 'Fireflies'), 'pulse'),
 'turing': ('Tu', T('얼룩말 무늬', 'Zebra Stripes'), 'stripes'),
 'revolution': ('Rv', T('혁명의 문턱', 'Revolution'), 'spread'),
 'cooperation': ('Co', T('협력의 진화', 'Cooperation'), 'handshake'),
 'monkey': ('Mk', T('원숭이와 햄릿', 'Monkeys'), 'letters'),
 'fashion': ('Fa', T('유행의 순환', 'Fashion'), 'spiral'),
 'painters': ('Pa', T('AI 화가', 'AI Painters'), 'tiles'),
 'population': ('Po', T('2070 인구', 'Population'), 'tri2'),
 'apartment': ('Ap', T('아파트 가격', 'Housing'), 'heat'),
 'easter': ('Es', T('이스터섬', 'Easter Island'), 'rise'),
 'alliance': ('Al', T('동맹의 연쇄', 'Alliances'), 'net'),
 'veil': ('Vl', T('무지의 베일', 'Veil of Ignorance'), 'vote'),
 'commons': ('Cm', T('공유지', 'Commons'), 'wave'),
 'zipf': ('Zp', T('지프의 법칙', "Zipf's Law"), 'bars'),
 'telephone': ('Tp', T('전달 게임', 'Telephone'), 'letters'),
 'sunflower': ('Ph', T('해바라기', 'Sunflower'), 'sunflower'),
 'auction': ('Au', T('경매', 'Auctions'), 'drift'),
 'braess': ('Br', T('새 길의 역설', 'Braess'), 'net'),
 'regression': ('Rg', T('평균 회귀', 'Regression'), 'drift'),
 'survivor': ('Sv', T('생존자 편향', 'Survivors'), 'heat'),
 'friendship': ('Fp', T('친구의 역설', 'Friend Paradox'), 'net'),
 'inspection': ('Ip', T('대기 시간', 'Waiting'), 'stripes'),
 'coincidence': ('Ci', T('우연의 일치', 'Coincidence'), 'ring'),
 'hagwon': ('Hg', T('학원 딜레마', 'Cram-School Dilemma'), 'rise'),
 'daycare': ('Dc', T('어린이집 감기', 'Daycare Colds'), 'heat'),
 'admission': ('Ad', T('입소 배정', 'Who Gets the Seat?'), 'grid2'),
 'war': ('Wa', T('전쟁의 구조', 'How War Starts'), 'net'),
 'treasury': ('Ty', T('국채 금리', 'Treasury Yield'), 'rise'),
 'fxrate': ('Fx', T('환율과 캐리', 'FX Carry'), 'stairs'),
 'secretary': ('Sk', T('37%의 법칙', 'The 37% Rule'), 'ring'),
 'weakties': ('Wk', T('약한 유대', 'Weak Ties'), 'net'),
 'checkout': ('Lq', T('계산대 줄', 'Checkout Lines'), 'stripes'),
 'bunching': ('Bu', T('버스 뭉침', 'Bus Bunching'), 'ring'),
 'seating': ('Bn', T('벤치 자리', 'Bench Seating'), 'grid2'),
 'dla': ('Dl', T('가지 프랙탈', 'Branching'), 'spread'),
 'sandpile': ('Sp', T('모래더미', 'Sandpile'), 'grid'),
 'wildfire': ('Wf', T('산불', 'Wildfire'), 'heat'),
 'ant': ('La', T('랭턴의 개미', "Langton's Ant"), 'spiral'),
 'farming': ('Fm', T('농경 전파', 'Farming Spread'), 'spread'),
 'lanchester': ('Lc', T('란체스터 법칙', "Lanchester's Law"), 'tri'),
}

def build(only_existing=True):
    nav, foot = _shell()
    nav = nav.replace('href="../../logo.svg"', 'href="logo.svg"').replace('src="../../logo.svg"', 'src="logo.svg"').replace('href="../../"', 'href="./"')
    nav = re.sub(r'<a class="link" href="\./"[^>]*>.*?</a>', '', nav, flags=re.S)
    cats = []
    for c in CATS:
        items = [it for it in c[5] if not only_existing or os.path.exists(EXP + it[0] + '/index.html')]
        if items: cats.append((c[:5], items))
    total = sum(len(i) for _, i in cats)

    # 주기율표 열(분야) + 칸(실험)
    cols = ''; n = 0; exps = []; feed = []
    for (k, col, ic, t, d), items in cats:
        tiles = ''
        for slug, method, title, desc in items:
            n += 1
            sym, short, kind = META[slug]
            ex = {'s': slug, 'n': '%02d' % n, 'c': col, 'sym': sym, 'ko': title[0], 'en': re.sub('<[^>]+>', '', H.unescape(title[1])), 'f': k, 'r': RELATED.get(slug, [])}
            if thumb(slug): ex['t'] = thumb(slug)
            if slug in ADDED: ex['a'] = ADDED[slug]
            exps.append(ex)
            feed.append((slug, ADDED.get(slug, '2026-10-10'), title, desc))
            th = thumb(slug)
            vis = f'<img class="thumb" src="{th}" alt="" loading="lazy" decoding="async">' if th else '<canvas class="glyph" aria-hidden="true"></canvas>'
            tiles += f"""
        <a class="el{' has-thumb' if th else ''}" href="experiments/{slug}/" data-field="{k}" data-kind="{kind}"{f' data-thumb="{th}"' if th else ''} style="--c:{col}">
          {vis}
          <span class="num">{n:02d}</span><span class="sym">{sym}</span>
          <span class="nm"{da(short)}>{short[0]}</span>
          <span class="hid t-title"{da(title)}>{title[0]}</span><span class="hid t-desc"{da(desc)}>{desc[0]}</span><span class="hid t-model"{da(method)}>{method[0]}</span>
        </a>"""
        cols += f"""
      <div class="col" data-field="{k}" data-color="{col}" data-icon="{ic}" style="--c:{col}">
        <div class="fh"><span class="ic">{ic}</span><b{da(t)}>{t[0]}</b><i>{len(items)}</i></div>{tiles}
      </div>"""

    L = lambda ko, en: (ko, en)
    eyebrow = T(f'SIMULATIO LAB · 실험 {total}개 · 분야 {len(cats)}개', f'SIMULATIO LAB · {total} experiments · {len(cats)} fields')
    mega = T('세상을<br>돌려보는 실험실', 'A Lab That<br>Reruns the World')
    lead = T("성공은 운일까? 소문은 어떻게 퍼질까? 새 길을 뚫으면 왜 더 막힐까? 사람과 사회, 자연과 예술이 그렇게 돌아가는 이유를 시뮬레이션으로 돌려보고, 변수를 바꿔 직접 확인할 수 있게 공개합니다.",
             'Is success luck? How do rumors spread? Why does a new road make traffic worse? We rerun people, society, nature and art in simulations to see why things happen, and publish them so you can change the variables and check for yourself.')
    cta1 = T('실험실 둘러보기 ↓', 'Explore the lab ↓'); cta2 = T('🎲 무작위 실험', '🎲 Random experiment')
    cta3 = T('▶ 유튜브 구독', '▶ Subscribe on YouTube')
    hint = T('점들을 만져 보세요. 마우스를 피하고, 클릭하면 "만약에!" 하고 흩어졌다가 다시 모입니다.', 'Play with the dots. They dodge your cursor, and a click asks "what if?": they scatter, then sort themselves out again.')
    h_tab = T('실험 주기율표', 'The Periodic Table of Experiments')
    p_tab = T(f'{total}개의 실험을 {len(cats)}개 분야(열)로 묶었어요. 칸 위에 마우스를 올리면 아래 실험 노트에 내용이 나타납니다.', f'{total} experiments in {len(cats)} fields (columns). Hover over a cell to see its details in the lab notebook below.')
    nb_today = T('오늘의 실험', 'Experiment of the day'); nb_sel = T('실험 노트', 'Lab notebook')
    nb_go = T('직접 돌려보기 →', 'Try it yourself →')
    desc = T("세상이 그렇게 돌아가는 이유를 AI 시뮬레이션으로 돌려봅니다. 변수를 바꿔 직접 확인해 보세요.", 'We rerun the world in AI-designed simulations to see why things happen. Change the variables and check for yourself.')
    out = f"""<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title data-en="Simulatio Lab">시뮬라티오 랩</title>
<meta name="description" content="{esc(desc[0])}" data-en-content="{esc(desc[1])}">
<link rel="icon" type="image/svg+xml" href="favicon.svg">
<link rel="manifest" href="manifest.webmanifest">
<link rel="alternate" type="application/rss+xml" title="Simulatio Lab | New experiments (RSS)" href="feed.xml">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<meta name="theme-color" content="#2f6fed">
<link rel="stylesheet" href="style.css">
<link rel="stylesheet" href="home.css">
</head>
<body class="home">
{nav}

<header class="hero" id="hero">
  <canvas id="swarm" aria-hidden="true"></canvas>
  <div class="hero-in wrap">
    <p class="eyebrow"{da(eyebrow)}>{eyebrow[0]}</p>
    <h1 class="mega"{da(mega)}>{mega[0]}</h1>
    <p class="rq" id="rq" aria-live="polite"></p>
    <p class="lead"{da(lead)}>{lead[0]}</p>
    <div class="cta"><a class="btn big" href="#table"{da(cta1)}>{cta1[0]}</a><button type="button" class="btn ghost" id="rand"{da(cta2)}>{cta2[0]}</button><a class="btn ghost yt" href="https://www.youtube.com/@simulatiolab?sub_confirmation=1" target="_blank" rel="noopener"{da(cta3)}>{cta3[0]}</a></div>
    <p class="hint"{da(hint)}>{hint[0]}</p>
    <div class="dsk" id="daily-sk" aria-hidden="true"><i></i><i></i><i></i></div>
  </div>
</header>

<main class="wrap wide">
  <section class="table-sec" id="table">
    <h2{da(h_tab)}>{h_tab[0]}</h2>
    <p class="muted"{da(p_tab)}>{p_tab[0]}</p>
    <div class="ptable">{cols}
    </div>
  </section>

  <section class="notebook" id="nb">
    <div class="nb-visual"><canvas id="nbcanvas" aria-hidden="true"></canvas><span class="nb-sym" id="nbsym"></span></div>
    <div class="nb-text">
      <p class="nb-tag"><span id="nbtag-today"{da(nb_today)}>{nb_today[0]}</span><span id="nbtag-sel" hidden{da(nb_sel)}>{nb_sel[0]}</span></p>
      <h3 id="nbtitle"></h3>
      <p id="nbdesc" class="muted"></p>
      <p class="nb-model"><span id="nbmodel" class="xchip"></span></p>
      <a class="btn big" id="nbgo" href="#"{da(nb_go)}>{nb_go[0]}</a>
    </div>
  </section>
</main>

{foot}
<script src="i18n.js"></script>
<script src="i18n-en.js"></script>
<script src="exps.js"></script>
<script src="home.js"></script>
<script src="counter.js"></script>
<script src="daily.js"></script>
<script src="engage.js"></script>
</body>
</html>
"""
    open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8').write(out)
    # 실험 페이지의 이전/다음 이동에 쓰는 목록
    import json
    # RSS 피드 (한국어 feed.xml, 영어 feed-en.xml): 새 실험 알림용
    import email.utils, datetime as _dt
    def rfc(d): return email.utils.format_datetime(_dt.datetime.strptime(d, '%Y-%m-%d').replace(hour=9, tzinfo=_dt.timezone(_dt.timedelta(hours=9))))
    def strip(x): return re.sub('<[^>]+>', '', H.unescape(x))
    for idx, fname, title_ch, desc_ch in ((0, 'feed.xml', '시뮬라티오 랩 | 새 실험', '세상을 시뮬레이션으로 돌려보는 실험실의 새 실험 소식'), (1, 'feed-en.xml', 'Simulatio Lab | New experiments', 'New experiments from the lab that reruns the world')):
        items = ''.join(f'<item><title>{H.escape(strip(t[idx]))}</title><link>https://heekeunlee.github.io/simulatiolab/experiments/{sl}/</link><guid isPermaLink="true">https://heekeunlee.github.io/simulatiolab/experiments/{sl}/</guid><pubDate>{rfc(d)}</pubDate><description>{H.escape(strip(ds[idx]))}</description></item>' for sl, d, t, ds in sorted(feed, key=lambda x: x[1], reverse=True))
        open(os.path.join(ROOT, fname), 'w', encoding='utf-8').write(f'<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>{H.escape(title_ch)}</title><link>https://heekeunlee.github.io/simulatiolab/</link><description>{H.escape(desc_ch)}</description><language>{"ko" if idx == 0 else "en"}</language>{items}</channel></rss>')
    open(os.path.join(ROOT, 'exps.js'), 'w', encoding='utf-8').write('// 실험 목록 (tools/pages/index.py 가 만든다)\nwindow.LAB_EXPS = ' + json.dumps(exps, ensure_ascii=False) + ';\n')
    return total, len(cats)

if __name__ == '__main__':
    print(build(only_existing=('--all' not in sys.argv)))
