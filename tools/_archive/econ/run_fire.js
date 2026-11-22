const { fresh, measure, line } = require('./lib.js');
const { B, env } = fresh();
const N = +(process.argv[2] || 40);
for (const fz of ['keep', 'scorch', 'melt']) {
  env.CONFIG.fizzle = fz;
  for (const v of [{}, { fireThr: 0.35, fireUp: 0.1 }, { fizzleProbe: 0.3 }]) {
    const m = measure(B, env, N, Object.assign({ policy: 'normal' }, v));
    console.log(line(fz + ' ' + (v.fireThr ? 'fire' : v.fizzleProbe ? 'probe' : 'none'), m));
  }
}
