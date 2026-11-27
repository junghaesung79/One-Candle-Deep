import { describe, it, expect } from 'vitest';
import { load } from '../bot/bot.js';

const { Core, CONFIG } = load();

// 조건이 거짓이면 실패로 기록하고 다음 검사를 이어 가요
function check(cond: unknown, msg: string) { expect.soft(!!cond, msg).toBe(true); }

// 분필·정보·보물·광맥 도구(reviews/23 3.4~3.6). 판 하나를 만들고 도구를 쥐여 그 장면을 직접 꾸며요
const DESC: Record<string, string> = {
  sheet: '층을 떠날 때 그은 X가 모두 지뢰였으면 X 하나마다 촛불 1을 얻습니다(최대 6)',
  fadebrush: '바랜 O 칸을 캐면 콤보가 2개 단계 오릅니다',
  sootmap: '층마다 한 번, 발파한 자리에서 두 걸음 떨어진 보물 한 칸에 O가 그어집니다',
  nervemark: '숫자로 확실한 칸이 하나도 없을 때 친 칸이 보물이면 콤보가 2개 단계 오릅니다',
  countlamp: '숫자로 확실히 알 수 있는 칸이 없으면 등불이 꺼져 알려 줍니다',
  scale: '층마다 한 번, 숫자 하나를 지뢰 몇 개와 보물 몇 개로 나눠 보여 줍니다(촛불 3)',
  dowse: '하루 한 번, 고른 칸 둘레 5×5 안에 보물이 몇 개인지 알려 줍니다',
  paireye: '짝 광맥 층에서 보물을 캐면 짝이 있는 쪽이 반짝입니다',
  borderline: '테두리 광맥 층의 보물은 값이 20 높습니다',
  tallyrule: '눈금 광맥 층에서 한 줄의 보물을 다 캐면 촛불 3을 얻습니다',
  minepairbook: '지뢰 짝 광맥 층에서 짝 지뢰 둘을 한 번에 발파하면 그 자리에 금 알갱이가 남습니다',
  veincollector: '오늘 서로 다른 광맥 층에 들어갈 때마다 그날 보물 값이 10% 오릅니다',
  jewelglass: '청록 보석을 캐면 콤보가 1개 단계 더 오릅니다',
  gobletstand: '금잔을 캐면 콤보가 끝까지 오릅니다',
  chunkchisel: '큰 덩이 값이 50% 높습니다',
  plumbline: '세로줄 광맥 층에서 보물을 캐면 그 세로줄 바로 양옆 줄의 덮인 칸에 X가 그어집니다',
  crosspick: '대각선 광맥 층에서 대각선으로 붙은 두 보물을 잇달아 캐면 콤보가 1개 단계 더 오릅니다',
  triosack: '무리 광맥 층에서 한 무리의 셋째 보물을 캐면 그 보물 값이 40 높습니다',
  bandcharm: '금 띠 광맥 층에서 처음 친 지뢰는 체력을 줄이지 않습니다'
};

// 첫날 광산 안. 도구는 하루를 열기 전에 쥐여요(on_day_start·on_floor_enter가 돌게)
function fresh(owned: string[], seed = 4242) { Core.applyPreset('v22'); const r: any = Core.newRun(seed); r.owned = owned.slice(); Core.startDay(r); r.d.candle = 80; return r; }
// 지금 층을 그 광맥의 새 층으로 바꿔요(모든 칸 덮임, 바랜 자국 없음)
function useFloor(r: any, rule: string, seed = 1234, depth = 2, chunk?: any) { const f = Core.genFloor({ depth, rule, sx: 7, sy: 5, seed, chunk }); r.d.floor = f; return f; }
function freeNb(f: any, c: any) { return Core.neighbors(f, c.x, c.y).find((n: any) => !n.haz && !n.stair); }
// 칸 옆에 설 자리를 열고 서요
function standBy(r: any, c: any) { const n = freeNb(r.d.floor, c); n.cover = 'open'; r.d.px = n.x; r.d.py = n.y; r.d.candle = Math.max(r.d.candle, 40); return n; }
function dig(r: any, c: any) { standBy(r, c); return Core.hit(r, c.x, c.y); }
function treasures(f: any) { return f.cells.filter((c: any) => c.haz === 'treasure' && !c.removed && c.cover !== 'open' && !c.box && freeNb(f, c)); }
function lastGain(r: any) { return r.fx.filter((e: any) => e.t === 'gain').slice(-1)[0]; }
// 숫자 하나만 열린 맨땅 층: 그 숫자로는 아무 칸도 확실하지 않아요
function guessFloor(r: any) {
  const f = useFloor(r, 'plain', 777, 2);
  const c = f.cells.find((q: any) => !q.haz && !q.stair && Core.numAt(f, q) >= 1 && Core.numAt(f, q) <= 3 && Core.neighbors(f, q.x, q.y).some((n: any) => n.haz === 'treasure' && !n.box) && Core.neighbors(f, q.x, q.y).every((n: any) => !n.stair));
  c.cover = 'open'; r.d.px = c.x; r.d.py = c.y;
  return { f, c, t: Core.neighbors(f, c.x, c.y).find((n: any) => n.haz === 'treasure' && !n.box) };
}

