import { describe, it, expect } from 'vitest';
import { load } from '../bot/bot.js';

// 콤보·발파·열림 도구(reviews/23 3.1~3.3): 도구마다 효과 하나씩
const env = load();
const { Core, TOOLS } = env;

function check(cond: unknown, msg: string) { expect.soft(!!cond, msg).toBe(true); }

// 손으로 그린 층(15×11). . 빈칸  m 지뢰  X 분필 X가 그어진 지뢰  g 금 알갱이  @ 서 있는 자리(열린 칸)
const BLANK = Array.from({ length: 11 }, () => '...............');
function put(rows: string[], marks: [number, number, string][]) {
  const out = rows.map(r => r.split(''));
  marks.forEach(([x, y, ch]) => { out[y][x] = ch; });
  return out.map(r => r.join(''));
}
// 도구를 쥐고 하루를 시작한 뒤 층을 그림으로 바꿔요. 자갈은 0으로 둬요(자갈 상자 검사만 따로)
function setup(tools: string[], map: string[], opt: { rule?: string; seed?: number; gravel?: boolean } = {}) {
  Core.applyPreset('v22');
  const r: any = Core.newRun(opt.seed ?? 4242);
  r.owned.push(...tools);
  Core.startDay(r);
  let px = 7, py = 5;
  map.forEach((row, y) => { const x = row.indexOf('@'); if (x >= 0) { px = x; py = y; } });
  if (!map.some(row => row.includes('s'))) map = put(map, [[11, 9, 's']]);   // 층에는 계단이 하나 있어야 해요
  const f = Core.floorFromMap(map.map(r => r.replace('@', '.')), 1, opt.rule || 'plain', px, py, 7);
  if (!opt.gravel) f.cells.forEach((c: any) => { c.res = 0; });
  const me = Core.cellAt(f, px, py); me.cover = 'open';
  r.d.floor = f; r.d.px = px; r.d.py = py; r.d.candle = 60;
  return r;
}
const cell = (r: any, x: number, y: number) => Core.cellAt(r.d.floor, x, y);
const mc = (r: any) => Core.consumableCount(r, 'matchstick');
// 왼쪽 위 구석에 지뢰를 몰아 둔 넓은 빈 층: 가운데를 깨면 크게 열려요
const WIDE = put(BLANK, [[0, 0, 'm'], [1, 0, 'm'], [0, 1, 'm'], [14, 10, 'm'], [13, 10, 'm'], [7, 5, '@']]);

