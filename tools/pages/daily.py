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
 ('talent-vs-luck', T('성공의 몇 %가 운 덕분이라고 생각하세요?', 'What share of success do you think is down to luck?'), [T('20% 이하', '20% or less'), T('약 50%', 'About 50%'), T('80% 이상', '80% or more')]),
 ('wealth', T('모두가 똑같이 시작해 공정하게 거래하면, 부는 고르게 남을까요?', 'If everyone starts equal and trades fairly, will wealth stay evenly spread?'), [T('고르게 남는다', 'It stays even'), T('조금 쏠린다', 'It tilts a little'), T('크게 쏠린다', 'It piles up in a few hands')]),
 ('youtube', T('좋은 콘텐츠를 만들면 결국 뜰까요?', 'If you make great content, will it eventually take off?'), [T('거의 뜬다', 'Almost always'), T('반반이다', 'About half the time'), T('운이 더 크다', 'Luck matters more')]),
 ('schelling', T('이웃의 몇 %가 나와 비슷해야 편안할까요?', 'How many of your neighbors need to be like you for you to feel comfortable?'), [T('전부', 'All of them'), T('절반 이상', 'More than half'), T('3분의 1쯤', 'About a third')]),
 ('rumor', T('단톡방에 퍼진 소문을 정정하면 효과가 있을까요?', 'Does correcting a rumor in a group chat help?'), [T('거의 없다', 'Hardly at all'), T('절반쯤 막는다', 'It stops about half'), T('대부분 막는다', 'It stops most of it')]),
 ('dating', T('눈높이를 낮추면 짝을 더 빨리 찾을까요?', 'If you lower your standards, will you find a match sooner?'), [T('더 빨리', 'Sooner'), T('비슷하다', 'About the same'), T('오히려 늦다', 'Actually later')]),
 ('peter', T('일을 가장 잘하는 사람을 승진시키면 조직은 좋아질까요?', 'If you promote your best performer, does the organization get better?'), [T('좋아진다', 'It gets better'), T('상관없다', 'It makes no difference'), T('나빠질 수 있다', 'It can get worse')]),
 ('voting', T('같은 표라도 개표 방식이 다르면 당선자가 바뀔 수 있을까요?', 'With the very same ballots, can a different counting method change the winner?'), [T('절대 아니다', 'Never'), T('가끔 바뀐다', 'Sometimes'), T('자주 바뀐다', 'Often')]),
 ('traffic', T('고속도로 정체는 대부분 사고나 공사 때문일까요?', 'Are most highway jams caused by accidents or roadwork?'), [T('대부분 그렇다', 'Mostly, yes'), T('절반쯤', 'About half'), T('아니다, 운전 습관만으로도 생긴다', 'No, driving habits alone can cause them')]),
 ('bar', T('모두가 인기 식당에 가면 모두에게 좋을까요?', 'If everyone goes to the popular restaurant, is that good for everyone?'), [T('좋다', 'Yes'), T('그저 그렇다', 'So-so'), T('오히려 모두 손해', 'Everyone loses')]),
 ('queue', T('새치기하는 사람이 늘면 줄의 질서는 어떻게 될까요?', 'When more people cut in line, what happens to the order of the line?'), [T('금방 무너진다', 'It collapses quickly'), T('조금 흔들린다', 'It wobbles a bit'), T('그래도 유지된다', 'It holds anyway')]),
 ('firefly', T('지휘자 없이도 반딧불이가 같은 박자로 반짝일 수 있을까요?', 'Can fireflies flash in time without a conductor?'), [T('불가능하다', 'Impossible'), T('가끔 가능하다', 'Sometimes'), T('대부분 가능하다', 'Usually')]),
 ('turing', T('얼룩말 무늬는 유전자가 무늬 지도를 그려 둔 결과일까요?', 'Is a zebra\'s pattern drawn from a map written in its genes?'), [T('그렇다', 'Yes'), T('일부만', 'Only partly'), T('간단한 화학 반응만으로도 생긴다', 'Simple chemistry alone can produce it')]),
 ('revolution', T('한 사람의 마음이 바뀌면 광장 전체가 달라질 수 있을까요?', 'Can one person changing their mind change a whole crowd?'), [T('불가능하다', 'Impossible'), T('가끔', 'Sometimes'), T('충분히 가능하다', 'Quite possible')]),
 ('easter', T('한 사회가 스스로 숲을 다 베어 낼 수 있을까요?', 'Can a society cut down its own forest entirely?'), [T('불가능하다', 'Impossible'), T('가끔', 'Sometimes'), T('충분히 가능하다', 'Quite possible')]),
 ('alliance', T('동맹이 많을수록 전쟁은 줄어들까요?', 'The more alliances there are, the fewer wars?'), [T('줄어든다', 'Yes, fewer'), T('상관없다', 'No difference'), T('오히려 더 번질 수 있다', 'A war may spread further')]),
 ('cooperation', T('남을 믿는 착한 사람은 결국 손해를 볼까요?', 'Do trusting, nice people end up losing out?'), [T('손해 본다', 'They lose out'), T('반반이다', 'It depends'), T('결국 살아남는다', 'They survive in the end')]),
 ('veil', T('내가 누구로 태어날지 모른다면 어떤 사회를 고르시겠어요?', 'If you did not know who you would be born as, which society would you choose?'), [T('모두 똑같은 사회', 'A perfectly equal society'), T('안전망이 있는 사회', 'A society with a safety net'), T('승자독식 사회', 'A winner-take-all society')]),
 ('commons', T('모두의 목초지는 반드시 망할까요?', 'Is a shared pasture doomed to be ruined?'), [T('반드시 망한다', 'Always'), T('규칙이 있으면 지켜진다', 'Rules can save it'), T('상황에 따라 다르다', 'It depends')]),
 ('monkey', T('원숭이가 무작위로 타자를 치면 햄릿 한 줄이라도 쓸 수 있을까요?', 'If a monkey types at random, can it write even one line of Hamlet?'), [T('불가능하다', 'No chance'), T('아주 짧은 줄만', 'Only a very short line'), T('충분히 쓸 수 있다', 'Easily')]),
 ('zipf', T('어느 언어든 소수의 단어가 글의 대부분을 차지할까요?', 'In any language, do a few words make up most of a text?'), [T('아니다', 'No'), T('조금', 'A little'), T('그렇다', 'Yes')]),
 ('telephone', T('이야기를 40번 전하면 원래 내용이 얼마나 남을까요?', 'After a story is retold 40 times, how much of the original is left?'), [T('거의 그대로', 'Almost all of it'), T('절반쯤', 'About half'), T('4분의 1쯤', 'About a quarter')]),
 ('fashion', T('유행은 따라 하는 사람 때문에 돌까요, 앞서가는 사람 때문에 돌까요?', 'Do fashions cycle because of the followers or because of the trendsetters?'), [T('따라 하는 사람', 'The followers'), T('앞서가는 사람', 'The trendsetters'), T('둘 다', 'Both')]),
 ('painters', T('서로 따라 그리면 화풍은 하나로 모일까요?', 'If artists keep copying each other, will styles converge into one?'), [T('그렇다', 'Yes'), T('아니다', 'No'), T('조건에 따라 다르다', 'It depends')]),
 ('sunflower', T('해바라기 씨앗의 배열 각도를 조금만 바꿔도 모양이 확 달라질까요?', 'If you nudge the angle of the sunflower seeds slightly, does the pattern change a lot?'), [T('아니다', 'No'), T('조금', 'A little'), T('확 달라진다', 'Dramatically')]),
 ('auction', T('경매에서 가장 높은 값을 부른 사람이 오히려 손해를 볼 수 있을까요?', 'Can the highest bidder in an auction actually end up losing?'), [T('불가능하다', 'Impossible'), T('가끔 그렇다', 'Sometimes'), T('자주 그렇다', 'Often')]),
 ('population', T('출산율이 이대로라면 2070년 65세 이상 인구 비중은 어느 정도일까요?', 'If the birth rate stays this low, what share of people will be 65 or older in 2070?'), [T('30% 안팎', 'Around 30%'), T('40% 안팎', 'Around 40%'), T('50% 이상', '50% or more')]),
 ('apartment', T('이웃 동네 집값이 오르면 우리 동네도 따라 오를까요?', 'If prices rise in the next neighborhood, will yours follow?'), [T('상관없다', 'No connection'), T('조금 따라 오른다', 'A little'), T('크게 따라 오른다', 'A lot')]),
 ('braess', T('길이 막히면 새 도로를 내는 것이 정답일까요?', 'When roads are jammed, is building a new road the answer?'), [T('그렇다', 'Yes'), T('상황에 따라 다르다', 'It depends'), T('오히려 더 막힐 수 있다', 'It can make things worse')]),
 ('regression', T('칭찬이 효과가 없다고 느낀 적이 있나요?', 'Have you ever felt that praise did not work?'), [T('있다', 'Yes'), T('없다', 'No'), T('잘 모르겠다', 'Not sure')]),
 ('survivor', T('성공한 사람들의 공통점은 곧 성공의 비결일까요?', 'Is what successful people have in common the secret of their success?'), [T('그렇다', 'Yes'), T('일부만', 'Only partly'), T('실패한 사람도 갖고 있을 수 있다', 'Failures may share it too')]),
 ('friendship', T('내 친구들은 대체로 나보다 친구가 많은 것 같나요?', 'Do your friends seem to have more friends than you?'), [T('그렇다', 'Yes'), T('비슷하다', 'About the same'), T('아니다', 'No')]),
 ('inspection', T('버스는 왜 내가 기다릴 때만 늦게 오는 것 같을까요?', 'Why does the bus only seem to be late when you are the one waiting?'), [T('내 운이 나빠서', 'Just bad luck'), T('원래 그런 것', 'It really works that way'), T('착각이다', 'It is my imagination')]),
 ('coincidence', T('"어떻게 이런 우연이!" 싶은 일은 드문 일일까요?', 'Are "what a coincidence!" moments actually rare?'), [T('아주 드물다', 'Very rare'), T('가끔 있다', 'Now and then'), T('생각보다 자주 생긴다', 'More common than you think')]),
]
TOPIC = {  # 다음 실험 주제 투표. 새 투표를 열 땐 id를 바꾼다.
 'id': 'topic-2026-10',
 'q': T('다음에 만들 실험을 골라 주세요', 'Pick the next experiment we build'),
 'o': [T('몬티 홀 문제: 문을 바꾸면 왜 유리할까', 'The Monty Hall problem: why does switching doors win more often?'),
       T('심슨의 역설: 병원마다 더 나은데 전체로는 왜 더 나쁠까', "Simpson's paradox: better in every hospital, yet worse overall?"),
       T('전염병과 거리두기: 모두가 조금씩 줄이면 어떻게 될까', 'Epidemics and distancing: what if everyone cuts back a little?'),
       T('도박사의 오류: 앞면이 다섯 번 나오면 다음은 뒷면일까', "The gambler's fallacy: after five heads in a row, is tails due?")],
}
UI = [
 T('🌤 오늘의 만약에', '🌤 Today\'s What If'),
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
assert len(DAILY) == 34 and all(len(d[2]) == 3 for d in DAILY)
open(os.path.join(SITE, 'daily.js'), 'w', encoding='utf-8').write('// 오늘의 만약에 · 주제 투표 데이터 (tools/pages/daily.py 가 만든다)\nwindow.LAB_DAILY = ' + json.dumps(data, ensure_ascii=False) + ';\n')
open(os.path.join(HERE, 'dyn_daily.py'), 'w', encoding='utf-8').write('# tools/pages/daily.py 가 만든다 (직접 고치지 말 것)\nDYN = ' + json.dumps(dyn, ensure_ascii=False, indent=1) + '\n')
print(len(DAILY), '개 질문,', len(dyn), '개 문구')