describe('분필·정보·보물·광맥 도구', () => {
  it('v2.2 진열에 모두 나오고 문장은 목록 그대로예요', () => {
    Core.applyPreset('v22');
    const pool = Core.toolPool().map((t: any) => t.id);
    Object.keys(DESC).forEach(id => {
      const t = Core.TOOL_BY_ID[id];
      check(t && pool.includes(id), id + ' in the v22 pool');
      check(t && t.desc === DESC[id], id + ' desc matches reviews/23');
      check(t && t.kind === 'passive' && ['일반', '고급', '희귀'].includes(t.rarity), id + ' rarity');
    });
    check(Core.TOOL_BY_ID.sheet.sets.includes('21'), 'sheet still in v2.1');
  });

  it('현장 검수표: 손으로 그은 X가 모두 맞으면 X마다 촛불 1, 틀린 X가 있으면 없음, 바랜 X는 안 셈', () => {
    const one = (wrong: boolean, fadedOnly: boolean) => {
      const r = fresh(['sheet']), f = r.d.floor;
      const ms = f.cells.filter((c: any) => c.haz === 'mine' && c.cover !== 'open' && !c.mark);
      if (fadedOnly) { ms[0].mark = 1; ms[0].faded = 1; ms[0].givenX = true; }
      else { Core.mark(r, ms[0].x, ms[0].y, 1); Core.mark(r, ms[1].x, ms[1].y, 1); }
      if (wrong) { const e = f.cells.find((c: any) => !c.haz && c.cover !== 'open' && !c.mark && !c.stair); Core.mark(r, e.x, e.y, 1); }
      const c0 = r.d.candle; Core.returnUp(r);
      return r.d.candle - c0;
    };
    check(one(false, false) === 2, 'two right X give candle 2');
    check(one(true, false) === 0, 'a wrong X gives nothing');
    check(one(false, true) === 0, 'faded X does not count');
  });

  it('바랜 자국 솔: 바랜 O 칸을 캐면 콤보 2개 단계', () => {
    const run = (owned: string[], faded: boolean) => {
      const r = fresh(owned), f = useFloor(r, 'plain', 31), t = treasures(f)[0];
      t.mark = 2; if (faded) t.faded = 2; r.d.streak = 0;
      dig(r, t); return r.d.streak;
    };
    check(run(['fadebrush'], true) === 2, 'faded O: +2 steps');
    check(run(['fadebrush'], false) === 1, 'plain O: +1 step');
    check(run([], true) === 1, 'without the tool: +1 step');
  });

  it('검댕 지도: 발파하면 두 걸음 떨어진 보물 칸에 O, 층마다 한 번', () => {
    const r = fresh(['sootmap']), f = useFloor(r, 'plain', 55);
    const setup = (m: any) => {   // 지뢰 m에서 두 걸음 떨어진 빈 칸 하나를 보물로
      const ring = f.cells.filter((c: any) => Core.cheb(c.x, c.y, m.x, m.y) === 2 && !c.haz && !c.stair && c.cover !== 'open');
      ring[0].haz = 'treasure'; ring[0].tier = 1;
      standBy(r, m); Core.mark(r, m.x, m.y, 1); r.d.candle = 80;
      return Core.ignite(r, m.x, m.y);
    };
    const os = () => f.cells.filter((c: any) => c.cover !== 'open' && c.mark === 2).length;
    const lone = (c: any) => c.haz === 'mine' && freeNb(f, c) && Core.neighbors(f, c.x, c.y).every((n: any) => n.haz !== 'mine');
    const mines = f.cells.filter(lone);
    const res = setup(mines[0]);
    check(res.ok && res.mines >= 1, 'blast went off');
    const marked = f.cells.filter((c: any) => c.cover !== 'open' && c.mark === 2);
    check(marked.length === 1 && marked[0].haz === 'treasure' && Core.cheb(marked[0].x, marked[0].y, mines[0].x, mines[0].y) === 2, 'one treasure two steps away got an O');
    const far = mines.find((m: any) => Core.cheb(m.x, m.y, mines[0].x, mines[0].y) > 4 && m.cover !== 'open');
    setup(far);
    check(os() === 1, 'only once per floor');
  });

  it('셈 등불과 배짱 표: 숫자로 확실한 칸이 없을 때를 알아요', () => {
    const r = fresh(['countlamp', 'nervemark']), G = guessFloor(r);
    check(Core.sureCells(r).length === 0, 'one open number: nothing sure');
    check(Core.TOOL_BY_ID.countlamp.iconNow(r) === 'lanternOff', 'lamp is out');
    r.d.streak = 0; r.d.candle = 80; Core.hit(r, G.t.x, G.t.y);
    check(r.d.streak === 2, 'guess hit on treasure: +2 steps');
    // 확실한 칸이 있으면(바랜 O) 등불이 켜지고 배짱 표는 그대로
    const r2 = fresh(['countlamp', 'nervemark']), G2 = guessFloor(r2);
    const o = G2.f.cells.find((c: any) => c.haz === 'treasure' && c.cover !== 'open' && c !== G2.t && Core.cheb(c.x, c.y, G2.c.x, G2.c.y) > 2);
    o.mark = 2; o.faded = 2;
    check(Core.sureCells(r2).length >= 1 && Core.TOOL_BY_ID.countlamp.iconNow(r2) === 'lantern', 'a sure cell lights the lamp');
    r2.d.streak = 0; r2.d.candle = 80; Core.hit(r2, G2.t.x, G2.t.y);
    check(r2.d.streak === 1, 'not a guess: +1 step');
    const r3 = fresh([]), G3 = guessFloor(r3); r3.d.streak = 0; r3.d.candle = 80; Core.hit(r3, G3.t.x, G3.t.y);
    check(r3.d.streak === 1, 'without the tool: +1 step');
  });

  it('보물 저울(누름): 숫자 하나를 지뢰와 보물로 나눠요, 층마다 한 번, 촛불 3', () => {
    const r = fresh(['scale']), f = r.d.floor;
    const n = f.cells.find((c: any) => c.cover === 'open' && !c.haz && Core.numAt(f, c) > 0);
    const m = Core.neighbors(f, n.x, n.y).filter((q: any) => q.haz === 'mine' && !q.removed).length, t = Core.neighbors(f, n.x, n.y).filter((q: any) => q.haz === 'treasure' && !q.removed).length;
    const T = Core.TOOL_BY_ID.scale;
    check(Core.toolBadge(r, 'scale') === '1', 'one use left');
    const empty = f.cells.find((c: any) => c.cover === 'open' && Core.numAt(f, c) === 0);
    if (empty) check(Core.useTool(r, 'scale', empty.x, empty.y).bad, 'a zero cell is refused');
    const c0 = r.d.candle, res = Core.useTool(r, 'scale', n.x, n.y);
    check(res.ok && res.split.m === m && res.split.t === t && n.scaled, 'split matches the cells');
    check(r.d.candle === c0 - 3, 'costs candle 3');
    check(Core.toolBadge(r, 'scale') === '' && T.left(r) === 0 && Core.useTool(r, 'scale', n.x, n.y).spent, 'second use on the same floor refused');
    check(!Core.useTool(fresh([]), 'scale', n.x, n.y).ok, 'needs the tool');
  });

  it('수맥 추(누름): 5×5 안의 보물 수, 하루 한 번', () => {
    const r = fresh(['dowse']), f = r.d.floor;
    let want = 0; for (let y = 3; y <= 7; y++) for (let x = 5; x <= 9; x++) { const c = Core.cellAt(f, x, y); if (c.haz === 'treasure' && !c.removed) want++; }
    const c0 = r.d.candle, res = Core.useTool(r, 'dowse', 7, 5);
    check(res.ok && res.n === want && f.dowse && f.dowse.x === 7, 'counts treasures in 5x5');
    check(r.d.candle === c0, 'no candle');
    check(Core.useTool(r, 'dowse', 3, 3).spent, 'once a day');
    Core.debugSkipDay(r); Core.startDay(r);
    check(Core.TOOL_BY_ID.dowse.left(r) === 1 && Core.useTool(r, 'dowse', 7, 5).ok, 'next day again');
  });

  it('짝 눈: 짝 층에서 캐면 짝이 반짝여요', () => {
    const run = (owned: string[]) => {
      const r = fresh(owned), f = useFloor(r, 'pair', 91);
      const t = treasures(f).find((c: any) => Core.orthN(f, c.x, c.y).some((n: any) => n.haz === 'treasure' && n.cover !== 'open'));
      const mate = Core.orthN(f, t.x, t.y).find((n: any) => n.haz === 'treasure');
      dig(r, t); return mate.glint === true;
    };
    check(run(['paireye']), 'mate glints');
    check(!run([]), 'no glint without the tool');
  });

  it('테두리 금줄: 테두리 층 보물 값 +20', () => {
    const run = (owned: string[]) => { const r = fresh(owned), f = useFloor(r, 'border', 12), t = treasures(f)[0]; r.d.streak = 0; const p0 = r.d.pocket; dig(r, t); return r.d.pocket - p0; };
    check(run(['borderline']) - run([]) === 20, 'plus 20 at stage 1, combo x1');
  });

  it('눈금 자: 한 줄을 다 캐면 촛불 3', () => {
    const r = fresh(['tallyrule']), f = useFloor(r, 'tally', 21);
    const t = treasures(f)[0], row = f.cells.filter((c: any) => c.y === t.y && c.haz === 'treasure' && c !== t);
    row.forEach((c: any) => { c.removed = true; c.cover = 'open'; });
    standBy(r, t); r.d.candle = 50;
    Core.hit(r, t.x, t.y);
    check(r.d.candle === 50 - 1 + 3, 'last treasure of the row: candle +3');
    const r2 = fresh(['tallyrule']), f2 = useFloor(r2, 'tally', 21), t2 = treasures(f2)[0];
    const other = f2.cells.find((c: any) => c.y === t2.y && Core.cheb(c.x, c.y, t2.x, t2.y) > 2 && !c.haz && !c.stair);
    other.haz = 'treasure'; other.tier = 1;   // 같은 줄에 보물이 하나 더 남아요
    standBy(r2, t2); r2.d.candle = 50; Core.hit(r2, t2.x, t2.y);
    check(r2.d.candle === 49, 'row not done: nothing');
  });

  it('지뢰 짝 장부: 짝 지뢰 둘을 한 번에 터뜨리면 금 알갱이', () => {
    const run = (owned: string[]) => {
      const r = fresh(owned), f = useFloor(r, 'minepair', 44);
      const a = f.cells.find((c: any) => c.haz === 'mine' && freeNb(f, c) && Core.orthN(f, c.x, c.y).some((n: any) => n.haz === 'mine'));
      standBy(r, a); Core.mark(r, a.x, a.y, 1); r.d.streak = 0; r.d.candle = 80;
      const p0 = r.d.pocket, res = Core.ignite(r, a.x, a.y);
      return { gain: r.d.pocket - p0, mines: res.mines, streak: r.d.streak };
    };
    const w = run(['minepairbook']), wo = run([]);
    check(w.mines >= 2 && w.gain - wo.gain === CONFIG.treasureValue[1], 'one nugget per pair');
    check(w.streak === wo.streak, 'the nugget does not raise the combo');
  });

  it('광맥 수집가: 오늘 들어간 광맥 가짓수마다 보물 값 +10%', () => {
    const r = fresh(['veincollector']), T = Core.TOOL_BY_ID.veincollector;
    check(Core.toolBadge(r, 'veincollector') === '1', 'first floor counts one vein');
    const f = r.d.floor; f.stair.found = true; f.forkOptions = Core.forkOptions(r, f.depth + 1);
    const k = f.forkOptions.findIndex((o: any) => o.kind === 'floor' && o.rule !== f.rule);
    r.d.px = f.stair.x; r.d.py = f.stair.y; r.d.candle = 80;
    check(k >= 0 && Core.descend(r, k).ok, 'went down to a different vein');
    check(Core.toolBadge(r, 'veincollector') === '2', 'two veins today');
    const t = treasures(r.d.floor)[0]; dig(r, t);
    check(Math.abs(lastGain(r).bonus - 0.2) < 1e-9, 'treasure +20%');
  });

  it('보석상 돋보기와 금잔 받침: 등급에 따라 콤보', () => {
    const run = (owned: string[], tier: number) => { const r = fresh(owned), f = useFloor(r, 'plain', 61), t = treasures(f)[0]; t.tier = tier; r.d.streak = 0; dig(r, t); return { s: r.d.streak, cap: Core.streakCapIdx(r) }; };
    check(run(['jewelglass'], 2).s === 2 && run(['jewelglass'], 1).s === 1 && run([], 2).s === 1, 'gem: one more step');
    const g = run(['gobletstand'], 3);
    check(g.s === g.cap && run(['gobletstand'], 2).s === 1, 'goblet: up to the cap');
  });

  it('큰 덩이 정: 큰 덩이 값 +50%', () => {
    const run = (owned: string[]) => {
      const r = fresh(owned), f = useFloor(r, 'plain', 71, 3, { depth: 3, w: 2, h: 2, value: 60 });
      f.cells.filter((c: any) => c.haz === 'chunk').forEach((c: any) => { if (c.cover !== 'open') dig(r, c); });
      const e = r.fx.filter((q: any) => q.t === 'gain' && q.chunk).slice(-1)[0];
      return e ? e.bonus : -1;
    };
    check(Math.abs(run(['chunkchisel']) - 0.5) < 1e-9 && run([]) === 0, 'chunk bonus 50%');
  });

  it('다림줄: 세로줄 층에서 캐면 양옆 줄의 지뢰에 X', () => {
    const run = (owned: string[]) => {
      const r = fresh(owned), f = useFloor(r, 'cols', 17), t = treasures(f)[0];
      dig(r, t);
      const side = f.cells.filter((c: any) => (c.x === t.x - 1 || c.x === t.x + 1) && c.cover !== 'open');
      return { mines: side.filter((c: any) => c.haz === 'mine' && !c.removed), x: side.filter((c: any) => c.mark === 1), side };
    };
    const w = run(['plumbline']);
    check(w.mines.length > 0 && w.mines.every((c: any) => c.mark === 1 && c.faded === 1) && w.x.every((c: any) => c.haz === 'mine'), 'all side-column mines get a right X, nothing else');
    check(run([]).x.length === 0, 'no X without the tool');
  });

  it('엇갈린 곡괭이: 대각선 짝을 잇달아 캐면 콤보 1개 단계 더', () => {
    const run = (owned: string[]) => {
      const r = fresh(owned), f = useFloor(r, 'diag', 23);
      const p = f.diagPairs.find((P: any) => P.every((i: any) => freeNb(f, f.cells[i])));
      r.d.streak = 0; dig(r, f.cells[p[0]]); dig(r, f.cells[p[1]]);
      return r.d.streak;
    };
    check(run(['crosspick']) === 3 && run([]) === 2, 'second of the pair: +1 more');
  });

  it('무리 자루: 한 무리의 셋째 보물 값 +40', () => {
    const run = (owned: string[]) => {
      const r = fresh(owned), f = useFloor(r, 'trio', 29);
      const g = f.groups.find((G: any) => G.every((i: any) => !f.cells[i].box && freeNb(f, f.cells[i])));
      const bases: number[] = [];
      g.forEach((i: any) => { if (f.cells[i].cover !== 'open') { dig(r, f.cells[i]); bases.push(lastGain(r).base - CONFIG.treasureValue[f.cells[i].tier]); } });
      return bases;
    };
    const b = run(['triosack']);
    check(b.length === 3 && b[0] === 0 && b[1] === 0 && b[2] === 40, 'only the third gets +40');
    check(run([]).every(x => x === 0), 'nothing without the tool');
  });

  it('띠 부적: 금 띠 층에서 처음 친 지뢰는 체력이 그대로', () => {
    const run = (owned: string[]) => {
      const r = fresh(owned), f = useFloor(r, 'band', 37);
      const ms = f.cells.filter((c: any) => c.haz === 'mine' && freeNb(f, c));
      const h0 = r.d.hp; dig(r, ms[0]); const h1 = r.d.hp;
      const far = ms.find((m: any) => m.cover !== 'open' && Core.cheb(m.x, m.y, ms[0].x, ms[0].y) > 3); dig(r, far);
      return [h0 - h1, h1 - r.d.hp];
    };
    const w = run(['bandcharm']), wo = run([]);
    check(w[0] === 0 && w[1] === 1, 'first mine free, second hurts');
    check(wo[0] === 1, 'without the tool the first mine hurts');
  });
});
