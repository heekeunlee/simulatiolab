"""메인 페이지(site/index.html) 생성기: 살아 있는 실험실 주기율표, 한국어 + 영어. 실험을 추가하면 CATS와 META에 한 줄씩 추가."""
import sys, os, re, html as H
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mk2 import T, esc, da, _shell, EXP

ROOT = os.path.join(EXP, '..')
# (id, 색, 아이콘, 분야 T, 설명 T, [(slug, 모델 T, 제목 T, 설명 T)])
CATS = [
 ('success', '#e0a100', '💰', T('성공과 불평등', 'Success &amp; Inequality'), T('운과 재능, 부와 인기는 왜 소수에게 쏠릴까?', 'Why do luck, talent, wealth and popularity pile up in a few hands?'), [
  ('talent-vs-luck', T('Talent vs Luck 모델', 'Talent vs Luck model'), T('성공은 재능일까, 운일까?', 'Is Success Talent or Luck?'), T('재능은 평균 근처에 모여 있는데 부는 왜 몇 사람에게 쏠릴까요. 최고 부자는 정말 최고 재능자일까?', 'Talent clusters around the average, so why does wealth pile up in a few hands? Is the richest person really the most talented?')),
  ('wealth', T('야드세일 교환 모델', 'Yard-sale exchange model'), T('부의 쏠림', 'Wealth Concentration'), T('모든 거래가 동전 던지기처럼 공정해도 부는 쏠릴까? 얼마나 나누면 막을 수 있을까?', 'Even if every trade is as fair as a coin flip, does wealth concentrate? How much sharing does it take to stop it?')),
  ('youtube', T('선호적 연결 모델', 'Preferential attachment model'), T('유튜브는 왜 상위 1%만 뜰까', 'Why Do Only the Top 1% of YouTubers Break Through?'), T('좋은 콘텐츠가 이길까, 먼저 뜬 채널이 이길까? 같은 채널로 시작한 평행우주를 비교해요.', 'Does good content win, or do channels that broke out first keep winning? Compare parallel universes that start with the same channels.')),
 ]),
 ('people', '#2f6fed', '🧑‍🤝‍🧑', T('사람 사이', 'People &amp; Relationships'), T('소문, 편견, 만남은 어떻게 퍼지고 갈라질까?', 'How do rumors, bias and encounters spread and split us apart?'), [
  ('schelling', T('셸링 분리 모델', 'Schelling segregation model'), T('끼리끼리 모이는 이유', 'Why Birds of a Feather Flock Together'), T('"소수가 되기 싫다" 정도의 약한 바람만으로도 동네가 완전히 갈라질까?', 'Can a mild wish like "I don\'t want to be a minority" split a neighborhood completely apart?')),
  ('rumor', T('소문 전파 모델 (SIR)', 'Rumor spreading model (SIR)'), T('단톡방 소문 확산', 'Rumor Spread in Group Chats'), T('소문은 얼마나 빨리, 누구를 거쳐 퍼질까? 정정 글은 언제까지 올려야 소용이 있을까?', 'How fast does a rumor spread, and through whom? How late can a correction come and still matter?')),
  ('dating', T('매칭·탐색 모델', 'Matching &amp; search model'), T('눈을 낮추면 짝을 찾을까', 'Does Lowering Your Standards Help You Find a Match?'), T('서로 동의해야 맺어지는 시장에서 눈높이가 짝 찾는 시간에 미치는 영향을 봐요.', 'See how aspiration level affects the time to find a partner in a market where both sides must agree.')),
 ]),
 ('work', '#7c5cff', '🏢', T('일터와 제도', 'Work &amp; Institutions'), T('조직과 규칙이 결과를 바꾸는 방식', 'How organizations and rules change outcomes'), [
  ('peter', T('피터의 원리 모델', 'Peter principle model'), T('무능한 상사는 왜 생길까', 'Why Do Incompetent Bosses Exist?'), T('일 잘하는 사람을 승진시키면 조직이 좋아질까? 승진 방식을 바꿔 비교해요.', 'Does promoting your best performers make an organization better? Compare promotion methods.')),
  ('voting', T('공간 투표 모델', 'Spatial voting model'), T('투표 방식이 달라지면 당선자가 바뀔까', 'Does the Voting Method Change the Winner?'), T('같은 표를 단순다수·결선·선호투표·보르다로 세면 당선자가 달라질 수 있을까요?', 'Count the same votes by plurality, runoff, ranked-choice and Borda. Can the winner change?')),
 ]),
 ('daily', '#1fa463', '🚦', T('일상의 선택과 질서', 'Everyday Choices &amp; Order'), T('길, 식당, 줄에서 우리가 매일 겪는 일', 'What we run into every day on the road, at restaurants and in lines'), [
  ('traffic', T('나겔-슈레켄베르크 모델', 'Nagel–Schreckenberg model'), T('유령 정체: 사고도 공사도 없는데 왜 막힐까', 'Phantom Traffic Jams: Why Does Traffic Stop Without an Accident?'), T('가끔 밟는 브레이크 하나가 도로 전체를 막는 과정을 지켜봐요.', 'Watch how a single occasional tap of the brake can block a whole road.')),
  ('bar', T('엘 파롤 바 문제', 'El Farol Bar problem'), T('다 같이 가는 식당은 왜 늘 붐빌까', 'Why Is the Popular Restaurant Always Packed?'), T('모두가 같은 생각을 하면 왜 모두 손해일까? 예측이 제각각이면 어떻게 될까?', 'Why does everyone lose when everyone thinks alike? And what if predictions differ?')),
  ('queue', T('공간 진화 게임', 'Spatial evolutionary game'), T('새치기가 늘면 줄은 어떻게 될까', 'What Happens When Queue-Jumping Spreads?'), T('질서는 가만히 지켜지지 않고 누군가 비용을 치르며 지켜진다는 걸 실험해요.', "Test the idea that order isn't kept by itself but by someone paying a price to keep it.")),
 ]),
 ('science', '#0ea5a5', '🔬', T('과학', 'Science'), T('자연이 스스로 질서와 무늬를 만드는 방식', 'How nature makes order and pattern by itself'), [
  ('firefly', T('펄스 결합 진동자', 'Pulse-coupled oscillators'), T('반딧불이는 왜 동시에 깜빡일까', 'Why Do Fireflies Flash in Unison?'), T('지휘자 없이도 수백 마리가 같은 박자로 빛나는 과정을 지켜봐요.', 'Watch hundreds of fireflies fall into the same rhythm with no conductor.')),
  ('turing', T('튜링 반응-확산 (Gray–Scott)', 'Turing reaction–diffusion (Gray–Scott)'), T('얼룩말 무늬는 어떻게 생길까', 'How Does a Zebra Get Its Stripes?'), T('두 물질의 단순한 반응만으로 점, 줄무늬, 미로 무늬가 저절로 생겨요. 직접 씨앗을 뿌려 보세요.', 'Two simple reacting chemicals can form spots, stripes and mazes by themselves. Drop your own seeds.')),
 ]),
 ('history', '#c2410c', '📜', T('역사', 'History'), T('작은 계기가 큰 흐름으로 번지는 순간', 'When a small spark turns into a big movement'), [
  ('revolution', T('문턱 모델 (Granovetter)', 'Threshold model (Granovetter)'), T('혁명은 어떻게 시작될까', 'How Does a Revolution Begin?'), T('사람마다 "몇 명이 나서면 나도 나선다"는 문턱이 다를 때, 한 사람의 차이가 광장 전체를 바꿀 수 있을까요?', 'When everyone has a different "I\'ll join if this many others do" threshold, can one person change the whole square?')),
  ('easter', T('자원-인구 과잉 모델', 'Resource–population overshoot model'), T('이스터섬은 왜 몰락했을까', 'Why Did Easter Island Collapse?'), T('숲과 사람이 함께 늘다가 한꺼번에 무너지는 과잉-붕괴의 곡선을 그려요. (실제 역사는 아직 논쟁 중이에요)', 'Forest and people grow together, then crash: trace the overshoot-and-collapse curve. (The real history is still debated.)')),
  ('alliance', T('동맹 네트워크 연쇄 모델', 'Alliance-network cascade model'), T('한 발의 총성이 세계대전이 되려면', 'How Does a Single Shot Become a World War?'), T('동맹이 촘촘해지면 작은 충돌이 어디까지 번질까요? 이름 없는 나라들로 해 보는 연쇄 실험이에요.', 'How far does a small clash spread as alliances get denser? A cascade experiment with anonymous states.')),
 ]),
 ('philosophy', '#be185d', '🧠', T('철학', 'Philosophy'), T('도덕과 신뢰는 어떻게 살아남을까', 'How do morality and trust survive?'), [
  ('cooperation', T('반복 죄수의 딜레마', "Iterated prisoner's dilemma"), T('착한 사람은 살아남을까', 'Do Nice People Survive?'), T('배신하는 사람이 많은 세상에서 협력과 신뢰는 어떻게 되살아날까? 실수가 끼어들면 어떻게 될까?', 'In a world full of defectors, how do cooperation and trust come back? What changes when mistakes creep in?')),
  ('veil', T('롤스·하사니 선택 모델', 'Rawls–Harsanyi choice model'), T('무지의 베일 뒤에서 어떤 사회를 고를까', 'Which Society Would You Choose Behind the Veil of Ignorance?'), T('내가 누구로 태어날지 모른다면 어떤 사회를 고를까요? 위험을 싫어하는 정도에 따라 선택이 뒤집혀요.', "If you didn't know who you'd be, which society would you pick? The choice flips with how much you dislike risk.")),
  ('commons', T('공유지 게임 (하딘 vs 오스트롬)', 'Commons game (Hardin vs Ostrom)'), T('공유지의 비극은 피할 수 없을까', 'Is the Tragedy of the Commons Inevitable?'), T('모두의 목초지는 반드시 망할까, 감시와 규칙이 지켜 줄까? 두 관점을 나란히 돌려 봐요.', 'Is a shared pasture doomed, or can monitoring and rules save it? Run both views side by side.')),
 ]),
 ('literature', '#a16207', '📖', T('문학', 'Literature'), T('우연과 선택이 글을 쓸 수 있을까', 'Can chance and selection write a text?'), [
  ('monkey', T('무한 원숭이 vs 누적 선택', 'Infinite monkeys vs cumulative selection'), T('원숭이가 햄릿을 쓸 수 있을까', 'Can Monkeys Write Hamlet?'), T('무작위로 타자를 치는 원숭이와, 조금씩 고르며 나아가는 진화를 나란히 비교해요.', 'Compare monkeys typing at random with evolution that keeps the best at every step.')),
  ('zipf', T('지프의 법칙 · 사이먼 모델', "Zipf's law · Simon model"), T('왜 소수의 단어만 자주 쓰일까', 'Why Are a Few Words Used Constantly?'), T('왜 어느 언어에서나 소수의 단어가 글의 대부분을 차지할까? 부익부 규칙으로 직접 글을 써 봐요.', 'Why do a few words make up most of any text? Generate one yourself with a rich-get-richer rule.')),
  ('telephone', T('전달 게임 (연쇄 재현)', 'Serial reproduction'), T('이야기는 전해지며 어떻게 변할까', "How Do Stories Change as They're Retold?"), T('입에서 입으로 전해지는 이야기에서 무엇이 살아남을까요? 기억에 남는 것만 남는 과정을 지켜봐요.', 'What survives as a story passes mouth to mouth? Watch only the memorable parts remain.')),
 ]),
 ('art', '#9333ea', '🎨', T('예술', 'Art'), T('취향과 화풍은 어떻게 변하고 사라질까', 'How do taste and style change and disappear?'), [
  ('fashion', T('모방과 차별화 모델', 'Imitation–distinction model'), T('유행은 왜 돌고 돌까', 'Why Do Fashions Come Around?'), T('따라 하는 대중과 도망가는 선두가 만드는 색의 순환을 색상환 위에서 봐요.', 'On a color wheel, watch the cycle created by a copying crowd and trendsetters running away.')),
  ('painters', T('문화 전파 모델', 'Cultural transmission model'), T('AI 화가 100명이 서로 따라 그리면', 'What If 100 AI Painters Copy Each Other?'), T('모방이 늘수록 화풍은 하나로 수렴할까? 100점의 그림이 어떻게 달라지는지 지켜봐요.', 'Does imitation collapse styles into one? Watch 100 paintings change.')),
  ('sunflower', T('황금각 잎차례 모델', 'Golden-angle phyllotaxis'), T('해바라기 씨는 왜 그 각도로 배열될까', 'Why Do Sunflower Seeds Sit at That Angle?'), T('씨앗을 137.5°씩 돌려 놓으면 틈 없이 빽빽해져요. 각도를 조금만 바꿔도 무늬가 무너지는 걸 보세요.', 'Turn each seed by 137.5° and they pack with no gaps. Nudge the angle and watch the pattern fall apart.')),
  ('auction', T('승자의 저주 모델', "Winner's curse model"), T('경매에서 이기면 왜 손해일까', 'Why Does Winning an Auction Cost You?'), T('가장 높게 쓴 사람이 이기는데, 왜 이긴 사람이 평균적으로 손해일까요? 얼마나 깎아 써야 본전일까요?', 'The highest bidder wins, so why does the winner lose on average? How much should you shade your bid to break even?')),
 ]),
 ('paradox', '#4d7c0f', '🔄', T('뒤집어 보기', 'Flip the View'), T('"이렇게도 해석할 수 있구나" 싶은 직관의 반전', 'Counterintuitive twists that make you say "oh, so that\'s how to read it"'), [
  ('braess', T('브라에스 네트워크 모델', 'Braess network model'), T('새 길을 뚫었더니 모두가 느려졌다', 'A New Road Made Everyone Slower'), T('지름길을 열었더니 모두의 출근 시간이 늘어난다? 운전자들이 스스로 길을 고르게 두고 확인해요.', 'Open a shortcut and everyone\'s commute gets longer? Let drivers pick their own routes and see.')),
  ('regression', T('평균으로의 회귀 모델', 'Regression-to-the-mean model'), T('칭찬했더니 못하고, 혼냈더니 잘하더라', 'Praise Was Followed by Worse, Scolding by Better'), T('말에 아무 효과가 없어도 혼낸 뒤엔 좋아지고 칭찬한 뒤엔 나빠져 보여요. 코치는 무엇을 배우게 될까요?', 'Even if words do nothing, scolding seems to work and praise seems to backfire. What does the coach learn?')),
  ('survivor', T('생존자 편향 모델', 'Survivorship-bias model'), T('돌아온 비행기의 총탄 자국, 어디를 보강할까', 'Bullet Holes on Returning Planes: Where Does the Armor Go?'), T('구멍이 없는 곳이 진짜 약점일 수 있어요. 돌아오지 못한 비행기를 함께 놓고 비교해요.', 'The places with no holes may be the real weak spots. Add the planes that never came back.')),
  ('friendship', T('관계망 성장 모델', 'Growing social network model'), T('내 친구들은 왜 나보다 친구가 많을까', 'Why Do My Friends Have More Friends Than I Do?'), T('인기 있는 사람은 많은 친구 목록에 등장해요. 사람을 눌러 확인해 보세요.', 'Popular people appear on many friend lists. Click a person to check.')),
  ('inspection', T('검사 역설 모델', 'Inspection-paradox model'), T('버스는 왜 늘 더 오래 기다릴까', 'Why Does the Bus Always Make You Wait Longer?'), T('평균 10분마다 오는 버스를 기다리면 평균 몇 분을 기다릴까요? 내 반이 늘 붐비는 이유도 같아요.', 'If a bus comes every 10 minutes on average, how long do you wait on average? The same reason makes your class feel crowded.')),
  ('coincidence', T('생일 문제 모델', 'Birthday-problem model'), T('우연의 일치는 우연이 아니다?', 'Is a Coincidence Not a Coincidence?'), T('23명이면 생일이 겹칠 확률이 50%. 그런데 "나와 겹칠" 확률은 얼마나 다를까요?', 'With 23 people the chance of a shared birthday is 50%. How different is a match with me?')),
 ]),
 ('society', '#475569', '🏙️', T('사회 현안', 'Society Today'), T('수치로 따져 보는 우리 사회의 큰 흐름', 'Big trends in society, worked through with numbers'), [
  ('population', T('코호트 인구 모델', 'Cohort-component model'), T('저출산이 계속되면 2070년 인구 구조는?', "What Does Korea's Population Look Like in 2070?"), T('출산율이 이대로면 인구 피라미드는 어떻게 바뀔까? 출산율과 이민을 바꿔 보세요.', 'If fertility stays as it is, how does the population pyramid change? Try other fertility and migration levels.')),
  ('apartment', T('공간 확산 모델', 'Spatial contagion model'), T('아파트 가격은 어떻게 번질까', 'How Do Apartment Prices Spread?'), T('한 동네의 상승이 이웃으로 번지는 과정과, 대출 규제·금리가 미치는 영향을 장난감 모델로 봐요.', 'See, in a toy model, how a rise in one neighborhood spreads to the next, and what lending limits and interest rates do.')),
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

# slug -> (기호, 짧은 이름 T, 미니 애니메이션 종류)
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
    cols = ''; n = 0; exps = []
    for (k, col, ic, t, d), items in cats:
        tiles = ''
        for slug, method, title, desc in items:
            n += 1
            sym, short, kind = META[slug]
            exps.append({'s': slug, 'n': '%02d' % n, 'c': col, 'sym': sym, 'ko': title[0], 'en': re.sub('<[^>]+>', '', H.unescape(title[1]))})
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
    hint = T('점들을 만져 보세요. 마우스를 피하고, 클릭하면 "만약에!" 하고 흩어졌다가 다시 모입니다.', 'Play with the dots. They dodge your cursor, and a click asks "what if?": they scatter, then sort themselves out again.')
    h_tab = T('실험 주기율표', 'The Periodic Table of Experiments')
    p_tab = T(f'{total}개의 실험을 {len(cats)}개 분야(열)로 묶었어요. 칸 위에 마우스를 올리면 아래 실험 노트에 내용이 나타납니다.', f'{total} experiments in {len(cats)} fields (columns). Hover a cell and its page opens in the lab notebook below.')
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
    <div class="cta"><a class="btn big" href="#table"{da(cta1)}>{cta1[0]}</a><button type="button" class="btn ghost" id="rand"{da(cta2)}>{cta2[0]}</button></div>
    <p class="hint"{da(hint)}>{hint[0]}</p>
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
<script src="home.js"></script>
<script src="counter.js"></script>
</body>
</html>
"""
    open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8').write(out)
    # 실험 페이지의 이전/다음 이동에 쓰는 목록
    import json
    open(os.path.join(ROOT, 'exps.js'), 'w', encoding='utf-8').write('// 실험 목록 (tools/pages/index.py 가 만든다)\nwindow.LAB_EXPS = ' + json.dumps(exps, ensure_ascii=False) + ';\n')
    return total, len(cats)

if __name__ == '__main__':
    print(build(only_existing=('--all' not in sys.argv)))
