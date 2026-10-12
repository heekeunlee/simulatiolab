import os
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'site') + '/'
import re, glob, json, sys, html as H
sys.path.insert(0, '.')
from scan_html import blocks
from en_blocks_1 import EN1
from en_blocks_2 import EN2
from en_blocks_3 import EN3
EN = {}; EN.update(EN1); EN.update(EN2); EN.update(EN3)
EN['B100'] = EN['B100'].replace("though I haven't confirmed that", "though this has not been confirmed")
ids = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'blocks.json'), encoding='utf-8'))
ko2id = {v['ko']: k for k, v in ids.items()}
missing = [k for k in ids if k not in EN]
if missing: print('번역 누락:', missing); sys.exit(1)

META = {
 'index': "We rerun the world in AI-designed simulations to see why things happen. Change the variables and check for yourself.",
 'talent-vs-luck': "Talent is bell-shaped, so why does wealth pile up in a few hands? Run the Talent vs Luck simulation yourself by changing the variables.",
 'schelling': "Can a mild wish not to be a minority split a neighborhood completely apart? Run the Schelling segregation model yourself.",
 'rumor': "How fast does a rumor spread in group chats, and how late can a correction come and still matter? Try it yourself.",
 'wealth': "If every exchange is as fair as a coin flip, does wealth still concentrate? Change the redistribution rate and run it yourself.",
 'peter': "Does promoting your best performer make an organization better? Compare promotion methods under the Peter principle.",
 'youtube': "Does good content win, or does whoever broke out first? See how subscribers concentrate when recommendations follow popularity.",
 'traffic': "Why does traffic jam with no accident or roadwork? Run the Nagel–Schreckenberg traffic model yourself.",
 'dating': "In a market where both sides must agree, how does aiming higher or lower change how long it takes to find a match? Try it yourself.",
 'bar': "Why does everyone lose when everyone thinks alike? Run the El Farol Bar problem and change how people predict.",
 'queue': "Can order survive when queue-jumping pays? Change the strength of punishment and see when order holds.",
 'voting': "Can counting the same votes by plurality, runoff, ranked-choice or Borda change the winner? Run it yourself.",
}
TITLE_ATTR = "Visitors today · total (Korea time)"
esc = lambda s: H.escape(s, quote=True)

root = ROOT
LEGACY = ['bar','dating','peter','queue','rumor','schelling','talent-vs-luck','traffic','voting','wealth','youtube']
pages = [root + 'experiments/%s/index.html' % k for k in LEGACY]  # 새 페이지는 tools/pages/*.py 가 data-en을 직접 만든다
for pg in pages:
    src = open(pg, encoding='utf-8').read()
    src = re.sub(r' data-en(?:-title|-content)?="[^"]*"', '', src)
    open(pg, 'w', encoding='utf-8').write(src)
    src, res = blocks(pg)
    edits = []
    for n, ko in res:
        edits.append((n.inner_start - 1, f' data-en="{esc(EN[ko2id[ko]])}"'))
    slug = 'index' if pg.endswith('site/index.html') else pg.split('/')[-2]
    m = re.search(r'<meta name="description" content="[^"]*"', src)
    edits.append((m.end(), f' data-en-content="{esc(META[slug])}"'))
    for m in re.finditer(r'title="오늘 방문자[^"]*"', src): edits.append((m.end(), f' data-en-title="{esc(TITLE_ATTR)}"'))
    for pos, txt in sorted(edits, reverse=True): src = src[:pos] + txt + src[pos:]
    open(pg, 'w', encoding='utf-8').write(src)
    print(slug, len(edits))
