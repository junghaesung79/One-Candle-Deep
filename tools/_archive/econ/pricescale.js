const { fresh, measure } = require('./lib.js');
const { B, env } = fresh();
const N = +(process.argv[2] || 100);
const base = {}; env.TOOLS.forEach(t => base[t.id] = t.price);
const ref = env.Core.TOOL_BY_ID.refiner;
if (process.argv[4] === 'refNoStreak') ref.hooks.on_blast_mine = function (ctx, ev) { if (ev.n >= env.CONFIG.refinerMin) ctx.treasure(ev.x, ev.y, env.CONFIG.treasureValue[1], '정제기', { noStreak: true }); };
for (const k of JSON.parse(process.argv[3] || '[1,0.6]')) {
  env.TOOLS.forEach(t => t.price = Math.round(base[t.id] * k / 10) * 10);
  for (const [pol, o] of [['normal', {}], ['normal', { spend: false }], ['cautious', {}], ['greedy', {}]]) {
    if (o.spend === false && k !== 1) continue;
    const m = measure(B, env, N, Object.assign({ policy: pol }, o));
    const sc = m.res.filter(r => r.final.success).map(r => r.final.score).sort((a, b) => a - b);
    console.log('price×' + k, pol, o.spend === false ? 'nobuy' : 'buy', 'pass', m.pass.join('/'), 'd14', m.inc[14], 'tools8', m.tools8, 'score med', sc[sc.length >> 1] || 0);
  }
}
