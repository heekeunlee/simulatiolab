"""메인 페이지의 "오늘의 만약에"(방문할 때마다 무작위로, 9초마다 자동으로 바뀌는 질문 + 투표), "다음 실험 주제 투표", 새 실험 알림 문구.
실행하면 site/daily.js(한국어 데이터)와 tools/pages/dyn_daily.py(한국어→영어)를 만든다. 번역은 tr_extract/tr_build로.
- 오늘의 만약에: DAILY를 방문할 때마다 무작위(안 답한 것 먼저, 연이어 같은 분야 제외)로 보여주고 9초마다 다음 질문으로 넘어간다. 각 질문은 관련 실험으로 이어진다.
- 주제 투표: TOPIC의 후보 중 하나를 고르게 한다. 새 실험이 정해지면 TOPIC.id를 새로 바꾸고 후보를 교체한다.
투표 저장은 구글 시트 predictions 시트를 같이 쓴다 (page = 'q-<실험 slug>' / TOPIC.id)."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); SITE = os.path.join(HERE, '..', '..', 'site')
sys.path.insert(0, HERE)
from mk2 import T

DAILY = [  # (실험 slug, 질문, [보기 3개])
 ('talent-vs-luck', T('성공의 몇 %는 운 덕분일까요?', 'How much of success comes from luck?'), [T('20% 이하', '20% or less'), T('약 50%', 'About half'), T('80% 이상', '80% or more')]),
 ('wealth', T('모두 똑같이 시작해서 공정하게 거래하면, 돈은 고르게 남을까요?', 'If everyone starts equal and trades fairly, will money stay evenly spread?'), [T('고르게 남는다', 'Stays even'), T('조금 쏠린다', 'Tilts a little'), T('크게 쏠린다', 'Piles up in a few hands')]),
 ('youtube', T('좋은 영상을 만들면 결국 뜰까요?', 'If you make great videos, will they take off in the end?'), [T('거의 뜬다', 'Almost always'), T('반반이다', 'Half the time'), T('운이 더 크다', 'Luck matters more')]),
 ('schelling', T('이웃 중 몇 %가 나와 비슷해야 편할까요?', 'How many of your neighbors should be like you to feel at ease?'), [T('전부', 'All of them'), T('절반 이상', 'More than half'), T('3분의 1쯤', 'About a third')]),
 ('rumor', T('단톡방에 퍼진 소문을 바로잡으면 소용이 있을까요?', 'Does fixing a rumor in a group chat help?'), [T('거의 없다', 'Hardly at all'), T('절반쯤 막는다', 'Stops about half'), T('대부분 막는다', 'Stops most of it')]),
 ('dating', T('눈을 낮추면 짝을 더 빨리 만날까요?', 'If you lower your standards, will you meet someone sooner?'), [T('더 빨리', 'Sooner'), T('비슷하다', 'About the same'), T('오히려 늦다', 'Later, actually')]),
 ('peter', T('일을 제일 잘하는 사람을 승진시키면 회사가 좋아질까요?', 'If you promote the best worker, does the company get better?'), [T('좋아진다', 'It gets better'), T('상관없다', 'No difference'), T('나빠질 수 있다', 'It can get worse')]),
 ('voting', T('같은 표인데 세는 방법만 바꾸면 당선자가 달라질까요?', 'With the same votes, can a different counting method change the winner?'), [T('절대 안 바뀐다', 'Never'), T('가끔 바뀐다', 'Sometimes'), T('자주 바뀐다', 'Often')]),
 ('traffic', T('고속도로가 막히는 건 대부분 사고나 공사 때문일까요?', 'Are most highway jams caused by crashes or roadwork?'), [T('대부분 그렇다', 'Mostly, yes'), T('절반쯤', 'About half'), T('아니다, 운전 습관만으로도 막힌다', 'No, driving habits alone can do it')]),
 ('bar', T('모두가 인기 식당에 가면 모두에게 좋을까요?', 'If everyone goes to the popular restaurant, is it good for everyone?'), [T('좋다', 'Yes'), T('그저 그렇다', 'So-so'), T('모두 손해다', 'Everyone loses')]),
 ('queue', T('새치기하는 사람이 늘면 줄은 어떻게 될까요?', 'If more people cut in line, what happens to the line?'), [T('금방 무너진다', 'Falls apart fast'), T('조금 흔들린다', 'Wobbles a bit'), T('그래도 유지된다', 'Holds up anyway')]),
 ('firefly', T('지휘하는 개체가 없어도 반딧불이는 함께 반짝일 수 있을까요?', 'Can fireflies flash together with no leader?'), [T('불가능하다', 'Impossible'), T('가끔 가능하다', 'Sometimes'), T('대부분 가능하다', 'Usually')]),
 ('turing', T('얼룩말 무늬는 유전자에 그려진 설계도대로 생길까요?', 'Does a zebra get its stripes from a blueprint in its genes?'), [T('그렇다', 'Yes'), T('일부만', 'Only partly'), T('간단한 화학 반응으로도 생긴다', 'Simple chemistry can make them')]),
 ('revolution', T('한 사람이 마음을 바꾸면 군중 전체가 달라질 수 있을까요?', 'Can one person changing their mind change a whole crowd?'), [T('불가능하다', 'Impossible'), T('가끔', 'Sometimes'), T('충분히 가능하다', 'Quite possible')]),
 ('easter', T('한 마을이 스스로 숲을 다 베어 버릴 수 있을까요?', 'Can a community cut down its whole forest by itself?'), [T('불가능하다', 'Impossible'), T('가끔', 'Sometimes'), T('충분히 가능하다', 'Quite possible')]),
 ('alliance', T('동맹이 많을수록 전쟁은 줄어들까요?', 'The more alliances, the fewer wars?'), [T('줄어든다', 'Fewer wars'), T('상관없다', 'No difference'), T('오히려 번질 수 있다', 'A war may spread more')]),
 ('cooperation', T('남을 믿는 착한 사람은 결국 손해를 볼까요?', 'Do kind, trusting people end up losing out?'), [T('손해 본다', 'They lose out'), T('반반이다', 'It depends'), T('결국 살아남는다', 'They win in the end')]),
 ('veil', T('내가 누구로 태어날지 모른다면, 어떤 사회를 고르시겠어요?', 'If you did not know who you would be born as, which society would you pick?'), [T('모두가 똑같은 사회', 'Everyone is equal'), T('안전망이 있는 사회', 'There is a safety net'), T('이긴 사람이 다 갖는 사회', 'Winner takes all')]),
 ('commons', T('모두가 함께 쓰는 풀밭은 결국 망가질까요?', 'Will a pasture everyone shares end up ruined?'), [T('반드시 망한다', 'Always'), T('규칙이 있으면 지켜진다', 'Rules can save it'), T('상황에 따라 다르다', 'It depends')]),
 ('monkey', T('원숭이가 아무 키나 계속 치면 햄릿 한 줄은 쓸 수 있을까요?', 'If a monkey types random keys, can it write even one line of Hamlet?'), [T('불가능하다', 'No chance'), T('아주 짧은 줄만', 'Only a very short line'), T('충분히 쓴다', 'Easily')]),
 ('zipf', T('어느 나라 말이든 몇몇 단어가 글의 대부분을 채울까요?', 'In any language, do a few words fill most of a text?'), [T('아니다', 'No'), T('조금', 'A little'), T('그렇다', 'Yes')]),
 ('telephone', T('이야기를 40번 전하면 처음 내용이 얼마나 남을까요?', 'After a story is passed along 40 times, how much of it is left?'), [T('거의 그대로', 'Almost all'), T('절반쯤', 'About half'), T('4분의 1쯤', 'About a quarter')]),
 ('fashion', T('유행은 따라 하는 사람 때문에 돌까요, 앞서가는 사람 때문에 돌까요?', 'Do trends come and go because of followers or because of trendsetters?'), [T('따라 하는 사람', 'Followers'), T('앞서가는 사람', 'Trendsetters'), T('둘 다', 'Both')]),
 ('painters', T('서로 따라 그리면 그림 스타일이 하나로 모일까요?', 'If painters keep copying each other, will they all end up with one style?'), [T('그렇다', 'Yes'), T('아니다', 'No'), T('상황에 따라 다르다', 'It depends')]),
 ('sunflower', T('해바라기 씨앗이 놓이는 각도를 조금만 바꿔도 모양이 확 달라질까요?', 'If you change the angle of sunflower seeds a little, does the pattern change a lot?'), [T('아니다', 'No'), T('조금', 'A little'), T('확 달라진다', 'A lot')]),
 ('auction', T('경매에서 제일 높은 값을 부른 사람이 오히려 손해일 수 있을까요?', 'Can the top bidder at an auction actually lose out?'), [T('불가능하다', 'Impossible'), T('가끔 그렇다', 'Sometimes'), T('자주 그렇다', 'Often')]),
 ('population', T('지금 출산율이 이어지면 2070년에 65세 이상은 몇 %일까요?', 'If birth rates stay this low, what share will be 65 or older in 2070?'), [T('30% 안팎', 'Around 30%'), T('40% 안팎', 'Around 40%'), T('50% 이상', '50% or more')]),
 ('apartment', T('옆 동네 집값이 오르면 우리 동네도 따라 오를까요?', 'If house prices rise in the next area, will yours rise too?'), [T('상관없다', 'No link'), T('조금 따라 오른다', 'A little'), T('크게 따라 오른다', 'A lot')]),
 ('braess', T('길이 막힐 때, 새 도로를 내면 해결될까요?', 'When roads are jammed, will a new road fix it?'), [T('그렇다', 'Yes'), T('상황에 따라 다르다', 'It depends'), T('더 막힐 수도 있다', 'It may get worse')]),
 ('regression', T('칭찬해 봤자 소용없다고 느낀 적이 있나요?', 'Have you ever felt that praise does not work?'), [T('있다', 'Yes'), T('없다', 'No'), T('잘 모르겠다', 'Not sure')]),
 ('survivor', T('성공한 사람들의 공통점이 곧 성공 비결일까요?', 'Is what successful people share the secret of their success?'), [T('그렇다', 'Yes'), T('일부만', 'Only partly'), T('실패한 사람도 갖고 있다', 'Failed people have it too')]),
 ('friendship', T('내 친구들은 나보다 친구가 많은 것 같나요?', 'Do your friends seem to have more friends than you?'), [T('그렇다', 'Yes'), T('비슷하다', 'About the same'), T('아니다', 'No')]),
 ('inspection', T('버스는 왜 내가 기다릴 때만 늦게 올까요?', 'Why is the bus late only when you are waiting?'), [T('내 운이 나빠서', 'Bad luck'), T('원래 그런 것이다', 'It really works that way'), T('착각이다', 'Just my imagination')]),
 ('coincidence', T('"어쩜 이런 우연이!" 싶은 일은 드물까요?', 'Are "what a coincidence!" moments rare?'), [T('아주 드물다', 'Very rare'), T('가끔 있다', 'Now and then'), T('생각보다 흔하다', 'More common than you think')]),
]

DAILY += [  # 2026-10-13 새 실험 11개 (정답 없는 가벼운 3지선다)
 ('secretary', T('집을 보러 다니는데 지나친 집은 다시 못 본다면, 몇 군데를 보고 정할까요?', 'You cannot go back to a home you passed. How many should you see before choosing?'), [T('첫 집에서 바로', 'The very first one'), T('3분의 1쯤 보고 나서', 'After about a third'), T('거의 다 보고 나서', 'After nearly all')]),
 ('weakties', T('새 일자리 소식은 누가 가장 먼저 알려 줄까요?', 'Who is most likely to tell you about a new job first?'), [T('가장 친한 친구', 'My closest friend'), T('가끔 보는 아는 사람', 'Someone I know slightly'), T('가족', 'Family')]),
 ('checkout', T('마트 계산대에서 어느 줄에 서나요?', 'Which checkout line do you pick at the store?'), [T('사람이 적은 줄', 'The fewest people'), T('카트가 가벼운 줄', 'The lightest carts'), T('가까운 줄', 'The nearest line')]),
 ('bunching', T('한참 기다렸더니 버스 세 대가 줄줄이 왔어요. 왜일까요?', 'You waited ages, then three buses came in a row. Why?'), [T('기사님들이 제멋대로라서', 'Careless drivers'), T('늦은 버스는 손님이 더 타서 더 늦어져서', 'A late bus gets more riders and falls further behind'), T('그냥 운이 나빠서', 'Just bad luck')]),
 ('seating', T('낯선 사람들이 서로 한 칸씩 띄우고 앉으면, 빈 벤치의 자리는 얼마나 낭비될까요?', 'If strangers sit with a gap between them, how much of an empty bench goes to waste?'), [T('거의 없다', 'Almost none'), T('열 자리 중 한두 자리', 'One or two in ten'), T('절반 이상', 'More than half')]),
 ('dla', T('물속의 가루가 닿으면 붙기만 한다면, 덩어리는 어떤 모양일까요?', 'If powder in water sticks when it touches, what shape does the clump take?'), [T('둥글고 꽉 찬 공', 'A round, solid ball'), T('가지가 뻗은 성긴 모양', 'A branching, open shape'), T('납작한 판', 'A flat plate')]),
 ('sandpile', T('모래를 한 알씩 쌓으면, 한 알이 일으키는 가장 큰 변화는 뭘까요?', 'Adding sand one grain at a time, what is the biggest change one grain can cause?'), [T('늘 작은 변화뿐', 'Only small changes'), T('가끔 더미 전체가 무너진다', 'Sometimes the whole pile slides'), T('쌓을수록 덜 무너진다', 'The more it grows, the less it slides')]),
 ('wildfire', T('작은 산불을 늘 바로 껐다면, 10년 뒤 숲은 어떻게 될까요?', 'If every small forest fire is put out at once, what will the forest be like in 10 years?'), [T('더 안전해진다', 'Safer'), T('마른 나무가 쌓여 큰불이 날 수 있다', 'Dry wood piles up and big fires can start'), T('별 차이 없다', 'No real change')]),
 ('ant', T('규칙 두 개만 따르는 개미를 오래 걷게 두면 어떻게 될까요?', 'If an ant follows just two rules and walks for a long time, what happens?'), [T('제자리를 맴돈다', 'Circles in place'), T('판을 어지럽게 채운다', 'Messily fills the grid'), T('어느 순간 곧은 길을 낸다', 'Suddenly builds a straight road')]),
 ('farming', T('마을이 한 해에 1km씩만 퍼져도, 천 년 뒤엔 얼마나 갈까요?', 'If a settlement spreads just 1 km a year, how far does it reach in a thousand years?'), [T('옆 도시까지', 'To the next town'), T('나라 한 바퀴쯤', 'Across a country'), T('대륙 하나를 가로질러', 'Across a continent')]),
 ('lanchester', T('우리 편이 두 배로 많고 서로 총을 겨눈다면, 힘은 몇 배일까요?', 'If your side has twice as many people and both sides shoot at each other, how many times stronger are you?'), [T('약 2배', 'About 2 times'), T('약 4배', 'About 4 times'), T('잘 모르겠다', 'Not sure')]),
]


DAILY += [
 ('treasury', T('금리가 1%p 오르면, 이미 가진 10년 만기 채권값은 어떻게 될까요?','If interest rates rise 1 point, what happens to the price of a 10-year bond you own?'), [T('거의 그대로','Barely changes'), T('1~2% 내린다','Drops 1-2%'), T('약 8% 내린다','Drops about 8%')]),
 ('fxrate', T('이자를 더 주는 나라의 돈을 사 두면 어떻게 될까요?', 'What happens if you hold money from a country that pays higher interest?'), [T('이자만큼 번다', 'You earn the interest'), T('환율 때문에 이득이 별로 없다', 'Exchange rates cancel it out'), T('조금씩 벌다 한 번에 크게 잃는다', 'Small gains, then one big loss')]),
]


DAILY += [
 ('war', T('두 나라 모두 전쟁이 싫고 서로 손해라면, 전쟁은 어떻게 될까요?','If neither country wants war and both would lose, what happens?'), [T('일어나지 않는다','It never happens'), T('서로 잘못 읽으면 일어날 수 있다','It can happen if they misread each other'), T('늘 일어난다','It always happens')]),
]


DAILY += [
 ('hagwon', T('이웃 아이들이 모두 학원을 하나씩 더 다니기 시작했어요. 우리 집은?', 'All the kids next door started one more class. What do you do?'), [T('우리도 하나 더 보낸다', 'Add one more class'), T('지금 그대로 둔다', 'Keep things the same'), T('아이와 이야기해서 정한다', 'Talk with my child first')]),
 ('daycare', T('한 반 아이가 20명에서 10명으로 줄면, 감기는 어떻게 될까요?','If a class drops from 20 kids to 10, what happens to colds?'), [T('거의 그대로','Barely changes'), T('조금 줄어든다','Fewer a little'), T('많이 줄어든다','Much fewer')]),
 ('admission', T('1지망이 인기 많은 곳이라면, 지망 순서를 어떻게 적을까요?','If your first choice is very popular, how do you rank your list?'), [T('원하는 순서대로 적는다','My true order'), T('될 만한 곳을 앞에 적는다','A safer pick first'), T('잘 모르겠다','Not sure')]),
]

DAILY += [  # 2026-10-14 예술 분야 새 실험 6개 (정답 없는 가벼운 3지선다)
 ('hitsong', T('만약 음원 차트에 순위가 사라지고 곡이 무작위 순서로만 보인다면, 1등 곡은 어떻게 될까요?', 'What if music charts dropped their rankings and showed songs only in random order: what would happen to the number one?'), [T('더 좋은 곡이 1등을 할 것 같다', 'Better songs would come first'), T('지금과 별로 다르지 않을 것 같다', 'Not much would change'), T('1등이라는 게 의미가 없어질 것 같다', 'Being number one would stop meaning much')]),
 ('harmony', T('도와 솔이 함께 울릴 때 편안하게 들리는 이유는 무엇이 클까요?', 'When C and G sound together, what mostly makes it feel calm?'), [T('소리 속 배음이 서로 덜 부딪쳐서', 'The overtones in the sound clash less'), T('어릴 때부터 자주 들어 익숙해서', 'We have heard it often since childhood'), T('그 음악이 원래 좋은 곡이라서', 'The music is simply good')]),
 ('pollock', T('아이가 물감을 마구 뿌린 그림과 유명 화가의 추상화, 숫자 하나로 구별할 수 있을까?', "Could a single number tell a child's random paint splatter from a famous painter's abstract work?"), [T('숫자로 충분히 가릴 수 있다', 'Yes, a number can tell them apart'), T('숫자로는 어렵고 눈으로 봐야 한다', 'Hard by number, you have to look'), T('둘 다 잘 모르겠다', 'Not sure either way')]),
 ('ovation', T('공연이 끝나고 앞쪽 사람들이 하나둘 일어서기 시작하면, 나는?', 'The show ends and people in front start standing one by one. What do you do?'), [T('바로 따라 일어선다', 'Stand right away with them'), T('정말 좋았을 때만 일어선다', 'Stand only if I truly loved it'), T('앉은 채로 박수만 친다', 'Stay seated and just clap')]),
 ('halftone', T('모자이크처럼 뭉개진 사진 속 얼굴, 어떻게 보면 가장 잘 알아볼 것 같나요?', 'A face in a blocky, pixelated photo: how would you recognize it best?'), [T('바짝 다가가서 자세히 본다', 'Look up close, in detail'), T('몇 걸음 물러나서 본다', 'Step back a few paces'), T('눈을 가늘게 뜨고 흐리게 본다', 'Squint so it looks blurry')]),
 ('mereexposure', T('최애 노래를 오래 좋아하고 싶다면 나는?', 'If I want to keep loving my favorite song, I would…'), [T('질릴 때까지 매일 듣는다', 'Play it every day until I tire of it'), T('아껴 두고 가끔 듣는다', 'Save it and play it now and then'), T('질리면 새 노래로 갈아탄다', 'Switch to a new song once I tire of it')]),
 ('tariff', T('옆 가게가 먼저 나에게 불리한 일을 벌이면, 나는?', 'The shop next door makes the first move against you. What do you do?'), [T('똑같이 맞받아친다', 'Hit back the same way'), T('한 번은 참고 대화해 본다', 'Hold off once and try talking'), T('아무것도 안 하고 기다린다', 'Do nothing and wait')]),
 ('ventilation', T('방이 답답할 때 나는 주로?', 'When your room feels stuffy, what do you usually do?'), [T('창문 하나만 활짝 연다', 'Open one window wide'), T('맞은편 창이나 방문까지 같이 연다', 'Also open the window or door on the other side'), T('선풍기나 환풍기를 켠다', 'Turn on a fan or the vent')]),
 ('murmuration', T('사람 많은 길을 걸을 때 나는 주로?', 'When you walk down a crowded street, what do you usually do?'), [T('앞사람만 보고 따라간다', 'Follow the person in front'), T('주변 몇 사람의 흐름에 맞춘다', 'Match the flow of the few people around me'), T('내 길만 보고 간다', 'Just keep to my own path')]),
 ('depopulation', T('동네 병원이나 가게가 문을 닫으면 나는?', 'If the clinic or shop in your neighborhood closed, what would you do?'), [T('옆 동네까지 다니며 버틴다', 'Travel to the next town and stay put'), T('아예 큰 도시로 이사를 생각한다', 'Start thinking about moving to a big city'), T('별로 상관없다', 'It would hardly matter to me')]),
 ('filterbubble', T('SNS에서 나와 생각이 아주 다른 글이 보이면 나는 주로?', 'When a post with a view very different from yours shows up on social media, what do you usually do?'), [T('읽어 보고 한 번 생각해 본다', 'Read it and give it some thought'), T('그냥 넘긴다', 'Just scroll past'), T('괜히 더 반대로 생각하게 된다', 'End up feeling even more opposed')]),
]

TOPIC = {  # 다음 실험 주제 투표. 새 투표를 열 땐 id를 바꾼다.
 'id': 'topic-2026-10',
 'q': T('다음에 만들 실험을 골라 주세요', 'Pick the next experiment we build'),
 'o': [T('몬티 홀 문제: 문을 바꾸면 왜 더 유리할까', 'The Monty Hall problem: why is switching doors better?'),
       T('심슨의 역설: 병원마다 나은데 전체로는 왜 나쁠까', "Simpson's paradox: better in each hospital, but worse overall?"),
       T('전염병과 거리두기: 모두 조금씩 줄이면 어떻게 될까', 'Epidemics: what if everyone cuts back a little?'),
       T('도박사의 착각: 앞면이 다섯 번 나오면 다음은 뒷면일까', "The gambler's mistake: after five heads, is tails due?")],
}
UI = [
 T('🎯 내 직관, 맞을까?', '🎯 Is My Intuition Right?'),
 T('오늘의 질문은 하루에 하나, 날마다 바뀌어요.', 'One question a day, a new one every day.'),
 T('이 질문, 실험해 볼까요? →', 'Try this question as an experiment →'),
 T('지금까지 {#0}명이 투표했어요', '{0} people have voted so far'),
 T('투표해 주셔서 고마워요! 더 많이 모이면 결과가 보여요.', 'Thanks for voting! The results appear once more people join.'),
 T('이전 질문', 'Previous question'),
 T('다음 질문', 'Next question'),
 T('🗳 다음 실험 투표', '🗳 Vote for the next experiment'),
 T('📬 새 실험이 나오면 알려드릴게요', '📬 Get notified when a new experiment arrives'),
 T('이메일 주소', 'Email address'),
 T('새 실험 소식을 이메일로 받는 데 동의합니다', 'I agree to receive news of new experiments by email'),
 T('알림 신청', 'Notify me'),
 T('이메일은 새 실험 소식을 보내는 데에만 쓰고, 받고 싶지 않으면 메일에 회신해 주시면 바로 지워요.', 'Your email is used only to announce new experiments. Reply to any message to be removed right away.'),
 T('신청했어요! 새 실험이 나오면 알려드릴게요.', 'You are on the list! We will let you know about new experiments.'),
 T('이메일 주소를 확인해 주세요.', 'Please check your email address.'),
 T('동의에 체크해 주세요.', 'Please tick the box to agree.'),
 T('지금은 신청할 수 없어요. 잠시 뒤에 다시 해 주세요.', 'We cannot sign you up right now. Please try again in a moment.'),
 T('RSS로 받기', 'Get it by RSS'),
 T('유튜브 구독', 'Subscribe on YouTube'),
 T('▶ 이 실험을 영상으로 보기', '▶ Watch this experiment as a video'),
 T('영상 재생', 'Play the video'),
]
data = {'daily': [{'s': s, 'q': q[0], 'o': [o[0] for o in opts]} for s, q, opts in DAILY], 'topic': {'id': TOPIC['id'], 'q': TOPIC['q'][0], 'o': [o[0] for o in TOPIC['o']]}}
dyn = {}
for s, q, opts in DAILY:
    dyn[q[0]] = q[1]
    for o in opts: dyn[o[0]] = o[1]
dyn[TOPIC['q'][0]] = TOPIC['q'][1]
for o in TOPIC['o']: dyn[o[0]] = o[1]
for t in UI: dyn[t[0]] = t[1]
assert len(DAILY) == 62 and all(len(d[2]) == 3 for d in DAILY)
open(os.path.join(SITE, 'daily.js'), 'w', encoding='utf-8').write('// 오늘의 만약에 · 주제 투표 데이터 (tools/pages/daily.py 가 만든다)\nwindow.LAB_DAILY = ' + json.dumps(data, ensure_ascii=False) + ';\n')
open(os.path.join(HERE, 'dyn_daily.py'), 'w', encoding='utf-8').write('# tools/pages/daily.py 가 만든다 (직접 고치지 말 것)\nDYN = ' + json.dumps(dyn, ensure_ascii=False, indent=1) + '\n')
print(len(DAILY), '개 질문,', len(dyn), '개 문구')
