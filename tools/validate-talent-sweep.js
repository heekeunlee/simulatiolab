// 영상용: 슬라이더를 바꿨을 때의 300회 반복 요약.  사용법: node tools/validate-talent-sweep.js
const TL=require('../site/experiments/talent-vs-luck/sim.js');
const mean=a=>a.reduce((x,y)=>x+y,0)/a.length, med=a=>[...a].sort((x,y)=>x-y)[Math.floor(a.length/2)];
function row(label,o){const b=TL.batch(o,300);console.log(label.padEnd(22),'상위20%',(mean(b.map(r=>r.top20Share))*100).toFixed(1)+'%','최고부자=재능1등',(b.filter(r=>r.richestIsTopTalent).length/3).toFixed(1)+'%','최고부자 재능중앙',med(b.map(r=>r.richestTalent)).toFixed(3),'상위10명중 재능상위10%',mean(b.map(r=>r.richInTopDecile)).toFixed(2));}
row('기본(500,0.1,50%)',{});
row('이벤트 50',{events:50});
row('이벤트 200',{events:200});
row('이벤트 2000',{events:2000});
row('재능폭 0.02',{sdT:0.02});
row('재능폭 0.2',{sdT:0.2});
row('기간 10년',{years:10});
row('기간 60년',{years:60});
for (const s of [1,2,3,4,5]){const st=TL.stats(TL.create({seed:s}).run());console.log('seed',s,'부자재능',st.richestTalent.toFixed(3),'자본',st.richestCapital,'재능1등자본',st.mostTalentedCapital.toFixed(3),'상위20',(st.top20Share*100).toFixed(1));}
