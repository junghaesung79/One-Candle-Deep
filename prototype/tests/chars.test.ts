import { describe, it, expect } from 'vitest';
import { load, playRun, type RunOptions } from '../bot/bot.js';

// 캐릭터 검사(01 15.6): 새 캐릭터 다섯의 X·O 칸 스킬, 고르는 순서, 열리는 조건에 쓰는 기록, 봇 한 판
const env: any = load();
const { Core, CONFIG, CHARACTERS } = env;

// 판을 비우고 플레이어를 세운 뒤, 옆 칸에 보물·지뢰를 놓아요(테스트 전용)
function scene(char: string, seed = 4242) {
  Core.applyPreset('v22');
  const run = Core.newRun(seed, { char });
  Core.startDay(run);
  const d = run.d, f = d.floor;
  for (const c of f.cells) {
    if (c.stair) continue;
    Object.assign(c, { haz: null, tier: 0, removed: false, melted: false, mark: 0, faded: 0, givenX: false, box: false, chunk: false, cover: 'rock', scorch: false, fizzle: false, probe: null });
  }
  f.chunk = null;
  let px = 3, py = 3;
  if (f.cells.some((c: any) => c.stair && Math.max(Math.abs(c.x - px), Math.abs(c.y - py)) <= 4)) { px = CONFIG.W - 4; py = CONFIG.H - 4; }
  Core.cellAt(f, px, py).cover = 'open';
  Object.assign(d, { px, py, candle: 50, hp: 3, streak: 0, pocket: 0 });
  run.phase = 'mine'; run.boxOffer = null;
  const at = (dx: number, dy: number) => Core.cellAt(f, px + dx, py + dy);
  const put = (dx: number, dy: number, haz: string | null, mark = 0, tier = 1) => { const c = at(dx, dy); c.haz = haz; c.tier = haz === 'treasure' ? tier : 0; c.mark = mark; return c; };
  const press = (dx: number, dy: number) => { const c = at(dx, dy); return c.mark === 1 ? Core.ignite(run, c.x, c.y) : Core.hit(run, c.x, c.y); };
  return { run, d, f, at, put, press };
}
const T1 = () => CONFIG.treasureValue[1];

