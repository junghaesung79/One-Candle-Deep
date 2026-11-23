import { describe, it, expect } from 'vitest';
import { load, playRun, type RunOptions } from '../bot/bot.js';

// 봇 연기 검사: 세 정책과 첫 판 경로가 예외 없이 15일 끝까지 가는지만 봐요.
// 납부 통과율 같은 경제 지표는 npm run bot 으로 재요.
const env = load();

function finishes(seed: number, opts: RunOptions) {
  const r = playRun(env, seed, opts);
  expect(r.final, `seed ${seed} ${JSON.stringify(opts)}`).toBeTruthy();
  expect(r.final.success || r.final.day).toBeTruthy();
  return r;
}

describe('봇 한 판', () => {
  it('보통 정책 20판이 끝까지 가요', () => { for (let s = 1; s <= 20; s++) finishes(1000 + s, { policy: 'normal' }); });
  it('신중·욕심 정책 각 10판이 끝까지 가요', () => {
    for (const policy of ['cautious', 'greedy'] as const) for (let s = 1; s <= 10; s++) finishes(3000 + s, { policy });
  });
  it('소극 봇은 납부를 못 해서 계약이 해지돼요', () => {
    let voided = 0;
    for (let s = 1; s <= 10; s++) if (!finishes(5000 + s, { lazy: true, spend: false }).final.success) voided++;
    expect(voided).toBeGreaterThan(0);
  });
  it('첫 판(고정 층) 경로가 끝까지 가요', () => { for (let s = 0; s < 3; s++) finishes(0, { tutorial: true }); });
  it('v2.1 프리셋도 끝까지 가요', () => { env.Core.applyPreset('v21'); try { for (let s = 1; s <= 5; s++) finishes(1000 + s, { policy: 'normal' }); } finally { env.Core.applyPreset('v22'); } });
  it('등급 2·3 광산도 끝까지 가요', () => { for (let s = 1; s <= 3; s++) { finishes(1100 + s, { policy: 'normal', grade: 2 } as any); finishes(1200 + s, { policy: 'normal', grade: 3 } as any); } });
});
