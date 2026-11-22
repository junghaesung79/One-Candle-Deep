// 도구 하나를 Day 1부터 가진 채(구매 없음) 15일 → 하루 수입 변화. 조합도 몇 개
const { fresh, avg } = require('./lib.js');
const { B, env } = fresh();
const C = env.CONFIG; C.payments.forEach(p => p.amount = 1);
const ov = JSON.parse(process.argv[3] || '{}'); Object.assign(C, ov);
const N = +(process.argv[2] || 40);
const pol = process.argv[4] || 'normal';
function run(tools) {
  const inc = [], col = [], haz = [], brk = [];
  for (let s = 1; s <= N; s++) { const r = B.playRun(env, 4000 + s, { policy: pol, spend: false, startTools: tools, mutations: {} });
    r.days.forEach(x => { if (C.payments.some(p => p.day === x.day)) return; inc.push(x.income); col.push(x.collapsed ? 1 : 0); haz.push(x.stats.hazDigs + (x.bot.fireBets || 0)); brk.push(x.stats.breaks + (x.bot.fireBets || 0)); }); }
  return { inc: avg(inc), col: avg(col), haz: haz.reduce((a, b) => a + b, 0) / brk.reduce((a, b) => a + b, 0) };
}
const base = run([]);
console.log('base', Math.round(base.inc), (100 * base.col).toFixed(1) + '%', (100 * base.haz).toFixed(1) + '%');
const ids = env.TOOLS.filter(t => t.kind === 'passive').map(t => t.id);
const sets = ids.map(i => [i]).concat(JSON.parse(process.argv[5] || '[]'));
for (const t of sets) { const r = run(t); console.log(t.join('+').padEnd(36), 'inc', Math.round(r.inc), '(' + (r.inc / base.inc * 100 - 100).toFixed(0) + '%)', 'col', (100 * r.col).toFixed(1) + '%', 'haz', (100 * r.haz).toFixed(1) + '%'); }
