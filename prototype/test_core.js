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
    check(d2.candle === c0 - Core.igniteCost(r2), 'blast costs igniteCost');
    check(d2.streak >= 2, 'blast keeps streak');
  }
  // 불발: X 아닌 칸에 점화 불가, 지뢰 아닌 X는 촛불만
  const safeC = f2.cells.find(c => !c.haz && !c.stair && c.cover !== 'open');
  if (safeC) {
    const nb = Core.neighbors(f2, safeC.x, safeC.y)[0]; nb.cover = 'open'; d2.px = nb.x; d2.py = nb.y;
    check(!Core.ignite(r2, safeC.x, safeC.y).ok, 'ignite needs X');
    Core.mark(r2, safeC.x, safeC.y, 1);
    const c0 = d2.candle; const rf = Core.ignite(r2, safeC.x, safeC.y);
    check(rf.ok && rf.mines === 0 && d2.candle === c0 - Core.igniteCost(r2) && safeC.fizzle && safeC.cover !== 'open', 'fizzle costs ignite candle only');
  }
  // 불발(05 확인 필요 1): 불을 붙인 X 칸이 보물이면 녹아 없어진다. 줄은 그대로
  const trM = f2.cells.find(c => c.haz === 'treasure' && c.cover !== 'open');
  if (trM && CONFIG.fizzle === 'melt') {
    const nb = Core.neighbors(f2, trM.x, trM.y)[0]; nb.cover = 'open'; d2.px = nb.x; d2.py = nb.y;
    Core.mark(r2, trM.x, trM.y, 1);
    const pk = d2.pocket, st0 = d2.streak, rf = Core.ignite(r2, trM.x, trM.y);
    check(rf.ok && rf.mines === 0 && trM.removed && trM.melted && d2.pocket === pk && d2.streak === st0, 'fizzled treasure melts, no value, streak kept');
  }
  // R29: 변덕 풀(잠든 계단·뭉개진 숫자·마른 손·선잠), 첫 판 Day 8 = 뭉개진 숫자, 쌍둥이 지뢰는 갱 상태
  for (let k = 0; k < 30; k++) { const rr = Core.newRun(500 + k); [8, 15].forEach(d => rr.mutationPlan[d].forEach(m => check(['blur', 'sleepy', 'noprobe', 'nap'].includes(m), 'mutation pool ' + m))); }
  check(Core.newRun(77, { tutorial: true }).mutationPlan[8][0] === 'blur', 'tutorial day 8 = blur');
  check(env.GANG.some(g => g.id === 'twin'), 'twin is a gang state');
  // R31 Day 15 덩이 지하 5층, R30 쓸모 검사
  check(CONFIG.chunks[15].depth === 5, 'day 15 chunk depth 5');
  { let ok = 0; for (let k = 0; k < 60; k++) { const g = Core.genFloor({ depth: 3, rule: ['pair', 'tally', 'minepair', 'lonely', 'rows', 'border'][k % 6], sx: 7, sy: 5, seed: Core.hashSeed(k, 61) }); if (g.useful) ok++; } check(ok >= 57, 'useful check (R30, R35) ' + ok + '/60'); }
  // R36: 쌍둥이 지뢰 갱 상태는 한 판 한 번, 납부일 제외
  for (let k = 0; k < 40; k++) { const rr = Core.newRun(900 + k); let tw = 0; for (let d = 1; d <= 15; d++) { if (rr.gang && rr.gang.id === 'twin') { tw++; check(![3, 8, 15].includes(rr.day), 'twin not on payday'); } Core.debugSkipDay(rr); rr.cash = 1e6; if (rr.phase === 'final') break; } check(tw <= 1, 'twin at most once (' + tw + ')'); }
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
  Core.startDay(r4); r4.d.pocket = CONFIG.payments[0].amount + 100; Core.returnUp(r4); Core.afterSettle(r4);
  check(r4.phase === 'payment' && r4.payment.ok && r4.stamps === 1 && r4.cash === r4.payment.before - CONFIG.payments[0].amount, 'deposit paid, stamp 1');
  // 시세: 도장 1개면 보물 값 ×1.5(05 2.3)
  check(Core.stage(r4).valueMul === CONFIG.stages[1].valueMul, 'value multiplier after first stamp');
  Core.afterPayment(r4);
  check(r4.phase === 'shop', 'shop after payment');
  // 첫 판 고정 층
  const rt = Core.newRun(env.TUTORIAL.seed, { tutorial: true }); Core.startDay(rt);
  check(rt.d.floor.tutorial && rt.d.floor.solvable, 'tutorial B1 fixed & solvable');
  check(rt.d.floor.forkOptions === null && rt.d.floor.stair.x === 13 && rt.d.floor.stair.y === 5, 'tutorial B1 stair');
  check(Core.neighbors(rt.d.floor, 13, 5).every(c => !c.haz), 'tutorial B1: no hazard around stair (R45)');
  // R43 중개소 선물: 첫 판 고정 3종, 둘째 판부터 일반 도구 셋. 선물은 값 0(되팔면 0)
  { const rg = Core.newRun(env.TUTORIAL.seed, { tutorial: true }); check(rg.giftOpts.join() === 'betchalk,ledger,fuse', 'tutorial gift fixed');
    const rn = Core.newRun(555); check(rn.giftOpts.length === 3 && rn.giftOpts.every(id => Core.TOOL_BY_ID[id].rarity === '일반'), 'gift: 3 common tools');
    Core.toGift(rn); const gr = Core.chooseGift(rn, 0); check(gr.ok && rn.owned[0] === gr.id && Core.sellPrice(rn, gr.id) === 0 && rn.phase === 'board', 'gift chosen free');
    check(CONFIG.tutorialShopDay1.every(id => !CONFIG.gift.tutorial.includes(id)), 'R50 day1 shop does not overlap gift'); }
  // R42 갈림길 덤: 카드마다 덤과 묻힌 양, 덤 효과
  { const rb = Core.newRun(4321); Core.startDay(rb); const fb = rb.d.floor; const s = fb.stair; const nb = Core.neighbors(fb, s.x, s.y).find(c => !c.haz);
    nb.cover = 'open'; rb.d.px = nb.x; rb.d.py = nb.y; Core.hit(rb, s.x, s.y); Core.travelTo(rb, s.x, s.y);
    check(fb.forkOptions.every(o => o.bonus && o.est && o.est.t > 0 && o.est.m > 0), 'fork cards have bonus and estimate');
    fb.forkOptions[0].bonus = 'candle'; rb.d.candle = 50; const cost = Core.travelCost(rb, 2); Core.descend(rb, 0);
    check(rb.d.candle === 50 - cost + CONFIG.forkBonus.candle, 'fork bonus candle +6');
    const rc = Core.newRun(4321); Core.startDay(rc); const fc = rc.d.floor; const sc = fc.stair; const nc = Core.neighbors(fc, sc.x, sc.y).find(c => !c.haz);
    nc.cover = 'open'; rc.d.px = nc.x; rc.d.py = nc.y; Core.hit(rc, sc.x, sc.y); Core.travelTo(rc, sc.x, sc.y); fc.forkOptions[0].bonus = 'more';
    const est = Core.floorEstimate(rc, 2, fc.forkOptions[0].rule, 'more'); Core.descend(rc, 0);
    const f2 = rc.d.floor; check(f2.cells.filter(c => c.haz === 'mine').length >= est.m - 2, 'fork bonus more mines'); }
  // 01 4.4: 불씨 다섯 번은 하루에 다섯 개가 전부. 다시 불이 붙었다 꺼지면 남은 불씨를 이어 쓴다
  {
    const r = Core.newRun(31337); Core.startDay(r); const dd = r.d, ff = dd.floor;
    const safeHit = () => { const c = ff.cells.find(c => c.cover !== 'open' && !c.haz && !c.stair && c.mark !== 1); const nb = Core.neighbors(ff, c.x, c.y)[0]; nb.cover = 'open'; dd.px = nb.x; dd.py = nb.y; return Core.hit(r, c.x, c.y); };
    dd.candle = 1; safeHit();
    const total = dd.embers;
    check(dd.embersOn && total === (Core.gang(r, 'ember') ? 7 : 5), 'embers start');
    safeHit(); safeHit();
    check(dd.embers === total - 2, 'embers spent 2');
    dd.candle = 0; dd.embersOn = false; dd.candle += 2;   // 촛불을 얻어 불이 다시 붙은 상태(addCandle과 같음)
    safeHit(); safeHit();
    check(dd.embersOn && dd.embers === total - 2, 'relit then out: remaining embers continue (' + dd.embers + ')');
    while (r.phase === 'mine' && dd.embers > 0) safeHit();
    check(r.phase === 'settle', 'day ends when embers run out');
  }
  // 01 11.2·11.3 판 계획: 쌍둥이 지뢰 한 판 한 번(납부일 제외), 이틀 연속 같은 상태 없음, 한 판 두 번까지, 주문 두 장은 다른 묶음
  for (let k = 0; k < 60; k++) {
    const rr = Core.newRun(7000 + k, { tutorial: k % 3 === 0 }), G = rr.plan.gang;
    const tw = G.map((g, i) => g === 'twin' ? i + 1 : 0).filter(Boolean);
    check(tw.length === 1 && ![3, 8, 15].includes(tw[0]) && (!rr.tutorial || tw[0] >= 4), 'twin exactly once, not payday ' + tw);
    for (let i = 1; i < G.length; i++) if (G[i] && G[i] === G[i - 1]) check(false, 'gang repeated on consecutive days');
    const cnt = {}; G.forEach(g => { if (g) cnt[g] = (cnt[g] || 0) + 1; }); Object.keys(cnt).forEach(g => check(cnt[g] <= 2, 'gang at most twice ' + g));
    rr.plan.orders.forEach(o => { if (o.length) check(Core.ORDER_BY_ID[o[0]].group !== Core.ORDER_BY_ID[o[1]].group, 'orders from different groups'); });
    if (rr.tutorial) check(G[0] === null && G[1] === 'thin' && G[2] === 'moon' && rr.plan.firstRule[1] === 'border', 'tutorial day 2/3 fixed');
  }
  check(env.ORDERS.length === 16 && env.GANG.length === 13, '16 orders, 13 gang states');
  // 01 3.7: 두드려 보기로 지뢰면 X가 저절로 그어진다(내가 그은 X로 세지 않는다)
  {
    const r = Core.newRun(4243); Core.startDay(r); const ff = r.d.floor;
    const m = ff.cells.find(c => c.haz === 'mine' && c.cover !== 'open'); const nb = Core.neighbors(ff, m.x, m.y)[0]; nb.cover = 'open'; r.d.px = nb.x; r.d.py = nb.y;
    r.d.probes = 2; Core.probe(r, m.x, m.y);
    check(m.mark === 1 && m.givenX, 'probe mine draws X');
    // 주문 '맞은 X 6칸, 틀린 X 0': 내가 그은 X가 지뢰로 밝혀지면 센다
    r.order = { id: 'xRight', prog: 0, done: false, failed: false };
    const m2 = ff.cells.find(c => c.haz === 'mine' && c.cover !== 'open' && c !== m); const nb2 = Core.neighbors(ff, m2.x, m2.y)[0]; nb2.cover = 'open'; r.d.px = nb2.x; r.d.py = nb2.y; r.d.candle = 50;
    Core.mark(r, m2.x, m2.y, 1); Core.ignite(r, m2.x, m2.y);
    check(r.order.prog >= 1 && !r.order.failed, 'xRight counts correct X (' + r.order.prog + ')');
    const e2 = ff.cells.find(c => !c.haz && !c.stair && c.cover !== 'open'); const nb3 = Core.neighbors(ff, e2.x, e2.y)[0]; nb3.cover = 'open'; r.d.px = nb3.x; r.d.py = nb3.y;
    Core.mark(r, e2.x, e2.y, 1); Core.ignite(r, e2.x, e2.y);
    check(r.order.failed, 'xRight fails on wrong X');
  }
  // R57: X 칸은 캐기로 열리지 않는다
  {
    const r = Core.newRun(5151); Core.startDay(r); const ff = r.d.floor;
    const c = ff.cells.find(q => q.cover !== 'open' && !q.stair && Core.neighbors(ff, q.x, q.y).some(n => n.cover === 'open'));
    const nb = Core.neighbors(ff, c.x, c.y).find(n => n.cover === 'open'); r.d.px = nb.x; r.d.py = nb.y;
    Core.mark(r, c.x, c.y, 1); const cd = r.d.candle; const res = Core.hit(r, c.x, c.y);
    check(c.cover !== 'open' && !res.ok && res.xcell && r.d.candle === cd, 'X cell is not dug by hit');
  }
  // R56·R60: 빛 번짐 중심은 계단에서 0~1칸, 반경 2칸 안에 계단
  {
    let n = 0;
    for (let s = 1; s <= 40; s++) {
      const r = Core.newRun(7000 + s); Core.startDay(r); const ff = r.d.floor;
      if (!ff.stair || ff.stair.blocked) continue; n++;
      check(ff.light && Core.cheb(ff.light.x, ff.light.y, ff.stair.x, ff.stair.y) <= 1, 'light center within 1 of stair (seed ' + s + ')');
      const r2 = Core.newRun(7000 + s); Core.startDay(r2);
      check(r2.d.floor.light.x === ff.light.x && r2.d.floor.light.y === ff.light.y, 'light center fixed by floor seed');
    }
    check(n >= 30, 'light tested on floors ' + n);
  }
  // 01 16.2: 첫 판 Day 2·3 정해진 층이 가르칠 요소를 갖는다
  {
    const rt2 = Core.newRun(env.TUTORIAL.seed, { tutorial: true }); Core.debugSkipDay(rt2); rt2.cash = 1e5; Core.startDay(rt2);
    const f21 = rt2.d.floor;
    check(f21.rule === 'border' && f21.cluster && f21.cluster.length === 3 && f21.graffiti.length >= 1 && f21.tutorialK != null, 'tutorial day2 B1: border + mine cluster');
    check(f21.cluster.every(([x, y]) => Core.cellAt(f21, x, y).haz === 'mine' && !Core.isBorder(x, y)), 'cluster cells are inner mines');
    for (const rule of ['pair', 'lonely']) {
      const g = Core.genFloor({ depth: 2, rule, sx: f21.stair.x, sy: f21.stair.y, seed: 1 });   // 생성기 연결 확인용
      check(Core.checkRule(g), 'gen ' + rule);
      const T = Core.TUT_TEST['2-2'];
      check(typeof T === 'function', 'tutorial test 2-2');
    }
  }
  console.log('  단위 검사 끝 (실패 ' + fails + ')');
})();