describe('캐릭터', () => {
  it('판 준비 화면 순서가 열 명이에요', () => {
    expect(CHARACTERS.map((c: any) => c.id)).toEqual(['miner', 'surveyor', 'foreman', 'veiner', 'gambler', 'defuser', 'jeweler', 'powderman', 'carpenter', 'blaster']);
    for (const c of CHARACTERS) { expect(c.x.desc).toBeTruthy(); expect(c.o.desc).toBeTruthy(); }
    for (const id of ['jeweler', 'veiner', 'foreman', 'carpenter', 'powderman']) expect(env.TEXT.charLock[id]).toMatch(/열립니다$/);
  });
  it('첫 판은 광부로만 해요', () => {
    Core.applyPreset('v22');
    expect(Core.newRun(1, { tutorial: true, char: 'veiner' }).char).toBe('miner');
    expect(Core.newRun(1, { char: 'veiner' }).char).toBe('veiner');
  });

  it('세공사: O 칸은 촛불 2 더, 보물 값 +50%, 지뢰는 평소처럼', () => {
    const m = scene('miner'); m.put(1, 0, 'treasure', 2); m.press(1, 0);
    const minerGain = m.d.pocketLines.treasure;
    const s = scene('jeweler'); s.put(1, 0, 'treasure', 2);
    const c0 = s.d.candle, r = s.press(1, 0);
    expect(r.ok).toBe(true);
    expect(c0 - s.d.candle).toBe(3);
    expect(s.d.pocketLines.treasure).toBe(Math.floor(minerGain * 1.5));
    expect(s.d.streak).toBe(1);
    // 표시 없는 칸은 그냥 캐요
    const u = scene('jeweler'); u.put(1, 0, 'treasure', 0); const c1 = u.d.candle; u.press(1, 0);
    expect(c1 - u.d.candle).toBe(1);
    expect(u.d.pocketLines.treasure).toBe(minerGain);
    // 지뢰면 평소처럼 다쳐요
    const b = scene('jeweler'); b.put(1, 0, 'mine', 2);
    const c2 = b.d.candle; b.press(1, 0);
    expect(b.d.hp).toBe(2); expect(c2 - b.d.candle).toBe(3);
    // 촛불이 모자라면 캐지 않아요
    const sh = scene('jeweler'); sh.put(1, 0, 'treasure', 2); sh.d.candle = 2;
    expect(sh.press(1, 0).ok).toBe(false); expect(sh.at(1, 0).cover).not.toBe('open');
  });

  it('광맥꾼: 이어진 O를 잇달아 캐고 촛불은 첫 칸만, 지뢰에서 멈추고 피해 +1', () => {
    const s = scene('veiner');
    s.put(1, 0, 'treasure', 2); s.put(2, 0, 'treasure', 2); s.put(3, 1, 'treasure', 2);
    const c0 = s.d.candle, r = s.press(1, 0);
    expect(r.ok && r.vein).toBe(3);
    expect(c0 - s.d.candle).toBe(1);
    expect([s.at(1, 0), s.at(2, 0), s.at(3, 1)].every((c: any) => c.removed)).toBe(true);
    expect(s.d.streak).toBe(3);
    const b = scene('veiner');
    b.put(1, 0, 'treasure', 2); b.put(2, 0, 'mine', 2); b.put(3, 0, 'treasure', 2);
    b.press(1, 0);
    expect(b.at(1, 0).removed).toBe(true);
    expect(b.at(2, 0).removed).toBe(true);
    expect(b.at(3, 0).removed).toBe(false);
    expect(b.d.hp).toBe(3 - CONFIG.mineDmg - 1);
    expect(b.d.streak).toBe(0);
  });

  it('갱 반장: 일꾼이 촛불 없이 캐요. 보물은 콤보 그대로, 지뢰는 치료비 10%', () => {
    const s = scene('foreman'); s.d.streak = 2;
    s.put(1, 0, 'treasure', 2);
    const mult = Core.streakMult(s.run), c0 = s.d.candle;
    expect(s.press(1, 0).ok).toBe(true);
    expect(s.d.candle).toBe(c0);
    expect(s.d.streak).toBe(2);
    expect(s.d.pocketLines.treasure).toBe(Math.floor(T1() * Core.stage(s.run).valueMul * (s.f.valueMul || 1) * mult + 1e-6));
    const b = scene('foreman'); b.d.streak = 2; b.d.pocket = 205;
    const mine = b.put(1, 0, 'mine', 2), nb = b.put(2, 0, 'treasure', 0);
    const mines0 = b.d.stats.mines, num0 = Core.numAt(b.f, b.at(0, 0));
    b.press(1, 0);
    expect(mine.removed).toBe(true);
    expect(b.d.hp).toBe(3);
    expect(b.d.streak).toBe(2);
    expect(b.d.stats.mines).toBe(mines0);
    expect(b.d.pocketLines.fee).toBe(20);
    expect(Core.numAt(b.f, b.at(0, 0))).toBe(num0 - 1);
    expect(nb.cover).not.toBe('open');
  });

  it('목수: X 칸 버팀목은 촛불 1, 지뢰는 조용히 빠지고 둘레는 안 열려요. 지뢰가 아니면 보물이 묻혀요', () => {
    const s = scene('carpenter');
    const mine = s.put(1, 0, 'mine', 1), nb = s.put(2, 0, 'treasure', 0);
    expect(Core.igniteCost(s.run)).toBe(1);
    const c0 = s.d.candle, ok0 = s.d.xOk, r = s.press(1, 0);
    expect(r.ok).toBe(true);
    expect(c0 - s.d.candle).toBe(1);
    expect(mine.removed && mine.cover === 'open' && !mine.scorch).toBe(true);
    expect(s.d.xOk).toBe(ok0 + 1);
    expect(s.d.hp).toBe(3);
    expect(nb.removed).toBe(false); expect(nb.cover).not.toBe('open');
    expect(s.d.stats.blasts).toBe(0);
    const b = scene('carpenter');
    const t = b.put(1, 0, 'treasure', 1);
    b.press(1, 0);
    expect(t.removed && t.melted && t.cover === 'open').toBe(true);
    expect(b.d.pocketLines.treasure).toBe(0);
    expect(b.d.hp).toBe(3);
    expect(b.d.xBad).toBe(1);
    // 성냥을 켜 두면(d.freeX) X 칸 스킬도 촛불 없이 하고 성냥이 타요
    const m = scene('powderman'); m.put(1, 0, 'mine', 1); m.d.freeX = { id: 'matchstick' };
    const c1 = m.d.candle; m.press(1, 0);
    expect(m.d.candle).toBe(c1); expect(m.d.freeX).toBe(null);
  });

  it('화약 장수: X 칸이 지뢰면 화약 10(시세·콤보)과 콤보, 아니면 체력 1과 보물이 녹아요', () => {
    const s = scene('powderman'); s.d.streak = 2;
    const mine = s.put(1, 0, 'mine', 1), nb = s.put(2, 0, 'treasure', 0);
    const mult = Core.streakMult(s.run), c0 = s.d.candle;
    expect(s.press(1, 0).ok).toBe(true);
    expect(c0 - s.d.candle).toBe(3);
    expect(mine.removed && !mine.scorch).toBe(true);
    expect(s.d.pocketLines.treasure).toBe(Math.floor(10 * Core.stage(s.run).valueMul * (s.f.valueMul || 1) * mult + 1e-6));
    expect(s.d.streak).toBe(3);
    expect(s.d.hp).toBe(3);
    expect(nb.cover).not.toBe('open');
    const b = scene('powderman'); b.d.streak = 1;
    const t = b.put(1, 0, 'treasure', 1);
    b.press(1, 0);
    expect(b.d.hp).toBe(2);
    expect(t.melted && t.removed).toBe(true);
    expect(b.d.pocketLines.treasure).toBe(0);
    const e = scene('powderman'); e.put(1, 0, null, 1);
    e.press(1, 0);
    expect(e.d.hp).toBe(2);
  });

  it('둘레 한꺼번에 열기는 스킬과 상관없이 O·X를 믿어요', () => {
    const s = scene('foreman');
    // 숫자 칸 (1,0) 위에 서서, 둘레의 O 칸 하나를 믿고 나머지를 열어요
    s.put(2, 0, 'treasure', 2); s.at(1, 0).cover = 'open'; s.d.px += 1;
    const r = Core.chord(s.run, s.d.px, s.d.py);
    expect(r.ok).toBe(true);
    expect(s.at(2, 0).cover).not.toBe('open');   // O 칸은 일꾼이 캐지 않아요
  });

  it('열리는 조건에 쓰는 기록이 쌓여요', () => {
    const g = scene('miner'); g.put(1, 0, 'treasure', 0, 3); g.press(1, 0);
    expect(g.run.stats.goblets).toBe(1);
    const o = scene('veiner');
    for (let k = 1; k <= 5; k++) o.put(k, 0, 'treasure', 2);
    o.press(1, 0);
    expect(o.run.stats.oFloorMax).toBe(5);
    const bl = scene('miner'); bl.put(1, 0, 'mine', 1); bl.put(2, 0, 'mine', 0); bl.press(1, 0);
    expect(bl.run.stats.blastMines).toBe(2);
    const x = scene('miner');
    for (let k = 0; k < 10; k++) x.put(-2 + (k % 5), 2 + Math.floor(k / 5), 'mine', 1);
    Core.debugEndDay(x.run);
    expect(x.run.stats.xFloor10).toBe(1);
    const xb = scene('miner');
    for (let k = 0; k < 10; k++) xb.put(-2 + (k % 5), 2 + Math.floor(k / 5), 'mine', 1);
    xb.put(-2, 4, null, 1);
    Core.debugEndDay(xb.run);
    expect(xb.run.stats.xFloor10 || 0).toBe(0);
  });

  it('봇이 새 캐릭터 다섯으로 끝까지 가요', () => {
    Core.applyPreset('v22');
    for (const char of ['jeweler', 'veiner', 'foreman', 'carpenter', 'powderman']) for (let s = 1; s <= 3; s++) {
      const r = playRun(env, 8000 + s, { policy: 'normal', char } as RunOptions);
      expect(r.final, char + ' ' + s).toBeTruthy();
    }
  });
});
