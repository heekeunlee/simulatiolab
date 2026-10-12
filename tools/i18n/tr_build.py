# tr/out/*.json (에이전트 번역) 을 검증하고 site/i18n-es.js, i18n-fr.js, i18n-ja.js 를 만든다.
import json, re, os, glob, sys, html
from collections import Counter
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tr')
SITE = os.path.join(D, '..', '..', '..', 'site')
static = json.load(open(os.path.join(D, 'src/all_static.json'), encoding='utf-8'))
dyn = json.load(open(os.path.join(D, 'src/all_dyn.json'), encoding='utf-8'))
HAN = re.compile('[ㄱ-ㆎ가-힣]')
tag = lambda s: Counter(re.findall(r'<[^>]+>', s))
ph = lambda s: Counter(re.findall(r'\{[#%]?\d+\}', s))
MEM = os.path.join(D, 'memory.json')   # 지금까지 검증을 통과한 번역 전체 (s: 영어 HTML→번역, d: 한국어 키→번역)
mem = json.load(open(MEM, encoding='utf-8')) if os.path.exists(MEM) else {'s': {}, 'd': {}}
tr = {}
outs = sorted(glob.glob(os.path.join(D, 'out/*.json')))
for f in outs:
    try: tr.update(json.load(open(f, encoding='utf-8')))
    except Exception as e: print('JSON 오류', f, e)
bad = []
out = {l: ({}, {}) for l in ('es', 'fr', 'ja', 'ru', 'zh')}
for i, en in enumerate(static):
    r = dict(mem['s'].get(en, {})); r.update(tr.get('s%04d' % i, {}))
    for l in out:
        v = r.get(l)
        if not v: bad.append(('s%04d' % i, l, '누락')); continue
        if HAN.search(v): bad.append(('s%04d' % i, l, '한글')); continue
        if tag(v) != tag(en):
            # 태그 속성 따옴표 등 사소한 차이는 태그 이름 순서로 한 번 더 비교
            nm = lambda s: Counter(re.findall(r'</?\w+', s))
            if nm(v) != nm(en) or Counter(re.findall(r'(?:id|href)="[^"]*"', v)) != Counter(re.findall(r'(?:id|href)="[^"]*"', en)):
                bad.append(('s%04d' % i, l, '태그')); continue
        out[l][0][en] = v
        mem['s'].setdefault(en, {})[l] = v
for i, (ko, en) in enumerate(dyn):
    r = dict(mem['d'].get(ko, {})); r.update(tr.get('d%04d' % i, {}))
    for l in out:
        v = r.get(l)
        if not v: bad.append(('d%04d' % i, l, '누락')); continue
        if HAN.search(v): bad.append(('d%04d' % i, l, '한글')); continue
        if ph(v) != ph(en): bad.append(('d%04d' % i, l, '자리표시자 ' + en + ' | ' + v)); continue
        out[l][1][ko] = v
        mem['d'].setdefault(ko, {})[l] = v
for l, (st, dy) in out.items():
    js = '// %s 번역 (tools/i18n/tr_build.py 로 생성)\n(function () {\n  var I = window.I18N; if (!I) return;\n  I.addLang(%s, %s);\n  I.addStatic(%s, %s);\n  I.apply();\n})();\n' % (l, json.dumps(l), json.dumps(dy, ensure_ascii=False), json.dumps(l), json.dumps(st, ensure_ascii=False))
    open(os.path.join(SITE, 'i18n-%s.js' % l), 'w', encoding='utf-8').write(js)
    print(l, 'static', len(st), '/', len(static), 'dyn', len(dy), '/', len(dyn))
for b in bad[:60]: print('불량', b)
print('불량 총', len(bad))
json.dump([b[0] for b in bad], open(os.path.join(D, 'bad.json'), 'w'))
json.dump(mem, open(MEM, 'w', encoding='utf-8'), ensure_ascii=False)
if not bad:
    for f in outs: os.remove(f)   # 번호 체계가 다음 추출 때 바뀌므로 흡수한 조각은 지운다
