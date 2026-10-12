# 채널 프로필 로고 후보 3종 (800x800, 원형으로 잘려도 안전하게 중앙 배치)
import math, random, os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'docs', 'youtube', 'logo')
INK, PAPER, GOLD, NAVY = '#1c2440', '#f3ecdf', '#d9a441', '#121833'

def enso_marks(n=900, mul=1.0, ink=INK, gold=GOLD, seed=7):
    # 원상(圓相): 점(사람)들이 모여 한 번의 붓질 같은 원을 이룬다. 끝은 열려 있다 — 다시 돌려보는 세계. 800x800 좌표
    r = random.Random(seed); s = []
    cx, cy, R = 400, 410, 245
    a0, a1 = math.radians(-60), math.radians(-60 + 318)
    for i in range(n):
        t = i / (n - 1); a = a0 + (a1 - a0) * t
        w = 70 * (math.sin(math.pi * min(1, t * 1.1)) ** 0.5) * (1 - 0.6 * t) + 10   # 붓의 굵기
        spread = (r.random() - 0.5) * w * (1 + 1.6 * t * t) / max(1, mul ** 0.5)
        rr = R + spread + 6 * math.sin(a * 3)
        x, y = cx + rr * math.cos(a), cy + rr * math.sin(a)
        size = mul * max(2.2, (w / 5.5) * (0.5 + r.random() * 0.7) * (1 - 0.45 * t))
        op = 0.92 - 0.4 * t * r.random()
        s.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{size:.1f}" fill="{ink}" opacity="{op:.2f}"/>')
    s.append(f'<circle cx="{cx + 70:.0f}" cy="{cy - 40:.0f}" r="{34 * max(1, mul * .8):.0f}" fill="{gold}"/>')   # 하나의 물음
    return ''.join(s)

def enso():
    return f'<rect width="800" height="800" fill="{PAPER}"/>' + enso_marks()

def question():
    # 물음표 성좌: 수많은 점(개인)이 모여 하나의 '왜?'를 그린다. 마침점은 금빛 해
    r = random.Random(3)
    s = [f'<defs><radialGradient id="g" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="#2a3566"/><stop offset="1" stop-color="{NAVY}"/></radialGradient></defs><rect width="800" height="800" fill="url(#g)"/>']
    for _ in range(90):   # 배경 별
        s.append(f'<circle cx="{r.uniform(0,800):.0f}" cy="{r.uniform(0,800):.0f}" r="{r.uniform(.8,2.2):.1f}" fill="#fff" opacity="{r.uniform(.15,.45):.2f}"/>')
    pts = []
    cx, cy, R = 400, 300, 130
    for i in range(70):   # 위쪽 고리
        a = math.radians(200 + 230 * i / 69)
        pts.append((cx + R * math.cos(a), cy + R * math.sin(a)))
    ex, ey = pts[-1]
    for i in range(1, 30):   # 아래로 내려오는 줄기
        t = i / 29
        pts.append((ex + (400 - ex) * t + 18 * math.sin(t * math.pi), ey + (535 - ey) * t))
    for i, (x, y) in enumerate(pts):
        jx, jy = r.gauss(0, 7), r.gauss(0, 7)
        for k in range(2):
            s.append(f'<circle cx="{x + jx + r.gauss(0,5):.1f}" cy="{y + jy + r.gauss(0,5):.1f}" r="{r.uniform(4,9):.1f}" fill="{"#ffd089" if r.random() < .12 else "#ffffff"}" opacity="{r.uniform(.65,.95):.2f}"/>')
    s.append(f'<circle cx="400" cy="610" r="36" fill="{GOLD}"/><circle cx="400" cy="610" r="60" fill="{GOLD}" opacity=".18"/>')
    return ''.join(s)

def cave():
    # 플라톤의 동굴: 불빛 앞의 작은 점(사람)들이 벽에 커다란 그림자를 드리운다 — 우리는 그림자(모델)로 실재를 짐작한다
    s = [f'<defs><radialGradient id="f" cx="50%" cy="95%" r="95%"><stop offset="0" stop-color="#ffd27a"/><stop offset=".45" stop-color="#d98b45"/><stop offset=".8" stop-color="#6b3a2a"/><stop offset="1" stop-color="#2a1a22"/></radialGradient></defs>',
         '<rect width="800" height="800" fill="url(#f)"/>']
    # 벽의 그림자: 아래 점들을 위로 크게 비춘 모양 (가장자리는 흐릿)
    for x, y, rr in [(250, 300, 70), (400, 270, 82), (550, 300, 70)]:
        s.append(f'<circle cx="{x}" cy="{y}" r="{rr + 10}" fill="{NAVY}" opacity=".35"/><circle cx="{x}" cy="{y}" r="{rr}" fill="{NAVY}" opacity=".9"/>')
    # 그림자로 이어지는 빛의 선 (불 → 사람 → 벽)
    for x, X in [(340, 250), (400, 400), (460, 550)]:
        s.append(f'<line x1="400" y1="640" x2="{X}" y2="300" stroke="#fff3d6" stroke-opacity=".18" stroke-width="2"/>')
    for x in (340, 400, 460):
        s.append(f'<circle cx="{x}" cy="520" r="22" fill="{NAVY}"/>')
    s.append('<path d="M400 690 C366 660 376 625 400 595 C424 625 434 660 400 690 Z" fill="#fff3d6"/><path d="M400 680 C384 662 388 640 400 622 C412 640 416 662 400 680 Z" fill="#ffd27a"/>')
    return ''.join(s)

