import { describe, it, expect } from 'vitest';
import { load } from '../bot/bot.js';

// 깊이·하루·금고·칸 도구(reviews/23 3.7~3.8): 도구 효과 하나에 검사 하나
const env = load();
const { Core, CONFIG } = env;
function check(cond: unknown, msg: string) { expect.soft(!!cond, msg).toBe(true); }

function mineRun(seed: number, owned: string[] = []) { Core.applyPreset('v22'); const r = Core.newRun(seed); r.owned = owned.slice(); Core.startDay(r); return r; }
// 덮인 보물 칸(연장함·덩이 아님) 하나를 캐요. 옆 칸을 열어 설 자리를 만들어요
function digTreasure(r: any) {
  const f = r.d.floor, t = f.cells.find((c: any) => c.haz === 'treasure' && !c.removed && c.cover !== 'open' && !c.box && !c.chunk && !c.mark);
  const nb = Core.neighbors(f, t.x, t.y).find((c: any) => !c.haz && !c.stair) || Core.neighbors(f, t.x, t.y)[0];
  nb.cover = 'open'; nb.haz = null; r.d.px = nb.x; r.d.py = nb.y; r.d.candle = Math.max(r.d.candle, 20);
  Core.hit(r, t.x, t.y);
  return t;
}
function hitMine(r: any) {
  const f = r.d.floor, m = f.cells.find((c: any) => c.haz === 'mine' && !c.removed && c.cover !== 'open' && !c.faded);
  const nb = Core.neighbors(f, m.x, m.y).find((c: any) => !c.haz && !c.stair) || Core.neighbors(f, m.x, m.y)[0];
  nb.cover = 'open'; nb.haz = null; r.d.px = nb.x; r.d.py = nb.y; r.d.candle = Math.max(r.d.candle, 20);
  Core.hit(r, m.x, m.y);
}
// 계단에 서서 내려가요. 돌려주는 값: 든 촛불
function descendOnce(r: any) {
  const f = r.d.floor; f.stair.found = true; f.forkOptions = Core.forkOptions(r, f.depth + 1); r.d.px = f.stair.x; r.d.py = f.stair.y; r.d.candle = 60;
  const before = r.d.candle, res = Core.descend(r, 0);
  return res.ok ? before - r.d.candle : -1;
}
// 하루를 끝내고 밤 상점까지(도장 날이 아닐 때)
function toShop(r: any) { Core.debugEndDay(r); Core.afterSettle(r); }

