const {load,playRun}=require('/home/claude/proto2/bot.js');
const env=load('/home/claude/proto2/index.html');
Object.assign(env.CONFIG,JSON.parse(process.argv[2]||'{}'));
const acc={};let n=0;const byDay={};
for(let s=1;s<=30;s++){const r=playRun(env,1000+s);
 r.run.history.forEach(h=>{});
}
// instrument: rerun capturing pocketLines via settle
const Core=env.Core;
const {Bot}=require('/home/claude/proto2/bot.js');
for(let s=1;s<=30;s++){const bot=new Bot(env,{floorBudget:8});const run=Core.newRun(2000+s);let g=0;
 while(run.phase!=='final'&&g++<200){
  if(run.phase==='deed'||run.phase==='board'){if(run.orders.length)Core.chooseOrder(run,bot.pickOrder(run));Core.startDay(run);continue;}
  if(run.phase==='mine'||run.phase==='room'){bot.playDay(run);const L=run.settle.lines;for(const k in L){acc[k]=(acc[k]||0)+L[k];}n++;
    const dd=run.day;byDay[dd]=byDay[dd]||{n:0,t:0,g:0,c:0,r:0,depth:0,tN:0};const b=byDay[dd];b.n++;b.t+=L.treasure;b.g+=L.gravel;b.c+=L.chunk;b.r+=L.refine;b.depth+=run.d.stats.depth;b.tN+=L.treasureN;continue;}
  if(run.phase==='settle'){Core.afterSettle(run);continue;}if(run.phase==='payment'){Core.afterPayment(run);continue;}
  if(run.phase==='shop'){bot.shop(run);Core.nextDay(run);continue;}}}
for(const k in acc)acc[k]=Math.round(acc[k]/n);console.log('avg/day',acc);
for(const d in byDay){const b=byDay[d];console.log('day',d,'n',b.n,'treas',Math.round(b.t/b.n),'tN',(b.tN/b.n).toFixed(1),'gravel',Math.round(b.g/b.n),'chunk',Math.round(b.c/b.n),'refine',Math.round(b.r/b.n),'depth',(b.depth/b.n).toFixed(1));}
