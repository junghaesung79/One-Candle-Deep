const { fresh, avg } = require('./lib.js');
const { B, env } = fresh();
const C = env.CONFIG; C.payments.forEach(p => p.amount = 1); C.treasureValue = { 1: 20, 2: 50, 3: 120 };
const R = env.Core.TOOL_BY_ID.refiner;
const V = {
  n2_streak: function (ctx, ev) { if (ev.n >= 2) ctx.treasure(ev.x, ev.y, C.treasureValue[1], 'r'); },
  n2_noStreak: function (ctx, ev) { if (ev.n >= 2) ctx.treasure(ev.x, ev.y, C.treasureValue[1], 'r', { noStreak: true }); },
  n3_streak: function (ctx, ev) { if (ev.n >= 3) ctx.treasure(ev.x, ev.y, C.treasureValue[1], 'r'); },
  all_noStreak: function (ctx, ev) { ctx.treasure(ev.x, ev.y, C.treasureValue[1], 'r', { noStreak: true }); },
  n2_noMult: function (ctx, ev) { if (ev.n >= 2) { ctx.run.d.pocket += C.treasureValue[1]; } },
};
function run(tools) { const inc = []; for (let s = 1; s <= 40; s++) { const r = B.playRun(env, 4000 + s, { policy: 'normal', spend: false, startTools: tools, mutations: {} }); r.days.forEach(x => { if (C.payments.some(p => p.day === x.day)) return; inc.push(x.income); }); } return avg(inc); }
const base = run([]);
for (const k in V) { R.hooks.on_blast_mine = V[k]; const a = run(['refiner']), b = run(['refiner', 'fuse']); console.log(k.padEnd(14), 'refiner', (a / base * 100 - 100).toFixed(0) + '%', ' +fuse', (b / base * 100 - 100).toFixed(0) + '%'); }
