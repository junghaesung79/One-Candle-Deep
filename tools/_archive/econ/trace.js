const { fresh } = require('./lib.js');
const { B, env } = fresh();
const Core = env.Core, C = env.CONFIG; C.payments.forEach(p => p.amount = 1);
const bot = new B.Bot(env, { policy: 'normal', spend: false });
const run = Core.newRun(2005, {});
const origStep = bot.step.bind(bot);
let last = null;
bot.step = function (r) {
  const d = r.d, f = d.floor;
  const before = { c: d.candle, depth: f.depth, m: Object.assign({}, this.m) };
  const res = origStep(r);
  if (r.day === 8 && r.d) {
    const k = Object.keys(this.m).filter(k => this.m[k] !== before.m[k]).join(',');
    console.log('D8 depth', before.depth, 'candle', before.c, '->', r.d.candle, k, 'stair', !!(f.stair && f.stair.found), 'safeOnFloor', this.safeOnFloor);
  }
  return res;
};
while (run.phase !== 'final' && run.day <= 8) {
  if (run.phase === 'deed' || run.phase === 'board') { Core.startDay(run); continue; }
  if (run.phase === 'mine' || run.phase === 'room') { bot.playDay(run); continue; }
  if (run.phase === 'settle') { Core.afterSettle(run); continue; }
  if (run.phase === 'payment') { Core.afterPayment(run); continue; }
  if (run.phase === 'shop') { Core.nextDay(run); continue; }
}
