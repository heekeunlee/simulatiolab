import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mk2 import *

def _opt(v, t, sel=False): return f'<option value="{v}"{" selected" if sel else ""}{da(t)}>{t[0]}</option>'
# 3D 섹션: 첫 섹션(①) 바로 아래에 전체 너비로 넣기 위해 ①의 extra에서 섹션을 닫고 새로 연다
_T3 = T('② 3D로 보기: 볼록한 꽃판과 솔방울 <span class="badge3d">3D</span>', '② See It in 3D: a Domed Seed Head and a Pinecone <span class="badge3d">3D</span>')
_P3 = T('위에서 고른 각도로 씨앗을 볼록한 꽃판 위에 올렸습니다. 돌려 보면 시계 방향과 반시계 방향의 나선이 겹쳐 보이고, 색 칠하기를 34나 55로 바꾸면 한 방향의 나선 팔이 한 색으로 묶입니다. 각도를 120°나 144°로 바꾸면 씨앗이 바큇살로 몰리고 그 사이로 짙은 꽃판이 드러납니다. 솔방울도 같은 규칙(비늘 하나마다 같은 각도만큼 돌기)으로 비늘을 쌓은 것이며, 이때는 나선이 8개, 13개로 보입니다.',
        'Seeds are placed on a domed head using the angle chosen above. Rotate it and you will see clockwise and counterclockwise spirals crossing; color by 34 or 55 and the arms of one direction group into single colors. Change the angle to 120° or 144° and the seeds crowd into spokes, exposing the dark head between them. A pinecone stacks its scales by the same rule (turn the same angle for each scale), and there the spirals show up as 8 and 13.')
_H3 = T('드래그로 회전 · 휠(두 손가락)로 확대 · 꽃판은 위 그림과 함께 자랍니다', 'Drag to rotate · scroll (or pinch) to zoom · the head grows along with the picture above')
_COLS = _opt('same', T('색 칠하기: 위 설정과 같게', 'Color: same as above'), True) + _opt('index', T('색 칠하기: 번호 순서', 'Color: seed order')) + \
        ''.join(_opt(str(f), T(f'색 칠하기: {f}로 나눈 나머지', f'Color: remainder mod {f}')) for f in (8, 13, 21, 34, 55))
SEC3D = f'''
  </section>
  <section class="panel chart" style="margin-top:16px">
    <style>@media (max-width: 640px) {{ #c-3d {{ aspect-ratio: 1 / 1; }} }}</style>
    <h3{da(_T3)}>{_T3[0]}</h3>
    <p{da(_P3)}>{_P3[0]}</p>
    <canvas id="c-3d" class="view3d" data-thumb aria-label="{esc(_T3[1].split(' <')[0])}"></canvas>
    <div class="anim-bar">
      <select id="shape3d" aria-label="shape">{_opt('flower', T('해바라기 꽃판', 'Sunflower head'), True)}{_opt('cone', T('솔방울', 'Pinecone'))}</select>
      <select id="col3d" aria-label="color">{_COLS}</select>
      <button id="grow3d"{da(T('▶ 처음부터 자라기', '▶ Grow from the start'))}>▶ 처음부터 자라기</button>
      <span class="when" id="info3d"></span>
    </div>
    <p class="hint3d"{da(_H3)}>{_H3[0]}</p>'''

