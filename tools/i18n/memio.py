# 번역 기억을 여러 파일로 나눠 읽고 쓴다 (한 파일이 5MB 한도를 넘지 않게)
#  - s(영어 HTML→번역)는 키의 해시로 4조각 memory_s_0..3.json, d(한국어 키→번역)는 memory_d.json
import glob, json, os, zlib
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tr')
NS = 4
def _shard(k): return zlib.crc32(k.encode('utf-8')) % NS
def load():
    m = {'s': {}, 'd': {}}
    for f in sorted(glob.glob(os.path.join(D, 'memory_s*.json'))):
        m['s'].update(json.load(open(f, encoding='utf-8')))
    p = os.path.join(D, 'memory_d.json')
    if os.path.exists(p): m['d'] = json.load(open(p, encoding='utf-8'))
    return m
def save(m):
    parts = [{} for _ in range(NS)]
    for k, v in m['s'].items(): parts[_shard(k)][k] = v
    for i, p in enumerate(parts):
        json.dump(p, open(os.path.join(D, 'memory_s_%d.json' % i), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    old = os.path.join(D, 'memory_s.json')
    if os.path.exists(old): os.remove(old)
    json.dump(m['d'], open(os.path.join(D, 'memory_d.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
