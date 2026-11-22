const { fresh, measure, avg, med } = require('./lib.js');
const { B, env } = fresh();
const out = {}, seg = [[], [], []];
for (const p of ['cautious', 'normal', 'greedy']) {
  const m = measure(B, env, 200, { policy: p });
  const days = [].concat(...m.res.map(r => r.days));
  const chunkDone = [3, 8, 15].map(d => { const L = days.filter(x => x.day === d); return +(100 * L.filter(x => x.lines.chunk > 0).length / Math.max(1, L.length)).toFixed(0); });
  m.res.forEach(r => { const rng = [[1, 3], [4, 8], [9, 15]]; for (let i = 0; i < 3; i++) if (r.final.stamps > i) seg[i].push(r.days.filter(x => x.day >= rng[i][0] && x.day <= rng[i][1]).reduce((a, x) => a + x.income, 0)); });
  out[p] = { pass: m.pass, inc: m.inc, haz: m.hazRate, left: m.leftover, x2: m.double, col: m.collapse, score: m.score, share: m.share, chunkDone, tools: [8, 15].map(d => +avg(days.filter(x => x.day === d).map(x => x.owned.length)).toFixed(1)), depth: m.depth, fire: m.firePerDay, gam: m.gambleRate };
  console.log(p, JSON.stringify(out[p]));
}
console.log('voidCompare', seg.map(a => Math.round(avg(a) / 10) * 10), 'n', seg.map(a => a.length));
require('fs').writeFileSync('out/final_r50.json', JSON.stringify(out, null, 1));
