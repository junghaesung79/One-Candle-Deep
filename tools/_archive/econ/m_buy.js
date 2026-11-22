// 최종값 측정 2: 정책 × 구매 방식별 통과율(100판)
const { fresh, measure } = require('./lib.js');
const { B, env } = fresh();
const N = 100, out = [];
const S = {
  '안 삼': { spend: false },
  '아무거나(진열 순서 무작위)': { buy: 'naive' },
  '기본 순서(측정 효과 큰 것부터)': { buy: 'synergy' },
  '줄 축만': { buy: 'synergy', buyList: ['gloves', 'lens', 'lastcard'] },
  '발파 축만': { buy: 'synergy', buyList: ['fuse', 'refiner', 'sieve'] },
  '와르르 축만': { buy: 'synergy', buyList: ['ledger', 'moonsieve', 'wedge'] },
  '분필 축만': { buy: 'synergy', buyList: ['betchalk', 'sheet', 'tongs'] },
  '발파+와르르': { buy: 'synergy', buyList: ['refiner', 'sieve', 'ledger', 'wedge', 'fuse', 'moonsieve'] }
};
for (const p of ['cautious', 'normal', 'greedy']) for (const k in S) {
  if (p !== 'normal' && !['안 삼', '아무거나(진열 순서 무작위)', '기본 순서(측정 효과 큰 것부터)', '줄 축만', '분필 축만'].includes(k)) continue;
  const m = measure(B, env, N, Object.assign({ policy: p }, S[k]));
  const row = { policy: p, buy: k, pass: m.pass, d14: m.inc[14], tools8: m.tools8, collapse: m.collapse };
  out.push(row); console.log(JSON.stringify(row));
}
require('fs').writeFileSync('out/buy.json', JSON.stringify(out, null, 1));
