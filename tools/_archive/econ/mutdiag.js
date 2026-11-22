// 변덕이 유리한가: 모든 날에 같은 변덕을 걸고(같은 난수) 하루 수입·쓰러짐·위험 칸 도전을 비교
const { fresh, avg } = require('./lib.js');
const { B, env } = fresh();
const C = env.CONFIG; C.payments.forEach(p => p.amount = 1);
const N = +(process.argv[2] || 40);
const pols = (process.argv[3] || 'normal').split(',');
for (const pol of pols) for (const mu of [null, 'twin', 'quake', 'blur', 'sleepy', 'twin+quake']) {
  const plan = {}; for (let d = 1; d <= 15; d++) plan[d] = mu ? mu.split('+') : [];
  const inc = [], col = [], dep = [], haz = [], brk = [], ch = [], treas = [];
  for (let s = 1; s <= N; s++) {
    const r = B.playRun(env, 3000 + s, { policy: pol, spend: false, mutations: plan });
    r.days.forEach(x => { if (C.payments.some(p => p.day === x.day)) return; inc.push(x.income); col.push(x.collapsed ? 1 : 0); dep.push(x.depth); haz.push(x.stats.hazDigs + (x.bot.fireBets || 0)); brk.push(x.stats.breaks + (x.bot.fireBets || 0)); treas.push(x.stats.treasures); });
  }
  console.log(pol.padEnd(8), (mu || 'none').padEnd(11), 'income', Math.round(avg(inc)), 'collapse', (100 * avg(col)).toFixed(1) + '%', 'depth', avg(dep).toFixed(2), 'treasures', avg(treas).toFixed(1), 'haz', (100 * haz.reduce((a, b) => a + b, 0) / brk.reduce((a, b) => a + b, 0)).toFixed(1) + '%');
}
