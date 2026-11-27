import { describe, it, expect } from 'vitest';
import { load } from '../bot/bot.js';

const env = load();
const { Core, CONFIG } = env;

// 소모품 도구(reviews/23 3.10) 열다섯 가지를 하나씩 검사해요
function check(cond: unknown, msg: string) { expect.soft(!!cond, msg).toBe(true); }

const IDS = ['herbbag', 'wickshears', 'atlas', 'matchbundle', 'bundle', 'busyhand', 'firstknot', 'tornsleeve', 'stubjar', 'goblinbag', 'junkbox', 'windguard', 'kwakbox', 'fadedfuse', 'waistpouch'];

// 첫날 광산 안. 도구를 칸에 넣고 시작해요
function mineRun(seed: number, tools: string[] = [], opts?: any) {
  const r = Core.newRun(seed, opts); tools.forEach(t => r.owned.push(t)); Core.startDay(r); r.d.candle = 60; return r;
}
// 칸 c 옆에 설 자리를 열고 서요(지뢰·보물이 아닌 옆 칸)
function standBy(r: any, c: any, avoid?: any) {
  const f = r.d.floor, nbs = Core.neighbors(f, c.x, c.y).filter((n: any) => n !== avoid);
  const nb = nbs.find((n: any) => !n.haz) || nbs[0];
  nb.cover = 'open'; nb.haz = null; nb.mark = 0; r.d.px = nb.x; r.d.py = nb.y;
  return nb;
}
function coveredMine(f: any, pred?: (c: any) => boolean) { return f.cells.find((c: any) => c.haz === 'mine' && !c.removed && c.cover !== 'open' && !c.faded && (!pred || pred(c))); }
function coveredTreasure(f: any) { return f.cells.find((c: any) => c.haz === 'treasure' && !c.box && !c.removed && c.cover !== 'open' && c.mark !== 1); }
// 보물 하나를 곡괭이로 캐고 그때 붙은 보너스(ev.bonus)를 돌려줘요
function digBonus(r: any) {
  const t = coveredTreasure(r.d.floor); standBy(r, t); t.mark = 0;
  const n0 = r.fx.length; Core.hit(r, t.x, t.y);
  const g = r.fx.slice(n0).find((e: any) => e.t === 'gain');
  return g ? g.bonus : NaN;
}
function toShop(r: any) {
  Core.debugEndDay(r); Core.afterSettle(r);
  if (r.phase === 'payment') Core.afterPayment(r);
  if (r.phase === 'gift') Core.chooseGift(r, -1);
}

