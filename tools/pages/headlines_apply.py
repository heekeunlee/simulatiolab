"""'이 결과가 말하는 것 / 말하지 않는 것' 상자를 한 줄 헤드라인 + 접이식 '상세 설명'으로 바꾼다.
헤드라인은 tools/pages/headlines/<slug>.json (says_ko, says_en, not_ko, not_en). 기존 긴 설명은 그대로 두고 접어 둔다.
mk2.page()가 페이지를 만들 때 자동으로 부르고, 직접 쓴 HTML 페이지는 `python3 tools/pages/headlines_apply.py`로 한 번에 바꾼다(여러 번 돌려도 같은 결과)."""
import html as H, json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
EXP = os.path.join(HERE, '..', '..', 'site', 'experiments')
RX = re.compile(r'<div class="callout" data-en="([^"]*)">(.*?)</div>', re.S)

def _text(s): return H.escape(s, quote=False)
def _attr(s): return H.escape(s, quote=True)

def apply(page_html, slug):
    path = os.path.join(HERE, 'headlines', slug + '.json')
    if not os.path.exists(path): return page_html
    hd = json.load(open(path, encoding='utf-8'))
    n = [0]
    def sub(m):
        i = n[0]; n[0] += 1
        if i > 1: return m.group(0)
        key = 'says' if i == 0 else 'not'
        en_full = m.group(1)                       # 이미 HTML 이스케이프된 data-en (태그 포함)
        ko_inner = m.group(2)
        lab_ko = re.match(r'\s*(<b>.*?</b>)', ko_inner, re.S); lab_ko = lab_ko.group(1) if lab_ko else ''
        lab_en = re.match(r'\s*(&lt;b&gt;.*?&lt;/b&gt;)', en_full, re.S); lab_en = H.unescape(lab_en.group(1)) if lab_en else ''
        head_ko, head_en = hd[key + '_ko'], hd[key + '_en']
        return (f'<div class="callout cl-{key}">\n'
                f'    <p class="chead" data-en="{_attr(lab_en + " " + head_en)}">{lab_ko} {_text(head_ko)}</p>\n'
                f'    <details class="cmore"><summary data-en="Details">상세 설명</summary>\n'
                f'      <p class="cfull" data-en="{en_full}">{ko_inner}</p></details>\n'
                f'  </div>')
    if 'class="chead"' in page_html: return page_html
    return RX.sub(sub, page_html)

if __name__ == '__main__':
    done = 0
    for slug in sorted(os.listdir(EXP)):
        f = os.path.join(EXP, slug, 'index.html')
        if not os.path.exists(f): continue
        s = open(f, encoding='utf-8').read(); t = apply(s, slug)
        if t != s: open(f, 'w', encoding='utf-8').write(t); done += 1
    print('바꾼 페이지', done)
