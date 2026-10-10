# JS 파일에서 한글이 들어 있는 문자열/템플릿 리터럴을 뽑는다. 템플릿의 ${...}는 {0},{1}... 로 바꾼다.
import os
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'site') + '/'
import re, sys, json
HANGUL = re.compile(r'[ㄱ-ㆎ가-힣]')

def scan(src):
    out = []
    i, n = 0, len(src)
    def read_expr(i):   # ${ 다음부터 짝이 맞는 } 까지, 내부 리터럴도 수집
        depth = 1
        while i < n and depth:
            c = src[i]
            if c == '{': depth += 1; i += 1
            elif c == '}':
                depth -= 1; i += 1
            elif c in '\'"`': i = read_string(i)
            elif src.startswith('//', i): i = src.find('\n', i) if src.find('\n', i) >= 0 else n
            elif src.startswith('/*', i): i = src.find('*/', i) + 2
            else: i += 1
        return i
    def read_string(i):
        q = src[i]; i += 1
        if q != '`':
            buf = []
            while i < n and src[i] != q:
                if src[i] == '\\': buf.append(src[i:i+2]); i += 2
                else: buf.append(src[i]); i += 1
            s = ''.join(buf)
            if HANGUL.search(s): out.append(s.replace("\\'", "'").replace('\\"', '"').replace('\\n', '\n'))
            return i + 1
        parts, k = [], 0
        buf = []
        while i < n and src[i] != '`':
            if src[i] == '\\': buf.append(src[i:i+2]); i += 2
            elif src.startswith('${', i):
                parts.append(''.join(buf)); buf = []
                i = read_expr(i + 2); k += 1
            else: buf.append(src[i]); i += 1
        parts.append(''.join(buf))
        tpl = ''
        for j, p in enumerate(parts):
            tpl += p + ('{%d}' % j if j < len(parts) - 1 else '')
        if HANGUL.search(tpl): out.append(tpl.replace('\\`', '`'))
        return i + 1
    while i < n:
        c = src[i]
        if src.startswith('//', i): i = src.find('\n', i) if src.find('\n', i) >= 0 else n
        elif src.startswith('/*', i): i = src.find('*/', i) + 2
        elif c in '\'"`': i = read_string(i)
        elif c == '/' and re.match(r'/[^/*\n][^/\n]*/[gimsuy]*', src[i:i+200]) and re.search(r'[(=,:;!&|?{}\[]\s*$', src[max(0,i-3):i]):
            m = re.match(r'/(?:\\.|[^/\\\n])+/[gimsuy]*', src[i:]); i += len(m.group(0)) if m else 1
        else: i += 1
    return out

if __name__ == '__main__':
    root = ROOT
    import glob
    files = ['lib.js', 'counter.js'] + sorted(glob.glob(root + 'experiments/*/app.js')) + sorted(glob.glob(root + 'experiments/*/sim.js'))
    allk = {}
    for f in files:
        f = f if f.startswith('/') else root + f
        keys = scan(open(f, encoding='utf-8').read())
        allk[f.replace(root, '')] = list(dict.fromkeys(keys))
    json.dump(allk, open('js_keys.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    tot = 0
    for f, k in allk.items(): print(f, len(k)); tot += len(k)
    print('total', tot, 'unique', len({x for k in allk.values() for x in k}))