describe('소모품 도구', () => {
  it('열다섯 가지가 v2.2 진열에 나와요', () => {
    Core.applyPreset('v22');
    const pool = Core.toolPool().map((t: any) => t.id);
    check(IDS.every(id => pool.includes(id) && Core.TOOL_BY_ID[id].axis === '소모품' && Core.TOOL_BY_ID[id].desc && Core.TOOL_BY_ID[id].kind === 'passive'), 'all fifteen in the v22 pool');
    check(!['flint', 'restinghand', 'matchcase'].some(id => IDS.includes(id)), 'match-making tools are another group');
  });

  it('약초 주머니: 지뢰를 치지 않은 날 붕대', () => {
    Core.applyPreset('v22');
    const r = mineRun(7101, ['herbbag']); Core.returnUp(r);
    check(Core.consumableCount(r, 'bandage') === 1, 'clean day gives a bandage');
    const r2 = mineRun(7102, ['herbbag']); r2.d.stats.mines = 1; Core.returnUp(r2);
    check(Core.consumableCount(r2, 'bandage') === 0, 'a mine hit: no bandage');
  });

  it('심지 가위: 올라가면 남은 촛불 5마다 몽당초', () => {
    Core.applyPreset('v22');
    const r = mineRun(7201, ['wickshears']); r.d.candle = 23; Core.returnUp(r);
    check(Core.consumableCount(r, 'stub') === 4, '23 candles left: 4 stubs');
    const r2 = mineRun(7202, ['wickshears']); r2.d.candle = 4; Core.returnUp(r2);
    check(Core.consumableCount(r2, 'stub') === 0, '4 candles left: none');
  });

  it('옛 갱도 지도첩: 지뢰 없이 지하 5층부터 새 깊이', () => {
    Core.applyPreset('v22');
    const go = (r: any, depth: number) => { const f = r.d.floor; f.stair.found = true; f.forkOptions = Core.forkOptions(r, depth); r.d.px = f.stair.x; r.d.py = f.stair.y; r.d.candle = 60; return Core.descend(r, 0).ok; };
    const r = mineRun(7301, ['atlas']); r.stats.deepest = 4;
    check(go(r, 5) && Core.consumableCount(r, 'mapscrap') === 1, 'new deepest at 5: one map piece');
    check(go(r, 5) && Core.consumableCount(r, 'mapscrap') === 1, 'same depth again: none');
    const r2 = mineRun(7302, ['atlas']); r2.stats.deepest = 3;
    check(go(r2, 4) && Core.consumableCount(r2, 'mapscrap') === 0, 'depth 4 is too shallow');
    const r3 = mineRun(7303, ['atlas']); r3.stats.deepest = 5; r3.d.stats.mines = 1;
    check(go(r3, 6) && Core.consumableCount(r3, 'mapscrap') === 0, 'hit a mine today: none');
  });

  it('성냥 다발: 성냥 셋이면 셋을 써서 5×5', () => {
    Core.applyPreset('v22');
    // 지뢰 m에서 두 칸 떨어진, 다른 지뢰와 붙지 않은 칸에 보물을 묻어요. 3×3이면 남고 5×5면 휩쓸려요
    const setup = (seed: number, tools: string[]) => {
      const r = mineRun(seed, tools), f = r.d.floor;
      const isMine = (c: any) => c && c.haz === 'mine' && !c.removed;
      const far2 = (m: any) => f.cells.find((c: any) => Core.cheb(c.x, c.y, m.x, m.y) === 2 && !c.haz && c.cover !== 'open');   // 홀로 있는 지뢰라 이 지뢰 하나만 터져요
      const m = coveredMine(f, (c: any) => !Core.neighbors(f, c.x, c.y).some(isMine) && !!far2(c)), t = far2(m);
      t.haz = 'treasure'; t.tier = 1; t.mark = 0;
      standBy(r, m); Core.mark(r, m.x, m.y, 1);
      return { r, m, t };
    };
    const A = setup(7401, ['matchbundle']); Core.addConsumable(A.r, 'matchstick', 4);
    const u = Core.useConsumable(A.r, 'matchstick', { x: A.m.x, y: A.m.y });
    check(u.ok && u.n === 3 && Core.consumableCount(A.r, 'matchstick') === 1, 'three matches used at once');
    check(A.t.removed && A.t.cover === 'open', 'a treasure two cells away is swept by the 5×5');
    const B = setup(7401, ['matchbundle']); Core.addConsumable(B.r, 'matchstick', 2);
    const u2 = Core.useConsumable(B.r, 'matchstick', { x: B.m.x, y: B.m.y });
    check(u2.ok && u2.n === 1 && !B.t.removed && B.t.cover !== 'open', 'with two matches: one used, plain 3×3');
  });

  it('보따리: 소모품 하나마다 보물 값 +2%', () => {
    Core.applyPreset('v22');
    const r0 = mineRun(7501), b0 = digBonus(r0);
    const r = mineRun(7501, ['bundle']); Core.addConsumable(r, 'stub', 3); Core.addConsumable(r, 'bandage', 2);
    const b = digBonus(r);
    check(Math.abs((b - b0) - 0.1) < 1e-9, 'five consumables: +10% (' + b0 + ' -> ' + b + ')');
  });

  it('부지런한 손: 소모품을 쓰면 콤보 한 단계', () => {
    Core.applyPreset('v22');
    const r = mineRun(7601, ['busyhand']); Core.addConsumable(r, 'stub', 1);
    const s0 = r.d.streak;
    check(Core.useConsumable(r, 'stub').ok && r.d.streak === s0 + 1, 'stub use: combo +1');
  });

  it('응급 매듭: 체력이 가득할 때 붕대로 콤보 두 단계', () => {
    Core.applyPreset('v22');
    const r = mineRun(7701, ['firstknot']); Core.addConsumable(r, 'bandage', 2);
    check(r.d.hp === r.d.hpMax, 'starts at full hp');
    const u = Core.useConsumable(r, 'bandage');
    check(u.ok && r.d.streak === 2 && Core.consumableCount(r, 'bandage') === 1 && r.d.hp === r.d.hpMax, 'full hp: bandage used, combo +2');
    r.d.hp = r.d.hpMax - 1; const s1 = r.d.streak;
    check(Core.useConsumable(r, 'bandage').ok && r.d.streak === s1 && r.d.hp === r.d.hpMax, 'not full: heals, no combo');
  });

  it('찢은 소매: 지뢰를 쳐서 체력 1이면 붕대(하루 한 번)', () => {
    Core.applyPreset('v22');
    const r = mineRun(7801, ['tornsleeve']);
    const hitMine = () => { const m = coveredMine(r.d.floor, (c: any) => c.mark !== 1); standBy(r, m); m.mark = 0; Core.hit(r, m.x, m.y); };
    r.d.hp = 2; hitMine();
    check(r.d.hp === 1 && Core.consumableCount(r, 'bandage') === 1, 'hp 2 -> 1: a bandage');
    r.d.hp = 2; hitMine();
    check(r.d.hp === 1 && Core.consumableCount(r, 'bandage') === 1, 'second time the same day: none');
  });

  it('초 동강 통: 층의 보물을 모두 캐고 떠나면 몽당초', () => {
    Core.applyPreset('v22');
    const T = (f: any) => f.cells.filter((c: any) => c.haz === 'treasure' || c.haz === 'chunk');
    const r = mineRun(7901, ['stubjar']); T(r.d.floor).forEach((c: any) => { c.removed = true; c.cover = 'open'; }); Core.returnUp(r);
    check(Core.consumableCount(r, 'stub') === 1, 'all treasures dug: a stub');
    const r2 = mineRun(7902, ['stubjar']); const L = T(r2.d.floor); L.slice(1).forEach((c: any) => { c.removed = true; }); Core.returnUp(r2);
    check(L.length > 1 && Core.consumableCount(r2, 'stub') === 0, 'one left: none');
    const r3 = mineRun(7903, ['stubjar']); const L3 = T(r3.d.floor); L3.forEach((c: any) => { c.removed = true; }); L3[0].melted = true; Core.returnUp(r3);
    check(Core.consumableCount(r3, 'stub') === 0, 'a melted treasure: none');
  });

  it('도깨비 주머니: 밤마다 가장 많은 소모품 하나(지도 조각은 빼고)', () => {
    Core.applyPreset('v22');
    const r = mineRun(8001, ['goblinbag']);
    Core.addConsumable(r, 'bandage', 2); Core.addConsumable(r, 'stub', 3); Core.addConsumable(r, 'mapscrap', 5);
    toShop(r);
    check(r.phase === 'shop' && Core.consumableCount(r, 'stub') === 4 && Core.consumableCount(r, 'bandage') === 2 && Core.consumableCount(r, 'mapscrap') === 5, 'night: stub 3 -> 4, map pieces untouched');
  });

  it('잡동사니 상자: 세 가지 이상이면 보물 값 +20%', () => {
    Core.applyPreset('v22');
    const r0 = mineRun(8101), b0 = digBonus(r0);
    const r = mineRun(8101, ['junkbox']); Core.addConsumable(r, 'stub', 1); Core.addConsumable(r, 'bandage', 1); Core.addConsumable(r, 'matchstick', 1);
    check(Math.abs(digBonus(r) - b0 - 0.2) < 1e-9, 'three kinds: +20%');
    const r2 = mineRun(8101, ['junkbox']); Core.addConsumable(r2, 'stub', 1); Core.addConsumable(r2, 'bandage', 5);
    check(Math.abs(digBonus(r2) - b0) < 1e-9, 'two kinds: nothing');
  });

  it('바람막이: 촛불 5 이하면 몽당초가 6', () => {
    Core.applyPreset('v22');
    const r = mineRun(8201, ['windguard']); Core.addConsumable(r, 'stub', 2);
    r.d.candle = 5; Core.useConsumable(r, 'stub');
    check(r.d.candle === 11, 'candle 5: +6');
    r.d.candle = 6; Core.useConsumable(r, 'stub');
    check(r.d.candle === 9, 'candle 6: +3');
  });

  it('곽 씨 성냥갑: 성냥으로 지뢰 2개 이상이면 성냥이 돌아와요(층마다 한 번)', () => {
    Core.applyPreset('v22');
    const r = mineRun(8301, ['kwakbox']), f = r.d.floor;
    // 지뢰 둘이 붙은 자리를 만들어요
    const pairUp = () => {
      const m = coveredMine(f, (c: any) => c.mark !== 1);
      const n = Core.neighbors(f, m.x, m.y).find((c: any) => c.cover !== 'open' && (!c.haz || c.haz === 'mine')); n.haz = 'mine'; n.mark = 0;
      standBy(r, m, n); Core.mark(r, m.x, m.y, 1); return m;
    };
    Core.addConsumable(r, 'matchstick', 2);
    const m1 = pairUp(), u = Core.useConsumable(r, 'matchstick', { x: m1.x, y: m1.y });
    check(u.ok && u.mines >= 2 && Core.consumableCount(r, 'matchstick') === 2, 'two mines: the match comes back');
    const m2 = pairUp(), u2 = Core.useConsumable(r, 'matchstick', { x: m2.x, y: m2.y });
    check(u2.ok && u2.mines >= 2 && Core.consumableCount(r, 'matchstick') === 1, 'second time on the floor: not returned');
  });

  it('바랜 도화선: 바랜 X 칸 발파는 촛불이 들지 않아요', () => {
    Core.applyPreset('v22');
    const r = mineRun(8401, ['fadedfuse']), f = r.d.floor;
    const m = coveredMine(f); standBy(r, m); m.mark = 1; m.faded = 1; m.givenX = true;
    const c0 = r.d.candle;
    check(Core.ignite(r, m.x, m.y).ok && r.d.candle === c0, 'faded X: free blast');
    const m2 = coveredMine(f); standBy(r, m2); Core.mark(r, m2.x, m2.y, 1);
    const c1 = r.d.candle;
    check(Core.ignite(r, m2.x, m2.y).ok && r.d.candle === c1 - Core.igniteCost(r), 'own X: costs candle');
  });

  it('허리 주머니: 소모품 한 가지는 칸을 차지하지 않아요', () => {
    Core.applyPreset('v22');
    const r = mineRun(8501, ['waistpouch']); Core.addConsumable(r, 'stub', 3); Core.addConsumable(r, 'bandage', 1);
    check(Core.slotsUsed(r) === 2, 'tool 1 + two kinds - one free = 2');
    check(CONFIG.shop.passiveSlots === Core.slotsOf(r), 'slot count unchanged');
  });
});
