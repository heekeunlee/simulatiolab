"""지난 전면 검수(commit 4e94a7f) 이후 새로 생긴 번역(정적·실행 중 문구)만 골라 언어별 검수 묶음을 만든다.
출력: tools/i18n/review/<lang>_n<k>.json  ([{"id","page","ko","en","tr"}]) — 지침은 GUIDE_LANG.md 그대로.
검수 결과(out/<lang>_n<k>.json)는 apply.py가 번역 기억에 반영한다."""
import glob, html, importlib.util, json, os, re, subprocess, sys
R = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(R, '..', '..', '..')
MEM = os.path.join(R, '..', 'tr', 'memory.json'); SRC = os.path.join(R, '..', 'tr', 'src')
LANGS = ['es', 'fr', 'ja', 'ru', 'zh']; SIZE = int(os.environ.get('SIZE', 90000))
mem = json.load(open(MEM, encoding='utf-8'))
old = json.loads(subprocess.check_output(['git', '-C', ROOT, 'show', '4e94a7f:tools/i18n/tr/memory.json']))
subprocess.run([sys.executable, os.path.join(R, '..', 'tr_extract.py')], capture_output=True)   # all_static/all_dyn 갱신
allst = json.load(open(os.path.join(SRC, 'all_static.json'), encoding='utf-8')); alld = json.load(open(os.path.join(SRC, 'all_dyn.json'), encoding='utf-8'))
# 정적: 영어 HTML → (한국어 HTML, 페이지)
ko_of = {}
def inner(s, start, tag):
    depth, pos = 1, start
    rx = re.compile(r'<(/?)%s\b[^>]*>' % tag)
    for m in rx.finditer(s, start):
        depth += -1 if m.group(1) else 1
        if depth == 0: return s[start:m.start()]
    return ''
for f in ['site/index.html'] + sorted(glob.glob(os.path.join(ROOT, 'site/experiments/*/index.html'))):
    fp = f if os.path.isabs(f) else os.path.join(ROOT, f); page = 'index' if f.endswith('site/index.html') else os.path.basename(os.path.dirname(fp))
    s = open(fp, encoding='utf-8').read()
    for m in re.finditer(r'<(\w+)\b([^>]*?)\bdata-en(-title|-content)?="([^"]*)"([^>]*)>', s):
        en = html.unescape(m.group(4)); attrs = m.group(2) + ' ' + m.group(5)
        if m.group(3):
            a = re.search(r'\b%s="([^"]*)"' % ('title' if m.group(3) == '-title' else 'content'), attrs); ko = html.unescape(a.group(1)) if a else ''
        else: ko = inner(s, m.end(), m.group(1)).strip()
        ko_of.setdefault(en, (ko, page))
# 실행 중 문구: 어느 dyn 파일에서 왔는지
dyn_page = {}
for f in sorted(glob.glob(os.path.join(ROOT, 'tools/pages/dyn_*.py'))):
    spec = importlib.util.spec_from_file_location(os.path.basename(f)[:-3], f); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    for k in m.DYN: dyn_page.setdefault(k, '(실행 중 문구) ' + os.path.basename(f)[4:-3])
items = []
for i, en in enumerate(allst):
    if en not in old['s'] and en in mem['s']:
        ko, page = ko_of.get(en, ('', '?')); items.append(('s%04d' % i, page, ko, en, mem['s'][en]))
for i, (ko, en) in enumerate(alld):
    if ko not in old['d'] and ko in mem['d']: items.append(('d%04d' % i, dyn_page.get(ko, '(실행 중 문구)'), ko, en, mem['d'][ko]))
for old_f in glob.glob(os.path.join(R, '*_n[0-9]*.json')): os.remove(old_f)
os.makedirs(os.path.join(R, 'out'), exist_ok=True)
counts = {}
for lang in LANGS:
    chunks, cur, n = [], [], 0
    for id_, page, ko, en, tr in items:
        w = len(ko) * 3 + len(en) + len(tr.get(lang, '')) * 2 + 80
        if cur and n + w > SIZE: chunks.append(cur); cur, n = [], 0
        cur.append({'id': id_, 'page': page, 'ko': ko, 'en': en, 'tr': tr.get(lang, '')}); n += w
    if cur: chunks.append(cur)
    for k, c in enumerate(chunks): json.dump(c, open(os.path.join(R, f'{lang}_n{k}.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    counts[lang] = len(chunks)
print('검수 대상', len(items), '개(언어별), 묶음', counts)