describe('깊이·하루·금고·칸 도구', () => {
  it('열넷 모두 v2.2 상점 풀에 있어요', () => {
    Core.applyPreset('v22');
    const ids = ['stairchart', 'deeppocket', 'deeppick', 'minecart', 'kwakmark', 'goldtooth', 'interest', 'piggy', 'haggle', 'shelf', 'giftwrap', 'emptycharm', 'fullset', 'mimic'];
    const pool = Core.toolPool().map((t: any) => t.id);
    ids.forEach(id => check(pool.indexOf(id) >= 0 && Core.TOOL_BY_ID[id].desc && Core.TOOL_BY_ID[id].kind === 'passive', id + ' in v22 pool'));
  });

  it('계단 표: 세 번째 계단은 촛불이 들지 않고, 미리 보기는 셈을 바꾸지 않아요', () => {
    const r = mineRun(7101, ['stairchart']);
    const c1 = descendOnce(r), c2 = descendOnce(r);
    const pre = Core.descendCost(r, r.d.floor.depth + 1), pre2 = Core.descendCost(r, r.d.floor.depth + 1);
    const c3 = descendOnce(r), c4 = descendOnce(r);
    check(c1 > 0 && c2 > 0 && c4 > 0, 'first, second and fourth cost candle');
    check(pre === 0 && pre2 === 0 && c3 === 0, 'third is free and preview matches');
  });

  it('깊은 주머니: 내려갈 때마다 금고 +10, 하루 끝 줄에 남아요', () => {
    const r = mineRun(7102, ['deeppocket']), cash0 = r.cash;
    descendOnce(r); descendOnce(r);
    check(r.cash === cash0 + 20, 'vault +10 per descent');
    Core.debugEndDay(r);
    check(r.settle.vault.some((q: any) => q.n === 20) && r.settle.after - r.settle.before === r.settle.net + 20, 'settle shows the vault line');
  });

  it('심층 곡괭이: 지하 4층부터 25% 높아요', () => {
    const a = mineRun(7103, []), b = mineRun(7103, ['deeppick']), c = mineRun(7103, ['deeppick']);
    a.d.floor.depth = 4; b.d.floor.depth = 4;
    digTreasure(a); digTreasure(b); digTreasure(c);
    check(a.d.pocket > 0 && b.d.pocket === Math.floor(a.d.pocket * 1.25), 'depth 4: +25%');
    check(c.d.pocket === a.d.pocket, 'depth 1: no bonus');
  });

  it('광차: 지하 1~2층 보물은 85%로 금고에 바로, 쓰러져도 남아요', () => {
    const a = mineRun(7104, []), b = mineRun(7104, ['minecart']);
    digTreasure(a); digTreasure(b);
    const full = a.d.pocket;
    check(b.d.pocket === 0 && b.cash === Math.floor(full * 0.85), 'goes to vault at 85%');
    b.d.hp = 1; const cash1 = b.cash; hitMine(b);
    check(b.phase === 'settle' && b.cash >= cash1, 'collapse keeps it');
  });

  it('곽 씨 표식: 쓰러져 잃은 돈의 절반을 다음 날 그 깊이에서 되찾아요', () => {
    const r = mineRun(7105, ['kwakmark']);
    r.d.pocket = 200; r.d.hp = 1; hitMine(r);
    check(r.phase === 'settle' && r.settle.lost > 0, 'collapsed and lost');
    const lost = r.settle.lost;
    Core.afterSettle(r); Core.nextDay(r); Core.startDay(r);   // 다음 날 지하 1층(쓰러진 깊이)에서 시작
    check(r.d.pocketLines.kwak === Math.floor(lost * 0.5) && r.d.pocket >= Math.floor(lost * 0.5), 'half regained on arrival');
    check(!r.toolRun.kwakmark.drop, 'drop is used up');
  });

  it('금 이빨: 보물마다 +10, 다치면 오늘 주머니 10%를 잃어요', () => {
    const a = mineRun(7106, []), b = mineRun(7106, ['goldtooth']);
    digTreasure(a); digTreasure(b);
    check(b.d.pocket === a.d.pocket + 10, 'flat +10');
    const p = mineRun(7116, []), q = mineRun(7116, ['goldtooth']);
    p.d.pocket = 300; q.d.pocket = 300; hitMine(p); hitMine(q);
    check(q.d.hp === 2 && q.d.pocketLines.tooth === 30 && q.d.pocket === p.d.pocket - 30, 'lose 10% of pocket when hurt');
  });

  it('이자 장부: 밤마다 금고 100마다 5(최대 25)', () => {
    const r = mineRun(7107, ['interest']); r.cash = 430; r.d.pocket = 0;
    Core.debugEndDay(r);
    check(r.cash === 450, '430 -> +20');
    const q = mineRun(7107, ['interest']); q.cash = 2000; q.d.pocket = 0;
    Core.debugEndDay(q);
    check(q.cash === 2025, 'cap 25');
  });

  it('저금 단지: 밤마다 파는 값 +40, 팔면 처음부터', () => {
    const r = mineRun(7108, ['piggy']);
    const v0 = Core.sellPrice(r, 'piggy');
    toShop(r);
    check(Core.sellPrice(r, 'piggy') === v0 + 40, 'one night +40');
    Core.nextDay(r); Core.startDay(r); toShop(r);
    check(Core.sellPrice(r, 'piggy') === v0 + 80, 'two nights +80');
    check(Core.sellBack(r, 'piggy').cash === v0 + 80, 'sold at the grown value');
    r.owned.push('piggy');
    check(Core.sellPrice(r, 'piggy') === v0, 'rebought one starts over');
  });

  it('흥정 수첩: 다른 물건 값이 20부터 20씩', () => {
    const r = mineRun(7109, ['haggle']); toShop(r); r.cash = 1000;
    check(r.phase === 'shop' && Core.rerollPrice(r) === 20, 'starts at 20');
    Core.reroll(r);
    check(Core.rerollPrice(r) === 40 && r.cash === 980, 'then 40');
    const q = mineRun(7109, []); toShop(q);
    check(Core.rerollPrice(q) === CONFIG.shop.reroll, 'without it: usual price');
  });

  it('진열대: 상점 진열이 한 자리 늘어요(다른 물건을 봐도)', () => {
    const r = mineRun(7110, ['shelf']); toShop(r); r.cash = 1000;
    const n = CONFIG.shop.tools + 1;
    check(r.shop.stock.length === n && r.shop.stock.every((id: any) => id), 'four tools on the shelf');
    Core.reroll(r);
    check(r.shop.stock.length === n && new Set(r.shop.stock).size === n, 'reroll keeps four distinct tools');
  });

  it('선물 보자기: 도장 선물 금고 돈이 두 배', () => {
    const r = mineRun(7111, ['giftwrap']); r.day = 3; r.cash = 1000; r.d.pocket = 0;
    Core.debugEndDay(r); Core.afterSettle(r);
    check(r.phase === 'payment' && r.payment.ok, 'paid first stamp');
    Core.afterPayment(r);
    check(r.phase === 'gift' && r.giftCash === CONFIG.stampReward.cash[0] * 2, 'cash doubled');
    const cash = r.cash; Core.chooseGift(r, -1);
    check(r.cash === cash + CONFIG.stampReward.cash[0] * 2, 'received doubled cash');
  });

  it('빈 칸 부적: 빈 칸(제 자리 포함)마다 15%, 소모품은 칸을 차지해요', () => {
    const a = mineRun(7112, []), b = mineRun(7112, ['emptycharm']);
    check(Core.emptySlots(b) === Core.slotsOf(b), 'own slot counts as empty');
    Core.addConsumable(b, 'stub', 1);
    const e = Core.emptySlots(b);
    check(e === Core.slotsOf(b) - 1, 'a consumable takes a slot');
    digTreasure(a); digTreasure(b);
    check(b.d.pocket === Math.floor(a.d.pocket * (1 + 0.15 * e) + 1e-6), '+15% per empty slot');
  });

  it('한 벌 연장: 가진 도구 하나마다 4%', () => {
    const a = mineRun(7113, []), b = mineRun(7113, ['fullset', 'gloves', 'amulet']);
    digTreasure(a); digTreasure(b);
    check(b.d.pocket === Math.floor(a.d.pocket * 1.12 + 1e-6), '3 tools: +12%');
  });

  it('본뜬 연장: 바로 오른쪽 도구를 한 번 더, 자리를 바꾸면 따라가요', () => {
    const a = mineRun(7114, ['mimic', 'goldtooth']), b = mineRun(7114, ['goldtooth', 'mimic']), c = mineRun(7114, []);
    check(Core.mimicTarget(a) === 'goldtooth' && Core.mimicTarget(b) === null, 'target is the right slot; consumable or empty is nothing');
    digTreasure(a); digTreasure(b); digTreasure(c);
    check(a.d.pocket === c.d.pocket + 20 && b.d.pocket === c.d.pocket + 10, 'copied flat bonus applies twice');
    const r = mineRun(7115, ['mimic', 'shortwick']);
    check(Math.abs(Core.keepSum(r, 'treasureBonus') - 0.5) < 1e-9 && Core.keepSum(r, 'candle') === -30, 'stat fields counted again');
    const h = mineRun(7116, ['mimic', 'crown']);
    check(Core.streakCapIdx(h) === CONFIG.streakCapIdx + 2 * CONFIG.streakCapPlusHat, 'copied cap adds again');
    check(Core.moveTool(h, 0, 1).ok && h.owned.join() === 'crown,mimic' && Core.streakCapIdx(h) === CONFIG.streakCapIdx + CONFIG.streakCapPlusHat, 'swap moves the copy away');
    check(Core.moveTool(h, 0, 5).ok && h.owned.join() === 'mimic,crown', 'drop on an empty slot moves to the end');
    const g = mineRun(7117, ['mimic', 'gloves']);   // 하루 한 번짜리도 따로 세서 하루 두 번
    g.d.streak = 4; hitMine(g);
    check(g.d.streak === 3, 'first break: one step down');
    g.d.streak = 4; hitMine(g);
    check(g.d.streak === 3, 'second break: the copy holds too');
  });
});
