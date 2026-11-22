const { fresh, measure, line } = require('./lib.js');
const { B, env } = fresh();
const N = +(process.argv[2] || 40);
for (const fs of [false, true]) {
  env.CONFIG.fizzleScorch = fs;
  for (const fp of [0, 0.3]) {
    const m = measure(B, env, N, { policy: 'normal', fizzleProbe: fp || false });
    const fpN = m.res.reduce((a, r) => a + r.bot.fizzleProbes, 0) / m.res.reduce((a, r) => a + r.days.length, 0);
    console.log(line(`fs${+fs} fp${fp}`, m), 'fizzProbe/day', fpN.toFixed(2));
  }
}
