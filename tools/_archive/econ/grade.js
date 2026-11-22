const { fresh, measure, avg } = require('./lib.js');
const { B, env } = fresh();
const C = env.CONFIG; C.payments.forEach(p => p.amount = 1);
const N = +(process.argv[2] || 60);
const pools = { g1: ['plain', 'border', 'pair', 'lonely'], g2: ['plain', 'border', 'pair', 'lonely', 'rows', 'tally'], g3: ['plain', 'border', 'pair', 'lonely', 'rows', 'tally', 'minepair'], g6: ['border', 'pair', 'lonely', 'rows', 'tally', 'minepair'] };
for (const pol of ['cautious', 'normal']) for (const g in pools) {
  C.rulePool = pools[g];
  const m = measure(B, env, N, { policy: pol, spend: false, mutations: {} });
  const days = [].concat(...m.res.map(x => x.days)).filter(x => ![3, 8, 15].includes(x.day));
  console.log(pol.padEnd(8), g, 'weekday income', Math.round(avg(days.map(x => x.income))), 'haz', m.hazRate, 'left', m.leftover);
}
