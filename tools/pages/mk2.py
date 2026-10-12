"""실험 페이지 생성기 (한국어 + 영어 동시 지원).
사용법: 실험마다 tools/pages/<slug>.py 를 만들어 `from mk2 import *` 후 page({...}) 호출 → site/experiments/<slug>/index.html 생성.
모든 문구는 T('한국어', 'English') 로 쓴다. HTML 태그(<b>, <code> 등)는 두 언어에서 같은 구조로 쓴다.
nav / footer는 기존 페이지(bar)에서 그대로 가져온다 (운영자 정보, 방문자 카운터, 언어 토글 포함).
"""
import html as H, os, re
HERE = os.path.dirname(os.path.abspath(__file__))
EXP = os.path.join(HERE, '..', '..', 'site', 'experiments') + '/'
esc = lambda s: H.escape(s, quote=True)

def T(ko, en): return (ko, en)
def da(t): return f' data-en="{esc(t[1])}"'

def leg(style, ko, en):
    """범례 항목. style 예: 'background:#3b82f6'"""
    i = f'<i style="{style}"></i>'
    return f'<span data-en="{esc(i + en)}">{i}{ko}</span>'

def legend(*items): return '\n      <div class="legend">' + ''.join(items) + '</div>'
def note(i): return f'\n      <div class="legend"><span id="note-{i}" data-en="Calculating…">계산 중…</span></div>'

def _shell():
    s = open(EXP + 'bar/index.html', encoding='utf-8').read()
    nav = re.search(r'<nav class="nav">.*?</nav>', s, re.S).group(0)
    foot = re.search(r'<footer>.*?</footer>', s, re.S).group(0)
    # 상단 메뉴의 현재 페이지 링크는 공통이라 그대로 쓴다
    return nav, foot

