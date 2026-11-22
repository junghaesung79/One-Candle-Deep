// 2차 프로토타입 봇. index.html의 ==CORE BEGIN== ~ ==CORE END== 구간을 읽어 node에서 Core를 만든다.
// 경제 담당 재사용: const { load, Bot, playRun } = require('./bot.js');
//   const env = load();                       // { Core, CONFIG, TOOLS, ... } (CONFIG를 고친 뒤 playRun을 돌리면 된다)
//   const r = playRun(env, seed, opts);       // 한 판(15일)을 끝까지 진행하고 기록을 돌려준다
// 봇이 보는 정보는 화면에 보이는 것뿐이다: 열린 칸의 숫자, 분필, 두드려 보기 결과, 캔 보물 자리, 표지판, 눈금, 밑줄.
// 덮인 칸의 정체(c.haz)는 읽지 않는다. 추리는 Core.deduce(숫자 + 광맥 규칙)를 쓴다.
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');

function load(htmlPath) {
  const html = fs.readFileSync(htmlPath || path.join(__dirname, 'index.html'), 'utf8');
  const m = /\/\/ ==CORE BEGIN==([\s\S]*?)\/\/ ==CORE END==/.exec(html);
  if (!m) throw new Error('core section not found');
  const sb = { module: { exports: {} }, console };
  vm.createContext(sb);
  vm.runInContext(m[1], sb, { filename: 'core.js' });
  return sb.module.exports;
}

const RULE_PREF = { border: 6, lonely: 5, minepair: 5, rows: 4, tally: 4, pair: 4, plain: 1 };
const TOOL_PREF = ['ledger', 'refiner', 'lens', 'gloves', 'moonsieve', 'fuse', 'sieve', 'wedge', 'sheet', 'lastcard', 'betchalk', 'tongs'];
const ORDER_PREF = ['reach5', 'deepStreak', 'gems2', 'bigNum', 'chain20', 'streak3', 'floor6', 'noProbe', 'blast4', 'chalkO', 'chain3', 'clean3', 'emberT', 'keep20', 'noMine'];