describe('콤보·발파·열림 도구', () => {
  it('모두 v2.2 상점 풀에 있고 그림이 있어요', () => {
    Core.applyPreset('v22');
    const ids = ['whetstone', 'bignum', 'dusk', 'pick7', 'tireless', 'apron', 'horseshoe', 'flint', 'firegloves', 'fusebundle', 'counterfire', 'sparkbook', 'resthand',
      'ledger', 'moonsieve', 'surveybook', 'charmthread', 'fanshovel', 'matchtin', 'quickhand', 'bigtumble', 'gravelbox'];
    const pool = Core.toolPool().map((t: any) => t.id);
    ids.forEach(id => { const t = Core.TOOL_BY_ID[id]; check(t && pool.includes(id) && t.icon && t.desc && t.price > 0, id + ' in v22 pool'); });
    check(TOOLS.filter((t: any) => ids.includes(t.id)).every((t: any) => !/R\d|[a-z]{4,}/.test(t.desc)), 'no internal codes in text');
  });

  it('숫돌: 콤보가 끝까지 오른 채로 캐면 촛불 2', () => {
    const r = setup(['whetstone'], put(BLANK, [[8, 5, 'g'], [7, 5, '@']]));
    r.d.streak = Core.streakCapIdx(r);
    Core.hit(r, 8, 5);
    check(r.d.candle === 60 - 1 + 2, 'candle +2 back');
  });

  it('큰 숫자 부적: 5 이상인 숫자가 열리면 콤보 1개 단계', () => {
    const map = put(BLANK, [[8, 4, 'm'], [9, 4, 'm'], [9, 5, 'm'], [9, 6, 'm'], [8, 6, 'm'], [7, 5, '@']]);
    const r = setup(['bignum'], map); Core.hit(r, 8, 5);
    check(Core.numAt(r.d.floor, cell(r, 8, 5)) === 5 && r.d.streak === 1, 'streak 1 on a 5');
    const q = setup([], map); Core.hit(q, 8, 5);
    check(q.d.streak === 0, 'no streak without the tool');
  });

  it('저녁 교대: 촛불 10 이하에서 캔 보물은 콤보 2개 단계', () => {
    const r = setup(['dusk'], put(BLANK, [[8, 5, 'g'], [7, 5, '@']]));
    r.d.candle = 8; Core.hit(r, 8, 5);
    check(r.d.streak === 2, 'streak 2');
  });

  it('일곱 번째 곡괭이: 일곱 번째 보물은 두 배, 날을 넘겨 셉니다', () => {
    const r = setup(['pick7'], put(BLANK, [[8, 5, 'g'], [6, 5, 'g'], [7, 5, '@']]));
    r.toolRun = { pick7: { n: 5 } };
    Core.hit(r, 6, 5);
    check(Core.toolBadge(r, 'pick7') === '6', 'badge 6');
    const before = r.d.pocketLines.treasure; r.d.streak = 0; Core.hit(r, 8, 5);
    check(r.d.pocketLines.treasure - before === 40, 'seventh nugget 20 x2 = 40');
    Core.returnUp(r);
    check(r.toolRun.pick7.n === 7, 'count kept past the day');
  });

  it('쉬지 않은 곡괭이: 지뢰 없이 층을 떠나면 5%, 지뢰를 치면 0', () => {
    const r = setup(['tireless'], put(BLANK, [[8, 5, 'g'], [6, 5, 'm'], [7, 5, '@']]));
    r.toolRun = { tireless: { k: 2 } };
    Core.hit(r, 8, 5);
    check(r.d.pocketLines.treasure === 22, 'nugget 20 +10% = 22');
    check(Core.toolBadge(r, 'tireless') === '10', 'badge shows percent');
    Core.hit(r, 6, 5);
    check(r.toolRun.tireless.k === 0, 'reset on mine');
    const q = setup(['tireless'], put(BLANK, [[7, 5, '@']]));
    Core.returnUp(q);
    check(q.toolRun.tireless.k === 1, 'one stack after a clean floor');
  });

  it('장인 앞치마: 4 이상을 연 뒤 지뢰를 쳐도 콤보가 그대로', () => {
    const map = put(BLANK, [[8, 4, 'm'], [9, 4, 'm'], [9, 5, 'm'], [9, 6, 'm'], [6, 5, 'm'], [7, 5, '@']]);
    const r = setup(['apron'], map); Core.hit(r, 8, 5);
    check(r.toolRun.apron.armed, 'armed by a 4');
    r.d.streak = 3; Core.hit(r, 6, 5);
    check(r.d.streak === 3 && r.d.hp === r.d.hpMax - 1, 'streak kept, hp lost');
    const q = setup([], map); Core.hit(q, 8, 5); q.d.streak = 3; Core.hit(q, 6, 5);
    check(q.d.streak === 0, 'breaks without the tool');
  });

  it('말발굽: 첫 실수 전까지 보물 값 25%', () => {
    const r = setup(['horseshoe'], put(BLANK, [[8, 5, 'g'], [6, 5, 'm'], [7, 4, 'g'], [7, 5, '@']]));
    Core.hit(r, 8, 5);
    check(r.d.pocketLines.treasure === 25, '20 +25%');
    Core.hit(r, 6, 5); r.d.streak = 0;
    const p = r.d.pocketLines.treasure; Core.hit(r, 7, 4);
    check(r.d.pocketLines.treasure - p === 20, 'no bonus after a mine');
  });

  it('곽 씨 부싯돌: 4단계 이상에서 끊기면 성냥', () => {
    const r = setup(['flint'], put(BLANK, [[8, 5, 'm'], [6, 5, 'm'], [7, 5, '@']]));
    r.d.streak = 4; Core.hit(r, 8, 5);
    check(mc(r) === 1, 'one matchstick');
    r.d.streak = 3; Core.hit(r, 6, 5);
    check(mc(r) === 1, 'not from step 3');
  });

  it('화약 장갑: 곡괭이로 지뢰를 쳐서 다치면 둘레 X가 촛불 없이 터짐', () => {
    const r = setup(['firegloves'], put(BLANK, [[8, 5, 'm'], [9, 5, 'X'], [9, 6, 'm'], [7, 5, '@']]));
    Core.hit(r, 8, 5);
    check(cell(r, 9, 5).removed && cell(r, 9, 6).removed, 'X mine and its neighbor blew');
    check(r.d.candle === 59 && r.d.hp === r.d.hpMax - 1, 'only the hit cost, one damage');
    const q = setup([], put(BLANK, [[8, 5, 'm'], [9, 5, 'X'], [7, 5, '@']]));
    Core.hit(q, 8, 5);
    check(!cell(q, 9, 5).removed, 'stays without the tool');
  });

  it('도화선 묶음: 한 층에서 세 번 발파하면 다음 보물 콤보 2개 단계', () => {
    const r = setup(['fusebundle'], put(BLANK, [[8, 4, 'm'], [12, 2, 'm'], [8, 5, 'g'], [7, 5, '@']]));
    [[6, 4], [6, 6], [7, 6]].forEach(([x, y]) => { Core.mark(r, x, y, 1); Core.ignite(r, x, y); });   // 빈 칸 발파(불발)도 발파 한 번
    check(r.toolRun.fusebundle.charges === 1, 'one charge');
    r.d.streak = 0; Core.hit(r, 8, 5);
    check(r.d.streak === 2 && !r.toolRun.fusebundle.charges, 'streak 2, used');
  });

  it('맞불: 한 번에 지뢰 둘 이상이면 콤보 1개 단계', () => {
    const r = setup(['counterfire'], put(BLANK, [[8, 5, 'X'], [9, 5, 'm'], [12, 2, 'm'], [7, 5, '@']]));
    const res = Core.ignite(r, 8, 5);
    check(res.mines === 2 && r.d.streak === 1, 'streak 1');
  });

  it('불꽃 장부: 콤보 4단계 이상이면 발파 촛불 2', () => {
    const r = setup(['sparkbook'], put(BLANK, [[8, 5, 'X'], [12, 2, 'm'], [7, 5, '@']]));
    r.d.streak = 3; check(Core.igniteCost(r) === 4, 'cost 4 at step 3');
    r.d.streak = 4; check(Core.igniteCost(r) === 2, 'cost 2 at step 4');
    Core.ignite(r, 8, 5);
    check(r.d.candle === 58, 'spent 2');
  });

  it('쉬는 손: 발파 없이 층을 떠나면 성냥', () => {
    const r = setup(['resthand'], put(BLANK, [[7, 5, '@']]));
    Core.returnUp(r);
    check(mc(r) === 1, 'one matchstick');
    const q = setup(['resthand'], put(BLANK, [[8, 5, 'X'], [12, 2, 'm'], [7, 5, '@']]));
    Core.ignite(q, 8, 5); Core.returnUp(q);
    check(mc(q) === 0, 'none after a blast');
  });

  it('연쇄 장부(v2.2): 한 번에 15칸 이상 열리면 촛불 3', () => {
    const r = setup(['ledger'], WIDE); Core.hit(r, 8, 5);
    check(r.d.candle === 60 - 1 + 3, 'candle +3');
  });

  it('달빛 체(v2.2): 열린 칸 10개마다 다음 보물 10%, 최대 두 배', () => {
    const r = setup(['moonsieve'], put(WIDE, [[14, 0, 'g'], [13, 0, 'm'], [14, 1, 'm'], [13, 1, 'm']]));
    Core.hit(r, 8, 5);
    check(Core.toolBadge(r, 'moonsieve') === '100', 'charged to 100%');
    const t = cell(r, 14, 0); t.cover = 'rock'; r.d.px = 14; r.d.py = 2; cell(r, 14, 2).cover = 'open';
    cell(r, 14, 1).haz = null; cell(r, 14, 1).cover = 'open'; r.d.px = 14; r.d.py = 1;
    const p = r.d.pocketLines.treasure; r.d.streak = 0; Core.hit(r, 14, 0);
    check(r.d.pocketLines.treasure - p === 40, 'nugget doubled');
  });

  it('측량 수첩: 한 번에 10칸 이상 열리면 확실한 지뢰에 X', () => {
    const map = put(BLANK, [[4, 4, 'm'], [0, 0, 'm'], [14, 10, 'm'], [7, 5, '@']]);
    const r = setup(['surveybook'], map, { rule: 'border' }); Core.hit(r, 8, 5);
    check(cell(r, 4, 4).mark === 1, 'inner mine marked');
    const q = setup([], map, { rule: 'border' }); Core.hit(q, 8, 5);
    check(cell(q, 4, 4).mark === 0, 'not without the tool');
  });

  it('부적 실: 한 번에 20칸 이상 열리면 다음 지뢰에 콤보가 그대로', () => {
    const r = setup(['charmthread'], put(WIDE, [[7, 6, 'm']]));
    r.d.px = 7; r.d.py = 5;
    Core.hit(r, 8, 4);
    check(r.toolRun.charmthread.armed, 'armed');
    r.d.px = 7; r.d.py = 5; cell(r, 7, 5).cover = 'open';
    r.d.streak = 2; Core.hit(r, 7, 6);
    check(r.d.streak === 2 && !r.toolRun.charmthread.armed, 'kept once');
  });

  it('부채 삽: 보물을 캐면 둘레의 안전이 확실한 칸이 열림', () => {
    const map = put(BLANK, [[8, 5, 'g'], [9, 4, 'm'], [6, 5, 'm'], [3, 3, 'm'], [12, 8, 'm'], [7, 5, '@']]);
    const prep = (r: any) => { const m = cell(r, 9, 4); m.faded = 1; m.mark = 1; return r; };
    const r = prep(setup(['fanshovel'], map)); Core.hit(r, 8, 5);
    check(cell(r, 8, 6).cover === 'open' && cell(r, 9, 5).cover === 'open' && cell(r, 9, 4).cover !== 'open', 'safe neighbours opened, mine kept');
    const q = prep(setup([], map)); Core.hit(q, 8, 5);
    check(cell(q, 8, 6).cover !== 'open', 'closed without the tool');
  });

  it('성냥 통: 한 번에 25칸 이상 열리면 성냥', () => {
    const r = setup(['matchtin'], WIDE); Core.hit(r, 8, 5);
    check(mc(r) === 1, 'one matchstick');
  });

  it('날랜 손: 둘레 한꺼번에 열기로 8칸 이상이면 촛불 1을 돌려받음', () => {
    const r = setup(['quickhand'], put(WIDE, [[6, 4, 'X']]));
    const res = Core.chord(r, 7, 5);
    check(res.ok && r.d.candle === 60, 'chord cost refunded');
  });

  it('큰 와르르: 한 번에 30칸 이상 열리면 다음에 캔 보물 두 배', () => {
    const r = setup(['bigtumble'], put(WIDE, [[14, 0, 'g'], [13, 0, 'm'], [13, 1, 'm'], [14, 1, 'm']]));
    Core.hit(r, 8, 5);
    check(r.toolRun.bigtumble.armed, 'armed');
    cell(r, 14, 1).haz = null; cell(r, 14, 1).cover = 'open'; r.d.px = 14; r.d.py = 1;
    const p = r.d.pocketLines.treasure; r.d.streak = 0; Core.hit(r, 14, 0);
    check(r.d.pocketLines.treasure - p === 40, 'nugget doubled');
  });

  it('자갈 상자: 와르르 자갈 값 두 배', () => {
    const r = setup(['gravelbox'], WIDE), q = setup([], WIDE);
    Core.hit(r, 8, 5); Core.hit(q, 8, 5);
    check(q.d.pocketLines.gravel > 0 && r.d.pocketLines.gravel === q.d.pocketLines.gravel * 2, 'gravel doubled');
  });
});
