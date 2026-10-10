# 영어 번역 규칙(실행 중 문구)을 모아 site/i18n-en.js 를 만든다.
# 모으는 곳: tools/i18n/en_dyn.py (기존 11개 실험) + tools/pages/dyn_*.py (새 실험마다 DYN 사전 하나)
import os, sys, json, glob, importlib.util
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from en_dyn import DYN
merged = dict(DYN)
for f in sorted(glob.glob(os.path.join(HERE, '..', 'pages', 'dyn_*.py'))):
    spec = importlib.util.spec_from_file_location(os.path.basename(f)[:-3], f); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    for k, v in m.DYN.items():
        if k in merged and merged[k] != v: print('경고: 같은 키에 다른 번역', repr(k), '|', f)
        merged.setdefault(k, v)
out = os.path.join(HERE, '..', '..', 'site', 'i18n-en.js')
open(out, 'w', encoding='utf-8').write("// 실행 중 생기는 문구의 영어 번역 규칙 ({0} 일반 값, {#0} 숫자, {%0} 퍼센트)\nwindow.I18N && window.I18N.add(" + json.dumps(merged, ensure_ascii=False, indent=1) + ");\n")
print(len(merged), 'rules written')
