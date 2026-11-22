// 최종값 측정 4: 변덕을 모든 날에 걸었을 때(같은 난수) 평일 수입·쓰러짐 / 실제 배정에서 Day 8 변덕별 중도금 통과율
const { fresh, measure, avg } = require('./lib.js');
const { B, env } = fresh();
const N = 60, out = { allDays: [], byAssign: {} };
for (const pol of ['cautious', 'normal', 'greedy']) for (const mu of [null, 'twin', 'quake', 'sleepy', 'blur', 'twin+quake']) {
  const plan = {}; for (let d = 1; d <= 15; d++) plan[d] = mu ? mu.split('+') : [];
  const C = env.CONFIG; const save = C.payments.map(p => p.amount); C.payments.forEach(p => p.amount = 1);
  const m = measure(B, env, N, { policy: pol, spend: false, mutations: plan });
  C.payments.forEach((p, i) => p.amount = save[i]);
  const days = [].concat(...m.res.map(r => r.days)).filter(x => ![3, 8, 15].includes(x.day));
  const row = { policy: pol, mut: mu || '없음', income: Math.round(avg(days.map(x => x.income))), collapse: +(100 * avg(days.map(x => x.collapsed ? 1 : 0))).toFixed(1), haz: m.hazRate, depth: +avg(days.map(x => x.depth)).toFixed(2) };
  out.allDays.push(row); console.log(JSON.stringify(row));
}
// 실제 배정(판마다 무작위)에서 Day 8 변덕별 중도금 통과율, Day 15 변덕 조합별 잔금 통과율(보통·욕심 200판씩)
for (const pol of ['cautious', 'normal', 'greedy']) {
  const by8 = {}, by15 = {};
  for (let s = 1; s <= 200; s++) {
    const r = B.playRun(env, 9000 + s, { policy: pol });
    const m8 = (r.run.mutationPlan[8] || []).join('+'), m15 = (r.run.mutationPlan[15] || []).slice().sort().join('+');
    if (r.final.stamps >= 1) { (by8[m8] = by8[m8] || [0, 0])[0]++; if (r.final.stamps >= 2) by8[m8][1]++; }
    if (r.final.stamps >= 2) { const tw = m15.includes('twin') ? '쌍둥이 지뢰 포함' : '쌍둥이 지뢰 없음'; (by15[tw] = by15[tw] || [0, 0])[0]++; if (r.final.stamps >= 3) by15[tw][1]++; }
  }
  out.byAssign[pol] = { by8, by15 }; console.log(pol, JSON.stringify(by8), JSON.stringify(by15));
}
require('fs').writeFileSync('out/mut.json', JSON.stringify(out, null, 1));
