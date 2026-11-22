const { fresh, avg } = require('./lib.js');
const { B, env } = fresh();
const C = env.CONFIG; C.treasureValue = { 1: 20, 2: 50, 3: 120 };
C.payments.forEach(p => p.amount = 1);
for (const pol of ['cautious', 'normal', 'greedy']) {
  const st = { 3: [], 8: [], 15: [] }, inc = { 2: [], 3: [], 7: [], 8: [], 14: [], 15: [] }, reach = { 3: 0, 8: 0, 15: 0 }, mult = { 3: [], 8: [], 15: [] };
  for (let s = 1; s <= 60; s++) {
    const r = B.playRun(env, 2000 + s, { policy: pol, spend: false });
    r.days.forEach(x => { if (inc[x.day]) inc[x.day].push(x.income); if (st[x.day]) { st[x.day].push(x.lines.chunk > 0 ? 1 : 0); if (x.lines.chunk) mult[x.day].push(x.lines.chunk / C.chunks[x.day].value); if (x.depth >= C.chunks[x.day].depth) reach[x.day]++; } });
  }
  console.log(pol, 'chunk done', [3, 8, 15].map(d => (100 * avg(st[d])).toFixed(0) + '% (reach ' + reach[d] + '/' + st[d].length + ', mult ' + avg(mult[d]).toFixed(2) + ')').join(' '), '| inc', Object.keys(inc).map(d => d + ':' + Math.round(avg(inc[d]))).join(' '));
}
