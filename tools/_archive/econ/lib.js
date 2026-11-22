'use strict';
// 측정 공통: 정책별 N판을 돌려 지표를 모은다
const path = require('path');
const BOT = '/home/claude/proto2/bot.js';
function fresh(htmlPath) {
  delete require.cache[require.resolve(BOT)];
  const B = require(BOT);
  const env = B.load(htmlPath);
  return { B, env };
}
function med(a) { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; }
function avg(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; }
function measure(B, env, N, opts, seed0) {
  const res = [];
  for (let s = 1; s <= N; s++) res.push(B.playRun(env, (seed0 || 1000) + s, opts));
  const C = env.CONFIG;
  const pass = [0, 0, 0];
  res.forEach(r => { for (let i = 0; i < 3; i++) if (r.final.stamps > i) pass[i]++; });
  const days = [].concat(...res.map(r => r.days));
  const byDay = {};
  days.forEach(x => { (byDay[x.day] = byDay[x.day] || []).push(x); });
  const inc = {}; for (const d in byDay) inc[d] = Math.round(avg(byDay[d].map(x => x.income)));
  const brk = days.reduce((a, x) => a + x.stats.breaks, 0), haz = days.reduce((a, x) => a + x.stats.hazDigs, 0);
  const gam = days.reduce((a, x) => a + (x.bot.gambles || 0), 0);
  const fire = days.reduce((a, x) => a + (x.bot.fireBets || 0) + (x.bot.fizzleProbes || 0), 0);
  const tLeft = res.reduce((a, r) => a + r.bot.tLeft, 0), tTot = res.reduce((a, r) => a + r.bot.tTotal, 0);
  // 평소의 2배: 같은 납부 구간(Day 1~3, 4~8, 9~15)에서 그날을 뺀 날들의 수입 중앙값의 2배 이상
  let dbl = 0, dblN = 0;
  const segOf = d => d <= 3 ? 0 : d <= 8 ? 1 : 2;
  res.forEach(r => { r.days.forEach(x => { const others = r.days.filter(y => y !== x && segOf(y.day) === segOf(x.day)).map(y => y.income); if (others.length < 2) return; const base = med(others); dblN++; if (base > 0 && x.income >= 2 * base) dbl++; }); });
  const d1 = byDay[1] || [];
  const firstT = d1.filter(x => x.stats.firstTreasureHit).map(x => x.stats.firstTreasureHit);
  const collapses = days.filter(x => x.collapsed).length;
  const lines = {}; days.forEach(x => { for (const k in x.lines) lines[k] = (lines[k] || 0) + x.lines[k]; });
  const totalL = Object.values(lines).reduce((a, b) => a + b, 0);
  const share = {}; for (const k in lines) share[k] = +(100 * lines[k] / totalL).toFixed(1);
  const scores = res.filter(r => r.final.success).map(r => r.final.score);
  return {
    n: N, pass: pass.map(p => +(100 * p / N).toFixed(1)), inc, hazRate: +(100 * (haz + fire) / (brk + fire)).toFixed(1), gambleRate: +(100 * gam / brk).toFixed(1), firePerDay: +(fire / days.length).toFixed(2),
    breaks: +(brk / days.length).toFixed(1), leftover: +(100 * tLeft / tTot).toFixed(1), double: +(100 * dbl / Math.max(1, dblN)).toFixed(1),
    firstT: med(firstT), collapse: +(100 * collapses / days.length).toFixed(1), depth: +avg(days.map(x => x.depth)).toFixed(2),
    blasts: +avg(days.map(x => x.stats.blasts)).toFixed(2), share, score: med(scores),
    treasures: +avg(days.map(x => x.stats.treasures)).toFixed(1),
    tools8: +avg(res.filter(r => r.days.length >= 8).map(r => r.days[7].owned.length)).toFixed(1),
    res
  };
}
function line(tag, m) {
  const I = m.inc;
  return `${tag.padEnd(14)} pass ${m.pass.join('/')} | inc D1 ${I[1]} D3 ${I[3]} D5 ${I[5]} D7 ${I[7]} D8 ${I[8]} D10 ${I[10]} D12 ${I[12]} D14 ${I[14]} D15 ${I[15]} | haz ${m.hazRate}% gam ${m.gambleRate}% fire ${m.firePerDay} brk ${m.breaks} left ${m.leftover}% x2 ${m.double}% col ${m.collapse}% dep ${m.depth} T ${m.treasures} bl ${m.blasts} tools8 ${m.tools8} score ${m.score}`;
}
module.exports = { fresh, measure, line, med, avg };
