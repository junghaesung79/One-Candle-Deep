module.exports = function apply(env, ov) {
  const C = env.CONFIG;
  for (const k in ov) {
    if (k === 'pay') ov.pay.forEach((a, i) => C.payments[i].amount = a);
    else if (k === 'rv') C.density.forEach(r => r.rv = ov.rv);
    else if (k === 'res') C.density.forEach(r => r.res = ov.res);
    else if (k === 'valueMul') ov.valueMul.forEach((v, i) => C.stages[i].valueMul = v);
    else if (k === 'startDepth') ov.startDepth.forEach((v, i) => C.stages[i].startDepth = v);
    else if (k === 'chunkV') [3, 8, 15].forEach((d, i) => C.chunks[d].value = ov.chunkV[i]);
    else if (k === 'orderMul') env.ORDERS.forEach(o => { if (o.reward.pocket) o.reward.pocket = Math.round(o.reward.pocket * ov.orderMul / 10) * 10; });
    else if (k === 'price') for (const id in ov.price) env.Core.TOOL_BY_ID[id].price = ov.price[id];
    else C[k] = ov[k];
  }
};
