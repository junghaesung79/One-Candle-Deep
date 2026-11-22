const { fresh } = require('./lib.js');
const { B, env } = fresh();
const Core = env.Core;
const agg = {};
const orig = B.Bot.prototype.leaveFloor;
B.Bot.prototype.leaveFloor = function (f) {
  if (f && !f.__counted) {
    const D = Core.deduce(f);
    const a = agg[f.rule] = agg[f.rule] || { n: 0, haz: 0, unk: 0, kT: 0, kM: 0, cov: 0, T: 0, Tl: 0, dugT: 0, open: 0 };
    a.n++;
    const hz = D.haz.length; a.haz += hz;
    a.kT += D.tre.length; a.kM += D.mine.length; a.unk += hz - D.tre.length - D.mine.length;
    a.cov += f.cells.filter(c => c.cover !== 'open').length;
    const T = f.cells.filter(c => c.haz === 'treasure'); a.T += T.length; a.Tl += T.filter(c => !c.removed).length;
  }
  return orig.call(this, f);
};
for (let s = 1; s <= 40; s++) B.playRun(env, 1000 + s, { policy: 'normal' });
for (const r in agg) { const a = agg[r]; const k = x => (x / a.n).toFixed(1); console.log(r.padEnd(9), 'floors', a.n, 'cov', k(a.cov), 'hazKnown', k(a.haz), 'unkId', k(a.unk), 'knownT', k(a.kT), 'knownM', k(a.kM), 'T', k(a.T), 'Tleft', k(a.Tl)); }
