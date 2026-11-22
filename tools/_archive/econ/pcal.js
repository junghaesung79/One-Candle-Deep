const { fresh } = require('./lib.js');
const { B, env } = fresh();
require('./applycfg.js')(env, JSON.parse(process.argv[2]));
const Core = env.Core;
const orig = B.Bot.prototype.dig;
const bk = {};
B.Bot.prototype.dig = function (run, c, kind) {
  if (kind === 'gambles') { const D = this.deduce(run); const p = this.pTreasure(run, D, c); const b = Math.min(9, Math.floor(p * 10)); const isT = c.haz === 'treasure' || c.haz === 'chunk'; (bk[b] = bk[b] || [0, 0, 0])[0]++; if (isT) bk[b][1]++; if (run.d.hp === 1) bk[b][2]++; }
  return orig.call(this, run, c, kind);
};
for (let s = 1; s <= 60; s++) B.playRun(env, 6000 + s, { policy: process.argv[3] || 'normal' });
for (const b in bk) console.log('p ' + b / 10 + '-' + (+b + 1) / 10, 'n', bk[b][0], 'actualT', (bk[b][1] / bk[b][0]).toFixed(2), 'at hp1', bk[b][2]);
