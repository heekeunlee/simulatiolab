"""메인 페이지(site/index.html) 생성기: 분야별 카드, 한국어 + 영어. 실험을 추가하면 CATS에 한 줄 추가."""
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
 ]),
 ('philosophy', '#be185d', '🧠', T('철학', 'Philosophy'), T('도덕과 신뢰는 어떻게 살아남을까', 'How do morality and trust survive?'), [
  ('cooperation', T('반복 죄수의 딜레마', "Iterated prisoner's dilemma"), T('착한 사람은 살아남을까', 'Do Nice People Survive?'), T('배신하는 사람이 많은 세상에서 협력과 신뢰는 어떻게 되살아날까? 실수가 끼어들면 어떻게 될까?', 'In a world full of defectors, how do cooperation and trust come back? What changes when mistakes creep in?')),
 ]),
 ('literature', '#a16207', '📖', T('문학', 'Literature'), T('우연과 선택이 글을 쓸 수 있을까', 'Can chance and selection write a text?'), [
  ('monkey', T('무한 원숭이 vs 누적 선택', 'Infinite monkeys vs cumulative selection'), T('원숭이가 햄릿을 쓸 수 있을까', 'Can Monkeys Write Hamlet?'), T('무작위로 타자를 치는 원숭이와, 조금씩 고르며 나아가는 진화를 나란히 비교해요.', 'Compare monkeys typing at random with evolution that keeps the best at every step.')),
 ]),
 ('art', '#9333ea', '🎨', T('예술', 'Art'), T('취향과 화풍은 어떻게 변하고 사라질까', 'How do taste and style change and disappear?'), [
  ('fashion', T('모방과 차별화 모델', 'Imitation–distinction model'), T('유행은 왜 돌고 돌까', 'Why Do Fashions Come Around?'), T('따라 하는 대중과 도망가는 선두가 만드는 색의 순환을 색상환 위에서 봐요.', 'On a color wheel, watch the cycle created by a copying crowd and trendsetters running away.')),
  ('painters', T('문화 전파 모델', 'Cultural transmission model'), T('AI 화가 100명이 서로 따라 그리면', 'What If 100 AI Painters Copy Each Other?'), T('모방이 늘수록 화풍은 하나로 수렴할까? 100점의 그림이 어떻게 달라지는지 지켜봐요.', 'Does imitation collapse styles into one? Watch 100 paintings change.')),
 ]),
 ('society', '#475569', '🏙️', T('사회 현안', 'Society Today'), T('수치로 따져 보는 우리 사회의 큰 흐름', 'Big trends in society, worked through with numbers'), [
  ('population', T('코호트 인구 모델', 'Cohort-component model'), T('저출산이 계속되면 2070년 인구 구조는?', "What Does Korea's Population Look Like in 2070?"), T('출산율이 이대로면 인구 피라미드는 어떻게 바뀔까? 출산율과 이민을 바꿔 보세요.', 'If fertility stays as it is, how does the population pyramid change? Try other fertility and migration levels.')),
  ('apartment', T('공간 확산 모델', 'Spatial contagion model'), T('아파트 가격은 어떻게 번질까', 'How Do Apartment Prices Spread?'), T('한 동네의 상승이 이웃으로 번지는 과정과, 대출 규제·금리가 미치는 영향을 장난감 모델로 봐요.', 'See, in a toy model, how a rise in one neighborhood spreads to the next, and what lending limits and interest rates do.')),
 ]),
]

