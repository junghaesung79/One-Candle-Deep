import { describe, it, expect } from 'vitest';
import { load, playRun } from '../bot/bot.js';

const env = load();
const { Core, CONFIG, RULES, RULE_IDS } = env;
const W = CONFIG.W, H = CONFIG.H;

// 조건이 거짓이면 실패로 기록하고 다음 검사를 이어 가요(한 번에 실패를 전부 보려고)
function check(cond: unknown, msg: string) { expect.soft(!!cond, msg).toBe(true); }
function pct(a: number, b: number) { return b ? (100 * a / b).toFixed(1) + '%' : '-'; }

const NEW = ['cols', 'diag', 'trio', 'band'] as const;
const isT = (c: any) => c && c.haz === 'treasure';
const isM = (c: any) => c && c.haz === 'mine';
const man = (a: any, b: any) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

// 01 9.2 배치 제약을 규칙 모듈과 따로 다시 세어 봐요(규칙 모듈의 검사와 같은 버그를 나눠 갖지 않게)
function constraintHolds(f: any): string | null {
  const T = f.cells.filter(isT), M = f.cells.filter(isM);
  if (f.rule === 'cols') {
    const cs: Record<number, number> = {}; T.forEach((c: any) => { cs[c.x] = (cs[c.x] || 0) + 1; });
    const ks = Object.keys(cs).map(Number);
    if (T.length >= 6 && ks.length !== 3) return 'three columns';
    if (ks.length > 3) return 'more than three columns';
    if (ks.some(x => cs[x + 1])) return 'adjacent columns';
    if (ks.some(x => cs[x] < 2)) return 'column with fewer than 2';
    if (!f.treasureCols || f.treasureCols.join() !== ks.sort((a, b) => a - b).join()) return 'treasureCols data';
  }
  if (f.rule === 'diag') {
    for (const c of T) {
      if (Core.orthN(f, c.x, c.y).some(isT)) return 'orthogonal treasure';
      if (Core.diagN(f, c.x, c.y).filter(isT).length !== 1) return 'diagonal mate count';
    }
    if (T.length % 2) return 'odd count';
    if (!f.diagPairs || f.diagPairs.length * 2 !== T.length) return 'diagPairs data';
    for (const [a, b] of f.diagPairs) { const A = f.cells[a], B = f.cells[b]; if (!isT(A) || !isT(B) || Core.cheb(A.x, A.y, B.x, B.y) !== 1 || man(A, B) !== 2) return 'diagPairs not diagonal'; }
  }
  if (f.rule === 'trio') {
    if (T.length % 3) return 'count not multiple of 3';
    if (!f.groups || f.groups.length * 3 !== T.length) return 'groups data';
    const owner: Record<number, number> = {};
    f.groups.forEach((g: number[], gi: number) => g.forEach(i => { owner[i] = gi; }));
    for (const g of f.groups) {
      const cs = g.map(i => f.cells[i]);
      if (!cs.every(isT)) return 'group cell not treasure';
      const deg = cs.map(a => cs.filter(b => man(a, b) === 1).length);
      if (deg.filter(d => d === 2).length !== 1 || deg.some(d => d === 0)) return 'group not connected in a line or L';
    }
    for (const c of T) {
      const gi = owner[Core.idx(c)];
      if (gi == null) return 'treasure outside groups';
      if (Core.neighbors(f, c.x, c.y).some((n: any) => isT(n) && owner[Core.idx(n)] !== gi)) return 'groups touch';
    }
  }
  if (f.rule === 'band') {
    for (const c of T) if (Core.neighbors(f, c.x, c.y).some(isM)) return 'mine next to treasure';
    const halo = new Set<number>();
    T.forEach((c: any) => Core.neighbors(f, c.x, c.y).forEach((n: any) => { if (!isT(n)) halo.add(Core.idx(n)); }));
    if (!f.band || f.band.length !== halo.size || f.band.some((i: number) => !halo.has(i))) return 'band data';
  }
  return null;
}

// 층 표(10.1) + 광맥 보정 + 개수 맞춤(01 9.4)
function expectedT(rule: string, depth: number) {
  let t = CONFIG.density[Math.min(depth, CONFIG.density.length) - 1].t + ((CONFIG.ruleTune[rule] || {}).t || 0);
  if (rule === 'cols') t = Math.max(6, t);
  if (rule === 'diag' && t % 2) t++;
  if (rule === 'trio') t = Math.max(3, Math.ceil(t / 3) * 3);
  return t;
}

