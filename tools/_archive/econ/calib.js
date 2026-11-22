// node calib.js N '<config json>' → 정책 셋의 통과율·수입 곡선
const { fresh, measure, line } = require('./lib.js');
const { B, env } = fresh();
const N = +(process.argv[2] || 100);
const ov = JSON.parse(process.argv[3] || '{}');
const pols = (process.argv[4] || 'cautious,normal,greedy').split(',');
const bo = JSON.parse(process.argv[5] || '{}');
function apply(C, ov) {
  for (const k in ov) {
    if (k === 'pay') ov.pay.forEach((a, i) => C.payments[i].amount = a);
    else if (k === 'rv') C.density.forEach(r => r.rv = ov.rv);
    else if (k === 'res') C.density.forEach(r => r.res = ov.res);
    else if (k === 'valueMul') ov.valueMul.forEach((v, i) => C.stages[i].valueMul = v);
    else if (k === 'chunkV') [3, 8, 15].forEach((d, i) => C.chunks[d].value = ov.chunkV[i]);
    else if (k === 'orderMul') env.ORDERS.forEach(o => { if (o.reward.pocket) o.reward.pocket = Math.round(o.reward.pocket * ov.orderMul / 10) * 10; });
    else if (k === 'price') for (const id in ov.price) env.Core.TOOL_BY_ID[id].price = ov.price[id];
    else C[k] = ov[k];
  }
}
apply(env.CONFIG, ov);
const out = {};
for (const p of pols) { const m = measure(B, env, N, Object.assign({ policy: p }, bo)); out[p] = m; console.log(line(p, m)); if (process.env.SHARE) console.log('   ', JSON.stringify(m.share)); }
module.exports = out;
