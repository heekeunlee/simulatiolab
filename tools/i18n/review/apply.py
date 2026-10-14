# 검수 결과(review/out/<lang>_<k>.json)를 번역 기억(tr/memory.json)에 반영한다. 태그·자리표시자·한글을 다시 검사하고 기록을 남긴다.
import json, glob, os, re
from collections import Counter
R = os.path.dirname(os.path.abspath(__file__)); MEM = os.path.join(R, '..', 'tr', 'memory.json')
import sys; sys.path.insert(0, os.path.join(R, '..')); import memio
mem = memio.load()
HAN = re.compile('[ㄱ-ㆎ가-힣]'); tag = lambda s: Counter(re.findall(r'</?\w+', s)); ph = lambda s: Counter(re.findall(r'\{\d+\}', s))
log, n, bad = [], 0, 0
for f in sorted(glob.glob(os.path.join(R, 'out', '*_[0-9].json')) + glob.glob(os.path.join(R, 'out', '*_n[0-9]*.json'))):
    lang, k = os.path.basename(f)[:-5].split('_')
    items = {x['id']: x for x in json.load(open(os.path.join(R, f'{lang}_{k}.json'), encoding='utf-8'))}
    for i, v in json.load(open(f, encoding='utf-8')).items():
        x = items.get(i); new = (v or {}).get('tr')
        if not x or not new: continue
        if HAN.search(new) or tag(new) != tag(x['en']) or ph(new) != ph(x['en']): bad += 1; log.append(f'- ✗ {lang} {i} 검사 실패, 적용 안 함: {new[:80]}'); continue
        store = mem['d'] if i.startswith('d') else mem['s']; key = x['ko'] if i.startswith('d') else x['en']
        if key not in store: continue
        if store[key].get(lang) != new:
            store[key][lang] = new; n += 1
            log.append(f"- {lang} `{x['page']}` {x['ko'][:40]!r}: {x['tr'][:70]!r} → {new[:70]!r} ({v.get('why', '')})")
memio.save(mem)
import datetime
_hdr = '# 번역 검수 반영 기록\n\n' if not os.path.exists(os.path.join(R, 'applied.md')) else ''
open(os.path.join(R, 'applied.md'), 'a', encoding='utf-8').write(_hdr + f'\n## {datetime.date.today()} 반영 {n}개, 검사 실패 {bad}개\n\n' + '\n'.join(log) + '\n')   # 이전 기록은 지우지 않고 덧붙인다
print('반영', n, '검사 실패', bad)