// ---------- 3. 봇 ----------
(function botRuns() {
  console.log(`== 3. 봇 ${RUNS}판 ==`);
  const t0 = Date.now();
  const res = [];
  let errors = 0;
  for (let s = 1; s <= RUNS; s++) {
    try { res.push(playRun(env, 1000 + s, { policy: 'normal' })); } catch (e) { errors++; console.log('ERROR seed', 1000 + s, e.stack); }
  }
  // 신중(첫 판 고정 층)·욕심 정책도 예외 없이 끝까지
  const other = {};
  for (const pol of ['cautious', 'greedy']) {
    other[pol] = [];
    for (let s = 1; s <= Math.max(20, RUNS >> 1); s++) { try { other[pol].push(playRun(env, 3000 + s, { policy: pol })); } catch (e) { errors++; console.log('ERROR', pol, e.stack); } }
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
  const fire = days.reduce((a, x) => a + (x.bot.fireBets || 0), 0);
  const haz = days.reduce((a, x) => a + x.stats.hazDigs, 0) + fire, brk = days.reduce((a, x) => a + x.stats.breaks, 0) + fire;
  const gam = days.reduce((a, x) => a + (x.bot.gambles || 0), 0);
  const rule = days.reduce((a, x) => a + (x.bot.ruleDigs || 0), 0);
  const d1 = byDay(1);
  const firstT = d1.filter(x => x.stats.firstTreasureHit).map(x => x.stats.firstTreasureHit);
  const incomeAt = d => { const L = byDay(d); return L.length ? Math.round(avg(L.map(x => x.income))) : '-'; };
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