describe('새 광맥 넷(세로줄, 대각선, 무리, 금 띠)', () => {
  it('규칙 모듈에 이름·표지판·광맥 풀이 있어요', () => {
    for (const r of NEW) {
      check(RULE_IDS.includes(r), r + ' in RULE_IDS');
      check(RULES[r] && RULES[r].name && RULES[r].sign && RULES[r].help, r + ' sign text');
      check(CONFIG.rulePool.includes(r), r + ' in v22 pool');
      check(CONFIG.ruleTune[r], r + ' tune');
    }
    // 옛 광맥의 광맥 번호(시드 열쇠)는 그대로
    check(RULE_IDS.slice(0, 7).join() === 'plain,pair,lonely,rows,tally,minepair,border', 'old vein numbers unchanged');
  });

  it('광맥마다 1,000층을 만들어 제약·개수·쓸모 검사를 지켜요', () => {
    console.log('== 새 광맥 생성기 (광맥마다 1,000층, 깊이 1~9 고르게) ==');
    for (const rule of NEW) {
      const t0 = Date.now();
      let bad = 0, coreBad = 0, ok = 0, solv = 0, useful = 0, countOk = 0, att = 0, relaxed = 0, worst = 0, revealed = 0;
      const firstBad: string[] = [];
      for (let s = 0; s < 1000; s++) {
        const depth = 1 + (s % 9);
        const t1 = Date.now();
        const f = Core.genFloor({ depth, rule, sx: CONFIG.START.x, sy: CONFIG.START.y, seed: Core.hashSeed(s, depth, 0x7e1a + rule.length), twin: false });
        worst = Math.max(worst, Date.now() - t1);
        att += f.attempts; if (f.relaxed) relaxed++;
        if (f.ok) ok++;
        if (f.solvable) solv++;
        if (!Core.checkRule(f)) coreBad++;
        const why = constraintHolds(f);
        if (why) { bad++; if (firstBad.length < 3) firstBad.push(s + ':' + why); }
        const nT = f.cells.filter(isT).length;
        if (!f.relaxed && nT === expectedT(rule, depth)) countOk++;
        const u = f.usefulT != null ? f.usefulT : Core.usefulCount(f); revealed += u;   // 생성할 때 잰 값(쓸모 검사)
        if (u >= (CONFIG.usefulMineRules.includes(rule) ? CONFIG.usefulMineMin : (CONFIG.usefulMinBy[rule] || CONFIG.usefulMin))) useful++;
        // 시작 3×3 안전, 계단 1개, 숫자 상한
        for (let y = CONFIG.START.y - 1; y <= CONFIG.START.y + 1; y++) for (let x = CONFIG.START.x - 1; x <= CONFIG.START.x + 1; x++) {
          const c = Core.cellAt(f, x, y); if (c.haz || c.stair) check(false, rule + ' start 3x3 not safe');
        }
        check(f.cells.filter((c: any) => c.stair).length === 1, rule + ' exactly one stair');
        if (f.ok) for (const c of f.cells) if (!c.haz && Core.numAt(f, c) > CONFIG.numberCap) check(false, rule + ' number cap');
      }
      check(bad === 0, rule + ' constraint violations ' + bad + ' ' + firstBad.join(' '));
      check(coreBad === 0, rule + ' checkRule rejects ' + coreBad);
      check(ok >= 990, rule + ' floors pass checks ' + ok);
      check(countOk + relaxed >= 990, rule + ' treasure count ' + countOk);
      check(solv >= 950, rule + ' solvable ' + solv);
      // 쓸모 검사는 25번 안에 못 맞추면 가장 많이 가려 준 배치를 써요(01 10.4). 그래도 대부분은 통과해야 해요
      check(useful >= 900, rule + ' usefulness ' + useful);
      check(worst < 1000, rule + ' worst floor ' + worst + 'ms');
      console.log(`  ${RULES[rule].name.padEnd(7)} 제약 ${1000 - bad}/1000 · 검사 통과 ${ok} · 보물 수 맞음 ${countOk} · 계단까지 풀림 ${pct(solv, 1000)} · 쓸모 ${pct(useful, 1000)} (규칙으로 가린 칸 평균 ${(revealed / 1000).toFixed(1)}) · 평균 시도 ${(att / 1000).toFixed(1)} · 완화 ${relaxed} · 평균 ${((Date.now() - t0) / 1000).toFixed(1)}ms · 최악 ${worst}ms`);
    }
  });

  it('규칙 풀이가 정답과 어긋나지 않아요(보물 확실·지뢰 확실이 늘 맞음)', () => {
    // 층을 조금씩 열어 가며 deduce가 '보물 확실' '지뢰 확실'이라고 한 칸이 실제와 같은지 봐요
    for (const rule of NEW) {
      let wrong = 0, claims = 0;
      for (let s = 0; s < 80; s++) {
        const f = Core.genFloor({ depth: 1 + (s % 9), rule, sx: 7, sy: 5, seed: Core.hashSeed(s, 31337, rule.length), twin: false });
        const g = JSON.parse(JSON.stringify(f));
        const open = (c: any) => {   // 안전한 칸을 열고 0이면 와르르
          const q = [c];
          while (q.length) {
            const z = q.pop(); if (z.cover === 'open') continue; z.cover = 'open';
            if (z.haz) { z.removed = true; continue; }
            if (Core.numAt(g, z) === 0) for (const n of Core.neighbors(g, z.x, z.y)) if (n.cover !== 'open' && !n.haz && !n.stair) q.push(n);
          }
        };
        open(Core.cellAt(g, 7, 5));
        for (let step = 0; step < 40; step++) {
          const D = Core.deduce(g);
          for (const i of D.tre) { claims++; if (g.cells[i].haz !== 'treasure') wrong++; }
          for (const i of D.mine) { claims++; if (g.cells[i].haz !== 'mine') wrong++; }
          for (const i of D.safe) { claims++; if (g.cells[i].haz && !(g.cells[i].stair)) wrong++; }
          for (let i = 0; i < g.cells.length; i++) { const c = g.cells[i]; if (c.cover === 'open') continue; if (!D.canT[i] && c.haz === 'treasure') wrong++; if (!D.canM[i] && c.haz === 'mine') wrong++; }
          // 다음: 확실한 칸부터, 없으면 열린 땅에 닿은 칸 하나를 캐요(지뢰면 그 자리에서 터진 것으로)
          const next = D.safe.concat(D.tre).map((i: number) => g.cells[i]).find((c: any) => c.cover !== 'open')
            || g.cells.find((c: any) => c.cover !== 'open' && c.haz === 'treasure' && Core.neighbors(g, c.x, c.y).some((n: any) => n.cover === 'open'))
            || g.cells.find((c: any) => c.cover !== 'open' && Core.neighbors(g, c.x, c.y).some((n: any) => n.cover === 'open'));
          if (!next) break;
          if (next.haz) { next.cover = 'open'; next.removed = true; for (const n of Core.neighbors(g, next.x, next.y)) if (n.cover === 'open' && Core.numAt(g, n) === 0) for (const m of Core.neighbors(g, n.x, n.y)) if (!m.haz && !m.stair) open(m); }
          else open(next);
        }
      }
      check(wrong === 0, rule + ' deduce wrong ' + wrong + '/' + claims);
    }
  });

  it('갈림길 카드 어림의 보물 수가 층 생성과 같아요', () => {
    const run = Core.newRun(424242);
    Core.startDay(run);
    for (const rule of NEW) for (const depth of [1, 3, 5, 9]) {
      const est = Core.floorEstimate(run, depth, rule, null);
      check(est.t === expectedT(rule, depth), rule + ' estimate ' + depth + ' ' + est.t);
    }
  });

  it('새 광맥만 나오는 판을 봇이 끝까지 돌아요', () => {
    const pool0 = CONFIG.rulePool;
    try {
      for (const rule of NEW) {
        CONFIG.rulePool = [rule];
        const r = playRun(env, 900 + rule.length, { policy: 'normal' });
        check(r.final, rule + ' run finished');
        check(r.days.some((d: any) => d.income > 0), rule + ' some income');
      }
    } finally { CONFIG.rulePool = pool0; }
  });
});
