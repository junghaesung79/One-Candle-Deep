// 봇 측정 보고서. npm run bot -- [보통 정책 판 수=100]
// 보통 정책 N판, 신중·욕심 정책 각 max(20, N/2)판, 소극 봇 20판, 첫 판 경로 10판을 돌리고
// 납부 통과율, 하루 수입, 위험 칸 도전 비율 같은 경제 지표를 찍어요. 경제 수치를 바꾸면 이걸로 다시 재요(05 문서 기준).
import { load, playRun } from './bot.js';

const env = load();
const { CONFIG } = env;
const RUNS = +(process.argv[2] || 100);

let fails = 0;
function check(cond: unknown, msg: string) { if (!cond) { fails++; console.log('FAIL:', msg); } }
function pct(a: number, b: number) { return b ? (100 * a / b).toFixed(1) + '%' : '-'; }
function avg(a: number[]) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; }

(function botRuns() {
  console.log(`== 봇 측정 (보통 정책 ${RUNS}판) ==`);
  const t0 = Date.now();
  const res: any[] = [];
  let errors = 0;
  for (let s = 1; s <= RUNS; s++) {
    try { res.push(playRun(env, 1000 + s, { policy: 'normal' })); } catch (e: any) { errors++; console.log('ERROR seed', 1000 + s, e.stack); }
  }
  // 신중(첫 판 고정 층)·욕심 정책도 예외 없이 끝까지
  const other: Record<string, any[]> = {};
  for (const pol of ['cautious', 'greedy'] as const) {
    other[pol] = [];
    for (let s = 1; s <= Math.max(20, RUNS >> 1); s++) { try { other[pol].push(playRun(env, 3000 + s, { policy: pol })); } catch (e: any) { errors++; console.log('ERROR', pol, e.stack); } }
  }
  // 계약 해지 경로 강제 확인: 걸기·발파를 안 하고 도구도 안 사는 소극 봇 20판
  let lazyVoid = 0;
  for (let s = 1; s <= 20; s++) { try { const r = playRun(env, 5000 + s, { lazy: true, spend: false }); if (!r.final.success) lazyVoid++; } catch (e: any) { errors++; console.log('ERROR lazy', e.stack); } }
  // 첫 판(고정 층) 경로
  for (let s = 0; s < 10; s++) { try { playRun(env, 0, { tutorial: true }); } catch (e: any) { errors++; console.log('ERROR tutorial', e.stack); } }
  check(errors === 0, '봇이 예외 없이 돌아요');
  const finished = res.filter(r => r.final && (r.final.success || r.final.day)).length;
  check(finished === res.length, '모든 판이 끝까지 가요');
  const pass = [0, 0, 0], reach = [0, 0, 0];
  res.forEach(r => { const st = r.final.stamps; for (let i = 0; i < 3; i++) { if (r.final.day >= CONFIG.payments[i].day) reach[i]++; if (st > i) pass[i]++; } });
  const days: any[] = res.flatMap(r => r.days);
  const byDay = (d: number) => days.filter(x => x.day === d);
  const breaks = avg(days.map(x => x.stats.breaks));
  const fire = days.reduce((a, x) => a + (x.bot.fireBets || 0), 0);
  const haz = days.reduce((a, x) => a + x.stats.hazDigs, 0) + fire, brk = days.reduce((a, x) => a + x.stats.breaks, 0) + fire;
  const gam = days.reduce((a, x) => a + (x.bot.gambles || 0), 0);
  const rule = days.reduce((a, x) => a + (x.bot.ruleDigs || 0), 0);
  const d1 = byDay(1);
  const firstT = d1.filter(x => x.stats.firstTreasureHit).map(x => x.stats.firstTreasureHit);
  const incomeAt = (d: number) => { const L = byDay(d); return L.length ? Math.round(avg(L.map(x => x.income))) : '-'; };
  const doubleDays = days.filter(x => x.day > 1).length;
  const scores = res.filter(r => r.final.success).map(r => r.final.score);
  console.log(`  예외 ${errors} · 끝까지 진행 ${finished}/${res.length} · 소극 봇 20판 중 계약 해지 ${lazyVoid} · ${((Date.now() - t0) / 1000).toFixed(1)}초`);
  console.log(`  [보통] 납부 통과율: 계약금 ${pct(pass[0], res.length)} · 중도금 ${pct(pass[1], res.length)} (도달 판 중 ${pct(pass[1], reach[1])}) · 잔금 ${pct(pass[2], res.length)} (도달 판 중 ${pct(pass[2], reach[2])})`);
  for (const pol in other) { const R = other[pol], P = [0, 1, 2].map(i => R.filter(r => r.final.stamps > i).length); console.log(`  [${pol === 'cautious' ? '신중' : '욕심'}] 납부 통과율 ${P.map(p => pct(p, R.length)).join(' · ')} (${R.length}판)`); }
  console.log(`  하루 깨는 칸 ${breaks.toFixed(1)} · 위험 칸 도전 비율 ${pct(haz, brk)} (아는 보물 ${pct(rule, brk)}, 곡괭이로 걸기 ${pct(gam, brk)}, 불로 걸기 ${pct(fire, brk)}) · 하루 발파 ${avg(days.map(x => x.stats.blasts)).toFixed(2)}`);
  console.log(`  첫 보물까지 치기(Day 1) 중앙값 ${firstT.sort((a, b) => a - b)[firstT.length >> 1]} · Day 1 보물 0개 ${pct(d1.length - firstT.length, d1.length)}`);
  console.log(`  하루 수입 평균: Day 1 ${incomeAt(1)} · Day 3 ${incomeAt(3)} · Day 8 ${incomeAt(8)} · Day 15 ${incomeAt(15)} · 쓰러진 날 ${pct(days.filter(x => x.collapsed).length, days.length)}`);
  console.log(`  도달 깊이 평균 ${avg(days.map(x => x.depth)).toFixed(1)} · 최대 줄 ×3 이상 찍은 날 ${pct(days.filter(x => x.stats.maxStreak >= 4).length, days.length)} · 주문 완료 ${pct(days.filter(x => x.order && x.order.done).length, days.filter(x => x.order).length)}`);
  if (scores.length) console.log(`  잔금 뒤 남긴 돈(점수) 중앙값 ${scores.sort((a, b) => a - b)[scores.length >> 1]}`);
  module.exports.summary = { pass, reach, n: res.length };
})();

console.log(fails ? `\n실패 ${fails}건` : '\n전부 통과');
process.exitCode = fails ? 1 : 0;
