// 2차 프로토타입 검사. node test_core.js [판 수=100]
// 1) 광맥 규칙 생성기 7종 × 1,000층: 규칙 준수, 기본 제약, '숫자·규칙·밑줄만으로 계단까지' 풀리는 비율
// 2) 규칙 단위 검사(1타, 촛불, 통행, 노다지 줄, 발파, 불씨, 쓰러짐, 납부·해지)
// 3) 봇 100판(15일, 계약 해지 경로 포함)을 예외 없이 끝까지 + 기본 지표
'use strict';
const { load, Bot, playRun } = require('./bot.js');
const env = load();
const { Core, CONFIG, RULE_IDS, RULES } = env;
const RUNS = +(process.argv[2] || 100);

let fails = 0;
function check(cond, msg) { if (!cond) { fails++; console.log('FAIL:', msg); } }
function pct(a, b) { return b ? (100 * a / b).toFixed(1) + '%' : '-'; }
function avg(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; }

// ---------- 1. 생성기 ----------
(function genTests() {
  console.log('== 1. 광맥 규칙 생성기 (규칙마다 1,000층, 깊이 1~9 고르게) ==');
  const t0 = Date.now();
  for (const rule of RULE_IDS) {
    let ok = 0, ruleOk = 0, solv = 0, relaxed = 0, att = 0, chainSum = 0, bad = 0;
    for (let s = 0; s < 1000; s++) {
      const depth = 1 + (s % 9);
      const f = Core.genFloor({ depth, rule, sx: CONFIG.START.x, sy: CONFIG.START.y, seed: Core.hashSeed(s, depth, rule.length * 31), twin: false });
      att += f.attempts; if (f.relaxed) relaxed++;
      if (Core.checkRule(f)) ruleOk++; else bad++;
      if (f.ok) ok++;
      if (f.solvable) solv++;
      chainSum += Core.startChainSize(f);
      // 시작 3×3 안전, 계단 1개, 숫자 상한
      for (let y = CONFIG.START.y - 1; y <= CONFIG.START.y + 1; y++) for (let x = CONFIG.START.x - 1; x <= CONFIG.START.x + 1; x++) {
        const c = Core.cellAt(f, x, y); if (c.haz || c.stair) { check(false, rule + ' start 3x3 not safe'); }
      }
      check(f.cells.filter(c => c.stair).length === 1, rule + ' exactly one stair');
      if (f.ok) for (const c of f.cells) if (!c.haz && Core.numAt(f, c) > CONFIG.numberCap) check(false, rule + ' number cap');
    }
    check(bad === 0, rule + ' rule violations ' + bad);
    console.log(`  ${RULES[rule].name.padEnd(7)} 규칙 준수 ${ruleOk}/1000 · 제약 통과 ${ok} · 계단까지 풀림 ${pct(solv, 1000)} · 평균 시도 ${(att / 1000).toFixed(1)} · 완화 ${relaxed} · 시작 와르르 평균 ${(chainSum / 1000).toFixed(0)}칸`);
  }
  // 쌍둥이 지뢰 변덕 + 덩이 층
  let tw = 0, ch = 0, chOk = 0;
  for (let s = 0; s < 300; s++) {
    const f = Core.genFloor({ depth: 5, rule: RULE_IDS[s % 7], sx: 7, sy: 5, seed: Core.hashSeed(s, 88), twin: true });
    if (Core.checkRule(f)) tw++;
    const g = Core.genFloor({ depth: 6, rule: ['plain', 'lonely', 'border'][s % 3], sx: 7, sy: 5, seed: Core.hashSeed(s, 89), chunk: { w: 3, h: 2, value: 1200 } });
    if (g.chunk) { ch++; if (Core.checkRule(g) && g.cells.filter(c => c.chunk).length === 6) chOk++; }
  }
  check(tw === 300, 'twin mines rule ' + tw);
  check(chOk === 300, 'chunk floors ' + chOk + '/' + ch);
  console.log(`  쌍둥이 지뢰 변덕 규칙 준수 ${tw}/300 · 3×2 덩이 층 ${chOk}/300 · ${((Date.now() - t0) / 1000).toFixed(1)}초`);
})();

