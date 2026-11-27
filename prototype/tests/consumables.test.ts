import { describe, it, expect } from 'vitest';
import { load } from '../bot/bot.js';

const env = load();
const { Core, CONFIG, TOOLS } = env;

// 조건이 거짓이면 실패로 기록하고 다음 검사를 이어 가요(한 번에 실패를 전부 보려고)
function check(cond: unknown, msg: string) { expect.soft(!!cond, msg).toBe(true); }

// 판 위에 선 채로 쓸 수 있게: 첫날 광산 안
function mineRun(seed: number, opts?: any) { const r = Core.newRun(seed, opts); Core.startDay(r); return r; }
// 지뢰 칸 하나 옆에 서고 X를 그어요(옆 칸은 열어서 설 자리를 만들어요)
function standByMine(r: any) {
  const f = r.d.floor, m = f.cells.find((c: any) => c.haz === 'mine' && c.cover !== 'open' && !c.faded);
  const nb = Core.neighbors(f, m.x, m.y).find((c: any) => !c.haz) || Core.neighbors(f, m.x, m.y)[0];
  nb.cover = 'open'; nb.haz = null; r.d.px = nb.x; r.d.py = nb.y;
  Core.mark(r, m.x, m.y, 1);
  return m;
}
// 옛 연장함 하나를 캐기까지(지하 2층부터, 2일째부터 나와요)
function digBox(seed: number) {
  const q = Core.newRun(seed); Core.debugSkipDay(q); Core.startDay(q);
  for (let k = 0; k < 6; k++) {
    const f = q.d.floor;
    if (f.box && f.box.state === 'buried') {
      const bc = Core.cellAt(f, f.box.x, f.box.y), nb = Core.neighbors(f, bc.x, bc.y)[0];
      nb.cover = 'open'; nb.haz = null; q.d.px = nb.x; q.d.py = nb.y; q.d.candle = 80;
      Core.hit(q, bc.x, bc.y);
      return q.boxOffer ? q : null;
    }
    f.stair.found = true; f.forkOptions = Core.forkOptions(q, f.depth + 1); q.d.px = f.stair.x; q.d.py = f.stair.y; q.d.candle = 80;
    if (!Core.descend(q, 0).ok) return null;
  }
  return null;
}

