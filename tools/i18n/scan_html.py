# HTML에서 번역할 "텍스트 블록"을 찾는다.
# 블록 = 직접 한글 텍스트를 가진 요소 중, 내부에 인라인 태그만 있는 가장 바깥 요소
import os
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'site') + '/'
import re, glob, json, sys
from html.parser import HTMLParser
HANGUL = re.compile(r'[ㄱ-ㆎ가-힣]')
VOID = {'input','img','meta','link','br','hr'}
INLINE = {'b','i','em','strong','sup','sub','code','small','span','a','output','br'}
SKIP = {'script','style','svg','canvas'}

class Node:
    def __init__(s, tag, attrs, start, tag_end):
        s.tag, s.attrs, s.start, s.inner_start = tag, dict(attrs), start, tag_end
        s.inner_end = None; s.children = []; s.texts = []; s.parent = None

class P(HTMLParser):
    def __init__(s, src):
        super().__init__(convert_charrefs=False)
        s.src = src; s.lines = [0]
        for m in re.finditer('\n', src): s.lines.append(m.end())
        s.root = Node('root', [], 0, 0); s.cur = s.root
    def off(s):
        l, c = s.getpos(); return s.lines[l - 1] + c
    def handle_starttag(s, tag, attrs):
        o = s.off(); txt = s.get_starttag_text()
        n = Node(tag, attrs, o, o + len(txt)); n.parent = s.cur; s.cur.children.append(n)
        if tag not in VOID: s.cur = n
        else: n.inner_end = n.inner_start
    def handle_startendtag(s, tag, attrs):
        o = s.off(); txt = s.get_starttag_text(); n = Node(tag, attrs, o, o + len(txt)); n.inner_end = n.inner_start; n.parent = s.cur; s.cur.children.append(n)
    def handle_endtag(s, tag):
        o = s.off(); c = s.cur
        while c is not s.root and c.tag != tag: c = c.parent
        if c is s.root: return
        c.inner_end = o; s.cur = c.parent
    def handle_data(s, d): s.cur.texts.append(d)

def descendants_inline(n):
    for c in n.children:
        if c.tag not in INLINE or not descendants_inline(c): return False
    return True

def blocks(path):
    src = open(path, encoding='utf-8').read()
    p = P(src); p.feed(src)
    res = []
    def visit(n):
        if n.tag in SKIP: return
        direct = any(HANGUL.search(t) for t in n.texts)
        if n.tag != 'root' and direct and descendants_inline(n):
            res.append((n, src[n.inner_start:n.inner_end].strip())); return
        for c in n.children: visit(c)
        if direct and n.tag != 'root':
            print('WARN 직접 텍스트 누락 가능:', path, n.tag, [t.strip()[:30] for t in n.texts if HANGUL.search(t)])
    visit(p.root)
    return src, res

if __name__ == '__main__':
    root = ROOT
    pages = [root + 'index.html'] + sorted(glob.glob(root + 'experiments/*/index.html'))
    uniq = {}
    for pg in pages:
        src, res = blocks(pg)
        for n, ko in res:
            uniq.setdefault(ko, []).append(pg.replace(root, ''))
    items = sorted(uniq.items(), key=lambda kv: (kv[1][0], src.find(kv[0])))
    out = {}
    for i, (ko, where) in enumerate(items, 1):
        out['B%03d' % i] = {'ko': ko, 'pages': sorted(set(where))}
    json.dump(out, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'blocks.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('pages', len(pages), 'unique blocks', len(out))