class Bot {
  constructor(env, opts) {
    this.env = env; this.Core = env.Core; this.CONFIG = env.CONFIG;
    this.o = Object.assign({ gambleLow: 0.34, gamblePlain: 0.45, gambleHigh: 0.5, blastMinOpen: 3, safeBudget: 14, floorBudget: 8, spend: true, lazy: false }, opts || {});
    this.m = { gambles: 0, ruleDigs: 0, safeDigs: 0, stairDigs: 0, guessDigs: 0, blasts: 0 };
  }
  // ---------- 하루 ----------
  playDay(run) {
    const Core = this.Core;
    let guard = 0;
    this.tried = new Set();
    while ((run.phase === 'mine' || run.phase === 'room') && guard++ < 3000) {
      run.fx.length = 0;
      if (run.phase === 'room') { this.room(run); continue; }
      if (!this.step(run)) { Core.returnUp(run); break; }
    }
    if (run.phase === 'mine' || run.phase === 'room') Core.returnUp(run);
  }
  room(run) {
    const Core = this.Core, d = run.d;
    if (run.room.kind === 'spring') { Core.springChoose(run, d.hp < d.hpMax ? 'hp' : 'candle'); return; }
    // 상인 방: 납부 여유가 있으면 1개
    const st = run.room.stock;
    for (let i = 0; i < st.length; i++) {
      const t = Core.TOOL_BY_ID[st[i]];
      if (t.kind === 'passive' && this.canSpend(run, Core.priceOf(run, st[i], true))) { Core.buy(run, i); break; }
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
    return true;
  }
  step(run) {
    const Core = this.Core, CONFIG = this.CONFIG, d = run.d, f = d.floor, o = this.o;
    const W = CONFIG.W;
    const D = Core.deduce(f, { sleepy: Core.mut(run, 'sleepy') });
    const cell = i => f.cells[i];
    const ok = c => c.cover !== 'open' && !this.tried.has(c);
    const tre = D.tre.map(cell).filter(ok);
    const mines = D.mine.map(cell).filter(ok);
    const chunkFloor = !!(f.chunk && !f.chunk.done);
    // 불씨: 아는 보물만 캐고 올라간다
    if (d.embersOn) {
      const t = this.nearest(run, tre.concat(f.cells.filter(c => ok(c) && c.mark === 2 && D.st[Core.idx(c)] !== 1)));
      if (t) return this.dig(run, t, 'ruleDigs');
      return false;
    }
    // 아는 지뢰에 X(공짜)
    if (!chunkFloor) for (const c of mines) if (c.mark !== 1) Core.mark(run, c.x, c.y, 1);
    const cost = Core.hitCost(run);
    const nextCost = Core.travelCost(run, f.depth + 1);
    // 1) 아는 보물부터(줄이 높을수록 확정 보물을 먼저)
    if (tre.length && d.candle >= cost) return this.dig(run, this.nearest(run, tre), 'ruleDigs');
    // 덩이: 위험으로 확정된 칸이 덩이 모양으로 모인 곳
    if (chunkFloor && d.candle > 4) {
      const t = this.chunkTarget(run, D);
      if (t) return this.dig(run, t, 'ruleDigs');
    }
    const unk = D.haz.map(cell).filter(c => ok(c) && D.canT[Core.idx(c)] && D.canM[Core.idx(c)]);
    const stairKnown = f.stair && f.stair.found;
    const reserve = stairKnown ? nextCost : 0;
    const gamble = (thr) => {
      if (o.lazy || !unk.length || d.candle < cost + reserve) return null;
      if (d.hp < 2 && thr < 0.75) return null;
      let best = null, bp = 0;
      for (const c of unk) { const p = this.pTreasure(run, D, c); if (p > bp) { bp = p; best = c; } }
      if (!best || bp < thr) return null;
      if (Core.owns(run, 'betchalk') && bp >= 0.5) Core.mark(run, best.x, best.y, 2);
      return best;
    };
    if (this.floorRef !== f) { this.floorRef = f; this.safeOnFloor = 0; this.floorCandle0 = d.candle; }
    // 층마다 촛불 예산을 넘기면 계단으로(깊은 층일수록 보물 값이 높다)
    const overBudget = stairKnown && (this.floorCandle0 - d.candle) > o.floorBudget;
    // 2) 보물일 가능성이 높은 위험 칸(규칙으로 확률을 올린 칸)
    let g = gamble(0.6);
    if (g) return this.dig(run, g, 'gambles');
    // 3) 발파: 아는 지뢰 중 둘레에 덮인 칸이 많은 것
    if (!chunkFloor && d.candle >= Core.igniteCost(run) + nextCost && !o.lazy) {
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
          const pw = run.cons.findIndex(a => a.id === 'powder');
          if (best.mark !== 1) Core.mark(run, best.x, best.y, 1);
          const r = pw >= 0 ? Core.useCons(run, pw) : Core.ignite(run, best.x, best.y);
          if (r.ok) { this.m.blasts++; return true; }
        }
        this.tried.add(best);
      }
    }
    // 4) 정보가 되는 안전 칸(층마다 상한)
    const safe = D.safe.map(cell).filter(ok);
    const informative = safe.filter(c => Core.neighbors(f, c.x, c.y).some(n => n.cover !== 'open' && D.st[Core.idx(n)] !== 1));
    const sc = informative.filter(c => D.stairCand.indexOf(Core.idx(c)) >= 0);
    if (!overBudget && (sc.length || (informative.length && (!stairKnown || this.safeOnFloor < o.safeBudget))) && d.candle >= cost + reserve) {
      this.safeOnFloor++;
      return this.dig(run, this.nearest(run, sc.length ? sc : informative), 'safeDigs');
    }
    // 5) 걸기: 줄이 높으면 문턱을 올린다
    // 첫 보물이 규칙 추리를 여는 층(외톨이·짝·가로줄)에서는 체력이 가득일 때 한 번 걸어 본다
    const opener = ['lonely', 'pair', 'rows'].indexOf(f.rule) >= 0 && f.treasuresDug === 0 && d.hp === d.hpMax;
    g = overBudget ? null : gamble(d.streak >= 2 ? o.gambleHigh : opener ? 0.3 : f.rule === 'plain' ? o.gamblePlain : o.gambleLow);
    if (g) return this.dig(run, g, 'gambles');
    // 5) 계단
    if (stairKnown) {
      if (d.candle >= nextCost) {
        const opts = f.forkOptions;
        const i = this.pickFork(run, opts);
        if (Core.travelTo(run, f.stair.x, f.stair.y).ok) {
          const r = Core.descend(run, i);
          if (r.ok) return true;
        }
      }
    } else {
      // 계단 찾기: 후보가 하나면 그 칸, 아니면 안전하지 않은 후보 중 하나
      const cands = D.stairCand.map(cell).filter(ok);
      if (cands.length && d.candle >= cost) return this.dig(run, this.nearest(run, cands), 'stairDigs');
      // 6) 막힘: 두드려 보기 → 찍기
      const front = this.frontier(run, D).filter(ok);
      if (front.length && d.candle >= cost) {
        front.sort((a, b) => this.pHaz(run, D, a) - this.pHaz(run, D, b));
        const c = front[0], ph = this.pHaz(run, D, c);
        if (d.probes > 0 && d.candle >= 3 && ph > 0.15 && c.probe == null) {
          if (Core.approach(run, c.x, c.y).ok) { const r = Core.probe(run, c.x, c.y); if (r.ok) return true; }
        }
        if (c.probe === 'mine') { this.tried.add(c); return true; }
        if (d.hp >= 2 || ph <= 0.2 || c.probe === 'safe') return this.dig(run, c, 'guessDigs');
      }
    }
    // 남은 덩이를 위해 촛불을 쓸 일이 없으면 올라간다
    return false;
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
  pTreasure(run, D, c) {
    const Core = this.Core, f = run.d.floor, i = Core.idx(c);
    if (!D.canM[i]) return 1;
    if (!D.canT[i]) return 0;
    if (c.probe === 'safe' || c.fizzle) return 1;
    let p = f.rule === 'minepair' ? 0.45 : 0.38;
    if (f.rule === 'pair') {
      // 캔 보물의 짝 후보이면 1/k
      for (const n of Core.orthN(f, c.x, c.y)) {
        if (n.cover === 'open' && n.removed && n.haz === 'treasure') {
          const k = Core.orthN(f, n.x, n.y).filter(z => z.cover !== 'open' && D.canT[Core.idx(z)] && D.st[Core.idx(z)] !== 1).length;
          if (k) p = Math.max(p, 1 / k);
        }
      }
    }
    if (f.rule === 'minepair' || f.twin) {
      for (const n of Core.orthN(f, c.x, c.y)) {
        if (n.cover === 'open' && n.removed && n.haz === 'mine') {
          const k = Core.orthN(f, n.x, n.y).filter(z => z.cover !== 'open' && D.canM[Core.idx(z)] && D.st[Core.idx(z)] !== 1).length;
          if (k) p = Math.min(p, 1 - 1 / k);
        }
      }
    }
    if (c.lens) p = Math.max(p, 0.5);
    return p;
  }
  chunkTarget(run, D) {
    const Core = this.Core, f = run.d.floor, C = f.chunk, W = this.CONFIG.W, H = this.CONFIG.H;
    // 이미 캔 덩이 조각이 있으면 그 조각을 포함하는 직사각형 중 가능한 것
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
    for (let yy = R.y; yy < R.y + C.h; yy++) for (let xx = R.x; xx < R.x + C.w; xx++) { const c = Core.cellAt(f, xx, yy); if (c.cover !== 'open' && !this.tried.has(c)) return c; }
    return null;
  }
  pickFork(run, opts) {
    const d = run.d;
    let best = 0, bv = -1;
    opts.forEach((o, i) => {
      let v = o.kind === 'floor' ? RULE_PREF[o.rule] : o.kind === 'spring' ? (d.hp < d.hpMax ? 7 : 2) : (this.canSpend(run, 200) ? 3 : 0);
      if (o.chunk) v += 2;
      if (v > bv) { bv = v; best = i; }
    });
    return best;
  }
  // ---------- 상점 ----------
  estIncome(run) {
    const h = run.history.slice(-3);
    if (!h.length) return 250;
    return h.reduce((a, x) => a + x.income, 0) / h.length;
  }
  canSpend(run, price) {
    const np = this.Core.nextPayment(run);
    if (!np) return true;
    const days = np.day - run.day;   // 상점은 그날 밤: 남은 날 수만큼 더 번다
    const need = np.amount - this.estIncome(run) * days * 0.4;
    return run.cash - price >= need;
  }
  shop(run) {
    const Core = this.Core;
    if (!this.o.spend) return;
    const st = run.shop.stock;
    const order = st.map((id, i) => ({ id, i })).filter(x => x.id && !run.shop.sold[x.i]);
    order.sort((a, b) => TOOL_PREF.indexOf(a.id) - TOOL_PREF.indexOf(b.id));
    for (const x of order) {
      const t = Core.TOOL_BY_ID[x.id];
      if (t.kind !== 'passive') continue;
      if (run.owned.length >= this.CONFIG.shop.passiveSlots) break;
      if (this.canSpend(run, Core.priceOf(run, x.id, false))) Core.buy(run, x.i);
    }
  }
  pickOrder(run) {
    let best = 0, bv = 1e9;
    run.orders.forEach((o, i) => { const r = ORDER_PREF.indexOf(o.id); if (r < bv) { bv = r; best = i; } });
    return best;
  }
}