// ---------- 2. 규칙 단위 검사 ----------
(function ruleTests() {
  console.log('== 2. 규칙 단위 검사 ==');
  const run = Core.newRun(4242);
  check(run.phase === 'deed', 'day1 starts at deed');
  Core.startDay(run);
  const d = run.d, f = d.floor;
  check(d.candle === CONFIG.candleMax || run.gang, 'candle 80');
  check(d.hp === 3 && d.probes >= 2, 'hp 3 probes 2');
  check(f.cells.filter(c => c.cover === 'open').length >= CONFIG.startChainMin, 'start chain');
  // 1타: 안전 확정 칸 하나 깨기
  const D = Core.deduce(f);
  const sc = D.safe.map(i => f.cells[i])[0];
  if (sc) {
    Core.approach(run, sc.x, sc.y);
    const c0 = d.candle, r = Core.hit(run, sc.x, sc.y);
    check(r.ok && sc.cover === 'open', 'one hit breaks');
    check(d.candle === c0 - 1, 'hit costs 1');
  }
  // 노다지 줄 / 지뢰 / 주머니
  const r2 = Core.newRun(99); Core.startDay(r2);
  const d2 = r2.d, f2 = d2.floor;
  const tr = f2.cells.filter(c => c.haz === 'treasure' && c.cover !== 'open');
  // 강제로 옆에 세워서 친다(테스트 전용)
  function forceHit(run, c) { const dd = run.d, fl = dd.floor; const nb = Core.neighbors(fl, c.x, c.y)[0]; nb.cover = 'open'; dd.px = nb.x; dd.py = nb.y; return Core.hit(run, c.x, c.y); }
  const p0 = d2.pocket;
  forceHit(r2, tr[0]);
  check(d2.streak === 1 && Core.streakMult(r2) === 1.5, 'streak to x1.5 after first treasure');
  const v1 = CONFIG.treasureValue[tr[1].tier];
  const pb = d2.pocket; forceHit(r2, tr[1]);
  check(d2.pocket - pb >= Math.round(v1 * 1.5) && d2.streak === 2, 'second treasure x1.5');
  const mn = f2.cells.find(c => c.haz === 'mine' && c.cover !== 'open');
  forceHit(r2, mn);
  check(d2.hp === 2 && d2.streak === 0, 'mine: hp-1, streak reset');
  // 발파: X 지뢰 점화, 피해 없음, 초 3
  const mn2 = f2.cells.find(c => c.haz === 'mine' && c.cover !== 'open');
  if (mn2) {
    const nb = Core.neighbors(f2, mn2.x, mn2.y)[0]; nb.cover = 'open'; d2.px = nb.x; d2.py = nb.y;
    d2.streak = 2;
    Core.mark(r2, mn2.x, mn2.y, 1);
    const hp0 = d2.hp, c0 = d2.candle;
    const rb = Core.ignite(r2, mn2.x, mn2.y);
    check(rb.ok && rb.mines >= 1 && d2.hp === hp0 && mn2.removed, 'blast removes mine without damage');
    check(d2.candle === c0 - CONFIG.igniteCost, 'blast costs 3');
    check(d2.streak >= 2, 'blast keeps streak');
  }
  // 불발: X 아닌 칸에 점화 불가, 지뢰 아닌 X는 촛불만
  const safeC = f2.cells.find(c => !c.haz && !c.stair && c.cover !== 'open');
  if (safeC) {
    const nb = Core.neighbors(f2, safeC.x, safeC.y)[0]; nb.cover = 'open'; d2.px = nb.x; d2.py = nb.y;
    check(!Core.ignite(r2, safeC.x, safeC.y).ok, 'ignite needs X');
    Core.mark(r2, safeC.x, safeC.y, 1);
    const c0 = d2.candle; const rf = Core.ignite(r2, safeC.x, safeC.y);
    check(rf.ok && rf.mines === 0 && d2.candle === c0 - 3 && safeC.fizzle && safeC.cover !== 'open', 'fizzle costs candle only');
  }
  // 불씨 다섯 번 → 지뢰면 쓰러짐, 주머니 절반
  d2.candle = 1; d2.pocket = 400;
  const any = f2.cells.find(c => c.cover !== 'open' && !c.haz && !c.stair);
  forceHit(r2, any);
  check(d2.embersOn && d2.embers === 5, 'embers start at 5');
  const mn3 = f2.cells.find(c => c.haz === 'mine' && c.cover !== 'open');
  if (mn3) {
    const pk = d2.pocket;
    forceHit(r2, mn3);
    check(r2.phase === 'settle' && r2.settle.reason === 'collapse' && r2.settle.lost === Math.floor(pk * 0.5), 'ember mine → collapse, lose half');
  }
  // 통행 촛불 = 2 + 도착 층
  check(Core.travelCost({ gang: null, d: {} }, 2) === 4 && Core.travelCost({ gang: null, d: {} }, 6) === 8, 'travel cost 2+depth');
  // 납부 실패 → 계약 해지
  const r3 = Core.newRun(7);
  for (let k = 0; k < 3; k++) Core.debugSkipDay(r3);
  check(r3.phase === 'final' && r3.final && !r3.final.success && r3.final.day === 3, 'payment fail on day 3 ends run (got ' + r3.phase + ')');
  // 납부 성공 → 도장, 금고에서 빠짐
  const r4 = Core.newRun(8);
  Core.debugSkipDay(r4); Core.debugSkipDay(r4);
  Core.startDay(r4); r4.d.pocket = 700; Core.returnUp(r4); Core.afterSettle(r4);
  check(r4.phase === 'payment' && r4.payment.ok && r4.stamps === 1 && r4.cash === r4.payment.before - 600, 'deposit paid, stamp 1');
  Core.afterPayment(r4);
  check(r4.phase === 'shop', 'shop after payment');
  // 첫 판 고정 층
  const rt = Core.newRun(env.TUTORIAL.seed, { tutorial: true }); Core.startDay(rt);
  check(rt.d.floor.tutorial && rt.d.floor.solvable, 'tutorial B1 fixed & solvable');
  check(rt.d.floor.forkOptions === null && rt.d.floor.stair.x === 11, 'tutorial B1 stair');
  console.log('  단위 검사 끝 (실패 ' + fails + ')');
})();

