import { describe, it, expect } from 'vitest';
import { load } from '../bot/bot.js';

const env = load();
const { Core, CONFIG, RULE_IDS, RULES } = env;

// 조건이 거짓이면 실패로 기록하고 다음 검사를 이어 가요(한 번에 실패를 전부 보려고)
function check(cond: unknown, msg: string) { expect.soft(!!cond, msg).toBe(true); }

// 규칙 단위 검사(1타, 촛불, 통행, 노다지 줄, 발파, 불씨, 쓰러짐, 납부·해지, 첫 판, 갈림길, 빛 번짐)
describe('규칙 단위 검사', () => {
  it('2차 규칙이 결정 기록대로 동작해요', () => {
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
  });
});
