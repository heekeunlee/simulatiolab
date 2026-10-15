#!/usr/bin/env python3
# 배포할 때마다 site/VERSION 의 끝자리를 올린다. 끝자리가 10이 되면 가운데 자리를 올리고 끝자리는 0 (1.3.9 → 1.4.0, 1.9.9 → 2.0.0).
# 사용: python3 tools/bump_version.py  → 그 뒤 python3 tools/pages/index.py (exps.js 에 window.LAB_VERSION 을 넣는다)
import os
P = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'site', 'VERSION')
a, b, c = [int(x) for x in open(P).read().strip().split('.')]
c += 1
if c == 10: c = 0; b += 1
if b == 10: b = 0; a += 1
v = f'{a}.{b}.{c}'
open(P, 'w').write(v + '\n'); print(v)
