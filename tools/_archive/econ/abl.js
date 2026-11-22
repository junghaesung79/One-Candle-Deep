const { fresh, measure } = require('./lib.js');
const { B, env } = fresh();
const [tag, cfgJ, boJ, pols] = process.argv.slice(2);
const cfg = JSON.parse(cfgJ || '{}'), bo = JSON.parse(boJ || '{}');
for (const k in cfg) { if (typeof cfg[k] === 'object' && !Array.isArray(cfg[k]) && env.CONFIG[k]) Object.assign(env.CONFIG[k], cfg[k]); else env.CONFIG[k] = cfg[k]; }
if (cfg.pay) cfg.pay.forEach((a, i) => env.CONFIG.payments[i].amount = a);
for (const p of (pols || 'cautious,normal,greedy').split(',')) {
  const m = measure(B, env, +(process.env.N || 100), Object.assign({ policy: p }, bo));
  const I = m.inc, avg = a => Math.round(a.reduce((x, y) => x + y, 0) / a.length);
  console.log(tag.padEnd(12), p.padEnd(8), 'pass', m.pass.join('/'), 'D1', I[1], 'D8', I[8], 'D9-14', avg([9,10,11,12,13,14].map(d => I[d] || 0)), 'D15', I[15], 'haz', m.hazRate, 'left', m.leftover, 'x2', m.double, 'col', m.collapse);
}
