# 사용법: python3 tools/scan_js_keys.py site/experiments/<slug>/app.js  → 한글 문자열 리터럴 목록 (번역 규칙 작성용)
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'i18n'))
from scan_js import scan
for k in dict.fromkeys(scan(open(sys.argv[1], encoding='utf-8').read())): print(repr(k))
