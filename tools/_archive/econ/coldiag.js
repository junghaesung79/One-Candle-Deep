const { fresh } = require('./lib.js');
const { B, env } = fresh();
require('./applycfg.js')(env, JSON.parse(process.argv[2]));
const agg = {}; let days = 0, col = 0;
for (let s = 1; s <= 60; s++) { const r = B.playRun(env, 6000 + s, { policy: process.argv[3] || 'normal' }); days += r.days.length; col += r.days.filter(x => x.collapsed).length; for (const k in r.bot) if (k.startsWith('mine_')) agg[k] = (agg[k] || 0) + r.bot[k]; }
console.log('days', days, 'collapses', col); for (const k in agg) console.log(k, (agg[k] / days).toFixed(2), 'per day');
