// 2차 프로토타입 봇. 규칙 모듈(src/core.js)을 그대로 import 해서 node에서 한 판을 끝까지 돌려요.
// 경제 담당 재사용: import { load, Bot, playRun, POLICY } from './bot/bot.js';
//   const env = load();                              // { Core, CONFIG, TOOLS, ... } (CONFIG를 고친 뒤 playRun을 돌리면 된다)
//   const r = playRun(env, seed, { policy: 'normal' }); // 한 판(15일)을 끝까지 진행하고 기록을 돌려준다
//   주의: env는 모듈 하나를 같이 쓴다. CONFIG를 고치면 같은 프로세스의 다음 판에도 그대로 남는다.
// 정책 셋: cautious(신중, 처음 하는 사람), normal(보통), greedy(욕심). 05 문서 6장.
// 봇이 보는 정보는 화면에 보이는 것뿐이다: 열린 칸의 숫자, 분필, 두드려 보기 결과, 캔 보물 자리, 표지판, 눈금, 밑줄(계단이 보이면 계단 자리).
// 덮인 칸의 정체(c.haz)는 읽지 않는다. 추리는 Core.deduce(숫자 + 광맥 규칙)를 쓴다.
// 예외: 층을 떠날 때 '남긴 보물' 기록, 시뮬 통계(측정용)는 정답을 읽는다. 행동 결정에는 쓰지 않는다.
import * as CoreModule from '../src/core.js';

function load() {
  return CoreModule;
}

// 정책. thr: 걸기 문턱(보물일 확률). s0 콤보 0단계, s 콤보 1단계 이상, hp2 체력 2, hp1 체력 1(9면 안 건다)
// ruleUse: 층마다 표지판 규칙을 추리에 쓰는 확률(처음 하는 사람은 규칙을 놓친다)
// safeBudget: 계단을 찾은 뒤 한 층에서 정보용 안전 칸을 더 깨는 상한. reserveK: 다음 납부까지 벌 돈을 몇 할 믿고 사는가
// lastCardThr: 마지막 패를 가졌을 때 체력 1의 문턱. forkSkill: 갈림길에서 좋은 광맥을 고르는 확률
const POLICY = {
  cautious: { ruleUse: 0.4, thr: { s0: 0.5, s: 0.6, hp2: 0.75, hp1: 9 }, blastMinOpen: 4, safeBudget: 14, reserveK: 0.3,
              forkSkill: 0.4, buy: 'naive', tutorial: true, useCons: false, slip: 0.012, opener: 0, endThr: 0.55, fireThr: 0,
              learn: { ruleUse: [0.5, 1.0], s0: [0.5, 0.42], fireThr: [0.25, 0.35], fireFrom: 3 } },
  normal:   { ruleUse: 1.0, thr: { s0: 0.4, s: 0.5, hp2: 0.6, hp1: 0.85 }, blastMinOpen: 3, safeBudget: 24, reserveK: 0.3,
              forkSkill: 1.0, buy: 'synergy', useCons: true, slip: 0, opener: 0.3, endThr: 0.45, fireThr: 0.35, fireUp: 0.1, prudent: true },
  greedy:   { ruleUse: 1.0, thr: { s0: 0.33, s: 0.5, hp2: 0.5, hp1: 0.7 }, blastMinOpen: 3, safeBudget: 30, reserveK: 0.35, prudent: true,
              forkSkill: 1.0, buy: 'synergy', useCons: true, slip: 0, lastCardThr: 0.6, betO: 0.65, openerHp: 2, opener: 0.25, endThr: 0.38, fireThr: 0.3, fireUp: 0.1 }
};

const RULE_PREF = { border: 6, lonely: 5, minepair: 5, rows: 4, tally: 4, pair: 4, plain: 1 };
// 구매 선호(보통·욕심). 측정으로 정한 순서(05 문서 8.3)
const TOOL_PREF = ['bigblast', 'moontongs', 'deadcrown', 'refiner', 'sieve', 'tongs', 'ledger', 'wedge', 'fuse', 'crown', 'moonsieve', 'amulet', 'sheet', 'lens', 'firstdig', 'belt', 'gloves', 'lonelamp', 'tapper', 'nuggetbag', 'lastcard', 'betchalk', 'crackedhelm', 'dripdish', 'shortwick', 'regular'];   // 합친 도구는 내려놓지 않아요
const ORDER_PREF = ['reach5', 'deepStreak', 'gems2', 'bigNum', 'chain20', 'streak3', 'floor5', 'noProbe', 'blast4', 'chalkO', 'chain3', 'clean3', 'emberT', 'keep20', 'noMine', 'xRight'];

