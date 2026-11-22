// CONFIG 바꿔 가며 봇 지표 보기
const {load,playRun}=require('/home/claude/proto2/bot.js');
const env=load('/home/claude/proto2/index.html');
const patch=JSON.parse(process.argv[2]||'{}');
Object.assign(env.CONFIG,patch);
const N=+process.argv[3]||40;
const res=[];for(let s=1;s<=N;s++)res.push(playRun(env,1000+s));
const days=[].concat(...res.map(r=>r.days));const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
const pass=[0,0,0];res.forEach(r=>{for(let i=0;i<3;i++)if(r.final.stamps>i)pass[i]++;});
const by=d=>days.filter(x=>x.day===d);
const brk=days.reduce((a,x)=>a+x.stats.breaks,0),haz=days.reduce((a,x)=>a+x.stats.hazDigs,0);
const g=days.reduce((a,x)=>a+(x.bot.gambles||0),0),rl=days.reduce((a,x)=>a+(x.bot.ruleDigs||0),0);
const lines=k=>Math.round(avg(days.map(x=>x.stats&&0)));
console.log('pass',pass.map(p=>(100*p/N).toFixed(0)).join('/'),'inc D1',Math.round(avg(by(1).map(x=>x.income))),'D3',Math.round(avg(by(3).map(x=>x.income))),'D8',Math.round(avg(by(8).map(x=>x.income||0))),'D15',Math.round(avg(by(15).map(x=>x.income)||[0])),
 'breaks',avg(days.map(x=>x.stats.breaks)).toFixed(1),'haz%',(100*haz/brk).toFixed(1),'rule%',(100*rl/brk).toFixed(1),'gamble%',(100*g/brk).toFixed(1),'depth',avg(days.map(x=>x.depth)).toFixed(1),
 'collapse%',(100*days.filter(x=>x.collapsed).length/days.length).toFixed(1),'blasts',avg(days.map(x=>x.stats.blasts)).toFixed(2), 'treas/day',avg(days.map(x=>x.stats.treasures)).toFixed(1));
