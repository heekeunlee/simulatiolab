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
# 지원 언어 (영어·한국어 제외). 인자를 주면 그 언어만 대상: python3 tr_extract.py ru zh
ALL_LANGS = ['es', 'fr', 'ja', 'ru', 'zh']
LANGS = sys.argv[1:] or ALL_LANGS
MEM = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tr', 'memory.json')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import memio
mem = memio.load()
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
cs = chunk([(k, v) for k, v in enumerate(items) if any(l not in mem['s'].get(v, {}) for l in LANGS)], int(os.environ.get('CHUNK', 8000)), lambda p: p[1])
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
cd = chunk([(k, kv) for k, kv in enumerate(ditems) if any(l not in mem['d'].get(kv[0], {}) for l in LANGS)], int(os.environ.get('CHUNK', 8000)) - 1000, lambda p: p[1][0] + p[1][1])
for i, c in enumerate(cd):
    json.dump([{'id': 'd%04d' % k, 'ko': ko, 'en': en} for k, (ko, en) in c], open(os.path.join(SRC, 'dyn_%02d.json' % i), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
json.dump(LANGS, open(os.path.join(SRC, 'langs.json'), 'w'))
print('대상 언어', LANGS, len(items), 'static,', len(ditems), 'dyn; 새로 번역할 묶음: static', len(cs), ' dyn', len(cd))
