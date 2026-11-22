// 납부 직전 금고 분포 → 목표 통과율에 맞는 납부액(조건부: 앞 납부를 통과한 판 기준)
const { fresh } = require('./lib.js');
const { B, env } = fresh();
const N = +(process.argv[2] || 100);
require('./applycfg.js')(env, JSON.parse(process.argv[3] || '{}'));
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s[Math.max(0, Math.min(s.length - 1, Math.floor(p * s.length)))]; };
const T = { cautious: [0.9, 0.5, 0.2], normal: [0.99, 0.85, 0.6], greedy: [0.99, 0.85, 0.6] };
for (const pol of (process.argv[4] || 'cautious,normal,greedy').split(',')) {
  const before = [[], [], []]; let pass = [0, 0, 0];
  for (let s = 1; s <= N; s++) { const r = B.playRun(env, 7000 + s, { policy: pol }); r.pays.forEach((p, i) => { before[i].push(p.before); if (p.ok) pass[i]++; }); }
  // 무조건 통과율 목표 → 조건부 분위수: 앞 납부 통과율 P(i-1), 목표 t_i → 조건부 t_i / P(i-1)
  const amt = env.CONFIG.payments.map(p => p.amount);
  console.log(pol.padEnd(9), 'pass', pass.map(p => (100 * p / N).toFixed(0)).join('/'), '| before p01/p10/p40/p50/p80:', before.map((b, i) => `[${i}] n${b.length} ${q(b, .01)}/${q(b, .1)}/${q(b, .4)}/${q(b, .5)}/${q(b, .8)}`).join(' '));
}
