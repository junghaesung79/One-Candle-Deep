import { describe, it, expect } from 'vitest';

// 그림 코드가 오류 없이 다 만들어지는지(규칙 테스트는 그림을 돌리지 않아서, 그림 순서 실수로 화면이 멈춘 일이 있었어요)
describe('그림', () => {
  it('모든 그림이 오류 없이 만들어지고, 도구·소모품·캐릭터 그림이 빠짐없이 있어요', async () => {
    const ctx: any = new Proxy({}, { get: () => () => {}, set: () => true });
    (globalThis as any).document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx, toDataURL: () => '' }) };
    const { SPR } = await import('../src/sprites.js');
    const { Core, CHARACTERS } = await import('../src/core.js');
    Core.applyPreset('v22');
    const missing = Object.values(Core.TOOL_BY_ID).filter((t: any) => t.sets && t.sets.includes('22') && t.icon && !t.icon.startsWith('k') && !SPR.icons[t.icon]).map((t: any) => t.id);
    expect(missing).toEqual([]);
    expect(Core.CONSUMABLES.every((c: any) => SPR.icons[c.icon])).toBe(true);
    expect(CHARACTERS.every((c: any) => SPR.minerBy[c.id])).toBe(true);
  });
});