class Bot {
  constructor(env, opts) {
    this.env = env; this.Core = env.Core; this.CONFIG = env.CONFIG;
    const pol = POLICY[(opts && opts.policy) || 'normal'];
    this.o = Object.assign({ spend: true, lazy: false, fizzleProbe: false, buyList: null }, pol, opts || {});
    this.o.thr = Object.assign({}, pol.thr, (opts && opts.thr) || {});
    this.rng = this.Core.rngFrom(((opts && opts.botSeed) || 1) * 7919 + 13);
    this.m = { gambles: 0, gambleWins: 0, ruleDigs: 0, safeDigs: 0, stairDigs: 0, guessDigs: 0, blasts: 0, fizzleProbes: 0, fizzleProbeT: 0, slips: 0, fireBets: 0, fireMiss: 0,
               floorsLeft: 0, tLeft: 0, tTotal: 0 };
    this.buys = [];
  }
  // ---------- 하루 ----------
  // 처음 하는 사람은 판 안에서 배운다: learn = { ruleUse: [Day1 값, Day15 값], s0: [...], fireThr: [...], fireFrom: n }
  learnDay(run) {
    const L = this.o.learn; if (!L) return;
    const k = (run.day - 1) / 14, lerp = a => a[0] + (a[1] - a[0]) * k;
    if (L.ruleUse) this.o.ruleUse = lerp(L.ruleUse);
    if (L.s0) this.o.thr.s0 = lerp(L.s0);
    if (L.fireThr) this.o.fireThr = run.day >= (L.fireFrom || 1) ? lerp(L.fireThr) : 0;
  }
  playDay(run) {
    const Core = this.Core;
    this.learnDay(run);
    let guard = 0;
    this.tried = new Set();
    this.floorRef = null;
    while ((run.phase === 'mine' || run.phase === 'room') && guard++ < 3000) {
      run.fx.length = 0;
      if (run.boxOffer) { this.takeBox(run); continue; }
      if (run.phase === 'room') { this.room(run); continue; }
      this.trackFloor(run);
      if (!this.step(run)) { this.leaveFloor(run.d.floor); Core.returnUp(run); break; }
    }
    if (run.phase === 'mine' || run.phase === 'room') { this.leaveFloor(run.d.floor); Core.returnUp(run); }
    else if (run.d && run.d.floor && this.floorRef === run.d.floor) this.leaveFloor(run.d.floor);
  }
  trackFloor(run) {
    const f = run.d.floor;
    if (this.floorRef !== f) {
      if (this.floorRef) this.leaveFloor(this.floorRef);
      this.floorRef = f; this.safeOnFloor = 0; this.floorCandle0 = run.d.candle;
      this.useRule = this.rng() < this.o.ruleUse;
      this.left = false;
    }
  }
  // 측정: 층을 떠날 때 남긴 보물(정답을 읽는다. 행동에는 쓰지 않음)
  leaveFloor(f) {
    if (!f || f.__counted) return;
    f.__counted = true;
    const T = f.cells.filter(c => c.haz === 'treasure');
    const left = T.filter(c => !c.removed).length;
    this.m.floorsLeft++; this.m.tLeft += left; this.m.tTotal += T.length;
  }
  room(run) {
    const Core = this.Core, d = run.d;
    if (run.room.kind === 'spring') { Core.springChoose(run, d.hp < d.hpMax ? 'hp' : 'candle'); return; }
    const st = run.room.stock;
    if (this.o.spend) {
      for (let i = 0; i < st.length; i++) {
        const t = Core.TOOL_BY_ID[st[i]];
        if (t.kind === 'passive' && this.wants(run, st[i]) && this.canSpend(run, Core.priceOf(run, st[i], true))) { const r = Core.buy(run, i); if (r.ok) this.buys.push({ day: run.day, id: st[i], where: 'room' }); break; }
      }
    }
    Core.leaveRoom(run);
  }
  dist(run, c) { return Math.max(Math.abs(run.d.px - c.x), Math.abs(run.d.py - c.y)); }
  nearest(run, list) { let b = null, bd = 1e9; for (const c of list) { const dd = this.dist(run, c); if (dd < bd) { bd = dd; b = c; } } return b; }
  dig(run, c, kind) {
    const Core = this.Core;
    if (!Core.approach(run, c.x, c.y).ok) { this.tried.add(c); return false; }
    if (c.mark === 1 && !Core.owns(run, 'tongs')) Core.mark(run, c.x, c.y, 0);
    const r = Core.hit(run, c.x, c.y);
    if (!r.ok) { this.tried.add(c); return false; }
    this.m[kind] = (this.m[kind] || 0) + 1;
    if (kind === 'gambles' && r.content === 'treasure') this.m.gambleWins++;
    if (r.content === 'mine') { const k = 'mine_' + kind + (run.d && run.d.embersOn ? '_ember' : ''); this.m[k] = (this.m[k] || 0) + 1; }
    return true;
  }
  deduce(run) {
    const f = run.d.floor;
    const view = this.useRule ? f : Object.assign({}, f, { rule: 'plain', twin: false });
    return this.Core.deduce(view, { sleepy: this.Core.mut(run, 'sleepy'), blur: this.Core.mut(run, 'blur') });
  }
  thr(run) {
    const d = run.d, T = this.o.thr, Core = this.Core;
    if (d.hp <= 1) return Core.owns(run, 'lastcard') ? (this.o.lastCardThr || T.hp1 - 0.15) : T.hp1;
    let base = d.streak === 0 ? T.s0 : T.s;
    // 배짱 장갑이 남아 있으면 콤보를 잃을 걱정이 줄어 문턱을 낮춘다
    if (d.streak >= 2 && Core.owns(run, 'gloves') && run.toolState.gloves && run.toolState.gloves.ready !== false) base -= 0.05;
    return d.hp === 2 ? Math.max(base, T.hp2) : base;
  }
  step(run) {
    const Core = this.Core, CONFIG = this.CONFIG, d = run.d, f = d.floor, o = this.o;
    const D = this.deduce(run);
    const cell = i => f.cells[i];
    const ok = c => c.cover !== 'open' && !this.tried.has(c);
    const reach = c => Core.neighbors(f, c.x, c.y).some(n => n.cover === 'open');   // 바랜 O는 아직 닿을 수 없는 곳에 있을 수 있어요
    const tre = D.tre.map(cell).filter(c => ok(c) && reach(c));
    const mines = D.mine.map(cell).filter(ok);
    const chunkHere = !!(f.chunk && !f.chunk.done);
    const chunkFloor = chunkHere && !CONFIG.features.chunkShown;   // 덩이 자리를 모르면 '지뢰'가 '지뢰 또는 덩이'라 X·발파를 쓰지 않는다
    // 불씨: 아는 보물과 O 칸만 캔다. 성냥이 있으면 캘 것이 남았을 때 켠다
    if (d.embersOn) {
      const ts = tre.concat(f.cells.filter(c => ok(c) && c.mark === 2 && D.st[Core.idx(c)] !== 1 && D.canT[Core.idx(c)]));
      if (o.useCons && ts.length >= 2) { const mi = run.cons.findIndex(a => a.id === 'match'); if (mi >= 0 && Core.useCons(run, mi).ok) return true; }
      const t = this.nearest(run, ts);
      if (t) return this.dig(run, t, 'ruleDigs');
      return false;
    }
    // 아는 지뢰에 X(공짜)
    if (!chunkFloor) for (const c of mines) if (c.mark !== 1) Core.mark(run, c.x, c.y, 1);
    const cost = Core.hitCost(run);
    const nextCost = Core.travelCost(run, f.depth + 1);
    // 1) 아는 보물
    if (tre.length && d.candle >= cost) return this.dig(run, this.nearest(run, tre), 'ruleDigs');
    // 덩이
    if (chunkHere && d.candle > 4) {
      const t = this.chunkTarget(run, D);
      if (t && this.dig(run, t, 'ruleDigs')) return true;
    }
    const unk = D.haz.map(cell).filter(c => ok(c) && D.canT[Core.idx(c)] && D.canM[Core.idx(c)]);
    const stairKnown = f.stair && f.stair.found && !f.stair.blocked;   // 첫 판 Day 1 지하 3층은 막힌 계단
    const reserve = stairKnown ? nextCost : 0;
    const bestUnk = () => { let best = null, bp = 0; for (const c of unk) { const p = this.pTreasure(run, D, c); if (p > bp) { bp = p; best = c; } } return { c: best, p: bp }; };
    const gamble = (thr) => {
      if (o.lazy || !unk.length || d.candle < cost + reserve) return null;
      const b = bestUnk();
      if (!b.c || b.p < thr) return null;
      if (Core.owns(run, 'betchalk') && b.p >= (o.betO || 0.8) && b.c.mark !== 2) Core.mark(run, b.c.x, b.c.y, 2);
      else if (d.survey > 0 && !b.c.mark) Core.mark(run, b.c.x, b.c.y, 2);   // 측량사: 거는 칸에 O를 그어 청진으로 캔다
      return b.c;
    };
    // 실수(처음 하는 사람): 가끔 확인 안 한 위험 칸을 친다
    if (o.slip && unk.length && this.rng() < o.slip && d.candle >= cost + reserve) {
      const c = unk[Math.floor(this.rng() * unk.length)];
      this.m.slips++;
      if (this.dig(run, c, 'gambles')) return true;
    }
    // 납부일: 큰 덩이 층까지는 서둘러 내려간다(정보용 안전 칸 상한을 줄이고 끝 걸기를 하지 않는다)
    const rush = !!(d.chunkSpec && !d.chunkDone && f.depth < d.chunkSpec.depth && o.rush !== false);
    const overBudget = stairKnown && (this.safeOnFloor >= (rush ? 2 : o.safeBudget));
    // 2) 걸기(정책 문턱). 첫 보물이 규칙 추리를 여는 층에서는 체력이 넉넉하면 문턱을 낮춘다
    const opener = this.useRule && o.opener && ['lonely', 'pair', 'rows', 'minepair'].indexOf(f.rule) >= 0 && f.treasuresDug === 0 && d.hp >= (o.openerHp || 3);
    let g = rush ? null : gamble(opener ? Math.min(this.thr(run), o.opener) : this.thr(run));
    if (g) return this.dig(run, g, 'gambles');
    // 2-1) 불발 확인(측정용 악용 봇): 걸지 않을 칸에 X를 긋고 불을 붙여 정체를 본다
    if (o.fizzleProbe && unk.length && !chunkFloor && d.candle >= Core.igniteCost(run) + cost + reserve) {
      const b = bestUnk();
      if (b.c && b.p >= o.fizzleProbe) {
        if (Core.approach(run, b.c.x, b.c.y).ok) {
          Core.mark(run, b.c.x, b.c.y, 1);
          const r = Core.ignite(run, b.c.x, b.c.y);
          if (r.ok) { this.m.fizzleProbes++; if (!r.mines) this.m.fizzleProbeT++; return true; }
        }
        this.tried.add(b.c);
      }
    }
    // 2-2) 불로 걸기: 지뢰일 가능성이 높은 위험 칸에 X를 긋고 불을 붙인다(콤보가 높거나 체력이 깎였으면 문턱을 올린다)
    if (o.fireThr && !rush && unk.length && !chunkFloor && !o.lazy && d.candle >= Core.igniteCost(run) + cost + reserve) {
      const ft = o.fireThr + ((d.streak >= 2 || d.hp <= 2) ? (o.fireUp || 0) : 0);
      let best = null, bp = 1, bv = 0;
      for (const c of unk) {
        const p = this.pTreasure(run, D, c); if (p > ft) continue;
        const v = Core.neighbors(f, c.x, c.y).filter(n => n.cover !== 'open' && D.st[Core.idx(n)] !== 2).length;
        if (v < (o.fireMinOpen || 1)) continue;
        if (p < bp || (p === bp && v > bv)) { bp = p; bv = v; best = c; }
      }
      if (best && Core.approach(run, best.x, best.y).ok) {
        Core.mark(run, best.x, best.y, 1);
        const pw = o.useCons ? run.cons.findIndex(a => a.id === 'powder') : -1;
        const r = pw >= 0 ? Core.useCons(run, pw) : Core.ignite(run, best.x, best.y);
        if (r.ok) { this.m.fireBets++; if (!r.mines) this.m.fireMiss++; return true; }
        this.tried.add(best);
      }
    }
    // 3) 발파: 아는 지뢰 중 둘레에 덮인 칸이 많은 것
    if (!chunkFloor && d.candle >= Core.igniteCost(run) + nextCost && !o.lazy && !(rush && stairKnown)) {
      let best = null, bv = 0;
      for (const m of mines) {
        const nb = Core.neighbors(f, m.x, m.y);
        const openable = nb.filter(n => n.cover !== 'open' && D.st[Core.idx(n)] !== 2).length;
        const hurtT = nb.filter(n => n.cover !== 'open' && D.tre.indexOf(Core.idx(n)) >= 0).length;
        const v = openable - hurtT * 3 + nb.filter(n => n.cover !== 'open' && D.mine.indexOf(Core.idx(n)) >= 0).length;
        if (v > bv) { bv = v; best = m; }
      }
      if (best && bv >= o.blastMinOpen) {
        if (Core.approach(run, best.x, best.y).ok) {
          const pw = o.useCons ? run.cons.findIndex(a => a.id === 'powder') : -1;
          if (best.mark !== 1) Core.mark(run, best.x, best.y, 1);
          const r = pw >= 0 ? Core.useCons(run, pw) : Core.ignite(run, best.x, best.y);
          if (r.ok) { this.m.blasts++; return true; }
        }
        this.tried.add(best);
      }
    }
    // 3-1) 계단 후보(밑줄 숫자, 0 옆에 남은 바위)가 있으면 먼저 친다
    if (!stairKnown) {
      const cands0 = D.stairCand.map(cell).filter(ok);
      if (cands0.length && d.candle >= cost) return this.dig(run, this.nearest(run, cands0), 'stairDigs');
    }
    // 3-2) 둘레 한꺼번에 열기: 둘레 위험 칸이 숫자만큼 다 밝혀진 숫자 칸에서 안전 칸 둘 이상을 촛불 한 번에 연다
    if (CONFIG.features.chord && !o.noChord && !overBudget && d.candle >= cost + reserve) {
      const ch = this.chordTarget(run, D);
      if (ch) {
        for (const q of ch.haz) if (!q.mark) Core.mark(run, q.x, q.y, D.canT[Core.idx(q)] ? 2 : 1);
        if (Core.travelTo(run, ch.c.x, ch.c.y).ok) {
          const r = Core.chord(run, ch.c.x, ch.c.y);
          if (r.ok) { this.m.chords = (this.m.chords || 0) + 1; if (stairKnown) this.safeOnFloor += 1; return true; }
        }
        this.tried.add(ch.c);
      }
    }
    // 4) 정보가 되는 안전 칸(계단을 찾은 뒤에는 층마다 상한)
    const safe = D.safe.map(cell).filter(ok);
    const informative = safe.filter(c => Core.neighbors(f, c.x, c.y).some(n => n.cover !== 'open' && D.st[Core.idx(n)] !== 1));
    const sc = informative.filter(c => D.stairCand.indexOf(Core.idx(c)) >= 0);
    if (!overBudget && (sc.length || informative.length) && d.candle >= cost + reserve) {
      if (stairKnown) this.safeOnFloor++;
      if (sc.length) return this.dig(run, this.nearest(run, sc), 'safeDigs');
      if (!stairKnown) {   // 계단을 아직 모르면 넓게 여는 칸부터(덮인 칸에 많이 닿은 칸)
        let best = null, bv = -1e9;
        const sw = this.CONFIG.stairShown && f.stair && !f.stair.blocked ? 1 : 0;   // 계단이 보이면 계단 쪽으로 여는 칸을 고른다
        for (const c of informative) { const v = Core.neighbors(f, c.x, c.y).filter(n => n.cover !== 'open' && D.st[Core.idx(n)] === 0).length * 2 - this.dist(run, c) * 0.25 - (sw ? Core.cheb(c.x, c.y, f.stair.x, f.stair.y) * sw : 0); if (v > bv) { bv = v; best = c; } }
        return this.dig(run, best, 'safeDigs');
      }
      return this.dig(run, this.nearest(run, informative), 'safeDigs');
    }
    // 5) 계단. 내려가기 전에 남은 위험 칸 중 가장 나은 칸에 건다(체력이 넉넉할 때)
    if (stairKnown && o.endThr && d.hp >= 2 && !rush) {
      g = gamble(d.hp >= 3 ? o.endThr : Math.max(o.endThr, this.o.thr.hp2));
      if (g) return this.dig(run, g, 'gambles');
    }
    // 옛 연장함이 묻힌 층: 내려가기 전에 조금 더 건다(사람은 알림을 보고 이 층을 더 판다는 가정)
    if (stairKnown && f.box && f.box.state === 'buried' && o.boxHunt !== false && d.hp >= 2 && !rush) {
      g = gamble(Math.max(0.3, (o.endThr || this.thr(run)) - 0.15));
      if (g) { this.m.boxHunt = (this.m.boxHunt || 0) + 1; return this.dig(run, g, 'gambles'); }
    }
    if (stairKnown) {
      if (d.candle >= nextCost) {
        const opts = f.forkOptions;
        const i = this.pickFork(run, opts);
        if (Core.travelTo(run, f.stair.x, f.stair.y).ok) {
          this.leaveFloor(f);
          const r = Core.descend(run, i);
          if (r.ok) return true;
        }
      }
      // 내려갈 촛불이 없으면 남은 촛불로 이 층에서 건다(콤보 0이면 문턱 그대로)
      g = gamble(this.thr(run));
      if (g) return this.dig(run, g, 'gambles');
      const rest = safe.filter(c => Core.neighbors(f, c.x, c.y).some(n => n.cover !== 'open'));
      if (rest.length && d.candle >= cost) return this.dig(run, this.nearest(run, rest), 'safeDigs');
    } else {
      const cands = D.stairCand.map(cell).filter(ok);
      if (cands.length && d.candle >= cost) return this.dig(run, this.nearest(run, cands), 'stairDigs');
      const front = this.frontier(run, D).filter(ok);
      if (front.length && d.candle >= cost) {
        const sd = c => (this.CONFIG.stairShown && f.stair && !f.stair.blocked ? Core.cheb(c.x, c.y, f.stair.x, f.stair.y) * 0.01 : 0);   // 같은 위험이면 계단에 가까운 칸
        front.sort((a, b) => (this.pHaz(run, D, a) + sd(a)) - (this.pHaz(run, D, b) + sd(b)));
        const c = front[0], ph = this.pHaz(run, D, c);
        if (d.probes > 0 && d.candle >= 3 && ph > 0.15 && c.probe == null) {
          if (Core.approach(run, c.x, c.y).ok) { const r = Core.probe(run, c.x, c.y); if (r.ok) return true; }
        }
        if (c.probe === 'mine') { this.tried.add(c); return true; }
        if (d.survey > 0 && !c.mark && ph > 0.15) Core.mark(run, c.x, c.y, 2);   // 측량사: 위험한 칸은 청진으로
        if ((d.hp >= 3 && ph <= 0.5) || (d.hp === 2 && ph <= 0.34) || ph <= 0.2 || c.probe === 'safe' || (c.mark === 2 && d.survey > 0)) return this.dig(run, c, 'guessDigs');
      }
    }
    return false;
  }
  chordTarget(run, D) {
    const Core = this.Core, f = run.d.floor;
    let best = null, bv = 0;
    for (const c of f.cells) {
      if (c.cover !== 'open' || (c.haz && !c.removed) || this.tried.has(c)) continue;
      const n = Core.numAt(f, c); if (!n) continue;
      const cov = Core.neighbors(f, c.x, c.y).filter(q => q.cover !== 'open');
      const haz = cov.filter(q => D.st[Core.idx(q)] === 2), safe = cov.filter(q => D.st[Core.idx(q)] === 1 && !q.mark && !this.tried.has(q));
      if (haz.length !== n || safe.length < 2 || haz.some(q => D.isC && D.isC[Core.idx(q)])) continue;
      const v = safe.length * 2 - this.dist(run, c) * 0.25;
      if (v > bv) { bv = v; best = { c, haz }; }
    }
    return best;
  }
  frontier(run, D) {
    const Core = this.Core, f = run.d.floor;
    return f.cells.filter(c => c.cover !== 'open' && D.st[Core.idx(c)] === 0 && Core.neighbors(f, c.x, c.y).some(n => n.cover === 'open'));
  }
  pHaz(run, D, c) {
    const Core = this.Core, f = run.d.floor;
    if (c.probe === 'safe') return 0.5;
    let p = 0.12;
    for (const n of Core.neighbors(f, c.x, c.y)) {
      if (n.cover !== 'open') continue;
      const U = Core.neighbors(f, n.x, n.y).filter(z => z.cover !== 'open');
      const h = U.filter(z => D.st[Core.idx(z)] === 2).length;
      const u = U.filter(z => D.st[Core.idx(z)] === 0).length;
      if (u) p = Math.max(p, (Core.numAt(f, n) - h) / u);
    }
    return p;
  }
  // 위험 칸이 보물일 확률(봇이 아는 것: 깊이별 개수 비율, 표지판, 렌즈 점, 두드려 보기, 불발)
  // 남은 보물·지뢰 수 어림: 깊이별 개수 표(+ 갱 상태)에서 이미 없어진 것과 정체를 아는 것을 뺀다
  floorCounts(run, D) {
    const Core = this.Core, f = run.d.floor, C = this.CONFIG;
    if (D.__fc) return D.__fc;
    const shift = (C.stages && C.stages[Math.min(run.stamps, C.stages.length - 1)].rowShift) || 0;
    const row = C.density[Math.min(f.depth + shift, C.density.length) - 1];
    let t = row.t, m = row.m;
    if (Core.gang(run, 'smell')) { t += 2; m += 2; }
    if (Core.gang(run, 'quiet')) { t -= 1; m -= 2; }
    let tGone = 0, mGone = 0, U = 0, cvT = 0, cv = 0;
    for (const c of f.cells) {
      if (c.cover === 'open') { if (c.removed && c.haz === 'treasure') tGone++; else if (c.removed && c.haz === 'mine') mGone++; continue; }
      const i = Core.idx(c);
      if (D.st[i] === 2) { if (!D.canM[i]) tGone++; else if (!D.canT[i]) mGone++; else U++; }
      else if (D.st[i] === 0) { cv++; if (D.canT[i]) cvT++; }
    }
    const tRem = Math.max(0, t - tGone), mRem = Math.max(0, m - mGone);
    const eCv = Math.max(0, tRem + mRem - U);                     // 아직 위험으로 안 보인 칸에 묻힌 수
    const h = cv ? Math.min(1, eCv / cv) : 0;                       // 그런 칸 하나가 위험일 확률
    const base = U ? Math.max(0.05, Math.min(0.85, tRem / (U + cvT * h))) : 0;
    return (D.__fc = { base, U, tRem, mRem });
  }
  pTreasure(run, D, c) {
    const Core = this.Core, f = run.d.floor, i = Core.idx(c);
    if (!D.canM[i]) return 1;
    if (!D.canT[i]) return 0;
    if (c.probe === 'safe' || c.fizzle) return 1;
    let p = this.floorCounts(run, D).base;
    if (this.useRule && f.rule === 'tally') {
      const k = Core.tallyRow(f, c.y);
      let n = 0; for (let x = 0; x < this.CONFIG.W; x++) { const z = Core.cellAt(f, x, c.y), j = Core.idx(z); if (z.cover !== 'open' && D.canT[j] && D.st[j] !== 1) n++; }
      if (n) p = Math.min(0.95, k / n);
    }
    if (this.useRule && f.rule === 'pair') {
      for (const n of Core.orthN(f, c.x, c.y)) {
        if (n.cover === 'open' && n.removed && n.haz === 'treasure') {
          const k = Core.orthN(f, n.x, n.y).filter(z => z.cover !== 'open' && D.canT[Core.idx(z)] && D.st[Core.idx(z)] !== 1).length;
          if (k) p = Math.max(p, 1 / k);
        }
      }
    }
    if (this.useRule && (f.rule === 'minepair' || f.twin)) {
      for (const n of Core.orthN(f, c.x, c.y)) {
        if (n.cover === 'open' && n.removed && n.haz === 'mine') {
          const k = Core.orthN(f, n.x, n.y).filter(z => z.cover !== 'open' && D.canM[Core.idx(z)] && D.st[Core.idx(z)] !== 1).length;
          if (k) p = Math.min(p, 1 - 1 / k);
        }
      }
    }
    // 감정 렌즈 점: 그 숫자의 위험 칸 중 하나 이상이 보물
    for (const n of Core.neighbors(f, c.x, c.y)) {
      if (n.cover === 'open' && n.lens) {
        const k = Core.neighbors(f, n.x, n.y).filter(z => z.cover !== 'open' && D.canT[Core.idx(z)] && D.st[Core.idx(z)] === 2).length;
        if (k) p = Math.max(p, Math.min(0.9, 1 / k));
      }
    }
    return p;
  }
  chunkTarget(run, D) {
    const Core = this.Core, f = run.d.floor, C = f.chunk, W = this.CONFIG.W, H = this.CONFIG.H;
    const dug = f.cells.filter(c => c.chunk && c.removed);
    const fits = [];
    for (let y = 0; y + C.h <= H; y++) for (let x = 0; x + C.w <= W; x++) {
      let okR = true, hz = 0;
      for (let yy = y; yy < y + C.h && okR; yy++) for (let xx = x; xx < x + C.w; xx++) {
        const c = Core.cellAt(f, xx, yy), i = Core.idx(c);
        if (c.cover === 'open') { if (!(c.chunk && c.removed)) { okR = false; break; } }
        else if (D.st[i] === 1 || c.probe === 'mine') { okR = false; break; }
        else if (D.st[i] === 2) hz++;
      }
      if (!okR) continue;
      if (dug.length && !dug.every(c => c.x >= x && c.x < x + C.w && c.y >= y && c.y < y + C.h)) continue;
      if (!dug.length && hz < C.w * C.h - 1) continue;
      fits.push({ x, y, hz });
    }
    if (!fits.length) return null;
    if (!dug.length && run.d.hp < 2) return null;
    fits.sort((a, b) => b.hz - a.hz);
    const R = fits[0];
    for (let yy = R.y; yy < R.y + C.h; yy++) for (let xx = R.x; xx < R.x + C.w; xx++) { const c = Core.cellAt(f, xx, yy); if (c.cover !== 'open' && !this.tried.has(c) && Core.neighbors(f, c.x, c.y).some(n => n.cover === 'open')) return c; }   // 열린 칸과 닿은 덩이 칸만
    return null;
  }
  pickFork(run, opts) {
    const d = run.d;
    if (this.rng() > this.o.forkSkill) return Math.floor(this.rng() * opts.length);
    let best = 0, bv = -1;
    opts.forEach((o, i) => {
      let v = o.kind === 'floor' ? RULE_PREF[o.rule] : o.kind === 'spring' ? (d.hp < d.hpMax ? 7 : 2) : (this.o.spend && this.canSpend(run, 200) ? 3 : 0);
      if (o.chunk) v += 2;
      // 갈림길 덤(R42): 단순 규칙. 값·촛불·콤보는 조금 더, 샘은 체력이 모자랄 때, 상인 방은 쓸 돈이 있을 때
      const b = o.bonus;
      if (b === 'value') v += 1.5; else if (b === 'candle') v += 1.2; else if (b === 'streak') v += 1;
      else if (b === 'more') v += (d.hp >= 2 ? 0.8 : -1);
      else if (b === 'spring') v += (d.hp < d.hpMax ? 3 : 0.5);
      else if (b === 'merchant') v += (this.o.spend !== false && this.canSpend(run, 200) ? 1 : 0);
      if (v > bv) { bv = v; best = i; }
    });
    return best;
  }
  // ---------- 상점 ----------
  estIncome(run) {
    const h = run.history.slice(-3);
    if (!h.length) return 200;
    return h.reduce((a, x) => a + x.income, 0) / h.length;
  }
  canSpend(run, price) {
    const np = this.Core.nextPayment(run);
    if (!np) return true;
    const days = np.day - run.day;   // 상점은 그날 밤: 남은 날 수만큼 더 번다
    let est = this.estIncome(run);
    if (this.o.prudent) { const h = run.history.slice(-3).map(x => x.income); if (h.length) est = Math.min(est, Math.min.apply(null, h) * 1.2); }
    const need = np.amount - est * days * this.o.reserveK;
    return run.cash - price >= need;
  }
  wants(run, id) {
    const L = this.o.buyList;
    if (L) return L.indexOf(id) >= 0;
    return true;
  }
  // 옛 연장함: 가장 앞 순위를 고르고, 칸이 가득이면 가진 것 가운데 가장 뒤 순위와 바꿔요(새 것이 더 앞일 때만). 아니면 곽 씨에게 넘겨요
  takeBox(run) {
    const Core = this.Core, B = run.boxOffer;
    if (B.keep) { Core.chooseBox(run, this.o.noKeep ? -1 : 0); this.m.keeps = (this.m.keeps || 0) + (this.o.noKeep ? 0 : 1); return; }   // 유품은 늘 챙겨요
    let bi = -1, br = 1e9; B.opts.forEach((id, i) => { const r = this.rank(id); if (r < br) { br = r; bi = i; } });
    if (bi < 0) { Core.chooseBox(run, -1); return; }
    if (run.owned.length < Core.slotsOf(run)) { Core.chooseBox(run, bi); this.buys.push({ day: run.day, id: B.opts[bi], where: 'box' }); return; }
    const worst = this.worstOwned(run, true);
    if (worst && this.rank(worst) > br) { Core.chooseBox(run, bi, worst); this.buys.push({ day: run.day, id: B.opts[bi], where: 'box' }); }
    else Core.chooseBox(run, -1);
  }
  worstOwned(run, adding) {
    let w = null, wr = -1;
    for (const id of run.owned) { if (!this.Core.canRemove(run, id, adding)) continue; const r = this.rank(id); if (r > wr) { wr = r; w = id; } }
    return w;
  }
  // 도장 날 금고가 모자라면: 조금 모자라면 덜 아끼는 도구부터 팔고, 많이 모자라면 심 씨에게 빌려요(빌릴 수 없으면 팔 수 있는 만큼 팔아요)
  rescue(run) {
    const Core = this.Core, P = run.payment;
    const L = Core.loanInfo(run), short = P.amount - run.cash;
    const sellSum = run.owned.filter(id => Core.canRemove(run, id, false)).reduce((a, id) => a + Core.sellPrice(run, id), 0);
    if (this.o.noLoan || !L || !L.ok || (sellSum >= short && short <= P.amount * 0.25)) {
      while (run.cash < P.amount) { const w = this.worstOwned(run, false); if (!w) break; Core.sellBack(run, w); this.m.sold = (this.m.sold || 0) + 1; }
      if (run.cash >= P.amount) { Core.payNow(run); return; }
    }
    const L2 = Core.loanInfo(run);
    if (L2 && L2.ok && !this.o.noLoan) { Core.takeLoan(run); this.m.loans = (this.m.loans || 0) + 1; }
  }
  rank(id) {
    const L = this.o.buyList || TOOL_PREF;
    const r = L.indexOf(id);
    return r < 0 ? 99 : r;
  }
  shop(run) {
    const Core = this.Core;
    for (const id of (run.shop.fuse || []).slice()) { if (Core.fuse(run, id).ok) this.m.fused = (this.m.fused || 0) + 1; }   // 합칠 수 있으면 늘 합쳐요
    if (!this.o.spend) return;
    const st = run.shop.stock;
    let order = st.map((id, i) => ({ id, i })).filter(x => x.id && !run.shop.sold[x.i]);
    if (this.o.buy === 'naive') order.sort(() => this.rng() - 0.5);
    else order.sort((a, b) => this.rank(a.id) - this.rank(b.id));
    for (const x of order) {
      const t = Core.TOOL_BY_ID[x.id];
      if (t.kind !== 'passive') {
        // 소모품: 화약은 발파를 쓰는 정책만, 칸이 비고 납부 여유가 있을 때 1개
        if (this.o.useCons && x.id === 'powder' && this.canSpend(run, Core.priceOf(run, x.id, false) + 100)) { const r = Core.buy(run, x.i); if (r.ok) this.buys.push({ day: run.day, id: x.id }); }
        continue;
      }
      if (!this.wants(run, x.id)) continue;
      if (run.owned.length >= Core.slotsOf(run)) break;
      if (this.canSpend(run, Core.priceOf(run, x.id, false))) { const r = Core.buy(run, x.i); if (r.ok) this.buys.push({ day: run.day, id: x.id }); }
    }
  }
  pickOrder(run) {
    if (this.o.buy === 'naive') return Math.floor(this.rng() * run.orders.length);
    let best = 0, bv = 1e9;
    run.orders.forEach((o, i) => { const r = ORDER_PREF.indexOf(o.id); if (r < bv) { bv = r; best = i; } });
    return best;
  }
}

