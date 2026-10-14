# 번역 기억(tr/memory.json)의 사이트 전체 일관성 정리 (여러 번 돌려도 같은 결과)
#  1) "말하는 것 / 말하지 않는 것" 머리말을 언어마다 한 가지로
#  2) 용어 통일 몇 가지
#  3) es/fr/ru 정적 문구의 숫자 표기를 그 언어 관습으로 (1,000 → 1.000 / 1 000, 0.5 → 0,5). 태그 안·<code> 안은 건드리지 않음
import json, os, re
R = os.path.dirname(os.path.abspath(__file__)); MEM = os.path.join(R, '..', 'tr', 'memory.json')
import sys; sys.path.insert(0, os.path.join(R, '..')); import memio
mem = memio.load()
HEAD = {
  'es': ('Qué muestra:', 'Qué no muestra:'),
  'fr': ('Ce que cela montre :', 'Ce que cela ne montre pas :'),
  'ja': ('言えること：', '言えないこと：'),
  'ru': ('Что это показывает:', 'Чего это не показывает:'),
  'zh': ('它说明了什么：', '它没有说明什么：'),
}
HEAD_EN = ('What it shows:', "What it doesn't show:")
TERMS = {
  'fr': [('Téléphone arabe', 'Téléphone sans fil'), ('téléphone arabe', 'téléphone sans fil')],
  'ru': [('Завеса неведения', 'Вуаль неведения'), ('завеса неведения', 'вуаль неведения'), ('завесой неведения', 'вуалью неведения'), ('завесу неведения', 'вуаль неведения'), ('завесы неведения', 'вуали неведения')],
}
THOU = {'es': '.', 'fr': ' ', 'ru': ' '}
def localize_numbers(html, lang, en=None):
    # en(영어 원문)에 그대로 있는 영어식 숫자만 바꾼다 → 이미 바꾼 숫자(예: es 1.000)를 다시 건드리지 않아 여러 번 돌려도 같다
    en_nums = set(re.findall(r'\d[\d.,]*\d|\d', re.sub(r'<[^>]+>', ' ', en))) if en is not None else None
    out, in_code = [], False
    for part in re.split(r'(<[^>]+>)', html):
        if part.startswith('<'):
            if re.match(r'<code\b', part): in_code = True
            if part.startswith('</code'): in_code = False
            out.append(part); continue
        if in_code or not part: out.append(part); continue
        def fix(m):
            num = m.group(0)
            if en_nums is not None and num not in en_nums: return num
            ip, _, fp = num.partition('.')
            ip = ip.replace(',', THOU[lang]) if ',' in ip else ip
            return ip + (',' + fp if fp else '')
        # 숫자 하나 전체(천 단위 쉼표·소수점 포함)를 잡아 바꾼다. 앞뒤가 글자·점이면(버전, 주소 등) 건드리지 않음
        out.append(re.sub(r'(?<![\w.,])(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+\.\d+)(?![0-9A-Za-z_]|\.\d|,\d)', fix, part))
    return ''.join(out)
n = {'head': 0, 'term': 0, 'num': 0}
for en, tr in mem['s'].items():
    for lang, (h1, h2) in HEAD.items():
        v = tr.get(lang)
        if not v: continue
        new = v
        if en.lstrip().startswith('<b>' + HEAD_EN[0] + '</b>'): new = re.sub(r'^(\s*)<b>[^<]*</b>', lambda m: m.group(1) + '<b>' + h1 + '</b>', new, count=1)
        if en.lstrip().startswith('<b>' + HEAD_EN[1] + '</b>'): new = re.sub(r'^(\s*)<b>[^<]*</b>', lambda m: m.group(1) + '<b>' + h2 + '</b>', new, count=1)
        if new != v: tr[lang] = new; n['head'] += 1
    for lang, rules in TERMS.items():
        v = tr.get(lang)
        if not v: continue
        new = v
        for a, b in rules: new = new.replace(a, b)
        if new != v: tr[lang] = new; n['term'] += 1
    for lang in THOU:
        v = tr.get(lang)
        if not v: continue
        new = localize_numbers(v, lang, en)
        if new != v: tr[lang] = new; n['num'] += 1
for ko, tr in mem['d'].items():
    for lang, rules in TERMS.items():
        v = tr.get(lang)
        if v:
            new = v
            for a, b in rules: new = new.replace(a, b)
            if new != v: tr[lang] = new; n['term'] += 1
memio.save(mem)
print(n)
