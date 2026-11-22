// 최종값 측정 3: 불발 규칙 3가지 × 전략(보통 정책), 점화 촛불 3·4
const { fresh, measure } = require('./lib.js');
const { B, env } = fresh();
const N = 100, out = [];
for (const fz of ['keep', 'scorch', 'melt']) for (const ic of [3, 4]) {
  env.CONFIG.fizzle = fz; env.CONFIG.igniteCost = ic;
  for (const [name, o] of [['기본(보통)', {}], ['불발 확인(보물일 듯한 칸에 먼저 불)', { fizzleProbe: 0.3 }], ['불로 걸기 위주(보물 확률 0.4 이하면 불)', { fireThr: 0.4 }]]) {
    if (ic === 4 && fz !== 'melt') continue;
    const m = measure(B, env, N, Object.assign({ policy: 'normal' }, o));
    const row = { fizzle: fz, ignite: ic, strategy: name, pass: m.pass, d1: m.inc[1], d14: m.inc[14], hazRate: m.hazRate, fire: m.firePerDay, leftover: m.leftover, collapse: m.collapse, streak3: null };
    out.push(row); console.log(JSON.stringify(row));
  }
}
require('fs').writeFileSync('out/abuse.json', JSON.stringify(out, null, 1));
