# 다국어(es/fr/ja) 번역 작업용 원문 묶음을 만든다.
#  - 정적 문구: HTML의 data-en / data-en-title / data-en-content 값(영어 HTML) → tr/src/static_NN.json
#  - 실행 중 문구: i18n-en.js 규칙(한국어 키 → 영어) → tr/src/dyn_NN.json
import re, glob, html, json, os, sys, importlib.util
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tr', 'src')
os.makedirs(SRC, exist_ok=True)
files = ['site/index.html'] + sorted(glob.glob(os.path.join(ROOT, 'site/experiments/*/index.html')))
seen = {}
for f in files:
    f = f if os.path.isabs(f) else os.path.join(ROOT, f)
    s = open(f, encoding='utf-8').read()
    for m in re.finditer(r'data-en(?:-title|-content)?="([^"]*)"', s):
        v = html.unescape(m.group(1))
        seen.setdefault(v, len(seen))
items = sorted(seen, key=lambda v: seen[v])
json.dump(items, open(os.path.join(SRC, 'all_static.json'), 'w', encoding='utf-8'), ensure_ascii=False)
def chunk(lst, size, key):
    out, cur, n = [], [], 0
    for x in lst:
        w = len(key(x)) + 20
        if cur and n + w > size: out.append(cur); cur, n = [], 0
        cur.append(x); n += w
    if cur: out.append(cur)
    return out
for old in glob.glob(os.path.join(SRC, '*_[0-9][0-9].json')): os.remove(old)
cs = chunk(list(enumerate(items)), 8000, lambda p: p[1])
for i, c in enumerate(cs):
    json.dump([{'id': 's%04d' % k, 'en': v} for k, v in c], open(os.path.join(SRC, 'static_%02d.json' % i), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
# 실행 중 문구
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from en_dyn import DYN
merged = dict(DYN)
for f in sorted(glob.glob(os.path.join(ROOT, 'tools/pages/dyn_*.py'))):
    spec = importlib.util.spec_from_file_location(os.path.basename(f)[:-3], f); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    for k, v in m.DYN.items(): merged.setdefault(k, v)
ditems = list(merged.items())
json.dump(ditems, open(os.path.join(SRC, 'all_dyn.json'), 'w', encoding='utf-8'), ensure_ascii=False)
cd = chunk(list(enumerate(ditems)), 7000, lambda p: p[1][0] + p[1][1])
for i, c in enumerate(cd):
    json.dump([{'id': 'd%04d' % k, 'ko': ko, 'en': en} for k, (ko, en) in c], open(os.path.join(SRC, 'dyn_%02d.json' % i), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print(len(items), 'static ->', len(cs), 'chunks;', len(ditems), 'dyn ->', len(cd), 'chunks')
