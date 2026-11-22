const {load,playRun}=require('/home/claude/proto2/bot.js');
const env=load('/home/claude/proto2/index.html');
const bo=JSON.parse(process.argv[2]||'{}');const N=+process.argv[3]||40;
const res=[];for(let s=1;s<=N;s++)res.push(playRun(env,1000+s,bo));
const days=[].concat(...res.map(r=>r.days));const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
const pass=[0,0,0];res.forEach(r=>{for(let i=0;i<3;i++)if(r.final.stamps>i)pass[i]++;});
const by=d=>days.filter(x=>x.day===d);const brk=days.reduce((a,x)=>a+x.stats.breaks,0),haz=days.reduce((a,x)=>a+x.stats.hazDigs,0);
console.log(JSON.stringify(bo),'pass',pass.map(p=>(100*p/N).toFixed(0)).join('/'),'D1',Math.round(avg(by(1).map(x=>x.income))),'D8',Math.round(avg(by(8).map(x=>x.income))),'D15',Math.round(avg(by(15).map(x=>x.income))),'haz%',(100*haz/brk).toFixed(1),'depth',avg(days.map(x=>x.depth)).toFixed(1),'treas',avg(days.map(x=>x.stats.treasures)).toFixed(1),'hp-left',avg(res.map(r=>r.run.d?r.run.d.hp:0)).toFixed(1));
