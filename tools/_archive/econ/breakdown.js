'use strict';
const { load, playRun } = require('/home/claude/proto2/bot.js');
const env = load();
const N = +(process.argv[2] || 40);
const opts = process.argv[3] ? JSON.parse(process.argv[3]) : {};
const agg = {};
for (let s = 1; s <= N; s++) {
  const r = playRun(env, 1000 + s, opts);
  r.run.history.forEach(h => {
    const a = agg[h.day] = agg[h.day] || { n: 0, inc: 0, br: 0, haz: 0, depth: 0, t: 0, mines: 0, blasts: 0, bm: 0 };
    a.n++; a.inc += h.income; a.br += h.stats.breaks; a.haz += h.stats.hazDigs; a.depth += h.depth; a.t += h.stats.treasures; a.mines += h.stats.mines; a.blasts += h.stats.blasts; a.bm += h.stats.blastMines;
  });
}
for (const d in agg) { const a = agg[d]; console.log(d, a.n, 'inc', Math.round(a.inc / a.n), 'br', (a.br / a.n).toFixed(1), 'haz', (a.haz / a.n).toFixed(1), 'dep', (a.depth / a.n).toFixed(1), 'T', (a.t / a.n).toFixed(1), 'mines', (a.mines / a.n).toFixed(2), 'blasts', (a.blasts / a.n).toFixed(1), 'bm', (a.bm/a.n).toFixed(1)); }
