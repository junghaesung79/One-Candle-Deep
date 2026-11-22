const { fresh } = require('./lib.js');
const { B, env } = fresh();
require('./applycfg.js')(env, JSON.parse(process.argv[2]));
const Core = env.Core;
const orig = B.Bot.prototype.dig;
let shown = 0; const src = {};
B.Bot.prototype.dig = function (run, c, kind) {
  if (kind === 'gambles') {
    const D = this.deduce(run); const p = this.pTreasure(run, D, c);
    if (p >= 0.9) {
      const f = run.d.floor, fc = this.floorCounts(run, D);
      const lensN = Core.neighbors(f, c.x, c.y).some(n => n.cover === 'open' && n.lens);
      const key = (lensN ? 'lens' : '') + (fc.base >= 0.9 ? 'base' : '') + (f.rule === 'tally' && this.useRule ? 'tally' : '') + (c.probe ? 'probe' : '') + (c.fizzle ? 'fizzle' : '');
      const s = src[key] = src[key] || [0, 0]; s[0]++; if (c.haz === 'treasure') s[1]++;
      if (shown < 4 && key === 'base' && c.haz === 'mine') { shown++; console.log('rule', f.rule, 'depth', f.depth, JSON.stringify(fc), 'twin', f.twin, 'actual T left', f.cells.filter(z => z.haz === 'treasure' && !z.removed).length, 'M left', f.cells.filter(z => z.haz === 'mine' && !z.removed).length); }
    }
  }
  return orig.call(this, run, c, kind);
};
for (let s = 1; s <= 40; s++) B.playRun(env, 6000 + s, { policy: 'normal' });
console.log(src);
