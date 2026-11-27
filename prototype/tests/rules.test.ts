import { describe, it, expect } from 'vitest';
import { load } from '../bot/bot.js';

const env = load();
const { Core, CONFIG, RULE_IDS, RULES } = env;

// 조건이 거짓이면 실패로 기록하고 다음 검사를 이어 가요(한 번에 실패를 전부 보려고)
function check(cond: unknown, msg: string) { expect.soft(!!cond, msg).toBe(true); }

// 규칙 단위 검사(1타, 촛불, 통행, 콤보, 발파, 불씨, 쓰러짐, 납부·해지, 첫 판, 갈림길, 빛 번짐, 보이는 계단, 지뢰 판정, 기록 장치)
describe('규칙 단위 검사', () => {
  it('2차 규칙이 결정 기록대로 동작해요', () => {
  console.log('== 2. 규칙 단위 검사 ==');
    Core.applyPreset('v21');   // 이 묶음은 v2.1 규칙(갱 상태, 주문, 불씨, 중개소 선물 등)을 검사해요
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
    // 콤보 / 지뢰 / 주머니
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
    // 불발(05 확인 필요 1): 불을 붙인 X 칸이 보물이면 녹아 없어진다. 콤보는 그대로
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
    // R56·R60: 빛 번짐 중심은 계단에서 0~1칸, 반경 2칸 안에 계단(계단을 숨기는 v2.1 방식일 때)
    {
      const shown0 = env.CONFIG.stairShown; env.CONFIG.stairShown = false;
      let n = 0;
      for (let s = 1; s <= 40; s++) {
        const r = Core.newRun(7000 + s); Core.startDay(r); const ff = r.d.floor;
        if (!ff.stair || ff.stair.blocked) continue; n++;
        check(ff.light && Core.cheb(ff.light.x, ff.light.y, ff.stair.x, ff.stair.y) <= 1, 'light center within 1 of stair (seed ' + s + ')');
        const r2 = Core.newRun(7000 + s); Core.startDay(r2);
        check(r2.d.floor.light.x === ff.light.x && r2.d.floor.light.y === ff.light.y, 'light center fixed by floor seed');
      }
      check(n >= 30, 'light tested on floors ' + n);
      env.CONFIG.stairShown = shown0;
    }
    Core.applyPreset('v22');   // 여기부터는 재미 보고서 규칙(v22, 기본)
    // 재미 보고서 1주차: 계단은 처음부터 보이고(빛 번짐·잠든 계단 없음), 추리에서 빈 칸으로 쳐요
    {
      check(env.CONFIG.stairShown === true, 'stairs shown by default');
      let n = 0;
      for (let s = 1; s <= 30; s++) {
        const r = Core.newRun(7100 + s); Core.startDay(r); const ff = r.d.floor;
        check(!ff.light, 'no light bleed when stairs shown');
        check(Object.values(r.mutationPlan).every((m: any) => m.indexOf('sleepy') < 0), 'no sleepy stair mutation');
        if (!ff.stair || ff.stair.blocked || ff.stair.found) continue; n++;
        const si = Core.shownStair(ff), D = Core.deduce(ff);
        check(si === ff.stair.y * Core.W + ff.stair.x && D.st[si] === 1 && !D.canT[si] && !D.canM[si], 'shown stair is known empty');
        const reach = Core.neighbors(ff, ff.stair.x, ff.stair.y).some(c => c.cover === 'open');
        check((D.safe.indexOf(si) >= 0) === reach && (D.stairCand.length === 1) === reach, 'stair offered only when reachable');
      }
      check(n >= 20, 'shown stair tested on floors ' + n);
      const rt = Core.newRun(env.TUTORIAL.seed, { tutorial: true }); Core.toGift(rt); Core.chooseGift(rt, 0); Core.startDay(rt);
      check(rt.d.floor.graffiti.every((g: any) => !g.stairHint), 'tutorial stair-hint graffiti removed');
    }
    // 갈림길: 광맥 풀이 작아도(얕은 층에 안 나오는 광맥 하나) 카드가 만들어져요
    {
      const pool0 = env.CONFIG.rulePool;
      for (const pool of [['rows'], ['minepair'], ['pair']]) {
        env.CONFIG.rulePool = pool;
        const r = Core.newRun(8801); Core.startDay(r);
        r.d.roomForks = { 1: 'spring', 2: 'spring', 3: 'spring' };
        const list = Core.forkOptions(r, 2);
        check(list.length >= 1 && list.every((o: any) => pool.indexOf(o.rule) >= 0), 'fork options from small pool ' + pool.join(','));
      }
      env.CONFIG.rulePool = pool0;
    }
    // 지뢰 판정 한 줄과 기록 장치
    {
      const r = Core.newRun(9311, { record: true }); Core.startDay(r); const ff = r.d.floor;
      ff.cells.forEach((c: any) => { if (c.cover !== 'open') { c.mark = 0; c.faded = 0; } });
      // 숫자로 확실한 지뢰를 찾아 친다(없으면 확실하지 않은 지뢰)
      const D = Core.deduce(ff);
      const known = D.mine.map((i: number) => ff.cells[i]).find((c: any) => c.haz === 'mine');
      const target = known || ff.cells.find(c => c.cover !== 'open' && c.haz === 'mine' && Core.neighbors(ff, c.x, c.y).some(n => n.cover === 'open'));
      const nb = Core.neighbors(ff, target.x, target.y).find(n => n.cover === 'open'); r.d.px = nb.x; r.d.py = nb.y;
      const res = Core.hit(r, target.x, target.y);
      const want = known ? env.TEXT.mineJudge.known : null;
      check(res.ok && res.content === 'mine' && (want ? r.log.some((l: any) => l.text.indexOf(want) >= 0) : ['bet', 'unknown'].indexOf(res.judge) >= 0), 'mine judgment line (' + res.judge + ')');
      check(r.d.rec[res.judge] === 1, 'recorder counts the hit');
      const rem = Core.remaining(ff);
      check(rem.m === ff.cells.filter(c => c.haz === 'mine' && !c.removed).length && rem.t === ff.cells.filter(c => c.haz === 'treasure' && !c.removed).length, 'remaining counts');
      Core.returnUp(r);
      const h = r.history[r.history.length - 1];
      check(h.rec && h.rec[res.judge] === 1 && h.reason === 'return', 'day history keeps the record');
      const r0 = Core.newRun(9311); Core.startDay(r0); Core.returnUp(r0);
      check(r0.history[0].rec === null, 'no record unless asked');
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
  it('재미 보고서 2~4주차 규칙(v22)이 동작해요', () => {
    Core.applyPreset('v22');
    const F = CONFIG.features;
    // 2주차: 빼기 묶음은 스위치로 꺼져 있어요
    { const r = Core.newRun(6101);
      check(r.plan.gang.every((g: any) => g === null) && r.plan.orders.every((o: any) => o.length === 0), 'no gang states, no orders');
      check(Object.keys(r.mutationPlan).length === 0 && r.giftOpts.length === 0, 'no mutations, no start gift');
      Core.startDay(r);
      check(r.d.probes === 0 && Object.keys(r.d.roomForks).length === 0, 'no base probes, no rooms');
      check(CONFIG.rulePool.join() === 'pair,border,lonely,tally,minepair,cols,diag,trio,band' && r.plan.firstRule.slice(1).every((x: string) => CONFIG.rulePool.includes(x)), 'every vein, any grade (plain only day 1)');
      check(Core.toolPool().filter((t: any) => t.kind === 'passive').length === 87 && !Core.toolPool().some((t: any) => ['match', 'bigblast', 'moontongs', 'deadcrown', 'toughcharm', 'betchalk', 'fuse', 'tongs'].includes(t.id)), '87 tools in v22 set, no fused or character-only tools in the pool'); }
    // 캐릭터는 X·O 칸 행동 하나만 바꿔요(R135): 따로 붙는 능력치가 없어요
    { const cs = Object.values(Core.CHAR_BY_ID) as any[];
      check(cs.every(c => !c.candleDelta && !c.capPlus && !c.valueMul && !c.digMineExtra && !c.perk && !c.weak), 'characters have no extra stats');
      check(cs.every(c => c.x.name === '발파' || c.o.name === '캐기'), 'each character changes at most one of X or O'); }
    // 해체공은 틀린 X에서 촛불을 돌려받지 않고, 폭파공은 틀린 X가 섞이면 체력 1(R139)
    for (const ch of ['defuser', 'blaster', 'miner']) {
      const r = Core.newRun(6120, { char: ch }); Core.startDay(r); const f = r.d.floor;
      const c = f.cells.find((q: any) => q.cover !== 'open' && !q.haz && !q.stair && Core.neighbors(f, q.x, q.y).some((n: any) => n.cover === 'open'));
      const nb = Core.neighbors(f, c.x, c.y).find((n: any) => n.cover === 'open'); r.d.px = nb.x; r.d.py = nb.y; c.mark = 1;
      const c0 = r.d.candle, h0 = r.d.hp; Core.ignite(r, c.x, c.y);
      if (ch === 'defuser') check(r.d.candle === c0 - 5 && r.d.hp === h0, 'defuser pays 5 on a wrong X, no refund');
      if (ch === 'blaster') check(r.d.candle === c0 - 8 && r.d.hp === h0, 'blaster pays 4 more candles per wrong X (R141)');
      if (ch === 'miner') check(r.d.candle === c0 - 4 && r.d.hp === h0, 'miner: wrong X costs candles only');
    }
    // 질긴 부적: 배짱 장갑과 곽 씨 부적이 하루 두 번
    { const r = Core.newRun(6111); r.owned.push('toughcharm'); Core.startDay(r);
      check(Core.owns(r, 'gloves') && Core.owns(r, 'amulet') && r.toolState.gloves.left === 2 && r.toolState.amulet.left === 2, 'tough charm doubles gloves and amulet'); }
    // 촛불이 다 타면 그 자리에서 하루 끝(불씨 없음)
    { const r = Core.newRun(6102); Core.startDay(r); const f = r.d.floor;
      const c = f.cells.find(q => q.cover !== 'open' && !q.haz && !q.stair && Core.neighbors(f, q.x, q.y).some(n => n.cover === 'open'));
      const nb = Core.neighbors(f, c.x, c.y).find(n => n.cover === 'open'); r.d.px = nb.x; r.d.py = nb.y; r.d.candle = 1;
      Core.hit(r, c.x, c.y);
      check(r.phase === 'settle' && r.settle.reason === 'candle' && !r.d.embersOn, 'candle out ends the day'); }
    // 자갈은 큰 와르르에서만
    { const r = Core.newRun(6103); Core.startDay(r);
      check(F.gravel === 'chain' && r.d.pocketLines.gravel === 0, 'no gravel from floor-start chain'); }
    // 3주차: 도장 다섯 번, 도장 선물
    { check(CONFIG.payments.length === 5 && CONFIG.payments.map((p: any) => p.day).join() === '3,6,9,12,15', 'five stamps every three days');
      const r = Core.newRun(env.TUTORIAL.seed, { tutorial: true });
      check(Core.stampNames(r).length === 5 && Core.stampNames(r)[4] === '마지막 도장', 'stamp names');
      Core.debugSkipDay(r); Core.debugSkipDay(r);
      Core.startDay(r); r.d.pocket = 1000; Core.returnUp(r); Core.afterSettle(r); Core.afterPayment(r);
      check(r.phase === 'gift' && r.giftKind === 'stamp' && r.giftOpts.join() === CONFIG.gift.tutorial.join(), 'stamp reward offers fixed tools on first run (' + r.phase + ')');
      const c0 = r.cash, gc = r.giftCash; const g = Core.chooseGift(r, -1);
      check(g.ok && r.cash === c0 + gc && gc > 0 && r.phase === 'shop', 'take cash instead of a tool');
      const r2 = Core.newRun(6104); Core.debugSkipDay(r2); Core.debugSkipDay(r2); Core.startDay(r2); r2.d.pocket = 1000; Core.returnUp(r2); Core.afterSettle(r2); Core.afterPayment(r2);
      const g2 = Core.chooseGift(r2, Math.max(0, r2.giftOpts.findIndex((id: string) => id !== 'regular')));   // 단골 장부는 제값에 팔려서 빼요
      const sv = Core.sellPrice(r2, g2.id), cs = r2.cash;
      check(g2.ok && r2.owned.includes(g2.id) && r2.phase === 'shop' && sv === Math.floor(Core.TOOL_BY_ID[g2.id].price * 0.5 / 10) * 10 && Core.sellBack(r2, g2.id).ok && r2.cash === cs + sv && !r2.owned.includes(g2.id), 'take a tool; sell it for half the shop price');
      check(Core.rateText(r2).indexOf('도장 1개') === 0, 'rate text'); }
    // 도구 경험: 도구 칸 8, 옛 연장함, 합친 도구, 심 씨 외상
    { const r = Core.newRun(6201); check(Core.slotsOf(r) === 8, 'eight tool slots');
      r.owned.push('belt'); check(Core.slotsOf(r) === 10, 'belt adds two slots'); r.owned.length = 0;
      // 연장함: 지하 2층 이상, 2일째부터. 묻힌 칸은 숫자에 보물로 세고, 캐면 둘 중 하나를 골라요
      let rb: any = null, fb: any = null;
      for (let sd = 6300; sd < 6600 && !fb; sd++) {
        const q = Core.newRun(sd); Core.debugSkipDay(q); Core.startDay(q);
        for (let k = 0; k < 6 && !fb; k++) { q.d.floor.stair.found = true; q.d.floor.forkOptions = Core.forkOptions(q, q.d.floor.depth + 1); q.d.px = q.d.floor.stair.x; q.d.py = q.d.floor.stair.y; q.d.candle = 80; Core.descend(q, 0); if (q.d.floor.box) { rb = q; fb = q.d.floor; } }
      }
      check(!!fb && fb.depth >= 2, 'a box shows up on some floor at depth 2+');
      if (fb) {
        const bc = Core.cellAt(fb, fb.box.x, fb.box.y);
        check(bc.haz === 'treasure' && bc.box && bc.cover !== 'open', 'box sits in a covered treasure cell');
        const nb = Core.neighbors(fb, bc.x, bc.y)[0]; nb.cover = 'open'; nb.haz = null; rb.d.px = nb.x; rb.d.py = nb.y;
        const t0 = rb.stats.treasures, s0 = rb.d.streak; Core.hit(rb, bc.x, bc.y);
        check(!!rb.boxOffer && rb.boxOffer.opts.length + (rb.boxOffer.cons ? 1 : 0) === 2 && rb.stats.treasures === t0 &&   /* 보물 값은 없어요(와르르 자갈은 들어올 수 있어요) */ rb.d.streak === s0 + 1 && !Core.canAct(rb), 'digging a box: two picks, no money, combo +1, board waits');
        rb.owned = ['gloves', 'lens', 'lastcard', 'crown', 'amulet', 'betchalk', 'fuse', 'wedge'].filter(id => !rb.boxOffer.opts.includes(id)).slice(0, 8);
        while (rb.owned.length < 8) rb.owned.push(['tapper', 'sieve', 'tongs', 'refiner'].find(id => !rb.owned.includes(id) && !rb.boxOffer.opts.includes(id)));
        check(!Core.chooseBox(rb, 0).ok, 'full slots: must drop one');
        const drop = rb.owned[0], dv = Core.toolValue(rb, drop, 'site'), pk = rb.d.pocket, pick0 = rb.boxOffer.opts[0];
        const cb = Core.chooseBox(rb, 0, drop);
        check(cb.ok && rb.owned.includes(pick0) && !rb.owned.includes(drop) && rb.d.pocket === pk + dv && dv === Math.floor(Core.TOOL_BY_ID[drop].price * 0.25 / 10) * 10 && !rb.boxOffer && rb.boxed[pick0], 'swap: dropped tool goes to Kwak at a quarter of the price, picked tool marked as from a toolbox');
      }
      // 합친 도구: 재료 둘을 가진 밤 상점에서 합쳐요. 재료 효과도 그대로
      const rq = Core.newRun(6206); Core.debugSkipDay(rq); Core.startDay(rq); rq.owned = ['sieve', 'refiner']; rq.boxed = { sieve: true }; Core.debugEndDay(rq); Core.afterSettle(rq);
      check(rq.phase === 'shop' && rq.shop.fuse.length === 0, 'no fusion on a night without a stamp');
      const shopParts = Core.newRun(6202); Core.debugSkipDay(shopParts); Core.debugSkipDay(shopParts); Core.startDay(shopParts); shopParts.owned = ['sieve', 'refiner']; shopParts.d.pocket = 1000; Core.returnUp(shopParts); Core.afterSettle(shopParts); Core.afterPayment(shopParts); Core.chooseGift(shopParts, -1);
      check(shopParts.phase === 'shop' && shopParts.shop.fuse.length === 0, 'no fusion when neither part came from a toolbox');
      const rf = Core.newRun(6202); Core.debugSkipDay(rf); Core.debugSkipDay(rf); Core.startDay(rf); rf.owned = ['sieve', 'refiner']; rf.boxed = { refiner: true }; rf.d.pocket = 1000; Core.returnUp(rf); Core.afterSettle(rf); Core.afterPayment(rf); Core.chooseGift(rf, -1);
      check(rf.phase === 'shop' && rf.shop.fuse.includes('bigblast'), 'fusion offered at the shop on a stamp night when one part came from a toolbox');
      check(Core.fuse(rf, 'bigblast').ok && rf.owned.join() === 'bigblast' && Core.owns(rf, 'sieve') && Core.owns(rf, 'refiner'), 'fused tool replaces both and keeps their effects');
      const rc = Core.newRun(6203); Core.startDay(rc); rc.owned = ['deadcrown']; rc.d.hp = 1;
      check(CONFIG.streakLadder[Core.streakCapIdx(rc)] === 6, 'dead crown: x6 at 1 HP');
      // 심 씨 외상: 모자라면 빌려서 도장을 찍고, 다음 도장에 1.5배가 붙어요. 한 판에 한 번
      const rl = Core.newRun(6204); Core.debugSkipDay(rl); Core.debugSkipDay(rl); Core.startDay(rl); rl.d.pocket = 200; Core.returnUp(rl); Core.afterSettle(rl);
      const L = Core.loanInfo(rl), next0 = Core.payments(rl)[1].amount;
      check(rl.phase === 'payment' && rl.payment.pending && L.ok && L.short === 100 && L.repay === 150, 'short on stamp day: pending with a loan offer');
      check(Core.takeLoan(rl).ok && rl.payment.ok && rl.stamps === 1 && Core.payments(rl)[1].amount === next0 + 150 && rl.loanUsed, 'loan stamps now and adds 1.5x to the next stamp');
      const rn = Core.newRun(6205); Core.debugSkipDay(rn); Core.debugSkipDay(rn); Core.startDay(rn); rn.d.pocket = 100; Core.returnUp(rn); Core.afterSettle(rn); Core.afterPayment(rn);
      check(rn.phase === 'final' && !rn.final.success, 'refusing the loan ends the contract'); }
    // 첫 판: 첫 도장이 모자라면 한 번 기다려 줘요(모자란 돈은 두 번째 도장에, 이자 없음). 합치기는 없어요
    { const rt = Core.newRun(env.TUTORIAL.seed, { tutorial: true }); Core.debugSkipDay(rt); if (rt.phase === 'shop') Core.nextDay(rt); Core.debugSkipDay(rt); if (rt.phase === 'shop') Core.nextDay(rt);
      Core.startDay(rt); rt.cash = 100; rt.d.pocket = 0; const second0 = Core.payments(rt)[1].amount; Core.returnUp(rt); Core.afterSettle(rt);
      check(rt.phase === 'payment' && rt.payment.ok && rt.stamps === 1 && rt.cash === 0 && Core.payments(rt)[1].amount === second0 + 200 && rt.payment.grace === 200, 'first run: first stamp waits once, short moves to the second stamp');
      rt.owned = ['fuse', 'refiner']; rt.boxed = { fuse: true }; check(Core.fusionsReady(rt).length === 0, 'first run: no fusion'); }
    // 유품: 하나뿐이라 챙기거나 두고 가요. 도구 칸을 쓰지 않고 판 끝까지 남아요
    { const rk = Core.newRun(7401); Core.startDay(rk); const hp0 = rk.d.hpMax, tc0 = Core.travelCost(rk, 3), cap0 = Core.streakCapIdx(rk), own0 = rk.owned.length;
      rk.boxOffer = { keep: 'ironhelm', opts: [], scorch: false, quote: '' };
      check(Core.chooseBox(rk, 0).ok && rk.keeps.includes('ironhelm') && rk.d.hpMax === hp0 + 1 && rk.owned.length === own0 && !rk.boxOffer, 'keepsake taken: hp +1 now, no tool slot used');
      rk.boxOffer = { keep: 'boots', opts: [], scorch: false, quote: '' };
      check(Core.chooseBox(rk, -1).ok && !rk.keeps.includes('boots'), 'keepsake can be left behind');
      ['boots', 'thickcandle', 'prayer'].forEach(id => { rk.boxOffer = { keep: id, opts: [], scorch: false, quote: '' }; Core.chooseBox(rk, 0); });
      rk.owned.push('crackedhelm');   // 맞바꿈은 도구로 옮겼어요(R129)
      check(Core.travelCost(rk, 3) === tc0 - 1 && Core.streakCapIdx(rk) === cap0 + 2, 'boots and cracked helm apply');
      const rk3 = Core.newRun(7403); rk3.owned = ['crackedhelm', 'shortwick']; Core.startDay(rk3);
      check(rk3.d.hpMax === env.CONFIG.hpMax - 1 && rk3.d.candleMax === env.CONFIG.candleMax - 15, 'trade-off tools change hp and candle next day');
      const rk2 = Core.newRun(7402); rk2.keeps = ['thickcandle', 'prayer', 'ironhelm']; Core.startDay(rk2);
      check(rk2.d.candleMax === env.CONFIG.candleMax + 10 && Core.streakMult(rk2) === 1.5 && rk2.d.hpMax === env.CONFIG.hpMax + 1, 'next day: candle +10, combo starts at x1.5, hp +1'); }
    // 바랜 분필 자국: 층마다 O 0~1개, X 0~2개. 늘 맞고, 오른쪽 클릭으로 안 바뀌어요
    { const cntO = [0, 0], cntX = [0, 0, 0]; let wrong = 0, extra = 0, locked = true;
      for (let s = 7000; s < 7300; s++) {
        const r = Core.newRun(s); Core.startDay(r); const f = r.d.floor;
        const fo = f.cells.filter((c: any) => c.faded === 2), fx = f.cells.filter((c: any) => c.faded === 1);
        if (fo.length > 1 || fx.length > 2) extra++; else { cntO[fo.length]++; cntX[fx.length]++; }
        wrong += fo.filter((c: any) => c.haz !== 'treasure' || c.mark !== 2 || c.box || c.chunk).length + fx.filter((c: any) => c.haz !== 'mine' || c.mark !== 1).length;
        const any = fo[0] || fx[0];
        if (any) { const m0 = any.mark, res = Core.mark(r, any.x, any.y); if (res.ok || !res.faded || any.mark !== m0) locked = false; }
      }
      check(extra === 0 && wrong === 0, 'faded marks: at most one O and two X per floor, always right');
      check(cntO[1] > 60 && cntO[1] < 140 && cntX.every(n => n > 60 && n < 140), 'faded marks: O about 1 in 3 floors, X 0/1/2 about equally');
      check(locked, 'right-click does not change a faded mark'); }
    // 주변 한꺼번에 열기
    { const r = Core.newRun(6105); Core.startDay(r); const f = r.d.floor;
      const num = f.cells.find(c => c.cover === 'open' && Core.numAt(f, c) > 0 && Core.neighbors(f, c.x, c.y).some(q => q.cover !== 'open' && !q.haz && !q.stair));
      const nbs = Core.neighbors(f, num.x, num.y).filter(q => q.cover !== 'open');
      nbs.forEach(q => { q.mark = q.haz ? 1 : 0; });
      r.d.px = num.x; r.d.py = num.y; const c0 = r.d.candle, hp0 = r.d.hp;
      const res = Core.chord(r, num.x, num.y);
      check(res.ok && r.d.candle <= c0 - 1 && r.d.hp === hp0 && nbs.filter(q => !q.haz).every(q => q.cover === 'open'), 'chord opens the rest for one candle');
      // 표시가 틀리면 지뢰가 터져요
      const r2 = Core.newRun(6106); Core.startDay(r2); const f2 = r2.d.floor;
      const num2 = f2.cells.find(c => c.cover === 'open' && Core.numAt(f2, c) > 0 && Core.neighbors(f2, c.x, c.y).some(q => q.cover !== 'open' && q.haz === 'mine') && Core.neighbors(f2, c.x, c.y).filter(q => q.cover !== 'open' && !q.haz && !q.stair).length >= Core.numAt(f2, c));
      if (num2) {
        const cov2 = Core.neighbors(f2, num2.x, num2.y).filter(q => q.cover !== 'open'); cov2.forEach(q => { q.mark = 0; });
        cov2.filter(q => !q.haz && !q.stair).slice(0, Core.numAt(f2, num2)).forEach(q => { q.mark = 2; });
        r2.d.px = num2.x; r2.d.py = num2.y; const hp1 = r2.d.hp;
        const res2 = Core.chord(r2, num2.x, num2.y);
        check(res2.ok && res2.boom && r2.d.hp < hp1, 'wrong marks: chord hits a mine');
      }
      const r3 = Core.newRun(6107); Core.startDay(r3); const f3 = r3.d.floor;
      const num3 = f3.cells.find(c => c.cover === 'open' && Core.numAt(f3, c) > 0);
      r3.d.px = num3.x; r3.d.py = num3.y; Core.neighbors(f3, num3.x, num3.y).forEach(q => { q.mark = 0; });
      check(!Core.chord(r3, num3.x, num3.y).ok, 'chord needs marks equal to the number'); }
    // 큰 덩이 자리 공개: 추리에서 덩이 칸은 따로
    { const g = Core.genFloor({ depth: 5, rule: 'border', sx: 7, sy: 5, seed: 4401, chunk: { w: 2, h: 2, value: 100 } });
      const D = Core.deduce(g), ci = g.cells.filter(c => c.chunk).map(c => Core.idx(c));
      check(ci.length === 4 && ci.every(i => D.chunk.includes(i) && !D.tre.includes(i) && !D.mine.includes(i)), 'shown chunk cells are known chunk'); }
    // 콤보 도구: 모자 ×4, 부적
    { const r = Core.newRun(6108); Core.startDay(r);
      check(Core.streakCapIdx(r) === CONFIG.streakCapIdx, 'base cap x3'); r.owned.push('crown');
      check(CONFIG.streakLadder[Core.streakCapIdx(r)] === 4, 'crown raises cap to x4');
      r.owned.push('amulet'); Core.startDay; r.toolState = {}; r.d.streak = 6; const f = r.d.floor;
      const m = f.cells.find(c => c.haz === 'mine' && c.cover !== 'open'); const nb = Core.neighbors(f, m.x, m.y)[0]; nb.cover = 'open'; r.d.px = nb.x; r.d.py = nb.y;
      const hp0 = r.d.hp; Core.hit(r, m.x, m.y);
      check(r.d.hp === hp0 && r.d.streak === 0, 'amulet keeps hp, streak breaks'); }
    // 다른 물건(다시 보기) 값: 밤마다 40에서 시작해 할 때마다 40씩(R123, R129)
    { const r = Core.newRun(6114); r.stamps = 2; r.cash = 10000; r.phase = 'shop'; r.shop = { stock: [], sold: {}, rerolls: 0, fuse: [] };
      const p0 = Core.rerollPrice(r); Core.reroll(r); const p1 = Core.rerollPrice(r); Core.reroll(r);
      check(p0 === 40 && p1 === 80 && Core.rerollPrice(r) === 120 && r.cash === 10000 - 40 - 80, 'reroll price 40, 80, 120 within a night'); }
    // 처음 풀 새 도구 넷(reviews/23): 첫 삽, 외톨이 등, 금 알갱이 주머니, 촛농 받이
    { const digT = (r: any) => { const f = r.d.floor, t = f.cells.find((c: any) => c.haz === 'treasure' && c.cover !== 'open' && !c.chunk); const nb = Core.neighbors(f, t.x, t.y)[0]; nb.cover = 'open'; r.d.px = nb.x; r.d.py = nb.y; const p0 = r.d.pocket; Core.hit(r, t.x, t.y); return { t, got: r.d.pocket - p0 }; };
      const r = Core.newRun(6110); r.owned.push('firstdig', 'nuggetbag'); Core.startDay(r); r.d.floor.rule = 'pair'; r.d.streak = 0;
      const a1 = digT(r); check(r.d.streak === 2, 'first dig: first treasure of the floor +2 steps');
      check(a1.got === CONFIG.treasureValue[a1.t.tier] + (a1.t.tier === 1 ? CONFIG.nuggetBag : 0), 'nugget bag: gold nugget +5');
      digT(r); check(r.d.streak === 3, 'first dig: only the first one');
      const r2 = Core.newRun(6111); r2.owned.push('lonelamp'); Core.startDay(r2); r2.d.streak = 0; r2.d.floor.rule = 'lonely';
      digT(r2); check(r2.d.streak === 2, 'lone lamp: +1 step on lonely floors');
      const r3 = Core.newRun(6112); r3.owned.push('dripdish'); Core.startDay(r3); r3.d.candle = 10; Core.returnUp(r3);
      check(r3.settle.lines.drip === 10 * CONFIG.dripPer, 'drip dish: 4 per candle left');
      const r4 = Core.newRun(6113); r4.owned.push('dripdish'); Core.startDay(r4); r4.d.candle = 70; Core.returnUp(r4);
      check(r4.settle.lines.drip === CONFIG.dripMax, 'drip dish: capped'); }
    // 콤보 상한: 도구는 'n개 단계 더 높이까지'를 더한다
    { const r = Core.newRun(6120); Core.startDay(r); const base = CONFIG.streakCapIdx;
      check(Core.streakCapIdx(r) === base, 'base cap');
      r.owned.push('crown'); const hat = CONFIG.streakCapPlusHat, lc = CONFIG.streakCapPlusLastCard; check(Core.streakCapIdx(r) === base + hat, 'hat adds steps');
      r.owned.push('lastcard'); r.d.hp = 1; check(Core.streakCapIdx(r) === Math.min(base + hat + lc, CONFIG.streakLadder.length - 1), 'hat + last card at 1 hp stack');
      r.owned = ['deadcrown']; r.d.hp = 2; check(Core.streakCapIdx(r) === base + hat, 'dead crown has the hat steps');
      r.d.hp = 1; check(Core.streakCapIdx(r) === CONFIG.streakLadder.length - 1, 'dead crown at 1 hp reaches the top'); }
    // 4주차: 등급과 오늘의 광산
    { const r2 = Core.newRun(6111, { grade: 2 }), r3 = Core.newRun(6111, { grade: 3 });
      check(r2.payments[4].amount === Math.round(CONFIG.payments[4].amount * CONFIG.gradeMul[1] / 10) * 10, 'grade 2 payments scaled');
      const r1 = Core.newRun(6111); check(Core.poolList(r1).includes('tally') && Core.poolList(r1).includes('minepair') && Core.poolList(r3).length === Core.poolList(r1).length, 'every grade has every vein');
      Core.startDay(r1); Core.startDay(r2); Core.startDay(r3);
      check(r2.d.candleMax === r1.d.candleMax - 10 && Core.streakCapIdx(r3) === Core.streakCapIdx(r1) - 4, 'grade penalties');
      check(Core.dailySeed('2026-11-23') === Core.dailySeed('2026-11-23') && Core.dailySeed('2026-11-23') !== Core.dailySeed('2026-11-24'), 'daily seed'); }
    // 프리셋: v21로 돌아가면 v2.1 값
    { Core.applyPreset('v21'); check(CONFIG.payments.length === 3 && CONFIG.features.embers && !CONFIG.features.chord && CONFIG.stairShown === false, 'v21 preset restores'); Core.applyPreset('v22'); }
  });
});
