// 광맥 하나만 나오게 하고(첫 층은 맨땅) 하루 수입·위험 칸 도전·남긴 보물. 보통, 무구매, 변덕 없음
const { fresh, measure, avg } = require('./lib.js');
const { B, env } = fresh();
const C = env.CONFIG; C.payments.forEach(p => p.amount = 1);
const N = +(process.argv[2] || 40);
for (const r of env.RULE_IDS) {
  C.rulePool = [r];
  const m = measure(B, env, N, { policy: process.argv[3] || 'normal', spend: false, mutations: {} });
  const days = [].concat(...m.res.map(x => x.days)).filter(x => ![3, 8, 15].includes(x.day));
  console.log(r.padEnd(9), 'income(평일)', Math.round(avg(days.map(x => x.income))), 'haz', m.hazRate + '%', 'left', m.leftover + '%', 'col', m.collapse + '%', 'T/day', m.treasures);
}
