import sys; sys.path.insert(0, '.')
from mk2 import *
# ② 3D 보기: 첫 섹션(①) 바로 아래에 전체 너비로 넣기 위해 ①의 extra에서 섹션을 닫고 새로 연다 (sunflower.py와 같은 방식)
_T3 = T('② 3D로 보기: 집값이 언덕처럼 솟아 번지는 지형 <span class="badge3d">3D</span>', '② See It in 3D: Prices Rising Like a Hill and Spreading <span class="badge3d">3D</span>')
_P3 = T('위 지도와 같은 시뮬레이션을 입체로 본 것입니다. 동네 900곳이 막대 하나씩이고, <b>막대 높이가 그 동네의 가격지수</b>, 색은 위 지도와 같은 "소득 기준선에 비해 비싼 정도"입니다. 가운데에서 솟은 언덕이 파도처럼 바깥으로 번지는지, 금리 충격 뒤에 내려앉는지 보세요. 재생, 일시정지, 처음부터, 슬라이더는 위 지도를 그대로 따라갑니다.',
        'This is the same simulation as the map above, seen in 3D. Each of the 900 neighborhoods is one bar: <b>the bar height is its price index</b>, and the color is the same "how expensive relative to the income line" as on the map. Watch whether the hill rising in the middle spreads outward like a wave, and whether it sinks after the rate shock. Play, pause, restart and the sliders all follow the map above.')
_H3 = T('같은 결과를 입체로 본 것일 뿐 새로 계산한 숫자는 없어요. 높이 = 가격지수(모서리 기둥의 눈금 100·200·300·400). 드래그로 회전 · 휠(두 손가락)로 확대 · 휴대폰에서 세로로 쓸면 페이지가 내려갑니다.',
        'It is the same result seen in 3D; no new numbers are calculated. Height = price index (ticks on the corner pole: 100, 200, 300, 400). Drag to rotate · scroll (or pinch) to zoom · on a phone, swiping up and down scrolls the page.')
_GRAD = 'background:linear-gradient(90deg,rgb(199,224,250),rgb(255,244,204) 7%,rgb(245,158,66) 27%,rgb(214,49,59) 53%,rgb(122,16,32))'
SEC3D = f'''
  </section>
  <section class="panel chart" style="margin-top:16px">
    <style>@media (max-width: 640px) {{ #c-3d {{ aspect-ratio: 1 / 1; }} }}</style>
    <h3{da(_T3)}>{_T3[0]}</h3>
    <p{da(_P3)}>{_P3[0]}</p>
    <canvas id="c-3d" class="view3d" data-thumb aria-label="{esc(_T3[1].split(' <')[0])}"></canvas>
    <p class="hint3d" id="when3d" style="text-align:right"></p>{legend(leg(_GRAD, '색: 소득 기준선에 비해 싼 편 → 매우 비쌈 (위 지도와 같음)', 'Color: cheaper → very expensive relative to the income line (same as the map)'), leg('background:rgba(90,110,150,.25);border:1px solid rgba(60,80,120,.6)', '옅은 판: 소득 기준선 높이', 'Faint plane: height of the income line'))}
    <p class="hint3d"{da(_H3)}>{_H3[0]}</p>'''

