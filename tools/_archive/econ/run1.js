const { fresh, measure, line } = require('./lib.js');
const { B, env } = fresh();
const N = +(process.argv[2] || 40);
for (const p of ['cautious', 'normal', 'greedy']) {
  const m = measure(B, env, N, { policy: p });
  console.log(line(p, m)); console.log('   share', JSON.stringify(m.share));
}
