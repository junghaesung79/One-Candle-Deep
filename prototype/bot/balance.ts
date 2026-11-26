// 밸런스 실험(reviews/22): 변형 하나를 골라 정책별로 봇을 돌리고 숫자 몇 개를 JSON으로 찍어요.
// npx tsx bot/balance.ts <변형> <판 수>   변형: base, mul, info, curve, mix …(아래 VARIANTS)
// 변형마다 규칙 모듈을 고치므로 한 프로세스에 변형 하나만 돌려요.
import { load, playRun } from './bot.js';

const env: any = load();
const { Core, CONFIG } = env;
const name = process.argv[2] || 'base';
const N = +(process.argv[3] || 100);

function tool(id: string, f: (t: any) => void) { f(Core.TOOL_BY_ID[id]); }

// 변형: 1 곱 줄이기, 2 정보 도구 강화, 3 납부 곡선
const VARIANTS: Record<string, () => void> = {
  base() {},
  // 1. 곱 줄이기: 기본 ×3 위의 콤보 단계를 0.5 → 0.25로(늙은 광부 모자 ×3.5, 마지막 패 ×4, 막장 왕관 ×4.5).
  //    합친 큰 발파의 금 알갱이는 콤보를 올리지 않게, 정제기는 4개부터
  mul() {
    CONFIG.streakLadder = [1, 1.5, 2, 2.5, 3, 3.25, 3.5, 3.75, 4, 4.25, 4.5];
    CONFIG.relic = Object.assign({}, CONFIG.relic, { bigStreak: false });
    CONFIG.refinerMin = 4;
  },
  // 2. 정보 도구: 청진 망치 하루 3번, 감정 렌즈는 콤보와 상관없이, 둘 다 값 내림. 배수 도구 값 올림
  info() {
    CONFIG.lensMinMult = 0;
    tool('tapper', t => { t.price = 90; });
    tool('lens', t => { t.price = 140; });
    tool('crown', t => { t.price = 300; });
    tool('lastcard', t => { t.price = 300; });
    tool('refiner', t => { t.price = 420; });
    (globalThis as any).__tapperProbes = 3;
  },
  // 3. 납부 곡선: 앞은 낮추고 뒤는 높게
  curve() { setPays([250, 700, 1700, 3800, 8000]); },
  curve2() { setPays([200, 600, 1600, 4000, 10000]); },
  mix() { VARIANTS.mul(); VARIANTS.info(); VARIANTS.curve(); },
  mix2() { VARIANTS.mul(); VARIANTS.info(); VARIANTS.curve2(); },
  mulinfo() { VARIANTS.mul(); VARIANTS.info(); }
};
function setPays(a: number[]) { CONFIG.payments = CONFIG.payments.map((p: any, i: number) => Object.assign({}, p, { amount: a[i] })); }

if (process.env.PAYS) VARIANTS[name] = () => setPays(process.env.PAYS!.split(',').map(Number));   // PAYS=300,1000,2400,4800,8000 처럼 곡선을 바로 줄 수 있어요
if (!VARIANTS[name]) throw new Error('모르는 변형 ' + name);
VARIANTS[name]();
// 청진 망치 횟수는 하루 시작에서 정해요. 변형에서 바꿨으면 하루를 열 때 고쳐 넣어요
const startDay0 = Core.startDay;
Core.startDay = function (run: any) { const r = startDay0.apply(this, arguments as any); const n = (globalThis as any).__tapperProbes; if (n && run.d && Core.owns(run, 'tapper') && !CONFIG.features.probeBase) { run.d.probes = n; run.d.probesMax = n; } return r; };
// 밤마다 금고를 적어 둬요: 남은 도장을 다 낼 만큼 모인 날 = 긴장이 끝난 날
const settle0 = Core.afterSettle;
let tense: number | null = null, curRun: any = null;
Core.afterSettle = function (run: any) {
  if (run !== curRun) { curRun = run; tense = null; }
  const left = Core.payments(run).slice(run.stamps).reduce((a: number, p: any) => a + p.amount, 0);
  if (tense == null && run.cash >= left) tense = run.day;
  return settle0.apply(this, arguments as any);
};

const avg = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const med = (a: number[]) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[b.length >> 1] : 0; };
const out: any = { variant: name, grade: +(process.env.GRADE || 1), pays: CONFIG.payments.map((p: any) => p.amount) };
for (const [pol, base] of [['normal', 1000], ['cautious', 3000], ['greedy', 7000]] as const) {
  const R: any[] = [], tenseDays: number[] = [];
  for (let s = 1; s <= N; s++) {
    tense = null; curRun = null;
    const r = playRun(env, base + s, { policy: pol, grade: +(process.env.GRADE || 1) });
    R.push(r); tenseDays.push(tense == null ? 16 : tense);
  }
  const NP = CONFIG.payments.length, lines: Record<string, number> = {};
  R.forEach(r => r.days.forEach((d: any) => { for (const k in d.lines) lines[k] = (lines[k] || 0) + (d.lines[k] || 0); }));
  for (const k in lines) lines[k] = Math.round(lines[k] / R.length);
  const scores = R.filter(r => r.final.success).map(r => r.final.score);
  out[pol] = {
    pass: Array.from({ length: NP }, (_, i) => Math.round(100 * R.filter(r => r.final.stamps > i).length / R.length)),
    scoreAvg: Math.round(avg(scores)), scoreMed: med(scores),
    income15: Math.round(avg(R.flatMap(r => r.days.filter((d: any) => d.day === 15).map((d: any) => d.income)))),
    incomeAll: Math.round(avg(R.map(r => r.days.reduce((a: number, d: any) => a + d.income, 0)))),
    maxStreak: +avg(R.flatMap(r => r.days.map((d: any) => d.stats.maxStreak || 0))).toFixed(2),
    tenseEnd: +avg(tenseDays).toFixed(1), tenseEndMed: med(tenseDays),
    lines
  };
}
out.ratio = +(out.normal.incomeAll / Math.max(1, out.cautious.incomeAll)).toFixed(2);
console.log(JSON.stringify(out));
