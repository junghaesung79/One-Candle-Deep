import { describe, it, expect } from 'vitest';
import { load } from '../bot/bot.js';

const env = load();
const { Core, CONFIG, RULE_IDS, RULES } = env;

// 조건이 거짓이면 실패로 기록하고 다음 검사를 이어 가요(한 번에 실패를 전부 보려고)
function check(cond: unknown, msg: string) { expect.soft(!!cond, msg).toBe(true); }
function pct(a: number, b: number) { return b ? (100 * a / b).toFixed(1) + '%' : '-'; }

// 광맥 규칙 생성기 7종 × 1,000층: 규칙 준수, 기본 제약, '숫자·규칙·밑줄만으로 계단까지' 풀리는 비율
describe('광맥 규칙 생성기', () => {
  it('규칙마다 1,000층을 만들어 규칙·제약을 지켜요', () => {
  console.log('== 1. 광맥 규칙 생성기 (규칙마다 1,000층, 깊이 1~9 고르게) ==');
    const t0 = Date.now();
    for (const rule of RULE_IDS) {
      let ok = 0, ruleOk = 0, solv = 0, relaxed = 0, att = 0, chainSum = 0, bad = 0;
      for (let s = 0; s < 1000; s++) {
        const depth = 1 + (s % 9);
        const f = Core.genFloor({ depth, rule, sx: CONFIG.START.x, sy: CONFIG.START.y, seed: Core.hashSeed(s, depth, rule.length * 31), twin: false });
        att += f.attempts; if (f.relaxed) relaxed++;
        if (Core.checkRule(f)) ruleOk++; else bad++;
        if (f.ok) ok++;
        if (f.solvable) solv++;
        chainSum += Core.startChainSize(f);
        // 시작 3×3 안전, 계단 1개, 숫자 상한
        for (let y = CONFIG.START.y - 1; y <= CONFIG.START.y + 1; y++) for (let x = CONFIG.START.x - 1; x <= CONFIG.START.x + 1; x++) {
          const c = Core.cellAt(f, x, y); if (c.haz || c.stair) { check(false, rule + ' start 3x3 not safe'); }
        }
        check(f.cells.filter(c => c.stair).length === 1, rule + ' exactly one stair');
        if (f.ok) for (const c of f.cells) if (!c.haz && Core.numAt(f, c) > CONFIG.numberCap) check(false, rule + ' number cap');
      }
      check(bad === 0, rule + ' rule violations ' + bad);
      console.log(`  ${RULES[rule].name.padEnd(7)} 규칙 준수 ${ruleOk}/1000 · 제약 통과 ${ok} · 계단까지 풀림 ${pct(solv, 1000)} · 평균 시도 ${(att / 1000).toFixed(1)} · 완화 ${relaxed} · 시작 와르르 평균 ${(chainSum / 1000).toFixed(0)}칸`);
    }
    // 쌍둥이 지뢰 변덕 + 덩이 층
    let tw = 0, ch = 0, chOk = 0;
    for (let s = 0; s < 300; s++) {
      const f = Core.genFloor({ depth: 5, rule: RULE_IDS[s % 7], sx: 7, sy: 5, seed: Core.hashSeed(s, 88), twin: true });
      if (Core.checkRule(f)) tw++;
      const g = Core.genFloor({ depth: 6, rule: ['plain', 'lonely', 'border'][s % 3], sx: 7, sy: 5, seed: Core.hashSeed(s, 89), chunk: { w: 3, h: 2, value: 1200 } });
      if (g.chunk) { ch++; if (Core.checkRule(g) && g.cells.filter(c => c.chunk).length === 6) chOk++; }
    }
    check(tw === 300, 'twin mines rule ' + tw);
    check(chOk === 300, 'chunk floors ' + chOk + '/' + ch);
    console.log(`  쌍둥이 지뢰 변덕 규칙 준수 ${tw}/300 · 3×2 덩이 층 ${chOk}/300 · ${((Date.now() - t0) / 1000).toFixed(1)}초`);
  });
});