// 한 판을 끝까지(계약 해지 포함). 반환: { final, days: [...], run }
function playRun(env, seed, opts) {
  const Core = env.Core, bot = new Bot(env, opts);
  const run = Core.newRun(seed, { tutorial: !!(opts && opts.tutorial) });
  const days = [];
  let guard = 0;
  while (run.phase !== 'final' && guard++ < 200) {
    if (run.phase === 'deed' || run.phase === 'board') { if (run.orders.length) Core.chooseOrder(run, bot.pickOrder(run)); Core.startDay(run); continue; }
    if (run.phase === 'mine' || run.phase === 'room') {
      const before = Object.assign({}, bot.m);
      bot.playDay(run);
      const h = run.history[run.history.length - 1];
      const dm = {}; for (const k in bot.m) dm[k] = bot.m[k] - (before[k] || 0);
      days.push({ day: h.day, income: h.income, gross: h.gross, collapsed: h.collapsed, depth: h.depth, stats: h.stats, bot: dm,
                  order: run.order ? { id: run.order.id, done: run.order.done } : null });
      continue;
    }
    if (run.phase === 'settle') { Core.afterSettle(run); continue; }
    if (run.phase === 'payment') { Core.afterPayment(run); continue; }
    if (run.phase === 'shop') { bot.shop(run); Core.nextDay(run); continue; }
    throw new Error('unknown phase ' + run.phase);
  }
  return { final: run.final, days, run, bot: bot.m };
}

module.exports = { load, Bot, playRun };