def page(sp):
    nav, foot = _shell()
    ctl = []
    def label_html(i, label, for_id):
        out = f'<output id="o-{i}"></output>'
        return f'<label for="{for_id}" data-en="{esc(label[1] + " " + out)}">{label[0]} {out}</label>'
    for (i, label, mn, mx, st, val, hint) in sp.get('sliders', []):
        ctl.append(f'<div class="ctl">{label_html(i, label, i)}\n        <input type="range" id="{i}" min="{mn}" max="{mx}" step="{st}" value="{val}">\n        <span class="hint"{da(hint)}>{hint[0]}</span></div>')
    for (i, label, opts, val, hint) in sp.get('selects', []):
        o = ''.join(f'<option value="{v}"{" selected" if v == val else ""}{da(t)}>{t[0]}</option>' for v, t in opts)
        ctl.append(f'<div class="ctl">{label_html(i, label, i)}\n        <select id="{i}" class="sel">{o}</select>\n        <span class="hint"{da(hint)}>{hint[0]}</span></div>')

    def sec(c):
        cls = 'rounded' if c.get('rounded') else ''
        if c.get('three'): cls = (cls + ' view3d').strip()   # 3D 보기 캔버스 (app3d.js가 three.js로 그림)
        bar = ''
        if c.get('anim'):
            sp_ = c.get('speeds', [('2', T('느리게', 'Slow')), ('6', T('보통', 'Normal')), ('16', T('빠르게', 'Fast'))])
            d = c.get('speed_default', sp_[1][0])
            opts = ''.join(f'<option value="{v}"{" selected" if v == d else ""}{da(t)}>{t[0]}</option>' for v, t in sp_)
            step = f'<button id="stepbtn"{da(T("한 단계", "Step"))}>한 단계</button>' if c.get('step', True) else ''
            bar = (f'\n    <div class="anim-bar">\n      <button id="play"{da(T("⏸ 일시정지", "⏸ Pause"))}>⏸ 일시정지</button>\n      {step}\n'
                   f'      <button id="restart"{da(T("처음부터", "Restart"))}>처음부터</button>\n      <select id="speed" aria-label="speed">{opts}</select>\n      <span class="when" id="when"></span>\n    </div>')
        extra = c.get('extra', '')
        if c.get('legend'): extra += legend(*c['legend'])
        if c.get('note'): extra += note(c['note'])
        extra_canvas = c.get('after_canvas', '')
        return (f'<h3{da(c["title"])}>{c["title"][0]}</h3>\n    <p{da(c["p"])}>{c["p"][0]}</p>\n'
                f'    <canvas id="{c["id"]}" class="{cls}"{" data-thumb" if c.get("thumb") else ""} aria-label="{esc(re.sub(r"<[^>]+>", "", c["title"][1]).strip())}"></canvas>{extra_canvas}{bar}{extra}')

    secs = sp['sections']
    first = f'  <section class="panel chart" style="margin-top:16px">\n    {sec(secs[0])}\n  </section>\n'
    # wide=True 이면 결과 격자에서 한 줄 전체를 쓴다 (3D 보기 등 큰 화면)
    rest = ''.join(f'    <section class="panel chart{" wide" if c.get("wide") else ""}">\n      {sec(c)}\n    </section>\n' for c in secs[1:])
    model = ''.join(f'\n    <li{da(b)}>{b[0]}</li>' for b in sp['model'])
    memo = ''.join(f'\n    <li class="memo"{da(b)}>{b[0]}</li>' for b in sp['memo'])
    code = T('코드는 <a href="https://github.com/heekeunlee/simulatiolab/tree/main/site/experiments/%s">GitHub</a>에서 볼 수 있습니다.' % sp['slug'],
             'The code is available on <a href="https://github.com/heekeunlee/simulatiolab/tree/main/site/experiments/%s">GitHub</a>.' % sp['slug'])
    h = lambda ko, en, tag='h2': f'<{tag} data-en="{esc(en)}">{ko}</{tag}>'
    btn = lambda i, ko, en, cls='': f'<button{" class=%s" % cls if cls else ""} id="{i}"{da(T(ko, en))}>{ko}</button>'
    three_tag = '<script src="../../lazy3d.js" data-module="app3d.js"></script>\n' if sp.get('three') else ''   # 3D: page(three=True) + 실험 폴더의 app3d.js (ES 모듈, ../../lab3d.js 사용). lazy3d.js가 화면 가까이 오면 불러옴
    out = f'''<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title{da(sp["title_tag"])}>{sp["title_tag"][0]}</title>
<meta name="description" content="{esc(sp["desc"][0])}" data-en-content="{esc(sp["desc"][1])}">
<link rel="icon" type="image/svg+xml" href="../../favicon.svg">
<link rel="manifest" href="../../manifest.webmanifest">
<link rel="apple-touch-icon" href="../../apple-touch-icon.png">
<meta name="theme-color" content="#2f6fed">
<link rel="stylesheet" href="../../style.css">
</head>
<body>
{nav}

<main class="wrap">
  <h1{da(sp["title"])}>{sp["title"][0]}</h1>
  <p class="lead"{da(sp["lead"])}>{sp["lead"][0]}</p>

  {h("모델은 이렇게 움직입니다", "How the model works")}
  <ul>{model}
  </ul>

  {h("직접 돌려보기", "Try it yourself")}
  <div class="panel">
    <div class="controls">
      {chr(10).join(ctl)}
    </div>
    <div class="btns">
      {btn("run", "처음부터 다시", "Start over", "primary")}
      {btn("reroll", sp.get("reroll", T("같은 설정, 다른 운", "Same settings, new luck"))[0], sp.get("reroll", T("같은 설정, 다른 운", "Same settings, new luck"))[1])}
      {btn("reset", "기본값으로", "Reset to defaults")}
      <span class="muted small" id="seedinfo"></span>
    </div>
  </div>

  <div class="stats" id="stats"></div>

{first}
  <div class="charts">
{rest}  </div>

  {h("이 결과가 말하는 것, 말하지 않는 것", "What This Shows, and What It Doesn't")}
  <div class="callout"{da(T("<b>말하는 것:</b> " + sp["says"][0], "<b>What it shows:</b> " + sp["says"][1]))}><b>말하는 것:</b> {sp["says"][0]}</div>
  <div class="callout"{da(T("<b>말하지 않는 것:</b> " + sp["not"][0], "<b>What it doesn't show:</b> " + sp["not"][1]))}><b>말하지 않는 것:</b> {sp["not"][0]}</div>

  {h("구현 메모", "Implementation notes")}
  <ul class="small">{memo}
    <li{da(code)}>{code[0]}</li>
  </ul>
</main>

{foot}
<script src="../../i18n.js"></script>
<script src="../../i18n-en.js"></script>
<script src="../../exps.js"></script>
<script src="../../layout.js"></script>
<script src="../../lib.js"></script>
<script src="sim.js"></script>
<script src="app.js"></script>
{three_tag}<script src="../../counter.js"></script>
<script src="../../engage.js"></script>
</body>
</html>
'''
    out = out.replace('class="memo"', '').replace('<li >', '<li>')
    d = EXP + sp['slug']; os.makedirs(d, exist_ok=True)
    open(d + '/index.html', 'w', encoding='utf-8').write(out)
    return d + '/index.html'
