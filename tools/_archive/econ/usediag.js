const { fresh } = require('./lib.js'); const { env } = fresh(); const Core = env.Core;
for (const rule of env.RULE_IDS) { if (rule === 'plain') continue;  let ok = 0, t0 = Date.now(), n = 300, sum = 0;
  for (let s = 0; s < n; s++) { const depth = 1 + (s % 6); const f = Core.genFloor({ depth, rule, sx: 7, sy: 5, seed: Core.hashSeed(s, 31, depth) }); if (f.useful) ok++; sum += f.usefulT || 0; }
  console.log(rule.padEnd(9), 'useful', (100 * ok / n).toFixed(0) + '%', 'avg T confirmed', (sum / n).toFixed(1), 'ms/floor', ((Date.now() - t0) / n).toFixed(1)); }
