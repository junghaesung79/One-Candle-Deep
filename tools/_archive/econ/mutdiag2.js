const { fresh, avg } = require('./lib.js');
const { B, env } = fresh();
const C = env.CONFIG; C.payments.forEach(p => p.amount = 1);
const N = +(process.argv[2] || 40);
for (const tb of [false, true]) for (const extra of [0, 4]) {
  C.twinBoth = tb; const base = C.density.map(r => r.m);
  C.density.forEach((r, i) => r.m = base[i]);
  for (const mu of [null, 'twin']) {
    if (mu && extra) C.density.forEach((r, i) => r.m = base[i] + extra); else C.density.forEach((r, i) => r.m = base[i]);
    const plan = {}; for (let d = 1; d <= 15; d++) plan[d] = mu ? [mu] : [];
    const inc = [], col = [];
    for (let s = 1; s <= N; s++) { const r = B.playRun(env, 3000 + s, { policy: 'normal', spend: false, mutations: plan }); r.days.forEach(x => { if (C.payments.some(p => p.day === x.day)) return; inc.push(x.income); col.push(x.collapsed ? 1 : 0); }); }
    console.log('twinBoth', tb, 'mines+', mu ? extra : 0, (mu || 'none').padEnd(5), 'income', Math.round(avg(inc)), 'collapse', (100 * avg(col)).toFixed(1) + '%');
  }
  C.density.forEach((r, i) => r.m = base[i]);
}
