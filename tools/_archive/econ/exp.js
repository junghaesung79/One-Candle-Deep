// node exp.js N '<json overrides for CONFIG>' '<json bot opts>' [policies]
const { fresh, measure, line } = require('./lib.js');
const { B, env } = fresh();
const N = +(process.argv[2] || 30);
const ov = JSON.parse(process.argv[3] || '{}');
const bo = JSON.parse(process.argv[4] || '{}');
const pols = (process.argv[5] || 'normal').split(',');
function deepSet(o, v) { for (const k in v) { if (v[k] && typeof v[k] === 'object' && !Array.isArray(v[k]) && o[k] && typeof o[k] === 'object' && !Array.isArray(o[k])) deepSet(o[k], v[k]); else o[k] = v[k]; } }
deepSet(env.CONFIG, ov);
if (ov.toolPrice) for (const id in ov.toolPrice) env.Core.TOOL_BY_ID[id].price = ov.toolPrice[id];
for (const p of pols) { const m = measure(B, env, N, Object.assign({ policy: p }, bo)); console.log(line(p, m)); if (process.env.SHARE) console.log('  ', JSON.stringify(m.share)); }
