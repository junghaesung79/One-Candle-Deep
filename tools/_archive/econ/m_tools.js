// 최종값 측정 5: 도구 하나를 Day 1부터 가진 채(무구매, 변덕 없음) 평일 수입 변화. 보통·욕심
const { fresh, avg } = require('./lib.js');
const { B, env } = fresh();
const C = env.CONFIG; C.payments.forEach(p => p.amount = 1);
const N = 60, out = [];
function run(pol, tools) {
  const inc = [], col = [];
  for (let s = 1; s <= N; s++) { const r = B.playRun(env, 4000 + s, { policy: pol, spend: false, startTools: tools, mutations: {} });
    r.days.forEach(x => { if ([3, 8, 15].includes(x.day)) return; inc.push(x.income); col.push(x.collapsed ? 1 : 0); }); }
  return { inc: avg(inc), col: avg(col) };
}
const ids = env.TOOLS.filter(t => t.kind === 'passive').map(t => t.id);
const sets = ids.map(i => [i]).concat([['fuse', 'refiner'], ['fuse', 'refiner', 'sieve'], ['ledger', 'moonsieve', 'wedge'], ['gloves', 'lens', 'lastcard'], ['betchalk', 'sheet', 'tongs'], ['refiner', 'sieve', 'tongs', 'ledger', 'wedge']]);
for (const pol of ['normal', 'greedy']) {
  const base = run(pol, []);
  out.push({ policy: pol, tools: '없음', inc: Math.round(base.inc), gain: 0, col: +(100 * base.col).toFixed(1) });
  for (const t of sets) { const r = run(pol, t); const row = { policy: pol, tools: t.join('+'), inc: Math.round(r.inc), gain: +(100 * (r.inc / base.inc - 1)).toFixed(0), col: +(100 * r.col).toFixed(1) }; out.push(row); console.log(JSON.stringify(row)); }
}
require('fs').writeFileSync('out/tools.json', JSON.stringify(out, null, 1));