// 한 판을 끝까지(계약 해지 포함). 반환: { final, days: [...], run, bot, buys }
// opts.policy: 'cautious' | 'normal' | 'greedy'. opts.tutorial을 주지 않으면 정책 기본값(신중 = 첫 판 고정 층)
// opts.mutations: { 8: ['twin'], ... } 변덕 배정을 덮어쓴다(측정용)
function playRun(env, seed, opts) {
  opts = opts || {};
  const Core = env.Core, bot = new Bot(env, Object.assign({ botSeed: seed }, opts));
  const tut = opts.tutorial != null ? !!opts.tutorial : !!bot.o.tutorial;
  let run = Core.newRun(seed, { tutorial: tut, grade: opts.grade || 1, char: opts.char });
  if (opts.mutations) run.mutationPlan = Object.assign({}, opts.mutations);
  if (opts.startTools) opts.startTools.forEach(id => { run.owned.push(id); run.paidFor[id] = Core.TOOL_BY_ID[id].price; });
  const days = [], pays = [];
  let guard = 0;
  while ((run.phase !== 'final' || (opts.endless && run.final && run.final.success && !run.endless && Core.continueEndless(run).ok)) && guard++ < (opts.endless ? 600 : 200)) {   // endless: 마지막 도장 뒤 끝없는 갱으로
    if (opts.roundTrip) run = JSON.parse(JSON.stringify(run));   // 판 저장 시험: 단계마다 저장했다 되살려도 같은 판이어야 해요
    if (run.boxOffer) { bot.takeBox(run); continue; }   // 옛 연장함 고르기가 먼저(하루가 같은 순간에 끝났을 수도 있어요)
    if (run.phase === 'deed' && !run.giftDone && run.giftOpts && run.giftOpts.length && !opts.noGift) {   // 중개소 선물(R43): 구매 선호 순서에서 가장 앞
      let gi = 0, gr = 1e9; run.giftOpts.forEach((id, i) => { const r = TOOL_PREF.indexOf(id); if (r >= 0 && r < gr) { gr = r; gi = i; } });
      Core.toGift(run); Core.chooseGift(run, gi); continue;
    }
    if (run.phase === 'gift') {   // 도장 선물: 다음 도장까지 여유가 있으면 도구, 모자라면 금고 돈
      let gi = -1;
      if (run.owned.length < Core.slotsOf(run) && run.giftOpts.length && (bot.o.buy === 'naive' || bot.canSpend(run, 0))) {
        if (bot.o.buy === 'naive') gi = Math.floor(bot.rng() * run.giftOpts.length);
        else { let gr = 1e9; run.giftOpts.forEach((id, i) => { const r = bot.rank(id); if (r < gr) { gr = r; gi = i; } }); }
      }
      if (opts.rewardCash) gi = -1;
      const r = Core.chooseGift(run, gi); if (r.ok && r.id) bot.buys.push({ day: run.day, id: r.id, where: 'reward' });
      if (!r.ok) Core.chooseGift(run, -1);
      continue;
    }
    if (run.phase === 'deed' || run.phase === 'board' || run.phase === 'ready') { if (run.orders.length) Core.chooseOrder(run, bot.pickOrder(run)); Core.startDay(run); continue; }
    if (run.phase === 'mine' || run.phase === 'room') {
      const before = Object.assign({}, bot.m);
      bot.playDay(run);
      const h = run.history[run.history.length - 1];
      const dm = {}; for (const k in bot.m) dm[k] = bot.m[k] - (before[k] || 0);
      days.push({ day: h.day, income: h.income, gross: h.gross, collapsed: h.collapsed, depth: h.depth, stats: h.stats, bot: dm,
                  lines: Object.assign({}, run.settle.lines), owned: run.owned.slice(), mutations: (run.mutationPlan[h.day] || []).slice(),
                  order: run.order ? { id: run.order.id, done: run.order.done } : null });
      continue;
    }
    if (run.phase === 'settle') { Core.afterSettle(run); continue; }
    if (run.phase === 'payment' && run.payment.pending) bot.rescue(run);
    if (run.phase === 'payment') { pays.push({ day: run.day, before: run.payment.before, amount: run.payment.amount, ok: run.payment.ok }); Core.afterPayment(run); continue; }
    if (run.phase === 'shop') { bot.shop(run); Core.nextDay(run); continue; }
    throw new Error('unknown phase ' + run.phase);
  }
  return { final: run.final, days, run, bot: bot.m, buys: bot.buys, pays };
}

export { load, Bot, playRun, POLICY, TOOL_PREF };
