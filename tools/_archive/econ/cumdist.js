// 무구매로 납부일까지 누적 수입 분포(분위수) → 납부액 후보
const { fresh, med } = require('./lib.js');
const { B, env } = fresh();
const N = +(process.argv[2] || 100);
const ov = JSON.parse(process.argv[3] || '{}');
const C = env.CONFIG;
require('./applycfg.js')(env, ov);
C.payments.forEach(p => p.amount = 1);
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
for (const pol of (process.argv[4] || 'cautious,normal,greedy').split(',')) {
  const cum = { 3: [], 8: [], 15: [] }, seg = { 3: [], 8: [], 15: [] };
  for (let s = 1; s <= N; s++) {
    const r = B.playRun(env, 5000 + s, { policy: pol, spend: process.env.SPEND === '1' });
    let c = 0, sg = 0; r.days.forEach(x => { c += x.income; sg += x.income; if (cum[x.day]) { cum[x.day].push(c); seg[x.day].push(sg); sg = 0; } });
  }
  console.log(pol.padEnd(9), [3, 8, 15].map(d => `D${d} seg p10 ${q(seg[d], .1)} p40 ${q(seg[d], .4)} p50 ${q(seg[d], .5)} p80 ${q(seg[d], .8)} p01 ${q(seg[d], .01)}`).join(' | '));
}
