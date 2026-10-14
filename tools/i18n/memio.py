# 번역 기억을 s/d 두 파일로 나눠 읽고 쓴다 (한 파일이 5MB 한도를 넘지 않게)
import json, os
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tr')
def _p(k): return os.path.join(D, 'memory_%s.json' % k)
def load():
    m = {}
    for k in ('s', 'd'):
        m[k] = json.load(open(_p(k), encoding='utf-8')) if os.path.exists(_p(k)) else {}
    return m
def save(m):
    for k in ('s', 'd'):
        json.dump(m[k], open(_p(k), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