describe('소모품', () => {
  it('표와 id가 도구·유물과 겹치지 않아요', () => {
    Core.applyPreset('v22');
    check(Core.CONSUMABLES.length === 4 && ['matchstick', 'bandage', 'stub', 'mapscrap'].every(id => Core.CONS_BY_ID[id]), 'four consumables');
    check(Core.CONSUMABLES.every((k: any) => !Core.TOOL_BY_ID[k.id] && !Core.KEEP_BY_ID[k.id] && k.name && k.desc && k.icon), 'ids distinct from tools and keepsakes');
    check(CONFIG.features.consumables === true, 'v22 turns consumables on');
    check(TOOLS.every((t: any) => t.kind !== 'consumable' || t.sets.indexOf('22') < 0), 'no consumable is sold in the v22 shop');
  });

  it('쌓이고, 칸을 함께 쓰고, 칸이 가득이면 새것은 생기지 않아요', () => {
    Core.applyPreset('v22');
    const r = mineRun(9101);
    check(Core.slotsUsed(r) === 0 && Core.consumableTotal(r) === 0, 'empty at start');
    check(Core.addConsumable(r, 'bandage', 2) === 2 && Core.addConsumable(r, 'bandage', 3) === 2 + 1 && Core.consumableCount(r, 'bandage') === 5, 'same kind stacks without limit');
    check(r.consumables.length === 1 && Core.slotsUsed(r) === 1, 'one kind takes one slot');
    Core.addConsumable(r, 'stub', 1);
    check(Core.slotsUsed(r) === 2 && Core.consumableTotal(r) === 6, 'second kind takes a second slot');
    check(Core.addConsumable(r, 'nope', 1) === 0 && Core.addConsumable(r, 'stub', 0) === 0, 'unknown id or zero adds nothing');
    // 칸 가득: 도구 6 + 소모품 2 = 8
    r.owned = ['gloves', 'lastcard', 'crown', 'amulet', 'betchalk', 'fuse'];
    check(Core.slotsUsed(r) === Core.slotsOf(r), 'tools and consumables fill the slots together');
    check(Core.addConsumable(r, 'mapscrap', 1) === 0 && Core.consumableCount(r, 'mapscrap') === 0, 'full: a new kind is not created');
    check(Core.addConsumable(r, 'stub', 4) === 4 && Core.consumableCount(r, 'stub') === 5, 'full: an existing kind still stacks');
    // 상점에서도 소모품이 칸을 차지해요
    Core.debugEndDay(r); Core.afterSettle(r);
    if (r.phase === 'payment') Core.afterPayment(r);
    if (r.phase === 'gift') Core.chooseGift(r, -1);
    check(r.phase === 'shop', 'reached the shop');
    const si = r.shop.stock.findIndex((id: string) => id && !Core.owns(r, id)); r.cash = 1e6;
    check(si < 0 || Core.buy(r, si).full, 'full slots block buying a tool');
    // 버리기: 돈 없이 칸이 비어요. 팔 수는 없어요
    const cash0 = r.cash, d1 = Core.discardConsumable(r, 'bandage');
    check(d1.ok && d1.n === 5 && Core.consumableCount(r, 'bandage') === 0 && r.cash === cash0 && Core.slotsUsed(r) === 7, 'discard frees the slot for 0');
    check(!Core.sellBack(r, 'stub').ok && Core.consumableCount(r, 'stub') === 5, 'consumables cannot be sold');
    check(!Core.discardConsumable(r, 'bandage').ok, 'nothing to discard');
    // 칸을 덜 쓰는 도구용 손잡이: consSlotFree
    const r2 = mineRun(9102); Core.addConsumable(r2, 'stub', 1); Core.addConsumable(r2, 'bandage', 1);
    const fake: any = { id: 'zz_pouch', kind: 'passive', consSlotFree: 1 }; Core.TOOL_BY_ID.zz_pouch = fake; r2.owned.push('zz_pouch');
    check(Core.slotsUsed(r2) === 2, 'a consSlotFree tool lets one consumable kind skip its slot');
    delete Core.TOOL_BY_ID.zz_pouch;
  });

  it('붕대·몽당초·지도 조각', () => {
    Core.applyPreset('v22');
    // 붕대: 체력 +1, 가득이면 쓰지 않고 그대로
    const r = mineRun(9201); Core.addConsumable(r, 'bandage', 2);
    const u0 = Core.useConsumable(r, 'bandage');
    check(!u0.ok && u0.refused && Core.consumableCount(r, 'bandage') === 2, 'full hp: bandage refused and kept');
    r.d.hp = r.d.hpMax - 1;
    const u1 = Core.useConsumable(r, 'bandage');
    check(u1.ok && u1.hp === 1 && r.d.hp === r.d.hpMax && Core.consumableCount(r, 'bandage') === 1, 'bandage heals 1');
    r.d.hp = 1; Core.useConsumable(r, 'bandage');
    check(r.d.hp === 2 && Core.consumableCount(r, 'bandage') === 0 && r.consumables.length === 0, 'used up: slot frees');
    check(!Core.useConsumable(r, 'bandage').ok, 'cannot use what you do not have');
    // 몽당초: 촛불 +3
    Core.addConsumable(r, 'stub', 1); const c0 = r.d.candle;
    const u2 = Core.useConsumable(r, 'stub');
    check(u2.ok && r.d.candle === c0 + CONFIG.consumables.stub && CONFIG.consumables.stub === 3, 'stub candle +3');
    // 지도 조각: 숫자로 모르는 지뢰 하나에 바랜 X
    const rm = mineRun(9202), f = rm.d.floor; Core.addConsumable(rm, 'mapscrap', 2);
    const before = Core.mapTargets(rm).length;
    const u3 = Core.useConsumable(rm, 'mapscrap'), mc = Core.cellAt(f, u3.x, u3.y);
    check(before > 0 && u3.ok && mc.haz === 'mine' && mc.mark === 1 && mc.faded === 1 && mc.givenX, 'map piece puts a faded X on a mine');
    check(Core.mapTargets(rm).length < before && Core.mapTargets(rm).indexOf(mc) < 0, 'that mine is no longer a target');
    check(!Core.mark(rm, mc.x, mc.y).ok && mc.mark === 1, 'faded X cannot be changed');
    // 모르는 지뢰가 없으면 쓰지 않고 그대로
    f.cells.forEach((c: any) => { if (c.haz === 'mine' && c.cover !== 'open') { c.faded = 1; c.mark = 1; c.givenX = true; } });
    const u4 = Core.useConsumable(rm, 'mapscrap');
    check(!u4.ok && u4.refused && Core.consumableCount(rm, 'mapscrap') === 1, 'no unknown mine: map piece refused and kept');
    // 광산 밖(상점)에서는 쓰지 않아요
    Core.debugEndDay(rm); Core.afterSettle(rm);
    check(!Core.useConsumable(rm, 'mapscrap').ok && Core.consumableCount(rm, 'mapscrap') === 1, 'not usable outside the mine');
  });

  it('성냥: 다음 X 칸 동작이 촛불 없이', () => {
    Core.applyPreset('v22');
    const r = mineRun(9301), m = standByMine(r); Core.addConsumable(r, 'matchstick', 2);
    const c0 = r.d.candle, hp0 = r.d.hp;
    const u = Core.useConsumable(r, 'matchstick', { x: m.x, y: m.y });
    check(u.ok && u.mines >= 1 && m.removed && r.d.candle === c0 && r.d.hp === hp0, 'match blasts the X for free');
    check(Core.consumableCount(r, 'matchstick') === 1 && !r.d.freeX, 'one match used, flag cleared');
    check(!Core.useConsumable(r, 'matchstick').ok && Core.useConsumable(r, 'matchstick').needTarget, 'match needs a target');
    const plain = r.d.floor.cells.find((c: any) => c.cover !== 'open' && c.mark !== 1);
    check(!Core.useConsumable(r, 'matchstick', { x: plain.x, y: plain.y }).ok && Core.consumableCount(r, 'matchstick') === 1, 'non-X cell: refused and kept');
    // 다음 발파는 다시 촛불이 들어요
    const m2 = standByMine(r), c1 = r.d.candle;
    Core.ignite(r, m2.x, m2.y);
    check(r.d.candle === c1 - Core.igniteCost(r), 'next plain blast costs candle again');
    // 그냥 ignite도 d.freeX를 지켜요(캐릭터 X 동작이 같은 신호를 봐요)
    const m3 = standByMine(r), c2 = r.d.candle; r.d.freeX = { id: 'matchstick' };
    const rb = Core.ignite(r, m3.x, m3.y);
    check(rb.ok && r.d.candle === c2 && !r.d.freeX, 'plain ignite honors the free flag and clears it');
    // 멀리 있는 X 칸이면 옆까지 걸어가요
    const r3 = mineRun(9302), m4 = standByMine(r3); Core.addConsumable(r3, 'matchstick', 1);
    const f3 = r3.d.floor, open = f3.cells.filter((c: any) => c.cover === 'open' && Core.walkable(f3, c) && Core.cheb(c.x, c.y, m4.x, m4.y) > 1);
    if (open.length) { const far = open[0]; r3.d.px = far.x; r3.d.py = far.y; }
    const c3 = r3.d.candle, u5 = Core.useConsumable(r3, 'matchstick', { x: m4.x, y: m4.y });
    check(u5.ok && r3.d.candle === c3 && Core.cheb(r3.d.px, r3.d.py, m4.x, m4.y) === 1, 'match walks next to a far X');
    // 다른 캐릭터의 X 동작도(해체공은 촛불 5)
    const rd = mineRun(9303, { char: 'defuser' }), md = standByMine(rd); Core.addConsumable(rd, 'matchstick', 1);
    const cd = rd.d.candle;
    check(Core.useConsumable(rd, 'matchstick', { x: md.x, y: md.y }).ok && rd.d.candle === cd, 'defuser X action is free with a match');
  });

  it('도구 신호: 얻을 때, 쓸 때 고치기', () => {
    Core.applyPreset('v22');
    const seen: string[] = [];
    const fake: any = { id: 'zz_wind', kind: 'passive', name: 'test', icon: 'gloves', hooks: {
      on_consumable_gain: (ctx: any, ev: any) => { seen.push('gain:' + ev.id + ':' + ev.n + ':' + ev.source); },
      on_consumable_check: (ctx: any, ev: any) => { if (ev.id === 'bandage') ev.refuse = ''; },
      on_consumable_use: (ctx: any, ev: any) => { seen.push('use:' + ev.id); if (ev.id === 'stub') ev.candle = 6; },
      on_consumable_used: (ctx: any, ev: any) => { seen.push('used:' + ev.id + ':' + ev.n); }
    } };
    Core.TOOL_BY_ID.zz_wind = fake;
    const r = mineRun(9401); r.owned.push('zz_wind');
    Core.addConsumable(r, 'stub', 1, 'test'); const c0 = r.d.candle;
    check(Core.useConsumable(r, 'stub').ok && r.d.candle === c0 + 6, 'a tool can change the stub amount (ev.candle)');
    Core.addConsumable(r, 'bandage', 1);
    check(r.d.hp === r.d.hpMax && Core.useConsumable(r, 'bandage').ok, 'a tool can allow a bandage at full hp (clear ev.refuse)');
    check(seen.join() === 'gain:stub:1:test,use:stub,used:stub:1,gain:bandage:1:,use:bandage,used:bandage:1', 'events in order: ' + seen.join());
    // ctx로 소모품 만들기
    fake.hooks.on_day_start = (c: any) => { c.addConsumable('matchstick', 2, '시험'); };
    Core.debugEndDay(r); Core.debugSkipDay(r); Core.startDay(r);
    check(Core.consumableCount(r, 'matchstick') >= 2, 'tools can make consumables through ctx.addConsumable');
    delete Core.TOOL_BY_ID.zz_wind;
  });

  it('저장하고 불러와도 그대로', () => {
    Core.applyPreset('v22');
    const r = mineRun(9501); Core.addConsumable(r, 'stub', 4); Core.addConsumable(r, 'mapscrap', 1);
    const back = JSON.parse(JSON.stringify(r));
    check(Core.consumableCount(back, 'stub') === 4 && Core.consumableCount(back, 'mapscrap') === 1 && Core.slotsUsed(back) === 2, 'roundtrip keeps stacks');
    const c0 = back.d.candle;
    check(Core.useConsumable(back, 'stub').ok && back.d.candle === c0 + 3 && Core.consumableCount(back, 'stub') === 3, 'loaded run can use them');
    const old = JSON.parse(JSON.stringify(r)); delete old.consumables;   // 소모품 전 저장
    check(Core.consumableTotal(old) === 0 && Core.slotsUsed(old) === 0 && Core.addConsumable(old, 'bandage', 1) === 1, 'old saves without the field still work');
  });

  it('옛 연장함에서 소모품 묶음이 나와요', () => {
    Core.applyPreset('v22');
    let boxes = 0, withCons = 0, sample: any = null;
    for (let sd = 9600; sd < 9900 && boxes < 30; sd++) {
      const q = digBox(sd); if (!q || q.boxOffer.keep || q.boxOffer.scorch) continue;
      boxes++;
      const B = q.boxOffer;
      if (B.cons) {
        withCons++;
        const rule = CONFIG.consumables.box.find((b: any) => b.id === B.cons.id);
        check(!!rule && rule.n === B.cons.n && B.opts.length === CONFIG.relic.n - 1, 'cons bundle replaces one tool pick');
        if (!sample) sample = q;
      } else check(B.opts.length === CONFIG.relic.n, 'plain box keeps two tool picks');
    }
    check(boxes >= 10 && withCons > 0 && withCons < boxes, 'some boxes carry a bundle: ' + withCons + '/' + boxes);
    if (sample) {
      const B = sample.boxOffer, id = B.cons.id, n = B.cons.n;
      // 칸 가득: 같은 것이 없으면 하나를 내려놓아야 해요
      sample.owned = ['gloves', 'lastcard', 'crown', 'amulet', 'betchalk', 'fuse', 'wedge', 'sieve'].filter((t: string) => !B.opts.includes(t)).slice(0, 8);
      while (sample.owned.length < 8) sample.owned.push(['tongs', 'refiner', 'regular', 'firstdig'].find((t: string) => !sample.owned.includes(t) && !B.opts.includes(t)));
      check(!Core.chooseBox(sample, B.opts.length).ok && !!sample.boxOffer, 'full slots: bundle needs a drop');
      const drop = sample.owned[0], pk = sample.d.pocket;
      const cb = Core.chooseBox(sample, B.opts.length, drop);
      check(cb.ok && Core.consumableCount(sample, id) === n && !sample.owned.includes(drop) && sample.d.pocket > pk && !sample.boxOffer, 'swap a tool for the bundle');
    }
    // 같은 것이 있으면 칸이 가득이어도 쌓여요
    const rs = mineRun(9901); rs.owned = ['gloves', 'lastcard', 'crown', 'amulet', 'betchalk', 'fuse', 'wedge']; Core.addConsumable(rs, 'stub', 1);
    rs.boxOffer = { opts: ['sieve'], cons: { id: 'stub', n: 2 }, scorch: false, quote: '' };
    check(Core.chooseBox(rs, 1).ok && Core.consumableCount(rs, 'stub') === 3 && Core.slotsUsed(rs) === 8, 'bundle stacks onto the same kind when full');
    // 소모품을 내려놓고 도구 받기
    rs.boxOffer = { opts: ['sieve'], scorch: false, quote: '' };
    check(Core.chooseBox(rs, 0, 'stub').ok && rs.owned.includes('sieve') && Core.consumableCount(rs, 'stub') === 0, 'drop a consumable stack to take a tool');
    // v2.1에는 나오지 않아요
    Core.applyPreset('v21');
    check(CONFIG.features.consumables === false, 'v21 has no consumables');
    Core.applyPreset('v22');
  });
});
