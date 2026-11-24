import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { load } from '../bot/bot.js';

// 시드 기준 데이터(reviews/15 6장): 정해진 시드와 정해진 선택으로 15일을 돌려
// 층마다 지뢰·보물·계단·연장함·바랜 자국 자리를 짧은 지문으로, 밤마다 상점 진열을 남겨요.
// Godot으로 옮긴 규칙이 같은 지문을 내면 이식이 맞은 거예요.
// 규칙을 일부러 바꿨으면 UPDATE_GOLDEN=1 npm test 로 다시 만들고 결정 기록에 남겨요.
const env = load();
const Core: any = env.Core;
const FILE = fileURLToPath(new URL('./golden/seeds.json', import.meta.url));
const SEEDS = [1, 2, 3, 12345, 4294967295];

function fnv(parts: (string | number)[]) {
  let h = 2166136261 >>> 0;
  for (const p of parts) { const s = String(p); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } h ^= 0x7c; h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
function floorPrint(f: any) {
  const parts: (string | number)[] = [f.depth, f.rule];
  f.cells.forEach((c: any, i: number) => { if (c.haz || c.stair || c.box || c.faded) parts.push(i + ':' + (c.haz || '') + (c.tier || '') + (c.stair ? 's' : '') + (c.box ? 'b' : '') + (c.faded || '')); });
  return fnv(parts);
}
function runPrints(seed: number) {
  const r = Core.newRun(seed); r.cash = 1e7;
  const days: any[] = [];
  for (let day = 1; day <= 15 && r.phase !== 'final'; day++) {
    if ((r.phase === 'deed' || r.phase === 'gift') && !r.giftDone) Core.chooseGift(r, 0);
    Core.startDay(r);
    const floors = [floorPrint(r.d.floor)];
    for (let k = 0; k < 4; k++) {
      const f = r.d.floor; if (!f.stair) break;
      f.stair.found = true; f.forkOptions = Core.forkOptions(r, f.depth + 1); r.d.px = f.stair.x; r.d.py = f.stair.y; r.d.candle = 80;
      if (!Core.descend(r, 0).ok && r.phase !== 'mine') break;
      if (r.d.floor !== f) floors.push(floorPrint(r.d.floor));
    }
    Core.debugEndDay(r); Core.afterSettle(r);
    if (r.phase === 'payment') Core.afterPayment(r);
    if (r.phase === 'gift') Core.chooseGift(r, 0);
    const shop = r.shop ? r.shop.stock.join(',') : '';
    days.push({ day, floors, shop });
    if (r.phase === 'shop') Core.nextDay(r);
  }
  return days;
}

describe('시드 기준 데이터', () => {
  it('같은 시드와 같은 선택이면 같은 광산과 상점이 나와요', () => {
    const now: any = { version: env.CONFIG.genVersion, seeds: {} };
    for (const s of SEEDS) now.seeds[s] = runPrints(s);
    expect(JSON.stringify(runPrints(SEEDS[0]))).toBe(JSON.stringify(now.seeds[SEEDS[0]]));   // 한 프로세스 안에서 두 번 돌려도 같다
    if (process.env.UPDATE_GOLDEN || !existsSync(FILE)) { writeFileSync(FILE, JSON.stringify(now, null, 1) + '\n'); return; }
    const before = JSON.parse(readFileSync(FILE, 'utf8'));
    expect(now).toEqual(before);
  });
});
