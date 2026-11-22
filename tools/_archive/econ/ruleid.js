// 광맥별 가려냄 비율 상한: 안전 칸을 전부 열고, 정체를 아는 칸을 캐거나 터뜨리기를 반복했을 때 정체가 밝혀지는 위험 칸 비율
const { fresh } = require('./lib.js');
const { env } = fresh();
const Core = env.Core, C = env.CONFIG;
function openAllSafe(f) {
  let prog = true;
  while (prog) {
    prog = false;
    const D = Core.deduce(f);
    for (const i of D.safe) { const c = f.cells[i]; if (c.cover !== 'open') { c.cover = 'open'; prog = true; } }
    for (const i of D.tre) { const c = f.cells[i]; if (c.cover !== 'open') { c.cover = 'open'; c.removed = true; c.__id = 'T'; prog = true; } }
    for (const i of D.mine) { const c = f.cells[i]; if (c.cover !== 'open') { c.cover = 'open'; c.removed = true; c.__id = 'M'; prog = true; } }
  }
}
for (const rule of env.RULE_IDS) {
  let H = 0, idd = 0, idT = 0, T = 0, n = 300;
  for (let s = 0; s < n; s++) {
    const depth = 2 + (s % 4);
    const f = Core.genFloor({ depth, rule, sx: 7, sy: 5, seed: Core.hashSeed(s, 5, depth, rule.length) });
    // 시작 와르르
    const st = Core.cellAt(f, 7, 5); st.cover = 'open';
    openAllSafe(f);
    // 한 번 찍기(opener): 보물 하나를 캔 것으로(규칙이 열리는 층)
    const tr = f.cells.filter(c => c.haz === 'treasure' && c.cover !== 'open');
    if (tr.length && ['lonely','pair','rows','minepair'].includes(rule)) { const c = tr[0]; c.cover = 'open'; c.removed = true; c.__id = 'G'; openAllSafe(f); }
    const hz = f.cells.filter(c => c.haz === 'mine' || c.haz === 'treasure');
    H += hz.length; T += hz.filter(c => c.haz === 'treasure').length;
    idd += hz.filter(c => c.__id === 'T' || c.__id === 'M').length; idT += hz.filter(c => c.__id === 'T').length;
  }
  console.log(rule.padEnd(9), 'hazards/floor', (H / n).toFixed(1), 'identified', (100 * idd / H).toFixed(0) + '%', 'treasures identified', (100 * idT / T).toFixed(0) + '%');
}
