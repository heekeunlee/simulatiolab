"""'이 결과가 말하는 것 / 말하지 않는 것' 상자를 헤드라인 1~3개(결과에서 유추한 통찰) + 접이식 '상세 설명'으로 바꾼다.
헤드라인은 tools/pages/headlines/<slug>.json: {"says_ko": [..], "says_en": [..], "not_ko": [..], "not_en": [..]} (문자열이면 1개로 본다).
기존 긴 설명은 그대로 두고 접어 둔다. mk2.page()가 페이지를 만들 때 자동으로 부르고, 직접 쓴 HTML 페이지는
`python3 tools/pages/headlines_apply.py`로 한 번에 바꾼다(이미 바뀐 페이지도 헤드라인만 새로 갈아 끼우므로 여러 번 돌려도 된다)."""
import html as H, json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
EXP = os.path.join(HERE, '..', '..', 'site', 'experiments')
RX = re.compile(r'<div class="callout" data-en="([^"]*)">(.*?)</div>', re.S)
# 이미 바뀐 상자를 원래 모양으로 되돌리는 패턴 (긴 설명 문단에 원문이 그대로 있다)
RX_DONE = re.compile(r'<div class="callout cl-(?:says|not)">.*?<p class="cfull" data-en="([^"]*)">(.*?)</p></details>\s*</div>', re.S)

def _text(s): return H.escape(s, quote=False)
def _attr(s): return H.escape(s, quote=True)
def _list(v): return v if isinstance(v, list) else [v]

def apply(page_html, slug):
    path = os.path.join(HERE, 'headlines', slug + '.json')
    if not os.path.exists(path): return page_html
    hd = json.load(open(path, encoding='utf-8'))
    page_html = RX_DONE.sub(lambda m: f'<div class="callout" data-en="{m.group(1)}">{m.group(2)}</div>', page_html)
    n = [0]
    def sub(m):
        i = n[0]; n[0] += 1
        if i > 1: return m.group(0)
        key = 'says' if i == 0 else 'not'
        en_full, ko_inner = m.group(1), m.group(2)
        lab_ko = re.match(r'\s*(<b>.*?</b>)', ko_inner, re.S); lab_ko = lab_ko.group(1) if lab_ko else ''
        lab_en = re.match(r'\s*(&lt;b&gt;.*?&lt;/b&gt;)', en_full, re.S); lab_en = H.unescape(lab_en.group(1)) if lab_en else ''
        ko, en = _list(hd[key + '_ko']), _list(hd[key + '_en'])
        assert len(ko) == len(en), (slug, key)
        lis = ''.join(f'<li data-en="{_attr(e)}">{_text(k)}</li>' for k, e in zip(ko, en))
        return (f'<div class="callout cl-{key}">\n'
                f'    <p class="clabel" data-en="{_attr(lab_en)}">{lab_ko}</p>\n'
                f'    <ul class="chead">{lis}</ul>\n'
                f'    <details class="cmore"><summary data-en="Details">상세 설명</summary>\n'
                f'      <p class="cfull" data-en="{en_full}">{ko_inner}</p></details>\n'
                f'  </div>')
    return RX.sub(sub, page_html)

if __name__ == '__main__':
    done = 0
    for slug in sorted(os.listdir(EXP)):
        f = os.path.join(EXP, slug, 'index.html')
        if not os.path.exists(f): continue
        s = open(f, encoding='utf-8').read(); t = apply(s, slug)
        if t != s: open(f, 'w', encoding='utf-8').write(t); done += 1
    print('바꾼 페이지', done)
