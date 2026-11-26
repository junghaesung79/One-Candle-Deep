// 도구 하나의 효과(05 8.4 방식): 보통 봇이 그 도구 하나를 Day 1부터 들고 무구매로 15일. 평일 하루 수입 평균
// npx tsx bot/onetool.ts <도구 id 또는 none> [판 수]
import { load, playRun } from './bot.js';
const env: any = load();
const id = process.argv[2] || 'none', N = +(process.argv[3] || 60);
const inc: number[] = [];
for (let s = 1; s <= N; s++) {
  const r = playRun(env, 4000 + s, { policy: 'normal', spend: false, noGift: true, startTools: id === 'none' ? [] : [id] });
  r.days.forEach((d: any) => { if (!env.Core.paymentFor(d.day, r.run)) inc.push(d.income); });
}
console.log(JSON.stringify({ id, weekday: Math.round(inc.reduce((a, b) => a + b, 0) / inc.length) }));
