from itertools import combinations
_N = ['엔진', '조종석', '동체', '날개', '꼬리']
_E = ['Engine', 'Cockpit', 'Fuselage', 'Wings', 'Tail']
DYN = {
'엔진': 'Engine', '조종석': 'Cockpit', '동체': 'Fuselage', '날개': 'Wings', '꼬리': 'Tail',
'방탄': 'armor',
'돌아온 비행기에서 보이는 구멍': 'Holes you can see on returned planes',
'실제로 맞은 총탄 전부': 'Every bullet that really hit',
'{#0}대 귀환': '{0} planes returned',
'{#0}대 출격 · {#1}대 추락': '{0} planes sent · {1} lost',
'방탄 장갑 {#0}/{#1}곳 · 다시 누르면 뗍니다': 'Armor on {0}/{1} sections · click again to remove',
'부위를 눌러 방탄 장갑을 붙여 보세요 (최대 {#0}곳)': 'Click a section to add armor (up to {0})',
'{#0}/{#1}회 출격 · {#2}대 귀환': 'Sortie {0}/{1} · {2} planes returned',
'맞은 총탄 중 돌아온 비행기에서 보이는 비율': 'Share of bullets that hit which you can still see on returned planes',
'재생을 누르면 채워져요': 'Press play to fill this in',
'보강 없음': 'No armor', '구멍 많은 곳': 'Where the holes are', '빈 곳 (월드)': 'Where holes are missing (Wald)', '내 선택': 'My choice',
'최선 (모든 조합 비교)': 'Best (all combinations compared)',
'출격한 비행기가 돌아오는 비율 (생존율)': 'Share of planes that come back (survival rate)',
'엔진에 맞은 총탄이 추락시키는 확률': 'Chance that a bullet in the engine brings the plane down',
'보강 없을 때 생존율': 'Survival rate without armor',
'{#0}회 출격 중 {#1}회 귀환': '{1} of {0} sorties returned',
'구멍 많은 곳에 보강': 'Armor where the holes are',
'빈 곳에 보강 (월드)': 'Armor where holes are missing (Wald)',
'그림의 부위를 눌러 고르세요': 'Click sections of the plane to choose',
'빈 곳에 보강하면 구멍 많은 곳에 보강할 때보다 생존율이 {0} 높아요': 'Armoring where holes are missing gives a survival rate {0} higher than armoring where the holes are',
'빈 곳에 보강하면 구멍 많은 곳에 보강할 때보다 생존율이 {0} 낮아요': 'Armoring where holes are missing gives a survival rate {0} lower than armoring where the holes are',
'엔진 치명률 0%에서 구멍 많은 곳 보강 {0} · 빈 곳 보강 {1}, 90%에서는 {2} · {3}입니다': 'At engine lethality 0%, armor where the holes are gives {0} and armor where holes are missing gives {1}; at 90% it is {2} and {3}',
'{#0}곳': '{0} sections',
'출격 기록 번호': 'Sortie record',
}
for k in (1, 2, 3):
    for c in combinations(range(5), k):
        DYN[' · '.join(_N[i] for i in c)] = ' · '.join(_E[i] for i in c)