// ---------- 3. 봇 ----------
(function botRuns() {
  console.log(`== 3. 봇 ${RUNS}판 ==`);
  const t0 = Date.now();
  const res = [];
  let errors = 0;
  for (let s = 1; s <= RUNS; s++) {
    try { res.push(playRun(env, 1000 + s)); } catch (e) { errors++; console.log('ERROR seed', 1000 + s, e.stack); }
  }
  // 계약 해지 경로 강제 확인: 걸기·발파를 안 하고 도구도 안 사는 소극 봇 20판
  let lazyVoid = 0;
  for (let s = 1; s <= 20; s++) { try { const r = playRun(env, 5000 + s, { lazy: true, spend: false }); if (!r.final.success) lazyVoid++; } catch (e) { errors++; console.log('ERROR lazy', e.stack); } }
  // 첫 판(고정 층) 경로
  for (let s = 0; s < 10; s++) { try { playRun(env, 0, { tutorial: true }); } catch (e) { errors++; console.log('ERROR tutorial', e.stack); } }
  check(errors === 0, 'bot runs without exceptions');
  const finished = res.filter(r => r.final && (r.final.success || r.final.day)).length;
  check(finished === res.length, 'all runs reach final');
  const pass = [0, 0, 0], reach = [0, 0, 0];
  res.forEach(r => { const st = r.final.stamps; for (let i = 0; i < 3; i++) { if (r.final.day >= CONFIG.payments[i].day) reach[i]++; if (st > i) pass[i]++; } });
  const days = [].concat(...res.map(r => r.days));
  const byDay = d => days.filter(x => x.day === d);
  const breaks = avg(days.map(x => x.stats.breaks));
  const haz = days.reduce((a, x) => a + x.stats.hazDigs, 0), brk = days.reduce((a, x) => a + x.stats.breaks, 0);
  const gam = days.reduce((a, x) => a + (x.bot.gambles || 0), 0);
  const rule = days.reduce((a, x) => a + (x.bot.ruleDigs || 0), 0);
  const d1 = byDay(1);
  const firstT = d1.filter(x => x.stats.firstTreasureHit).map(x => x.stats.firstTreasureHit);
  const incomeAt = d => { const L = byDay(d); return L.length ? Math.round(avg(L.map(x => x.income))) : '-'; };
  const doubleDays = days.filter(x => x.day > 1).length;
  const scores = res.filter(r => r.final.success).map(r => r.final.score);
  console.log(`  예외 ${errors} · 끝까지 진행 ${finished}/${res.length} · 소극 봇 20판 중 계약 해지 ${lazyVoid} · ${((Date.now() - t0) / 1000).toFixed(1)}초`);
  console.log(`  납부 통과율: 계약금 ${pct(pass[0], res.length)} · 중도금 ${pct(pass[1], res.length)} (도달 판 중 ${pct(pass[1], reach[1])}) · 잔금 ${pct(pass[2], res.length)} (도달 판 중 ${pct(pass[2], reach[2])})`);
  console.log(`  하루 깨는 칸 ${breaks.toFixed(1)} · 위험 칸 도전 비율 ${pct(haz, brk)} (규칙으로 가려낸 칸 ${pct(rule, brk)}, 찍기 ${pct(gam, brk)}) · 하루 발파 ${avg(days.map(x => x.stats.blasts)).toFixed(2)}`);
  console.log(`  첫 보물까지 치기(Day 1) 중앙값 ${firstT.sort((a, b) => a - b)[firstT.length >> 1]} · Day 1 보물 0개 ${pct(d1.length - firstT.length, d1.length)}`);
  console.log(`  하루 수입 평균: Day 1 ${incomeAt(1)} · Day 3 ${incomeAt(3)} · Day 8 ${incomeAt(8)} · Day 15 ${incomeAt(15)} · 쓰러진 날 ${pct(days.filter(x => x.collapsed).length, days.length)}`);
  console.log(`  도달 깊이 평균 ${avg(days.map(x => x.depth)).toFixed(1)} · 최대 줄 ×3 이상 찍은 날 ${pct(days.filter(x => x.stats.maxStreak >= 4).length, days.length)} · 주문 완료 ${pct(days.filter(x => x.order && x.order.done).length, days.filter(x => x.order).length)}`);
  if (scores.length) console.log(`  잔금 뒤 남긴 돈(점수) 중앙값 ${scores.sort((a, b) => a - b)[scores.length >> 1]}`);
  module.exports.summary = { pass, reach, n: res.length };
})();

console.log(fails ? `\n실패 ${fails}건` : '\n전부 통과');
process.exitCode = fails ? 1 : 0;