page(dict(
 three=True,
 slug='sunflower',
 title=T('해바라기 씨는 왜 하필 그 각도로 놓일까', 'Why Do Sunflower Seeds Sit at That Exact Angle?'),
 title_tag=T('해바라기 씨는 왜 하필 그 각도로 놓일까 · 시뮬라티오 랩', 'Why Do Sunflower Seeds Sit at That Exact Angle? · Simulatio Lab'),
 desc=T('씨앗을 한 알씩 놓을 때 돌리는 각도를 바꿔 가며, 어떤 각도가 빈틈없이 고르게 채우는지 직접 확인해 보세요.',
        'Change the turning angle as seeds are placed one by one, and see which angle fills the disc evenly with no gaps.'),
 lead=T('해바라기 씨앗은 왜 하필 약 137.5도씩 돌아가며 자랄까요? 씨앗을 한 알씩 놓을 때 돌리는 각도를 바꿔 가며, 어떤 각도가 빈틈없이 고르게 채우는지 확인해 봅니다.',
        'Why does each sunflower seed sit about 137.5 degrees around from the one before? Change the angle you turn as each seed is placed, and check which angle fills the disc evenly without gaps.'),
 model=[T('k번째 씨앗은 중심에서 √k만큼 떨어지고, 앞 씨앗보다 정해진 각도만큼 더 돌아간 자리에 놓입니다. 이 배열을 Vogel의 나선이라고 부르며, 식물의 잎과 씨앗이 놓이는 방식(잎차례, phyllotaxis)을 설명하는 대표적인 모델입니다.',
          'The k-th seed sits √k away from the center, turned a fixed angle further than the previous seed. This arrangement is called Vogel\'s spiral, a classic model of phyllotaxis (the way leaves and seeds are arranged on a plant).'),
        T('각도가 360°의 간단한 분수(90°는 1/4, 120°는 1/3, 144°는 2/5)에 가까우면 씨앗이 같은 방향으로 겹쳐 쌓여서 바큇살 모양과 큰 빈틈이 생깁니다.',
          'When the angle is close to a simple fraction of 360° (90° is 1/4, 120° is 1/3, 144° is 2/5), seeds pile up along the same directions, leaving spokes and large gaps.'),
        T('<b>황금각</b>(약 137.508°)은 360°를 황금비(자연에서 자주 보이는 약 1:1.618의 비율)로 나눈 각도로, 간단한 분수에서 가장 멀리 떨어진 각도로 알려져 있습니다.',
          'The <b>golden angle</b> (about 137.508°) divides 360° in the golden ratio (the roughly 1:1.618 proportion often seen in nature), and is known as the angle farthest from any simple fraction.'),
        T('채움 품질은 원판 위의 여러 점에서 가장 가까운 씨앗까지 거리를 재서, 평균(빈틈 평균)과 최댓값(가장 큰 빈틈)을 이상 간격으로 나눈 값입니다. 작을수록 고르게 채워진 것입니다. "색 보기"에서 번호를 34 같은 수로 나눈 나머지로 칠하면 나선 팔을 볼 수 있어요.',
          'Packing quality is measured by taking many points on the disc and finding the distance to the nearest seed; the mean (average gap) and the maximum (largest gap) are divided by the ideal spacing. Smaller means more evenly filled. In "Color by", coloring by the remainder after dividing the seed number by something like 34 reveals the spiral arms.')],
 sliders=[('angle', T('씨앗 사이의 각도', 'Angle between seeds'), 90, 180, 0.001, 137.508, T('황금각은 약 137.508°입니다. 조금만 움직여 보세요', 'The golden angle is about 137.508°. Try moving it just a little')),
          ('n', T('씨앗 수', 'Number of seeds'), 100, 2000, 50, 600, T('많을수록 무늬가 선명해져요', 'More seeds make the pattern clearer')),
          ('size', T('씨앗 크기', 'Seed size'), 30, 100, 5, 80, T('100%면 이상 간격만큼 커서 서로 맞닿아요', 'At 100% a seed is as wide as the ideal spacing, so they touch'))],
 selects=[('preset', T('각도 프리셋', 'Angle preset'), [('custom', T('직접 조절', 'Custom')), ('golden', T('황금각 137.508°', 'Golden angle 137.508°')), ('a137', T('137°', '137°')), ('a138', T('138°', '138°')), ('a120', T('120° (1/3)', '120° (1/3)')), ('a144', T('144° (2/5)', '144° (2/5)')), ('a90', T('90° (1/4)', '90° (1/4)')), ('a150', T('150°', '150°'))], 'golden', T('고르면 각도 슬라이더가 맞춰져요', 'Choosing one sets the angle slider')),
          ('color', T('색 보기', 'Color by'), [('index', T('번호 순서 (안쪽→바깥)', 'Seed order (inside → outside)')), ('21', T('21로 나눈 나머지', 'Remainder mod 21')), ('34', T('34로 나눈 나머지', 'Remainder mod 34')), ('55', T('55로 나눈 나머지', 'Remainder mod 55'))], 'index', T('나선 팔이 몇 개로 보이는지 확인해 보세요', 'See how many spiral arms appear'))],
 reroll=T('다시 자라기', 'Grow again'),
 sections=[
  dict(title=T('① 해바라기가 자라는 모습', '① Watching the Sunflower Grow'),
       p=T('씨앗이 한 알씩 더해집니다. 각도를 바꾸면 무늬가 어떻게 달라지는지 보세요. 황금각 근처에서는 빈틈이 거의 없고, 120°나 144° 같은 각도에서는 바큇살이 생겨요.',
           'Seeds are added one at a time. Change the angle and watch how the pattern differs. Near the golden angle there are almost no gaps, while angles like 120° or 144° produce spokes.'),
       id='c-flower', rounded=True, anim=True, step=False,
       speeds=[('10', T('느리게', 'Slow')), ('28', T('보통', 'Normal')), ('80', T('빠르게', 'Fast'))], speed_default='28',
       extra=SEC3D),
  dict(title=T('③ 각도마다 빈틈은 얼마나 될까', '③ How Big Are the Gaps at Each Angle?'),
       p=T('가로는 씨앗 사이의 각도, 세로는 빈틈 평균입니다(눈금 간격이 점점 넓어지는 로그 눈금). 숫자가 작을수록 고르게 채워진 것입니다. 대부분의 각도는 비슷하게 낮지만, 360°의 간단한 분수 근처에서는 뾰족하게 나빠집니다.',
           'The horizontal axis is the angle between seeds, the vertical axis is the average gap (a log scale, where steps grow wider). Smaller means more evenly filled. Most angles stay similarly low, but near simple fractions of 360° the gap spikes sharply.'),
       id='c-sweep', note='sweep'),
  dict(title=T('④ 특별한 각도 비교', '④ Comparing Special Angles'),
       p=T('지금 씨앗 수에서 몇 가지 각도의 빈틈 평균을 비교합니다. 낮을수록 고르게 채워진 것이고, 금색이 황금각입니다.',
           'Compares the average gap of a few angles at the current seed count. Lower means more evenly filled, and gold is the golden angle.'),
       id='c-bars'),
  dict(title=T('⑤ 이웃까지의 거리', '⑤ Distance to the Nearest Neighbor'),
       p=T('지금 각도에서 씨앗마다 가장 가까운 이웃까지의 거리 분포입니다. 간격이 일정하면 한 곳에 뾰족하게 모이고, 겹치거나 듬성듬성하면 넓게 퍼집니다.',
           'The distribution of the distance from each seed to its nearest neighbor at the current angle. Even spacing gives one sharp peak; overlap or sparse spots spread it out.'),
       id='c-hist'),
 ],
 says=T('씨앗 600개일 때 황금각(137.508°)의 빈틈 평균은 0.38로, 90°~180°를 0.1° 간격으로 훑은 각도 중 이보다 낮은 것은 0.3%뿐이었습니다. 90°, 120°, 144°, 180°처럼 간단한 분수에 가까운 각도는 2.4~5.0으로 6~13배 나쁩니다. 간격의 균일함(이웃 거리의 변동계수)도 황금각은 0.012인데, 0.2°만 어긋난 137.7°는 0.107로 약 9배 들쭉날쭉합니다. 황금각에서는 가까운 이웃의 번호 차이가 피보나치 수로 나옵니다(씨앗 1000개일 때 55와 34).',
        'With 600 seeds, the golden angle (137.508°) has an average gap of 0.38, and only 0.3% of the angles from 90° to 180° (scanned in 0.1° steps) scored lower. Angles near simple fractions such as 90°, 120°, 144° and 180° score 2.4 to 5.0, which is 6 to 13 times worse. The evenness of spacing (coefficient of variation of neighbor distances) is 0.012 at the golden angle, while 137.7°, off by only 0.2°, gives 0.107, about 9 times less even. At the golden angle, the index difference between close neighbors is a Fibonacci number (55 and 34 with 1000 seeds).'),
 **{'not': T('실제 해바라기가 이런 계산으로 만들어진다는 증명은 아닙니다. 이 모델은 "어떤 각도가 기하학적으로 고르게 채우는가"만 보며, 실제 식물에서는 새 씨앗이 기존 씨앗 사이의 가장 빈 자리에서 생기는 과정(호르몬과 억제 효과)으로 각도가 정해진다는 설명이 있습니다. 또 황금각만 잘 채우는 것은 아닙니다. 600개일 때 빈틈 평균이 0.5 미만인 각도가 전체의 73%였습니다. 황금각은 그중에서도 가장 낮은 편이고 가장 고른 편이라는 것이 측정 결과입니다.',
                  'This does not prove that real sunflowers are built by this calculation. The model only looks at which angle fills a disc evenly in geometry; for real plants there is an explanation in which new seeds form in the emptiest spot between existing ones (hormones and inhibition), and the angle follows from that. Also, the golden angle is not the only one that fills well: with 600 seeds, 73% of the angles had an average gap below 0.5. The measured result is that the golden angle is among the lowest and most even of them.')},
theory=[
  ('root', T('식물의 잎·씨앗 배열(잎차례, phyllotaxis)을 설명하는 <b>Vogel의 나선</b>입니다. Vogel (1979, <i>Mathematical Biosciences</i>)은 <code>r = c√k</code>, <code>θ = k × 137.5°</code>로 해바라기 머리를 그릴 수 있음을 보였고, Douady, Couder (1992, <i>Physical Review Letters</i>)는 새 원기가 기존 것에서 가장 먼 빈자리에 생기는 과정이 황금각 배열로 이어짐을 실험과 모델로 보였습니다.',
             'This is <b>Vogel\'s spiral</b>, a model of how leaves and seeds are arranged on plants (phyllotaxis). Vogel (1979, <i>Mathematical Biosciences</i>) showed that a sunflower head can be drawn with <code>r = c√k</code>, <code>θ = k × 137.5°</code>, and Douady and Couder (1992, <i>Physical Review Letters</i>) showed with experiments and a model that new primordia forming in the emptiest spot lead to the golden-angle arrangement.')),
  ('model', T('황금각은 <code>360°(1 − 1/φ) = 360°/φ<sup>2</sup> ≈ 137.508°</code> (<code>φ = (1+√5)/2</code>)입니다. 황금비는 연분수가 전부 1이라 유리수로 가장 근사하기 어려운 무리수여서(Hurwitz 정리), 어떤 방향으로도 씨앗이 겹쳐 쌓이지 않습니다. 슬라이더의 각도가 <code>θ</code>이고 씨앗 수가 <code>k</code>의 범위입니다.',
              'The golden angle is <code>360°(1 − 1/φ) = 360°/φ<sup>2</sup> ≈ 137.508°</code>, with <code>φ = (1+√5)/2</code>. Because all the terms of its continued fraction are 1, the golden ratio is the hardest irrational to approximate by fractions (Hurwitz\'s theorem), so seeds never stack along a few directions. The angle slider is <code>θ</code> and the seed count is the range of <code>k</code>.')),
  ('simplify', T('이 구현은 씨앗의 위치만 계산하는 기하학 모델이고, 새 씨앗이 생기는 호르몬·억제 과정은 다루지 않습니다. 채움 품질의 정의(반지름 85% 안 점들에서 가장 가까운 씨앗까지 거리)와 씨앗 크기는 이 프로젝트가 정한 값이고, 논문 수치의 재현이 아닙니다.',
                 'This implementation is a geometric model that only computes seed positions and does not model the hormonal or inhibitory process that creates new seeds. The packing-quality definition (distance from probe points inside 85% of the radius to the nearest seed) and the seed size are this project\'s own choices, and no paper\'s numbers are reproduced.')),
  ('check', T('이론이 말하는 것은 "황금각이 고르다"는 것이고, 시뮬레이션에서 씨앗 1,000개의 빈틈 평균은 황금각 0.381, 137.7° 0.441, 144° 3.069, 90° 3.776, 180° 6.435였습니다. 이웃 거리의 변동계수도 황금각 0.011, 137° 0.117, 138° 0.157로, 0.5° 안팎만 어긋나도 한 자릿수 배 가까이 고르지 못했습니다. 다만 황금각만 잘 채우는 것은 아니고 가장 낮은 값을 다투는 각도가 가까이에 있습니다.',
              'Theory says the golden angle is even, and in the simulation with 1,000 seeds the average gap was 0.381 at the golden angle, 0.441 at 137.7°, 3.069 at 144°, 3.776 at 90° and 6.435 at 180°. The coefficient of variation of neighbor distances was 0.011 at the golden angle, 0.117 at 137° and 0.157 at 138°, so an error of about half a degree already made spacing roughly ten times less even. The golden angle is not the only good one, though; other angles come close.')),
  ('read', T('Vogel (1979), "A better way to construct the sunflower head", <i>Mathematical Biosciences</i> 44. Douady, Couder (1992), "Phyllotaxis as a physical self-organized growth process", <i>Physical Review Letters</i> 68. Prusinkiewicz, Lindenmayer (1990), 『The Algorithmic Beauty of Plants』, Springer.',
              'Vogel (1979), "A better way to construct the sunflower head", <i>Mathematical Biosciences</i> 44. Douady, Couder (1992), "Phyllotaxis as a physical self-organized growth process", <i>Physical Review Letters</i> 68. Prusinkiewicz, Lindenmayer (1990), <i>The Algorithmic Beauty of Plants</i>, Springer.')),
 ],
 memo=[
         T('채움 품질은 반지름의 85% 안쪽 원판에 이상 간격의 0.35배 간격으로 찍은 점에서 가장 가까운 씨앗까지의 거리로 계산합니다. 씨앗 k는 반지름 √(k+0.5)에 놓입니다.',
         'Packing quality uses probe points spaced 0.35 times the ideal spacing inside 85% of the disc radius, measuring the distance to the nearest seed. Seed k sits at radius √(k+0.5).'),
       T('씨앗 1,000개에서 황금각의 이웃 거리 변동계수는 0.011이고, 137°는 0.117, 138°는 0.157, 144°는 0.198로 모두 더 높았습니다. 검증은 <code>node tools/validate-sunflower.js</code>로 할 수 있습니다.',
         'With 1,000 seeds the coefficient of variation of neighbor distances is 0.011 at the golden angle, versus 0.117 at 137°, 0.157 at 138° and 0.198 at 144°. You can verify with <code>node tools/validate-sunflower.js</code>.')],
))