def build(only_existing=True):
    nav, foot = _shell()
    nav = nav.replace('<a class="link" href="../../">', '<a class="link" href="./">').replace('href="../../logo.svg"', 'href="logo.svg"').replace('src="../../logo.svg"', 'src="logo.svg"').replace('href="../../"', 'href="./"')
    nav = re.sub(r'<a class="link" href="\./"[^>]*>.*?</a>', '', nav, flags=re.S)  # 메인에서는 '실험 목록' 링크 생략
    cats = []
    for c in CATS:
        items = [it for it in c[5] if not only_existing or os.path.exists(EXP + it[0] + '/index.html')]
        if items: cats.append((c[:5], items))
    total = sum(len(i) for _, i in cats)
    chips = ''.join(f'<a class="catchip" href="#{k}" style="--c:{col}"{da(T("", "<span>%s</span>%s<em>%d</em>" % (ic, t[1], len(items))))}><span>{ic}</span>{t[0]}<em>{len(items)}</em></a>' for (k, col, ic, t, d), items in cats)
    secs = ''; n = 0
    for (k, col, ic, t, d), items in cats:
        cards = ''
        for slug, method, title, desc in items:
            n += 1
            go = T('직접 돌려보기 <i>→</i>', 'Try it yourself <i>→</i>')
            cards += f'''
      <a class="xcard" href="experiments/{slug}/">
        <div class="xtop"><span class="xnum">{n:02d}</span><span class="xchip"{da(method)}>{method[0]}</span></div>
        <h3{da(title)}>{title[0]}</h3>
        <p{da(desc)}>{desc[0]}</p>
        <span class="xgo"{da(go)}>{go[0]}</span>
      </a>'''
        cnt = T(f'{len(items)}개', f'{len(items)} experiments')
        secs += f'''
  <section class="cat" id="{k}" style="--c:{col}">
    <div class="cathead"><span class="caticon">{ic}</span><div><h2{da(t)}>{t[0]}</h2><p{da(d)}>{d[0]}</p></div><span class="catcount"{da(cnt)}>{cnt[0]}</span></div>
    <div class="xgrid">{cards}
    </div>
  </section>
'''
    hero_title = T('만약에를 실험하는 곳', 'A Lab for Testing "What If?"')
    lead = T("성공은 운일까? 소문은 어떻게 퍼질까? 사람과 사회에 대한 '만약에'를 AI로 설계한 시뮬레이션으로 실험하고, 변수를 바꿔 직접 돌려볼 수 있게 공개합니다.",
             'Is success luck? How do rumors spread? We test "what if" questions about people and society with AI-designed simulations, and publish them so you can change the variables and run them yourself.')
    s1 = T(f'<b>{total}</b>개 실험 공개', f'<b>{total}</b> experiments published'); s2 = T(f'<b>{len(cats)}</b>개 분야', f'<b>{len(cats)}</b> fields')
    s3 = T('설치 없이 <b>브라우저에서 바로</b> 실행', 'Runs <b>right in your browser</b>, no install')
    desc = T("사람과 사회에 대한 '만약에'를 AI 시뮬레이션으로 실험합니다. 변수를 바꿔 직접 돌려보세요.", 'We test "what if" questions about people and society with AI-designed simulations. Change the variables and run them yourself.')
    out = f'''<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title data-en="Simulatio Lab">시뮬라티오 랩</title>
<meta name="description" content="{esc(desc[0])}" data-en-content="{esc(desc[1])}">
<link rel="icon" type="image/svg+xml" href="favicon.svg">
<link rel="stylesheet" href="style.css">
</head>
<body>
{nav}

<main class="wrap">
  <section class="hero">
    <h1{da(hero_title)}>{hero_title[0]}</h1>
    <p class="lead"{da(lead)}>{lead[0]}</p>
    <div class="herostats"><span{da(s1)}>{s1[0]}</span><span{da(s2)}>{s2[0]}</span><span{da(s3)}>{s3[0]}</span></div>
    <nav class="catnav" aria-label="categories">{chips}</nav>
  </section>
{secs}
</main>

{foot}
<script src="i18n.js"></script>
<script src="i18n-en.js"></script>
<script src="counter.js"></script>
</body>
</html>
'''
    open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8').write(out)
    return total, len(cats)

if __name__ == '__main__':
    print(build(only_existing=('--all' not in sys.argv)))