page(dict(
 three=True,
 slug='apartment',
 title=T('아파트 가격은 어떻게 번질까', 'How Do Apartment Prices Spread?'),
 title_tag=T('아파트 가격은 어떻게 번질까 · 시뮬라티오 랩', 'How Do Apartment Prices Spread? · Simulatio Lab'),
 desc=T('한 동네에서 오른 집값이 이웃 동네로 번지는 모습을 지켜보세요. 대출 한도와 금리 충격도 바꿔 볼 수 있어요. 투자 조언이 아닌 장난감 모델입니다.',
        'Watch a price rise in one neighborhood spread to the next ones. You can change the loan cap and a rate shock. A toy model, not investment advice.'),
 lead=T('한 동네에서 오른 집값은 이웃 동네로 번질까요? 이웃이 오르면 따라 오르는 정도(가격 전염), 대출 한도, 금리 충격을 바꿔 가며 바둑판 위 동네 900곳을 지켜봅니다. 실제 지역이 아니라 원리를 보는 장난감 모델입니다.',
        'Does a price rise in one neighborhood spread to the next ones? Change how much a neighborhood copies the rise next door (price contagion), the loan cap and a rate shock, and watch 900 neighborhoods on a grid. It is a toy model of how things work, not a real area.'),
 model=[
  T('30×30 격자의 칸 하나가 한 동네이고, 가격지수는 모두 100에서 시작합니다. 한 걸음은 한 분기입니다. 가운데 7×7칸(점선 네모)에서 상승이 먼저 시작됩니다.',
    'Each cell of a 30×30 grid is a neighborhood, and every price index starts at 100. One step is one quarter. The rise starts in the central 7×7 block (dashed square).'),
  T('각 동네의 상승률은 <b>자기 최근 상승(관성)</b>, <b>8개 이웃의 최근 상승(가격 전염)</b>, <b>앞으로도 오를 것이라는 기대</b>, 작은 무작위 충격이 합쳐서 정해집니다.',
    'Each neighborhood\'s growth combines <b>its own recent gains (momentum)</b>, <b>the recent gains of its 8 neighbors (price contagion)</b>, <b>the expectation that prices keep rising</b>, and small random shocks.'),
  T('소득이 천천히 늘어난 만큼의 "소득 기준선"이 있고, <b>대출 한도</b>가 클수록 가격이 그 위로 더 올라갈 수 있습니다(감당 상한). 상한을 넘으면 상승률이 깎이고, 기준선 아래로 내려가면 다시 사는 사람이 생깁니다.',
    'There is an "income line" that rises slowly with incomes, and a higher <b>loan cap</b> lets prices climb further above it (the affordability ceiling). Above the ceiling growth is dragged down; below the line buyers return.'),
  T('<b>금리 충격</b>을 고르면 그 분기부터 감당 상한이 낮아지고 기대가 꺾이면서 가격이 식습니다.',
    'If you choose a <b>rate shock</b>, from that quarter the ceiling drops and expectations sour, so prices cool.')],
 sliders=[
  ('contagion', T('이웃 따라 오르기(가격 전염)', 'Copying neighbors (price contagion)'), 0, 1, 0.05, 0.6, T('이웃이 오르면 얼마나 따라 오르는지. 0이면 이웃과 상관없음', 'How much a neighborhood follows its neighbors\' rise. 0 means independent')),
  ('ltv', T('대출 한도', 'Loan cap'), 40, 80, 5, 60, T('클수록 소득 기준선보다 더 높이 오를 수 있음', 'Higher means prices can climb further above the income line')),
  ('optimism', T('더 오를 거라는 기대', 'Hope for more gains'), 0, 100, 10, 50, T('0이면 기대 때문에 오르는 일이 없음', 'At 0, hope alone pushes nothing up'))],
 selects=[('rateStep', T('금리 급등', 'Rate shock'), [('0', T('없음', 'None')), ('40', T('40분기째에', 'At quarter 40')), ('50', T('50분기째에', 'At quarter 50')), ('60', T('60분기째에', 'At quarter 60'))], '50', T('그 분기부터 대출 여건이 나빠지고 기대가 꺾임', 'From that quarter lending tightens and expectations sour'))],
 sections=[
  dict(title=T('① 집값이 번지는 모습', '① How Prices Spread'),
       p=T('한 칸이 한 동네이고, 색은 소득에 비해 집값이 얼마나 비싼지입니다. 가운데 점선 네모에서 시작해 이웃으로 번지는지, 금리 충격 뒤에 식는지 지켜보세요.',
           'Each cell is a neighborhood, and color shows how expensive it is relative to the income line. Watch whether the rise spreads out from the dashed square in the middle, and whether it cools after the rate shock.'),
       id='c-map', rounded=True, anim=True, speeds=[('4', T('느리게', 'Slow')), ('8', T('보통', 'Normal')), ('25', T('빠르게', 'Fast'))], speed_default='8', extra=SEC3D),
  dict(title=T('③ 평균 집값과 오를 수 있는 한계', '③ Average Price and Its Limit'),
       p=T('파란 선이 평균 집값 지수예요. 회색 점선은 소득 기준선, 금색 점선은 대출 한도가 허락하는 한계선입니다. 집값은 한계선 근처까지 오르다가 금리 충격 뒤 내려옵니다.',
           'The blue line is the average price index. The gray dashed line is the income line and the gold dashed line is the ceiling allowed by the loan cap. Prices rise toward the ceiling, then fall after the rate shock.'),
       id='c-price'),
  dict(title=T('④ 얼마나 많은 동네가 너무 비싸졌나', '④ How Many Neighborhoods Get Too Pricey'),
       p=T('너무 비싼 동네는 소득 기준선보다 30% 넘게 비싼 동네예요. 빨간 선은 그 비율, 회색 선은 동네끼리 집값이 벌어진 정도(표준편차를 평균으로 나눈 값)입니다.',
           'An overvalued neighborhood is one priced more than 30% above the income line. The red line is their share, and the gray line is the price gap between neighborhoods (standard deviation divided by the mean).'),
       id='c-hot'),
  dict(title=T('⑤ 이웃을 더 따라 할수록, 대출이 쉬울수록', '⑤ More Copying, Easier Loans'),
       p=T('가로는 이웃 따라 오르기의 세기, 세로는 기간 중 너무 비싼 동네가 가장 많았을 때의 비율입니다. 같은 전염 세기에서 대출 한도만 40%로 낮추면 어떻게 달라지는지 비교해 보세요. 점은 5번의 실행이에요.',
           'The horizontal axis is price contagion; the vertical axis is the highest share of overvalued neighborhoods during the run. Compare what changes when only the loan cap is lowered to 40% at the same contagion. Dots are 5 runs.'),
       id='c-sweep', note='sweep'),
 ],
 says=T('이 모델에서는 이웃의 상승에 끌리는 정도(가격 전염)가 0.4까지는 상승이 거의 번지지 않다가(고평가 동네 최대 약 9%), 0.5가 되면 약 90%의 동네가 고평가 상태가 되고 0.6 이상에서는 모든 동네로 번집니다. 같은 전염 세기에서도 대출 한도를 40%로 낮추면 번짐이 거의 일어나지 않았습니다. 기본 설정(전염 0.6, 대출 한도 60%, 50분기째 금리 충격)에서는 평균 가격이 약 230까지 올랐다가 정점에서 약 24% 내려왔습니다. 상승이 번지는 데는 한 동네의 사정보다 서로 따라가는 구조가 크게 작용할 수 있다는 뜻이에요.',
        'In this model, up to a contagion of 0.4 the rise barely spreads (at most about 9% of neighborhoods overvalued); at 0.5 about 90% become overvalued, and from 0.6 up it reaches every neighborhood. At the same contagion, lowering the loan cap to 40% left almost no spread. With the default settings (contagion 0.6, loan cap 60%, a rate shock at quarter 50), the average price rose to about 230 and then fell about 24% from its peak. The structure of following each other can matter more for how a rise spreads than the circumstances of any one neighborhood.'),
 **{'not': T('실제 어느 도시나 지역의 가격 전망이 아니고, 투자나 부동산 거래에 대한 조언도 아닙니다. 이 모델에는 공급, 인구, 세금, 금융 제도, 정책이 없고, 숫자(전염의 세기, 대출 한도, 금리 충격의 크기)는 구조를 보여 주려고 정한 값이라 실제 시장과 직접 비교할 수 없습니다.',
                'This is not a price forecast for any real city or area, and it is not advice on investing or property transactions. The model has no supply, population, taxes, financial regulation or policy, and its numbers (contagion strength, loan cap, size of the rate shock) are chosen to show structure, so they cannot be compared directly with real markets.')},
 theory=[
  ('root', T('가격이 오르는 모습을 보고 더 사려는 마음이 가격을 다시 올리는 되먹임은 Shiller(2000)의 『Irrational Exuberance』가 자산시장의 한 설명으로 널리 알렸고, Case와 Shiller(1989)는 단독주택 가격 변화에 관성이 있다는 것을 다뤘습니다. 대출 한도가 가격 상한을 정한다는 발상은 Geanakoplos의 "레버리지 순환(leverage cycle)" 논의에서 가져왔습니다. 이 페이지는 그 논문들의 모델이 아니라 이 프로젝트의 장난감 모델입니다.', 'The feedback in which seeing prices rise makes people buy more and push prices up was popularized as an account of asset markets by Shiller (2000) in <i>Irrational Exuberance</i>, and Case and Shiller (1989) examined momentum in single-family home prices. The idea that lending limits set a ceiling on prices comes from Geanakoplos\'s "leverage cycle" discussion. This page is this project\'s own toy model, not a model from those works.')),
  ('model', T('분기 상승률 <code>g = 0.30×(내 직전 g) + 전염×(8 이웃 평균 g) + 0.004×기대 + 무작위 충격 + 상한 보정</code>입니다. 자기 상승과 이웃 상승이 다시 상승을 낳는 되먹임이라서 전염 슬라이더가 클수록 상승이 번지기 쉽고, 감당 상한 <code>소득선×(대출 한도÷0.4)<sup>1.5</sup></code>이 가격이 소득 기준선에서 얼마나 멀어질 수 있는지를 정합니다.', "The quarterly growth is <code>g = 0.30×(own previous g) + contagion×(average g of 8 neighbors) + 0.004×optimism + random shock + ceiling correction</code>. Own gains and neighbors' gains feed back into new gains, so a larger contagion slider makes a rise spread more easily, and the ceiling <code>income line×(loan cap÷0.4)<sup>1.5</sup></code> sets how far prices can drift from the income line.")),
  ('simplify', T('계수(0.30, 0.004, 지수 1.5, 상한 보정 25%, 금리 충격 때의 30% 하락 등)와 소득 증가율(분기 0.5%)은 모두 이 프로젝트가 구조를 보여 주려고 임의로 정한 값이고 실제 시장에서 추정한 것이 아닙니다. 모든 동네의 소득이 같고, 이웃은 격자의 8칸일 뿐 실제 인접 관계가 아니며, 공급·인구·세금·정책은 없습니다.', 'The coefficients (0.30, 0.004, the exponent 1.5, the 25% ceiling correction, the 30% ceiling cut at a rate shock and so on) and the income growth (0.5% per quarter) were all chosen arbitrarily by this project to show structure, not estimated from real markets. Every neighborhood has the same income, neighbors are just the 8 grid cells rather than real adjacency, and there is no supply, population, tax or policy.')),
  ('check', T('이론적 기준값이 없어 시뮬레이션만으로 확인했습니다. 금리 충격이 없을 때 고평가 동네의 최대 비율은 전염 0.4에서 9%, 0.5에서 92%, 0.6에서 100%였고, 전염 0.6에서 대출 한도 40%는 0%, 50%는 99%였습니다. 기본 설정은 평균 가격이 정점 230에서 끝 174로 24% 내려왔습니다.', 'There is no theoretical benchmark, so this was checked by simulation alone. Without a rate shock, the peak share of overvalued neighborhoods was 9% at contagion 0.4, 92% at 0.5 and 100% at 0.6, and at contagion 0.6 a 40% loan cap gave 0% while 50% gave 99%. The default settings took the average price from a peak of 230 to 174 at the end, down 24%.')),
  ('read', T('Shiller, R. J. (2000), <i>Irrational Exuberance</i>, Princeton University Press. Case, K. E. & Shiller, R. J. (1989), 「The Efficiency of the Market for Single-Family Homes」, <i>American Economic Review</i>. Geanakoplos, J. (2010), 「The Leverage Cycle」, <i>NBER Macroeconomics Annual 2009</i>.', 'Shiller, R. J. (2000), <i>Irrational Exuberance</i>, Princeton University Press. Case, K. E. & Shiller, R. J. (1989), "The Efficiency of the Market for Single-Family Homes", <i>American Economic Review</i>. Geanakoplos, J. (2010), "The Leverage Cycle", <i>NBER Macroeconomics Annual 2009</i>.')),
 ],
 memo=[
  T('상승률 = 0.30×(내 직전 상승률) + 전염×(8 이웃 평균) + 0.004×기대 + 무작위 충격(표준편차 0.6%). 감당 상한 = 소득 기준선×(대출 한도÷0.4)<sup>1.5</sup>이고, 상한 위에서는 상한과의 로그 차이의 25%만큼, 소득 기준선 아래에서는 같은 크기만큼 상승률이 조정됩니다. 소득은 분기마다 0.5%씩 늘어납니다.',
    'Growth = 0.30 × (own previous growth) + contagion × (average of 8 neighbors) + 0.004 × optimism + a random shock (SD 0.6%). The ceiling = income line × (loan cap ÷ 0.4)<sup>1.5</sup>; above the ceiling growth is reduced by 25% of the log gap, and below the income line it is raised by the same amount. Income grows 0.5% per quarter.'),
  T('금리 충격은 그 분기부터 감당 상한을 30% 낮추고, 기대를 4분의 1로 줄이고, 12분기에 걸쳐 사라지는 하락 압력(최대 -1.2%)을 더합니다. 이 상수들은 모두 임의로 정했습니다.',
    'A rate shock cuts the ceiling by 30% from that quarter, reduces optimism to a quarter, and adds a downward pressure (up to −1.2%) that fades over 12 quarters. All these constants were chosen arbitrarily.'),
  T('④, ⑤번 그래프의 "고평가"는 소득 기준선보다 30% 넘게 비싼 동네입니다. ⑤번은 금리 충격 없이 80분기를 5번씩 돌린 결과입니다. 검증은 <code>node tools/validate-apartment.js</code>로 할 수 있습니다.',
    '"Overvalued" in graphs ④ and ⑤ means priced more than 30% above the income line. Graph ⑤ runs 80 quarters 5 times each without a rate shock. You can verify with <code>node tools/validate-apartment.js</code>.')],
))
