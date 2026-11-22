// 최종값 측정 1: 정책별 통과율·수입 곡선·지표(200판)
const { fresh, measure, avg, med } = require('./lib.js');
const { B, env } = fresh();
const N = 200, out = {};
for (const p of ['cautious', 'normal', 'greedy']) {
  const m = measure(B, env, N, { policy: p });
  const days = [].concat(...m.res.map(r => r.days));
  const inc = {}; for (let d = 1; d <= 15; d++) { const L = days.filter(x => x.day === d); inc[d] = L.length ? Math.round(avg(L.map(x => x.income))) : null; }
  const d1 = days.filter(x => x.day === 1), ft = d1.filter(x => x.stats.firstTreasureHit).map(x => x.stats.firstTreasureHit);
  const reach = [3, 8, 15].map(d => m.res.filter(r => r.final.day >= d).length);
  const chunkDone = [3, 8, 15].map(d => { const L = days.filter(x => x.day === d); return +(100 * L.filter(x => x.lines.chunk > 0).length / Math.max(1, L.length)).toFixed(0); });
  const tools = [8, 15].map(d => { const L = days.filter(x => x.day === d); return +avg(L.map(x => x.owned.length)).toFixed(1); });
  const mines = +avg(days.map(x => x.stats.mines)).toFixed(2);
  const fireMiss = m.res.reduce((a, r) => a + r.bot.fireMiss, 0), fireN = m.res.reduce((a, r) => a + r.bot.fireBets, 0);
  const gw = m.res.reduce((a, r) => a + r.bot.gambleWins, 0), gn = m.res.reduce((a, r) => a + r.bot.gambles, 0);
  const streak3 = +(100 * days.filter(x => x.stats.maxStreak >= 4).length / days.length).toFixed(1);
  out[p] = { pass: m.pass, inc, hazRate: m.hazRate, gambleRate: m.gambleRate, firePerDay: m.firePerDay, breaks: m.breaks, leftover: m.leftover, double: m.double, firstT: med(ft), noT1: +(100 * (d1.length - ft.length) / d1.length).toFixed(1), collapse: m.collapse, depth: m.depth, blasts: m.blasts, share: m.share, score: m.score, treasures: m.treasures, chunkDone, tools, mines, fireMissRate: +(100 * fireMiss / Math.max(1, fireN)).toFixed(0), gambleWin: +(100 * gw / Math.max(1, gn)).toFixed(0), streak3 };
  console.log(p, JSON.stringify(out[p]));
}
require('fs').writeFileSync('out/main.json', JSON.stringify(out, null, 1));