LOGOS = [('1-enso', '원상: 돌려보는 세계', enso), ('2-question', '물음표 성좌', question), ('3-cave', '플라톤의 동굴', cave)]
for name, _, f in LOGOS:
    open(os.path.join(OUT, name + '.svg'), 'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">{f()}</svg>')
# 미리보기: 원형으로 자른 모습 3개 + 작은 크기(실제 댓글·검색 크기)
pv = ['<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="640" viewBox="0 0 1500 640"><rect width="1500" height="640" fill="#ffffff"/>']
for i, (name, label, f) in enumerate(LOGOS):
    x = 40 + i * 490
    pv.append(f'<clipPath id="c{i}"><circle cx="{x+200}" cy="220" r="200"/></clipPath><g clip-path="url(#c{i})"><g transform="translate({x},20) scale(.5)">{f()}</g></g>')
    pv.append(f'<clipPath id="d{i}"><circle cx="{x+40}" cy="520" r="22"/></clipPath><g clip-path="url(#d{i})"><g transform="translate({x+18},498) scale(.055)">{f()}</g></g>')
    pv.append(f'<text x="{x+80}" y="528" font-family="Apple SD Gothic Neo" font-size="26" fill="#333">{i+1}. {label}</text>')
pv.append('</svg>')
open(os.path.join(OUT, 'preview.svg'), 'w').write(''.join(pv))
print('ok')

# ---- 웹사이트 로고·파비콘 (작은 크기용: 점 수를 줄이고 크게) ----
SITE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'site')
def small(n, mul):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="48" height="48" role="img" aria-label="시뮬라티오 랩 로고">'
            f'<rect width="800" height="800" rx="200" fill="{PAPER}"/><g transform="translate(400 400) scale(1.12) translate(-400 -405)">{enso_marks(n, mul)}</g></svg>')
open(os.path.join(SITE, 'logo.svg'), 'w').write(small(150, 2.6))
open(os.path.join(SITE, 'favicon.svg'), 'w').write(small(70, 4.2))
# ---- 유튜브 프로필 (원상) ----
YT = os.path.join(OUT, '..')
open(os.path.join(YT, 'profile.svg'), 'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">{enso()}</svg>')
# ---- 유튜브 배너 (2560x1440, 글자·로고는 가운데 1546x423 안전 영역 안) ----
r = random.Random(11)
dots = ''.join(f'<circle cx="{r.uniform(0,2560):.0f}" cy="{r.uniform(0,1440):.0f}" r="{r.uniform(2,6):.1f}" fill="{INK}" opacity="{r.uniform(.04,.12):.2f}"/>' for _ in range(160))
FONT = "-apple-system,'Apple SD Gothic Neo','Noto Sans KR',sans-serif"
banner = (f'<svg xmlns="http://www.w3.org/2000/svg" width="2560" height="1440" viewBox="0 0 2560 1440">'
          f'<defs><radialGradient id="glow" cx="0.5" cy="0.5" r="0.6"><stop offset="0" stop-color="#fbf7ef"/><stop offset="1" stop-color="#ebe1cf"/></radialGradient></defs>'
          f'<rect width="2560" height="1440" fill="url(#glow)"/>{dots}'
          f'<g transform="translate(470 460) scale(0.62)">{enso_marks(700, 1.25)}</g>'
          f'<text x="1010" y="715" font-family="{FONT}" font-size="150" font-weight="800" fill="{INK}">시뮬라티오 랩</text>'
          f'<text x="1014" y="815" font-family="{FONT}" font-size="64" font-weight="500" fill="#4a5270">세상을 돌려보는 실험실</text>'
          f'<text x="1016" y="885" font-family="-apple-system,\'Helvetica Neue\',sans-serif" font-size="40" font-weight="600" letter-spacing="12" fill="#b07d2a">SIMULATIO LAB</text></svg>')
open(os.path.join(YT, 'banner.svg'), 'w').write(banner)
print('site logo/favicon, profile, banner written')
# ---- 유튜브 동영상 워터마크 (정사각형, 투명 바탕 위 한지색 원) ----
open(os.path.join(YT, 'watermark.svg'), 'w').write(
    f'<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 800 800">'
    f'<circle cx="400" cy="400" r="392" fill="{PAPER}" opacity=".92"/>'
    f'<g transform="translate(400 400) scale(1.05) translate(-400 -405)">{enso_marks(220, 2.0)}</g></svg>')
