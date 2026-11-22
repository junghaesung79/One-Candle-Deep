const fs=require('fs'),vm=require('vm');
const src=fs.readFileSync('/home/claude/proto2_src/core.js','utf8');
const sb={module:{exports:{}},console};vm.createContext(sb);vm.runInContext(src,sb);
const {Core,CONFIG,TUTORIAL}=sb.module.exports;
module.exports=sb.module.exports;
if(require.main===module){
  const map=JSON.parse(process.argv[2]||'null'); if(map) TUTORIAL.floors[1].map=map;
  const run=Core.newRun(TUTORIAL.seed,{tutorial:true});
  Core.startDay(run);
  const f=run.d.floor;
  let out='';
  for(let y=0;y<11;y++){let a='',b='';for(let x=0;x<15;x++){const c=Core.cellAt(f,x,y);
    b+=c.haz==='mine'?'m':c.haz==='treasure'?(c.tier>1?'G':'g'):c.stair?'s':'.';
    if(c.cover!=='open')a+='#';else{const n=Core.numAt(f,c);a+=n?n:(x===f.sx&&y===f.sy?'@':'.');}}
    out+=a+'   '+b+'\n';}
  console.log(out);
  console.log('open',f.cells.filter(c=>c.cover==='open').length,'pocket',run.d.pocket,'solvable',f.solvable);
  const D=Core.deduce(f);console.log('haz',D.haz.map(i=>[i%15,i/15|0]+''),'safe',D.safe.length,'stairCand',D.stairCand);
}
