import { Core, CONFIG, TEXT, RULES, MUTATIONS, TUTORIAL, TREASURE_NAMES, CHARACTERS, TOOLS } from './core.js';
import { SPR, iconHtml } from './sprites.js';

// ================= 화면, 입력, 연출 (배치·시간: 03_art_ui.md v0.3 3.6, 6장) =================
var run = null;
var settings = { shake: true, flash: true, tutorialDone: false, best: 0, aim: false, openingSeen: false, gradeOpen: 1, grade: 1, bestBy: {}, bubblesOnce: {} };   // R92: 조준(기본 꺼짐, 끄면 옆 칸은 한 번에 캐고 X는 한 번에 터뜨려요). R87: 키보드 단축키·범례·말풍선은 늘 켜짐
try { var sv = JSON.parse(localStorage.getItem('ocd2_settings') || 'null'); if (sv) settings = Object.assign(settings, sv); } catch (e) {}
// 주소 뒤에 ?preset=v21 을 붙이면 2차 기획 v2.1 규칙으로 해 볼 수 있어요(플레이테스트 비교용)
try { var qpreset = new URLSearchParams(location.search).get('preset'); if (qpreset) Core.applyPreset(qpreset); } catch (e) {}
function saveSettings() { try { localStorage.setItem('ocd2_settings', JSON.stringify(settings)); } catch (e) {} }
// 도감(Balatro처럼 처음엔 이름이 가려져 있고, 얻을 때마다 열려요). 이 브라우저에 남아요
var CODEX_KEY = 'ocd2_codex';
var codex = (function () { try { return JSON.parse(localStorage.getItem(CODEX_KEY) || '{}') || {}; } catch (e) { return {}; } })();
if (!codex.seen) codex.seen = {};
function codexMark(ids) { var nw = []; ids.forEach(function (id) { if (id && !codex.seen[id]) { codex.seen[id] = 1; nw.push(id); } }); if (nw.length) { try { localStorage.setItem(CODEX_KEY, JSON.stringify(codex)); } catch (e) {} } return nw; }
// 처음 가진 도구는 이름이 열려요: 칸이 금빛으로 번지고 설명 칸에 이름을 띄워요
function reveal(ids) {
  var nw = codexMark(ids); if (!nw.length || typeof ui === 'undefined') return;
  var now = performance.now();
  nw.forEach(function (id) { ui.revealAt[id] = now; });
  if (run) (run.newSeen = run.newSeen || []).push.apply(run.newSeen, nw);
  var t = Core.TOOL_BY_ID[nw[nw.length - 1]] || Core.KEEP_BY_ID[nw[nw.length - 1]];
  ui.desc = '<span class="acc">' + TEXT.revealed + '</span> <b>' + esc(t.name) + '</b><br>' + esc(t.desc); ui.hudDirty = true;
}
// 안 가져 본 도구는 이름을 가려요(효과는 보여요). 도감과 같은 규칙
function tName(id) { return codex.seen[id] ? Core.TOOL_BY_ID[id].name : TEXT.unknownTool; }
function kName(id) { return codex.seen[id] ? Core.KEEP_BY_ID[id].name : TEXT.unknownKeep; }

var T = 48, BW = CONFIG.W, BH = CONFIG.H, BOX = 44, BOY = 64;   // 판 왼쪽 위(무대 좌표)
var ui = { sub: null, sel: 0, debugReveal: false, hover: null, shownAt: 0, rHold: null, hudDirty: true, desc: null,
           bubbleQ: [], bubble: null, bubblesSeen: {}, pairHints: 0, flys: [], pocketPending: 0, logFrom: 0, seenMine: false,
           rulesSeen: {}, settleT0: 0, payT0: 0, lastCandle: null, shopSel: -1, slotPop: {}, keepPop: {}, revealAt: {}, streakFx: null, pendingBreak: null };
var anim = { pend: {}, shake: [], flashUntil: 0, pops: [], stopUntil: 0, numBlink: {}, blame: null, pairHint: null, emberT: 0, floorT: 0 };
var sched = [];
var stage = document.getElementById('stage'), board = document.getElementById('board'), bctx = board.getContext('2d');
bctx.imageSmoothingEnabled = false;
var $ = function (id) { return document.getElementById(id); };
var NUMC = { 1: '#8fd3ff', 2: '#9be37a', 3: '#ffd25a', 4: '#ff9a4d', 5: '#ff6b6b', 6: '#d58cff', 7: '#f1ece2', 8: '#a59fb3' };
var fmt = Core.fmt;
// 숫자 폰트: Press Start 2P를 불러오면 판 숫자에도 쓰고, 못 불러오면 시스템 고정폭 글꼴로 그린다
var NUMFONT = 'Consolas, Menlo, "Courier New", monospace', psReady = false;
if (document.fonts && document.fonts.load) document.fonts.load('20px "Press Start 2P"').then(function () { psReady = document.fonts.check('20px "Press Start 2P"'); ui.hudDirty = true; }, function () {});
function numFont(px) { return psReady ? Math.round(px * 0.8) + 'px "Press Start 2P", ' + NUMFONT : 'bold ' + px + 'px ' + NUMFONT; }
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

function fitStage() {
  var s = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
  if (s >= 1) s = Math.floor(s);
  stage.style.transform = 'scale(' + s + ')';
  stage.style.left = Math.max(0, (window.innerWidth - 1280 * s) / 2) + 'px';
  stage.style.top = Math.max(0, (window.innerHeight - 720 * s) / 2) + 'px';
}
window.addEventListener('resize', fitStage);

// ---------- 예약 실행(계산 연출, 팝업). 아무 입력이나 받으면 남은 단계를 즉시 놓는다(6.0) ----------
function after(ms, fn) { sched.push({ t: performance.now() + ms, fn: fn }); }
function runSched(now) {
  if (!sched.length) return;
  var due = sched.filter(function (s) { return s.t <= now; });
  if (!due.length) return;
  sched = sched.filter(function (s) { return s.t > now; });
  due.sort(function (a, b) { return a.t - b.t; }).forEach(function (s) { s.fn(); });
}
function flushAll() {
  var guard = 0;
  while (sched.length && guard++ < 50) { var list = sched; sched = []; list.sort(function (a, b) { return a.t - b.t; }).forEach(function (s) { s.fn(); }); }
  ui.flys.slice().forEach(function (f) { finishFly(f); });
  anim.pend = {};
  anim.stopUntil = 0;
  ui.hudDirty = true;
}

// ---------- 새 판 ----------
function todayStr() { var t = new Date(); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); }
// ---------- 통계(R91): 판 수, 완납, 연속 완납. 판이 끝나거나 진행 중인 판을 버리면 한 판 ----------
function countRun(won) {
  if (!run || run.statDone) return;
  run.statDone = true;
  var S = settings.stats || (settings.stats = { plays: 0, clears: 0, streak: 0, bestStreak: 0 });
  var before = openChars();
  S.plays++; S.maxStamps = Math.max(S.maxStamps || 0, run.stamps || 0);
  if (won) { S.clears++; S.streak++; S.bestStreak = Math.max(S.bestStreak, S.streak); } else S.streak = 0;
  saveSettings();
  run.newChars = openChars().filter(function (id) { return before.indexOf(id) < 0; });   // 판 끝 화면 '이번 판에 열린 것'
}
// 캐릭터 열기(01 15.6): 광부는 처음부터, 나머지는 조건을 채우면 열려요. 잠긴 사람은 실루엣과 조건만
function charOpen(id) {
  var S = settings.stats || {}, B = settings.bestBy || {};
  if (id === 'miner') return true;
  if (id === 'surveyor') return (S.plays || 0) >= 1;
  if (id === 'defuser') return (S.clears || 0) >= 1;
  if (id === 'gambler') return (S.maxStamps || 0) >= 3;
  if (id === 'blaster') return (B['grade:2'] || 0) > 0 || (settings.gradeOpen || 1) >= 3;
  return true;
}
function openChars() { return CHARACTERS.filter(function (c) { return charOpen(c.id); }).map(function (c) { return c.id; }); }
function statsLine() {
  var S = settings.stats; if (!S || !S.plays) return '아직 끝낸 판이 없어요';
  return '판 ' + S.plays + ' · 완납 ' + S.clears + '(' + Math.round(S.clears / S.plays * 100) + '%) · 연속 완납 ' + S.streak + '(최고 ' + S.bestStreak + ')';
}
function bestLine() {
  var B = settings.bestBy || {}, out = [];
  for (var g = 1; g <= 3; g++) { var v = B['grade:' + g] || (g === 1 ? settings.best || 0 : 0); if (v) out.push(gradeName(g) + ' ' + fmt(v)); }
  return out.length ? '최고 점수 ' + out.join(' · ') : '';
}
function startNewRun(tutorial, o) {
  o = o || {};
  if (inProgress(run)) countRun(false);   // 진행 중인 판을 버리면 진 판으로 세요
  clearSave(); ui.title = false;
  var grade = tutorial ? 1 : Math.max(1, Math.min(settings.gradeOpen || 1, o.grade || settings.grade || 1));
  var daily = !tutorial && o.daily ? todayStr() : null;
  var seedSet = !tutorial && !daily && o.seed != null;   // 시드를 넣은 판
  var seed = tutorial ? TUTORIAL.seed : daily ? Core.dailySeed(daily) : seedSet ? o.seed : Core.randomSeed();
  run = Core.newRun(seed, { tutorial: tutorial, record: true, grade: daily ? 1 : grade, daily: daily, char: charOpen(settings.char || 'miner') ? settings.char : 'miner' });   // 기록 장치: 하루마다 플레이 기록을 남겨요. 오늘의 광산은 모두 같은 씨앗, 등급 1
  run.seedSet = seedSet;
  resetView();
  ui.opening = tutorial && !settings.openingSeen ? 0 : null;   // R52: 첫 판만 자동
  renderOverlay(); ui.hudDirty = true;
}
function resetView() {
  sched = []; ui.flys.forEach(function (f) { if (f.el.parentNode) f.el.remove(); }); ui.flys = []; ui.pocketPending = 0;
  ui.sub = null; ui.sel = 0; ui.bubblesSeen = {}; ui.pairHints = 0; ui.seenMine = false; ui.firstBreakDone = false; ui.rulesSeen = {}; ui.bubbleQ = []; hideBubble();
  ui.shownAt = performance.now(); ui.mode = null; ui.aim = null; ui.judge = null;
  anim.pend = {}; anim.pops = [];
}

// ---------- 판 저장과 이어하기(01 18장) ----------
// 판 상태는 함수 없는 자료라서 통째로 적어요. 판이 끝나면 지워요. 규칙 판본이나 프리셋이 다르면 이어하지 않아요
var RUN_KEY = 'ocd2_run', SAVE_V = 1;
var UI_KEEP = ['logFrom', 'dayClicks', 'dayRecorded', 'giftLine', 'bubblesSeen', 'rulesSeen', 'seenMine', 'firstBreakDone', 'pairHints'];
function inProgress(r) { return !!r && r.phase !== 'final' && !!(r.d || r.day > 1); }
function clearSave() { try { localStorage.removeItem(RUN_KEY); } catch (e) {} }
function saveRun() {
  if (!run) return;
  if (run.phase === 'final') { clearSave(); return; }
  if (!inProgress(run)) return;
  var u = {}; UI_KEEP.forEach(function (k) { u[k] = ui[k]; }); u.dayMs = ui.dayT0 ? Date.now() - ui.dayT0 : 0;
  var fx = run.fx; run.fx = [];
  try { localStorage.setItem(RUN_KEY, JSON.stringify({ v: SAVE_V, gen: CONFIG.genVersion, preset: CONFIG.preset, at: Date.now(), run: run, ui: u })); } catch (e) {}
  run.fx = fx;
}
function loadSave() {
  try {
    var s = JSON.parse(localStorage.getItem(RUN_KEY) || 'null');
    if (s && s.v === SAVE_V && s.gen === CONFIG.genVersion && s.preset === CONFIG.preset && inProgress(s.run)) return s;
  } catch (e) {}
  return null;
}
function resumeRun(s) {
  run = s.run; run.fx = []; ui.title = false; ui.save = null;
  resetView();
  UI_KEEP.forEach(function (k) { if (s.ui && k in s.ui) ui[k] = s.ui[k]; });
  ui.dayT0 = s.ui && s.ui.dayMs ? Date.now() - s.ui.dayMs : 0;
  ui.lastCandle = run.d ? run.d.candle : null; ui.opening = null;
  afterAction.lastPhase = run.phase;
  renderOverlay(); ui.hudDirty = true;
}
window.addEventListener('pagehide', saveRun);
document.addEventListener('visibilitychange', function () { if (document.hidden) saveRun(); });
function beginDay() {
  if (run.orders.length && !run.order) Core.chooseOrder(run, ui.sel || 0);
  var before = run.logSeq;
  Core.startDay(run);
  ui.logFrom = before;   // 하루 시작 때 로그를 비움(그날 로그만)
  if (ui.giftLine) { run.log.push({ text: ui.giftLine, id: ++run.logSeq }); ui.giftLine = null; }
  ui.lastCandle = run.d.candle; ui.pocketPending = 0;
  ui.dayT0 = Date.now(); ui.dayClicks = 0; ui.dayRecorded = false; ui.judge = null;
  ui.sub = null;
  drainFx(); renderOverlay(); ui.hudDirty = true;
}

// ---------- 날아가는 팝업 ----------
function stageXY(cx, cy) { return { x: BOX + cx * T + T / 2, y: BOY + cy * T + T / 2 }; }
var POCKET_XY = { x: 1200, y: 36 }, CANDLE_XY = { x: 930, y: 140 };
function addFly(o) {
  var el = document.createElement('div'); el.className = 'pop'; el.style.display = 'none';
  el.style.fontSize = (o.size || 16) + 'px'; el.style.color = o.color || '#ffd25a';
  $('fxLayer').appendChild(el);
  var f = Object.assign({ el: el, born: performance.now(), showAt: 0, flyAt: 660, flyDur: 350, rise: 24, steps: [], tx: POCKET_XY.x, ty: POCKET_XY.y, total: 0 }, o);
  ui.flys.push(f);
  return f;
}
function finishFly(f) {
  if (f.done) return;
  f.done = true;
  if (f.el.parentNode) f.el.remove();
  ui.flys.splice(ui.flys.indexOf(f), 1);
  if (f.pocket) { ui.pocketPending = Math.max(0, ui.pocketPending - f.pocket); blinkEl('pocketBox', 'blink', 200); }
  if (f.onArrive) f.onArrive();
  ui.hudDirty = true;
}
function updateFlys(now) {
  ui.flys.slice().forEach(function (f) {
    var k = now - f.born;
    if (k < f.showAt) { f.el.style.display = 'none'; return; }
    f.el.style.display = 'block';
    var html = '';
    for (var i = 0; i < f.steps.length; i++) if (k >= f.steps[i].t) html = f.steps[i].h;
    if (f.el._h !== html) { f.el.innerHTML = html; f.el._h = html; }
    var x = f.x, y = f.y - Math.min(1, (k - f.showAt) / 200) * f.rise, op = 1, sc = 1;
    if (f.flyAt != null && k >= f.flyAt) {
      var p = Math.min(1, (k - f.flyAt) / f.flyDur), e = p * p;
      x = x + (f.tx - x) * e; y = y + (f.ty - y) * e; sc = 1 - 0.4 * p;
      if (p >= 1) { finishFly(f); return; }
    } else if (f.fadeAt != null && k >= f.fadeAt) {
      op = Math.max(0, 1 - (k - f.fadeAt) / 300); if (op <= 0) { finishFly(f); return; }
    }
    f.el.style.left = x + 'px'; f.el.style.top = y + 'px'; f.el.style.opacity = op;
    f.el.style.transform = 'translate(-50%,-50%) scale(' + sc + ')';
  });
}
function multTxt(m) { return '×' + (Math.round(m * 10) / 10); }
function blinkEl(id, cls, ms) { var e = $(id); if (!e) return; e.classList.add(cls); clearTimeout(e['_t' + cls]); e['_t' + cls] = setTimeout(function () { e.classList.remove(cls); }, ms); }

// ---------- 연출 큐 ----------
function addShake(px, ms, exp) { if (!settings.shake) return; anim.shake.push({ a: px, ms: ms, t0: performance.now(), exp: !!exp }); }
function drainFx() {
  if (!run) return;
  if (!run.d) { run.fx = []; return; }
  var now = performance.now(), list = run.fx; run.fx = [];
  var procs = [], gainIdx = 0, hadGain = false, gainAnchor = null;
  list.forEach(function (e) {
    switch (e.t) {
      case 'candle': candleFloat(e.delta); break;
      case 'break': ui.firstBreakDone = true; addShake(2, 120); anim.stopUntil = Math.max(anim.stopUntil, now + 70); break;
      case 'open': {
        var start, total = CONFIG.fx.chainMaxMs;
        if (e.floorStart) { start = now + 350; anim.floorT = now; ui.rulesSeen[run.d.floor.rule] = true; }
        else start = now + (e.stop || 0);
        var maxRing = 0; e.cells.forEach(function (c) { if (c.ring > maxRing) maxRing = c.ring; });
        var gap = maxRing ? Math.max(CONFIG.fx.ringMinMs, Math.min(CONFIG.fx.ringMs, total / maxRing)) : 0;
        e.cells.forEach(function (c) { anim.pend[c.y * BW + c.x] = { t: start + c.ring * gap, was: c.was }; });
        if (e.floorStart && run.tutorial && run.day === 1 && run.d.floor.depth === 1) after(1700, function () { bubble('number', TEXT.bubbles.number, { el: 'legend', above: true }); });
        if (e.floorStart) { var fc = run.d.floor.cells.filter(function (q) { return q.faded && q.cover !== 'open'; })[0]; if (fc) after(2100, function () { bubble('faded', TEXT.firstRun.fadedBubble, { cell: { x: fc.x, y: fc.y } }); }); }   // 바랜 분필 자국: 처음 본 자리에서 한 번
        if (e.floorStart && run.d.floor.rule !== 'plain' && run.tutorial) after(1700, function () { bubble('sign', TEXT.bubbles.sign, { el: 'sign', below: true }); });
        break;
      }
      case 'gravel': {
        var p = stageXY(e.x, e.y), t0 = e.floorStart ? 950 : 300;
        ui.pocketPending += e.total;
        addFly({ x: p.x, y: p.y - 10, showAt: t0, flyAt: t0 + 300, size: 15, color: '#c9c3d6', pocket: e.total,
                 steps: [{ t: t0, h: iconHtml('pebble', 24) + '자갈 +' + e.total }] });
        if (e.floorStart && run.tutorial && run.day === 1 && run.d.floor.depth === 1) after(1800, function () { bubble('gravel', TEXT.bubbles.gravel, { el: 'pocketBox', below: true }); });
        break;
      }
      case 'gain': {
        var q = stageXY(e.x, e.y), d0 = gainIdx * 120; gainIdx++; hadGain = true;
        ui.pocketPending += e.total;
        var base = e.scorch ? fmt(e.full || e.base * 2) + ' 반값' : '' + fmt(e.base);   // 01 7.2 "20 반값 ×2 = 20"
        var plainT = !e.order && !e.chunk && !e.scorch && e.label !== '정제기';   // 바로 캔 보물: 무엇을 캤는지 크게 보여 준다
        var ic = e.order ? '' : iconHtml(e.chunk ? 'chunk' : e.label === '정제기' ? 'nugget' : 'tier.' + (e.tier || 1), e.chunk ? 40 : plainT ? 44 : 24);
        if (plainT) anim.pops.push({ x: e.x, y: e.y, t0: now + gainIdx * 120 - 120, kind: 'lift', tier: e.tier || 1 });
        var s1 = ic + (plainT ? '<span class="tname t' + (e.tier || 1) + '">' + TREASURE_NAMES[e.tier || 1] + '</span> ' : '') + base, s2 = s1 + (e.mult > 1 ? ' ' + multTxt(e.mult) : '') + (e.bonus ? ' +' + Math.round(e.bonus * 100) + '%' : '');
        var s3 = s2 + ((e.mult > 1 || e.bonus || e.scorch) ? ' = ' + fmt(e.total) : '');
        if (e.order) { s1 = s2 = s3 = '주문 +' + fmt(e.total); }
        var gi = gainIdx - 1;
        if (e.scorch || e.label === '정제기') {   // 발파로 얻은 값: 그 칸 위에 작게, 바로 주머니로(판을 오래 가리지 않게. 03 6.0)
          addFly({ x: Math.max(80, Math.min(730, q.x)), y: q.y - 6, showAt: 200 + gi * 60, flyAt: 650 + gi * 60, flyDur: 300, size: 13, pocket: e.total, rise: 10,
                   steps: [{ t: 200 + gi * 60, h: s3 }] });
          break;
        }
        if (!gainAnchor) { gainAnchor = { x: Math.max(110, Math.min(700, q.x)), y: q.y - 16, down: q.y - 16 - 3 * 24 < 84, n: 0 }; }
        var gn = gainAnchor.n++;
        var gx = gainAnchor.x, gy = gainAnchor.down ? gainAnchor.y + 60 + (gn % 6) * 40 : gainAnchor.y - 14 - (gn % 6) * 40;
        addFly({ x: gx, y: gy, showAt: 120 + d0, flyAt: (e.chunk ? 1300 : 900) + d0, flyDur: e.chunk ? 500 : 350, size: e.chunk ? 22 : 17, pocket: e.total, rise: e.chunk ? 40 : 24,
                 steps: [{ t: 120 + d0, h: s1 }, { t: 240 + d0, h: s2 }, { t: 360 + d0, h: s3 }] });
        if (e.chunk) { addShake(4, 300); }
        if (run.tutorial && run.d.floor.rule === 'pair' && !e.chunk && !e.order && e.label !== '정제기' && ui.pairHints < 3) {
          ui.pairHints++;
          anim.pairHint = { cells: Core.orthN(run.d.floor, e.x, e.y).filter(function (c) { return c.cover !== 'open'; }).map(function (c) { return { x: c.x, y: c.y }; }), t0: now };
        }
        break;
      }
      case 'streak':
        ui.streakFx = { t0: now + 1250, kind: 'up' };   // 보물 팝업이 주머니에 닿는 때(900 + 350)
        if (e.to >= 1 && run.tutorial) after(1100, function () { bubble('streak', TEXT.bubbles.streak, { el: 'streakBox', below: true }); });
        break;
      case 'streakBreak':
        ui.streakFx = { t0: now + 350, kind: 'break', from: e.from, to: e.to };
        anim.pops.push({ x: run.d.px, y: run.d.py, t0: now + 350, kind: 'smoke' });
        break;
      case 'mine':
        if (settings.flash) anim.flashUntil = now + 150 + 33;
        addShake(6, 300, true); anim.stopUntil = Math.max(anim.stopUntil, now + 150);
        anim.pops.push({ x: e.x, y: e.y, t0: now + 150, kind: 'boom' });
        anim.hurtT = now + 150;
        ui.seenMine = true;
        if (run.tutorial) after(600, function () { bubble('mine', TEXT.bubbles.mine, { cell: { x: e.x, y: e.y } }); });
        break;
      case 'blame': anim.blame = { cells: e.cells, t0: now + 200 }; break;
      case 'judge': {   // 지뢰 판정 한 줄(재미 보고서 1주차): 숫자를 가리지 않게 판 아래 범례 자리에 4초
        var jk = { text: e.text, kind: e.kind };
        after(650, function () { ui.judge = jk; ui.hudDirty = true; });
        after(4650, function () { if (ui.judge === jk) { ui.judge = null; ui.hudDirty = true; } });
        break;
      }
      case 'boom': anim.pops.push({ x: e.x, y: e.y, t0: now + 80 + (e.delay || 0), kind: e.blast ? 'dust' : 'boom' }); after(80 + (e.delay || 0), function () { addShake(4, 250); if (settings.flash && !e.delay) anim.flashUntil = performance.now() + 33; }); break;
      case 'fizzle': {
        anim.pops.push({ x: e.x, y: e.y, t0: now + 150, kind: 'fizzle' });
        if (e.text) { var fp = stageXY(e.x, e.y); addFly({ x: Math.max(120, Math.min(690, fp.x)), y: fp.y - 30, showAt: 150, flyAt: null, fadeAt: 1300, size: 14, rise: 10, color: '#c9c3d6', steps: [{ t: 150, h: esc(e.text) }] }); }
        break;
      }
      case 'relit': ui.hudDirty = true; break;
      case 'probe': anim.pops.push({ x: e.x, y: e.y, t0: now + 180, kind: 'probe' }); break;
      case 'box': {   // 옛 연장함: 멈춤, 빛기둥, 칸 위 글자. 솟는 걸 본 뒤 고르는 창
        anim.stopUntil = Math.max(anim.stopUntil, now + CONFIG.fx.boxStop); addShake(3, 220);
        anim.pops.push({ x: e.x, y: e.y, t0: now + 60, kind: 'boxLift', scorch: e.scorch });
        var bq = stageXY(e.x, e.y);
        addFly({ x: Math.max(110, Math.min(700, bq.x)), y: bq.y - 40, showAt: 120, flyAt: 900, size: 18, color: '#ffd25a', steps: [{ t: 120, h: iconHtml('icons.box', 28) + '<span class="tname t3">옛 연장함</span>' }] });
        after(700, function () { if (run.boxOffer) { ui.shownAt = performance.now(); renderOverlay(); } });
        break;
      }
      case 'boxHere': blinkEl('candleBox', 'flick', 900); after(700, function () { bubble('boxHere', TEXT.firstRun.boxBubble, { el: 'candleBox', below: true }); }); break;
      case 'boxMelt': anim.pops.push({ x: e.x, y: e.y, t0: now + 150, kind: 'fizzle' }); break;
      case 'stair': anim.pops.push({ x: e.x, y: e.y, t0: now, kind: 'stair' }); break;
      case 'locked': anim.pops.push({ x: e.x, y: e.y, t0: now, kind: 'locked' }); break;
      case 'chalkDust': anim.pops.push({ x: e.x, y: e.y, t0: now, kind: 'dust' }); break;
      case 'numChange': anim.numBlink[e.y * BW + e.x] = now + 360; break;
      case 'awake': addShake(3, 600); anim.stopUntil = Math.max(anim.stopUntil, now + 200); break;
      case 'chunkPiece': break;
      case 'embers':
        anim.emberT = now;
        if (run.tutorial || !ui.bubblesSeen.ember) after(1500, function () { bubble('ember', TEXT.bubbles.ember, { el: 'candleBox', below: true }); });
        if (run.tutorial && run.day <= 3 && CONFIG.features.embers) teachHere('ember', TUTORIAL.b3Graffiti.o, { x: run.d.px, y: run.d.py });
        break;
      case 'proc': procs.push(e); break;
      case 'order': blinkEl('orderLine', 'acc', 1200); break;
      case 'perfect': addFly({ x: 380, y: 250, showAt: 500, flyAt: null, fadeAt: 2200, size: 26, rise: 16, color: '#ffd25a', steps: [{ t: 500, h: '완벽한 층' }] }); break;
    }
  });
  // 계산 연출: 도구 아이콘이 순서대로 튄다(6.7). 원인 연출 포함 1.2초 안
  if (procs.length) {
    var baseT = hadGain ? 450 : 200, gap = Math.max(60, Math.min(150, (1200 - baseT) / procs.length));
    if (gap === 60 && procs.length * 60 + baseT > 1200) procs = mergeProcs(procs);
    procs.forEach(function (pr, i) {
      after(baseT + i * gap, function () {
        ui.slotPop[pr.id] = performance.now();
        var m = run.d ? stageXY(run.d.px, run.d.py) : { x: 400, y: 300 };
        addFly({ x: m.x + 22 + i * 10, y: m.y - 22, showAt: 0, flyAt: null, fadeAt: 300, size: 13, rise: 14,
                 steps: [{ t: 0, h: iconHtml('icons.' + pr.icon, 24) }] });
        ui.hudDirty = true;
      });
    });
    // 연출이 끝난 뒤 로그 한 줄로 요약(6.7)
    var summary = procs.map(function (pr) { return Core.TOOL_BY_ID[pr.id] ? Core.TOOL_BY_ID[pr.id].short + ' ' + pr.label : pr.label; }).join(' · ');
    after(baseT + procs.length * gap + 50, function () { if (run.d) { run.log.push({ text: summary, id: ++run.logSeq, kind: 'good' }); ui.hudDirty = true; } });
  }
  ui.hudDirty = true;
}
function mergeProcs(ps) { var out = [], by = {}; ps.forEach(function (p) { if (by[p.id]) { by[p.id].n++; by[p.id].label = by[p.id].base + ' ×' + by[p.id].n; } else { by[p.id] = Object.assign({}, p, { n: 1, base: p.label }); out.push(by[p.id]); } }); return out; }
function candleFloat(delta) {
  var big = Math.abs(delta) >= 4 && delta < 0;
  var awake = delta === -2 && run.d && run.d.floor && run.d.floor.awake;
  addFly({ x: CANDLE_XY.x + 30 + Math.random() * 6, y: CANDLE_XY.y + (delta > 0 ? 18 : 0), showAt: 0, flyAt: null, fadeAt: big ? 300 : 100, rise: delta > 0 ? -12 : 12, size: big ? 24 : 16,
           color: delta > 0 ? '#9be37a' : awake ? '#f1ece2' : '#ff9a4d', steps: [{ t: 0, h: (delta > 0 ? '+' : '') + delta }] });
}

// ---------- 강조 말풍선(6개, 첫 판) ----------
function bubble(key, text, anchor) {
  if (ui.bubblesSeen[key]) return;
  var anyRun = ['ember', 'gold', 'faded', 'boxHere'].indexOf(key) >= 0;   // 첫 판 밖에서도 나오는 말풍선은 브라우저에 한 번만(R87)
  if (!anyRun && !(run && run.tutorial)) return;
  if (anyRun && !run.tutorial) { if (!settings.bubblesOnce) settings.bubblesOnce = {}; if (settings.bubblesOnce[key]) return; settings.bubblesOnce[key] = true; saveSettings(); }
  ui.bubblesSeen[key] = true;
  ui.bubbleQ.push({ key: key, text: text, anchor: anchor, at: performance.now() });
  if (!ui.bubble) nextBubble();
}
function nextBubble() {
  var b = ui.bubbleQ.shift();
  while (b && performance.now() - b.at > 8000) b = ui.bubbleQ.shift();   // 오래 기다린 말풍선은 그 순간이 지났으므로 버린다
  if (!b) return;
  var el = document.createElement('div'); el.className = 'bubble'; el.innerHTML = esc(b.text);
  stage.appendChild(el);
  var x = 400, y = 300, w = el.offsetWidth, h = el.offsetHeight, a = b.anchor;
  anim.bubbleCell = null;
  if (a.cell || a.el === 'legend' || a.el === 'sign') {   // 판 위 숫자를 가리지 않게: 판 아래 기록 칸 자리에 띄우고, 가리키는 칸은 판 위에 테두리로
    var ax0 = a.cell ? stageXY(a.cell.x, a.cell.y).x - 20 : a.el === 'sign' ? 150 : 140;
    x = Math.max(44, Math.min(768 - w, ax0)); y = 652 + Math.max(0, (52 - h) / 2); el.classList.add('tt');
    if (a.cell) anim.bubbleCell = { x: a.cell.x, y: a.cell.y };
  } else if (a.el) {
    var t = $(a.el), L = t.offsetLeft, Tp = t.offsetTop;
    if (a.above) { x = L + (a.el === 'legend' ? 140 : 10); y = Tp - h - 12; el.classList.add('tb'); }
    else { x = L + 10; y = Tp + t.offsetHeight + 12; el.classList.add('tt'); }
  } else if (a.cell) {
    var p = stageXY(a.cell.x, a.cell.y); x = p.x - 20; y = p.y - 24 - h - 12; el.classList.add('tb');
    if (y < 64) { y = p.y + 30; el.classList.remove('tb'); el.classList.add('tt'); }
  }
  x = Math.max(8, Math.min(1272 - w, x));
  el.style.left = x + 'px'; el.style.top = y + 'px';
  ui.bubble = { el: el, t0: performance.now(), key: b.key };
}
function hideBubble() { anim.bubbleCell = null; if (ui.bubble) { var e = ui.bubble.el; e.style.transition = 'opacity 0.2s'; e.style.opacity = 0; setTimeout(function () { e.remove(); }, 200); ui.bubble = null; setTimeout(nextBubble, 220); } }
function bubbleOnAction() { if (ui.bubble && performance.now() - ui.bubble.t0 >= 1500) hideBubble(); }
function clearBubbles() { anim.bubbleCell = null; ui.bubbleQ = []; if (ui.bubble) { ui.bubble.el.remove(); ui.bubble = null; } }

// ---------- 판 그리기 ----------
function cellVisual(c, now) {
  var p = anim.pend[c.y * BW + c.x];
  if (p) {
    if (now < p.t) return { covered: true, fade: 0 };
    var k = (now - p.t) / CONFIG.fx.openAnimMs;
    if (k >= 1) { delete anim.pend[c.y * BW + c.x]; return { covered: false, fade: 1, numT: 1 }; }
    return { covered: false, fade: k, numT: Math.max(0, (now - p.t - 60) / 90) };
  }
  return { covered: c.cover !== 'open', fade: 1, numT: 1 };
}
function stairHinted(f, x, y) {
  if (CONFIG.stairShown || !f.stair || f.stair.found || Core.mut(run, 'sleepy')) return false;   // 계단이 보이면 밑줄을 쓰지 않아요
  return Core.cheb(f.stair.x, f.stair.y, x, y) === 1;
}
function drawBoard(now) {
  var g = bctx, d = run.d, f = d && d.floor;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#0b0a10'; g.fillRect(0, 0, 720, 528);
  if (!f) return;
  var sx = 0, sy = 0, sum = 0;
  anim.shake = anim.shake.filter(function (s) { return now - s.t0 < s.ms; });
  anim.shake.forEach(function (s) { var k = (now - s.t0) / s.ms; sum += s.exp ? s.a * Math.pow(0.02, k) : s.a * (1 - k); });
  sum = Math.min(6, sum);
  if (sum > 0) { sx = (Math.random() * 2 - 1) * sum; sy = (Math.random() * 2 - 1) * sum; }
  g.translate(Math.round(sx), Math.round(sy));
  var embers = d.embersOn && run.phase === 'mine';
  var low = CONFIG.features.lowLight && !embers && d.candle <= CONFIG.lowLight && run.phase === 'mine';
  var blur = Core.mut(run, 'blur'), goldSeen = false;
  var x, y, c, X, Y, v, vi;
  // 1) 바닥·바위
  for (y = 0; y < BH; y++) for (x = 0; x < BW; x++) {
    c = f.cells[y * BW + x]; X = x * T; Y = y * T; v = cellVisual(c, now); vi = (x + y * 7) & 3;
    if (!v.covered) {
      g.drawImage(SPR.ground[vi], X, Y, T, T);
      var up = Core.cellAt(f, x, y - 1), lf = Core.cellAt(f, x - 1, y);
      if (up && up.cover !== 'open') g.drawImage(SPR.shTop, X, Y, T, T);
      if (lf && lf.cover !== 'open') g.drawImage(SPR.shLeft, X, Y, T, T);
      if (c.scorch) g.drawImage(c.haz === 'mine' && c.removed ? SPR.scorch : SPR.scorchDust, X, Y, T, T);
      if (c.stair && !(f.stair && f.stair.blocked)) g.drawImage(SPR.stair, X, Y, T, T);
      else if (c.stair) { g.drawImage(SPR.rock[vi], X, Y, T, T); g.fillStyle = 'rgba(29,20,14,0.55)'; g.fillRect(X, Y, T, T); }   // 첫날 지하 3층: 막힌 계단 자리
      if (c.chunk && c.removed && f.chunk && !f.chunk.done) g.drawImage(SPR.chunk, X, Y, T, T);
      if (v.fade < 1) { g.globalAlpha = 1 - v.fade; g.drawImage(SPR.rock[vi], X, Y, T, T); g.globalAlpha = 1; }
    } else {
      // R40·R49: 열린 땅에 닿은 계단 바위는 틈새 빛 + 지그재그 계단 단면. 잠든 계단 날과 막힌 계단은 그리지 않는다(검수 4번)
      // 재미 보고서 1주차: 계단은 층에 도착할 때부터 보여요(stairShown)
      var stairLit = c.stair && !(f.stair && f.stair.blocked) && (CONFIG.stairShown || (!Core.mut(run, 'sleepy') && Core.neighbors(f, x, y).some(function (n) { return n.cover === 'open' && !anim.pend[n.y * BW + n.x]; })));
      if (stairLit) { drawStairRock(g, X, Y, vi, now); if (!CONFIG.stairShown && run.tutorial && run.day <= 3) teachRock(f, x, y); }
      else g.drawImage(SPR.rock[vi], X, Y, T, T);
      if (f.glow && f.glow.some(function (q) { return q[0] === x && q[1] === y; })) {
        var gl = 0.6 + 0.4 * Math.sin(now / 200);
        g.strokeStyle = 'rgba(255,210,90,' + gl.toFixed(2) + ')'; g.lineWidth = 3; g.strokeRect(X + 3, Y + 3, T - 6, T - 6);
      }
    }
  }
  // 1b) 계단 빛 번짐(R56·R60): 중심은 계단에서 0~1칸 어긋난 칸, 둘레 2칸. 층 도착 때부터, 잠든 계단 날·막힌 계단은 없음. 숫자보다 먼저 그려 숫자를 가리지 않는다
  if (f.light && f.stair && !f.stair.blocked && !Core.mut(run, 'sleepy')) {
    var LX = f.light.x, LY = f.light.y, fl = 0.92 + 0.08 * Math.sin(now / 700);
    for (y = Math.max(0, LY - 2); y <= Math.min(BH - 1, LY + 2); y++) for (x = Math.max(0, LX - 2); x <= Math.min(BW - 1, LX + 2); x++) {
      var ld = Math.max(Math.abs(x - LX), Math.abs(y - LY)), le = Math.sqrt((x - LX) * (x - LX) + (y - LY) * (y - LY));
      var la = (ld === 0 ? 0.22 : ld === 1 ? 0.16 : 0.08) * fl * (le > 2.5 ? 0.6 : 1);
      g.fillStyle = 'rgba(255,200,120,' + la.toFixed(3) + ')'; g.fillRect(x * T, y * T, T, T);
    }
  }
  // 1c) 큰 덩이 자리(v22: 층 도착 때부터 금빛 점선 테두리)
  if (CONFIG.features.chunkShown && f.chunk && !f.chunk.done) {
    var CK = f.chunk, ga = 0.8 + 0.2 * Math.sin(now / 400);
    g.save(); g.setLineDash([6, 4]); g.lineWidth = 3; g.strokeStyle = 'rgba(255,210,90,' + ga.toFixed(2) + ')';
    g.strokeRect(CK.x * T + 2, CK.y * T + 2, CK.w * T - 4, CK.h * T - 4); g.restore();
  }
  // 2) 벽 낙서
  f.graffiti.forEach(function (gr) {
    if (!graffitiVisible(f, gr, d, now)) return;
    var done = gr.target && Core.cellAt(f, gr.target[0], gr.target[1]).cover === 'open';   // 가르친 칸이 열리면 흐리게(검수 19)
    if (done) g.globalAlpha = 0.35; drawGraffiti(g, gr); g.globalAlpha = 1;
  });
  // 3) 숫자(평소 전체, 좁은 빛 바깥은 흐리게, 불씨는 전부 가림)
  for (y = 0; y < BH; y++) for (x = 0; x < BW; x++) {
    c = f.cells[y * BW + x]; v = cellVisual(c, now);
    if (v.covered || c.haz && !c.removed) continue;
    if (c.chunk && f.chunk && !f.chunk.done) continue;
    var n = Core.numAt(f, c);
    var dist = Math.sqrt((x - d.px) * (x - d.px) + (y - d.py) * (y - d.py));
    var inside = !low || dist <= CONFIG.lowLightRadius;
    if (inside && !embers) c.seen = true;
    if (n <= 0 || embers || (x === d.px && y === d.py) || v.numT <= 0) continue;
    if (!inside && !c.seen) continue;
    X = x * T; Y = y * T;
    var dy = Math.round((1 - Math.min(1, v.numT)) * -6);
    var txt = blur && n >= 4 ? '4+' : String(n);
    var blink = anim.numBlink[y * BW + x];
    if (blink && now < blink && now > blink - 360 && Math.floor((blink - now) / 80) % 2 === 0) continue;
    g.font = numFont(txt.length > 1 ? 20 : 24); g.textAlign = 'center'; g.textBaseline = 'middle';
    if (inside) { g.fillStyle = '#1a120b'; g.fillText(txt, X + 27, Y + 28 + dy); g.fillStyle = NUMC[Math.min(n, 8)]; g.fillText(txt, X + 24, Y + 25 + dy); }
    if (stairHinted(f, x, y) && (inside || c.seen)) drawStairHint(g, X, Y);
    if (f.chunk && !f.chunk.done && (inside || c.seen) && Core.neighbors(f, x, y).some(function (q) { return q.haz === 'chunk' && !q.removed; })) {   // R44 큰 덩이에 닿은 숫자 옆 금빛 점
      g.fillStyle = '#1a120b'; g.fillRect(X + 4, Y + 4, 9, 9); g.fillStyle = '#ffd25a'; g.fillRect(X + 5, Y + 5, 7, 7); goldSeen = true;
    }
    if (c.lens && Core.neighbors(f, x, y).some(function (q) { return Core.liveHaz(q) && q.haz === 'treasure'; })) { g.fillStyle = '#0f4a52'; g.fillRect(X + 35, Y + 5, 9, 9); g.fillStyle = '#5fe0e8'; g.fillRect(X + 37, Y + 7, 5, 5); }
  }
  if (goldSeen && !ui.bubblesSeen.gold) bubble('gold', TEXT.bubbles.gold, { el: 'sign' });
  // 4) 어둠
  if (embers) { g.fillStyle = 'rgba(11,10,16,0.55)'; g.fillRect(0, 0, 720, 528); }
  else if (low) {
    for (y = 0; y < BH; y++) for (x = 0; x < BW; x++) {
      var dd = Math.sqrt((x - d.px) * (x - d.px) + (y - d.py) * (y - d.py));
      if (dd <= CONFIG.lowLightRadius) continue;
      g.fillStyle = dd <= 3.5 ? 'rgba(11,10,16,0.45)' : 'rgba(11,10,16,0.75)'; g.fillRect(x * T, y * T, T, T);
      c = f.cells[y * BW + x];
      if (c.cover === 'open' && c.seen && !(c.haz && !c.removed)) {   // 흐린 숫자(현재 값, R25)
        var nn = Core.numAt(f, c);
        if (nn > 0 && !(x === d.px && y === d.py)) {
          var tx2 = blur && nn >= 4 ? '4+' : String(nn);
          g.globalAlpha = 0.6; g.font = numFont(tx2.length > 1 ? 20 : 24); g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillStyle = NUMC[Math.min(nn, 8)]; g.fillText(tx2, x * T + 24, y * T + 25); g.globalAlpha = 1;
        }
      }
    }
  }
  // 5) 분필·두드려 보기·덩이 표시(어둠 위에 원래 밝기)
  for (y = 0; y < BH; y++) for (x = 0; x < BW; x++) {
    c = f.cells[y * BW + x]; X = x * T; Y = y * T; v = cellVisual(c, now);
    if (v.covered) {
      if (c.mark === 1) g.drawImage(c.faded ? SPR.chalkXFaded : SPR.chalkX, X, Y, T, T); else if (c.mark === 2) g.drawImage(c.faded ? SPR.chalkOFaded : SPR.chalkO, X, Y, T, T);   // 바랜 자국은 흐리고 군데군데 지워진 분필
      if (c.probe === 'mine' && c.mark === 1) { g.strokeStyle = '#e5484d'; g.lineWidth = 2; g.strokeRect(X + 2, Y + 2, T - 4, T - 4); }   // 두드려 보기로 확인된 X
      if (c.probe) drawProbe(g, X, Y, c.probe);
      else if (c.fizzle) drawProbe(g, X, Y, 'safe');
      if (ui.debugReveal) drawDebug(g, X, Y, c);
    } else if (c.chunk && c.removed && f.chunk && !f.chunk.done) {
      g.font = 'bold 12px Consolas, monospace'; g.textAlign = 'center'; g.textBaseline = 'top';
      g.fillStyle = '#1a120b'; g.fillRect(X + 8, Y + 2, 32, 13); g.fillStyle = '#ffd25a'; g.fillText(f.chunk.dug + '/' + f.chunk.total, X + 24, Y + 3);
    }
  }
  if (anim.pairHint && now - anim.pairHint.t0 < 3500) anim.pairHint.cells.forEach(function (q) { var cc = Core.cellAt(f, q.x, q.y); if (cc.cover !== 'open') dashRect(g, q.x * T + 4, q.y * T + 4, T - 8, T - 8, 'rgba(230,225,214,0.7)'); });
  if (anim.bubbleCell) { var bc = anim.bubbleCell, on2 = Math.floor(now / 300) % 2 === 0; g.strokeStyle = on2 ? '#ffd25a' : 'rgba(255,210,90,0.4)'; g.lineWidth = 3; g.strokeRect(bc.x * T + 2, bc.y * T + 2, T - 4, T - 4); }
  if (anim.blame && now > anim.blame.t0 && now - anim.blame.t0 < 1000) {
    var on = Math.floor((now - anim.blame.t0) / 250) % 2 === 0;
    if (on) anim.blame.cells.forEach(function (q) { g.strokeStyle = '#f1ece2'; g.lineWidth = 3; g.strokeRect(q.x * T + 3, q.y * T + 3, T - 6, T - 6); });
  }
  drawSweep(g, f, now);
  // 조준 꺾쇠(R54: 클릭으로 조준한 바위에만)와 마우스 테두리, 고르기 상태의 대상 칸(R53)
  var keyLabels = [];
  if (run.phase === 'mine' && !ui.sub) {
    if (ui.mode) {
      var mk = ui.mode.kind, pulse = 0.55 + 0.35 * Math.sin(now / 220);
      if (mk !== 'probe') f.cells.forEach(function (q) { if (q.cover !== 'open' && q.mark === 1) { g.strokeStyle = 'rgba(255,210,90,' + pulse.toFixed(2) + ')'; g.lineWidth = 3; g.strokeRect(q.x * T + 2, q.y * T + 2, T - 4, T - 4); } });
      if (ui.hover) {
        var mh = Core.cellAt(f, ui.hover.x, ui.hover.y), okT = mh && mh.cover !== 'open' && (mk === 'probe' || mh.mark === 1);
        g.strokeStyle = okT ? '#ffd25a' : 'rgba(165,159,179,0.5)'; g.lineWidth = 2; g.strokeRect(ui.hover.x * T + 1, ui.hover.y * T + 1, T - 2, T - 2);
        if (okT) drawBrackets(g, ui.hover.x * T, ui.hover.y * T, '#ffd25a');
      }
    } else {
      if (ui.aim) {
        var ac = Core.cellAt(f, ui.aim.x, ui.aim.y);
        if (ac && ac.cover !== 'open') { drawBrackets(g, ui.aim.x * T, ui.aim.y * T, ac.mark === 1 ? '#ff8a3d' : '#f1ece2'); if (run.tutorial && run.day === 1 && !ui.firstBreakDone) keyLabels.push([ui.aim.x, ui.aim.y, '한 번 더 클릭']); }
      }
      if (ui.hover && !(ui.aim && ui.aim.x === ui.hover.x && ui.aim.y === ui.hover.y)) {
        var hc = Core.cellAt(f, ui.hover.x, ui.hover.y);
        if (hc) { g.strokeStyle = hc.mark === 1 && hc.cover !== 'open' ? 'rgba(229,72,77,0.7)' : 'rgba(241,236,226,0.55)'; g.lineWidth = 1; g.strokeRect(hc.x * T + 1.5, hc.y * T + 1.5, T - 3, T - 3); }
      }
    }
  }
  // 광부 + 곡괭이 불꽃(콤보 단계)
  var hurt = anim.hurtT && now > anim.hurtT && now - anim.hurtT < 600;
  if (!(hurt && Math.floor(now / 80) % 2)) g.drawImage(SPR.minerBy[run.char] || SPR.miner, d.px * T, d.py * T, T, T);
  drawPickFlame(g, d.px * T + 34, d.py * T + 2, d.streak, now);
  keyLabels.forEach(function (k) { drawCellLabel(g, f, k[0], k[1], k[2]); });
  // 튀어 오르는 것들
  anim.pops = anim.pops.filter(function (p) { return now - p.t0 < 1000; });   // 옛 연장함 빛기둥(950 ms)도 이 안에 끝나요
  anim.pops.forEach(function (p) {
    var k = now - p.t0; if (k < 0) return;
    var PX = p.x * T, PY = p.y * T;
    if (p.kind === 'boom') {   // 밟은 지뢰: 날카로운 별
      if (k < 360) { var r = 10 + k / 360 * 30; g.globalAlpha = 1 - k / 360; g.fillStyle = k < 120 ? '#fff4c2' : k < 240 ? '#ffb347' : '#c4432b'; star(g, PX + 24, PY + 24, r, r * 0.45, 8); g.globalAlpha = 1; }
    } else if (p.kind === 'dust') {   // 발파: 둥근 흙먼지
      if (k < 300) { var r2 = 12 + k / 300 * 30; g.globalAlpha = 1 - k / 300; g.fillStyle = k < 80 ? '#fff4c2' : k < 160 ? '#f2c14e' : '#80583a'; g.beginPath(); g.arc(PX + 24, PY + 24, r2, 0, 7); g.fill(); g.fillStyle = '#4a3222'; g.beginPath(); g.arc(PX + 24 - r2 / 3, PY + 24 + r2 / 4, r2 / 2, 0, 7); g.fill(); g.globalAlpha = 1; }
    } else if (p.kind === 'fizzle') {
      if (k < 240) { g.globalAlpha = 1 - k / 240; g.fillStyle = '#a59fb3'; g.beginPath(); g.arc(PX + 24, PY + 16 - k / 20, 6 + k / 40, 0, 7); g.fill(); g.globalAlpha = 1; }
    } else if (p.kind === 'smoke') {
      var m = run.d; if (k < 240) { g.globalAlpha = 1 - k / 240; g.fillStyle = '#5d5868'; g.beginPath(); g.arc(m.px * T + 38, m.py * T + 4 - k / 12, 4 + k / 30, 0, 7); g.fill(); g.globalAlpha = 1; }
    } else if (p.kind === 'stair') {
      if (k < 280) { g.strokeStyle = '#fff4c2'; g.globalAlpha = 1 - k / 280; g.lineWidth = 3; g.strokeRect(PX - k / 20, PY - k / 20, T + k / 10, T + k / 10); g.globalAlpha = 1; }
    } else if (p.kind === 'probe') {
      if (k < 200) { g.strokeStyle = '#e6e1d6'; g.globalAlpha = 1 - k / 200; g.lineWidth = 2; g.beginPath(); g.arc(PX + 24, PY + 24, 8 + k / 8, 0, 7); g.stroke(); g.globalAlpha = 1; }
    } else if (p.kind === 'nope') {   // 숫자 칸이 좌우로 흔들림
      if (k < 260) { var dx = [3, -3, 2, -2, 1, 0][Math.floor(k / 45)] || 0; g.strokeStyle = 'rgba(241,236,226,0.8)'; g.lineWidth = 2; g.strokeRect(PX + 3 + dx, PY + 3, T - 6, T - 6); }
    } else if (p.kind === 'lift') {   // 캔 보물이 칸에서 크게 솟아올라 무엇을 캤는지 보여 준다
      if (k < 850) {
        var up = Math.min(1, k / 160), sz = 44 + 40 * up, cy = PY + 24 - 18 * up, al = k < 650 ? 1 : 1 - (k - 650) / 200;
        g.globalAlpha = al * 0.35; g.fillStyle = p.tier === 2 ? '#5fe0e8' : '#ffd25a'; g.beginPath(); g.arc(PX + 24, cy, sz * 0.42, 0, 7); g.fill();
        g.globalAlpha = al; g.drawImage(SPR.tier[p.tier], PX + 24 - sz / 2, cy - sz / 2, sz, sz); g.globalAlpha = 1;
      }
    } else if (p.kind === 'boxLift') {   // 옛 연장함: 칸에서 위로 빛기둥, 상자가 솟아요
      if (k < 950) {
        var al2 = k < 700 ? 1 : 1 - (k - 700) / 250, hgt = Math.min(1, k / 180) * PY + T;
        var grd = g.createLinearGradient(0, PY + T, 0, PY + T - hgt); grd.addColorStop(0, p.scorch ? 'rgba(165,159,179,0.55)' : 'rgba(255,210,90,0.6)'); grd.addColorStop(1, 'rgba(255,210,90,0)');
        g.globalAlpha = al2; g.fillStyle = grd; g.fillRect(PX + 8, PY + T - hgt, T - 16, hgt);
        var up2 = Math.min(1, k / 200), sz2 = 40 + 36 * up2; g.drawImage(SPR.icons.box, PX + 24 - sz2 / 2, PY + 24 - 22 * up2 - sz2 / 2, sz2, sz2); g.globalAlpha = 1;
      }
    } else if (p.kind === 'dust') {   // 바랜 자국을 문지르면 분필 가루만 날려요
      if (k < 500) { var da = 1 - k / 500; g.fillStyle = 'rgba(200,192,176,' + (0.8 * da).toFixed(2) + ')'; for (var di = 0; di < 7; di++) { var dx = ((di * 37) % 13) - 6, dy = -k / 40 - ((di * 23) % 7); g.fillRect(PX + T / 2 + dx * (1 + k / 250), PY + T / 2 + dy, 2, 2); } }
    } else if (p.kind === 'locked') {
      if (k < 120) { g.strokeStyle = '#e5484d'; g.lineWidth = 2; g.strokeRect(PX + 2 + (Math.floor(k / 30) % 2 ? 2 : -2), PY + 2, T - 4, T - 4); }
    }
  });
  if (now < anim.flashUntil && now > anim.flashUntil - 33) { g.fillStyle = 'rgba(241,236,226,0.85)'; g.fillRect(-10, -10, 740, 548); }
  // 광산 깨어남: 판 테두리 맥동(명도만, 1,200 ms 주기)
  var bw = $('boardWrap');
  var col = f.awake && !(f.chunk && f.chunk.done) ? (Math.sin(now / 1200 * Math.PI * 2) > 0 ? '#c4432b' : '#3a0f14') : embers ? '#3a3542' : '#2a2633';
  if (bw._c !== col) { bw.style.borderColor = col; bw._c = col; }
}
function drawStairRock(g, X, Y, vi, now) {
  g.drawImage(SPR.rock[vi], X, Y, T, T);
  var a = 0.55 + 0.25 * Math.sin(now / 420);
  // 바위 네 모서리 틈으로 새는 빛
  g.fillStyle = 'rgba(255,214,140,' + a.toFixed(2) + ')';
  g.fillRect(X + 2, Y + 2, 7, 2); g.fillRect(X + 2, Y + 2, 2, 7); g.fillRect(X + T - 9, Y + 2, 7, 2); g.fillRect(X + T - 4, Y + 2, 2, 7);
  g.fillRect(X + 2, Y + T - 4, 7, 2); g.fillRect(X + 2, Y + T - 9, 2, 7); g.fillRect(X + T - 9, Y + T - 4, 7, 2); g.fillRect(X + T - 4, Y + T - 9, 2, 7);
  // 지그재그 계단 단면(어두운 틈 + 디딤 끝에 빛)
  g.fillStyle = 'rgba(18,12,8,0.9)';
  g.fillRect(X + 11, Y + 12, 9, 26); g.fillRect(X + 20, Y + 19, 8, 19); g.fillRect(X + 28, Y + 26, 9, 12);
  g.fillStyle = 'rgba(255,214,140,' + (a + 0.15).toFixed(2) + ')';
  g.fillRect(X + 11, Y + 12, 9, 2); g.fillRect(X + 20, Y + 19, 8, 2); g.fillRect(X + 28, Y + 26, 9, 2);
}
// 계단 바위를 처음 볼 때 낙서(R40)
function teachRock(f, x, y) { if (!run.taught) run.taught = {}; if (run.taught.rock) return; run.taught.rock = true; Core.placeGraffiti(f, TEXT.light.rock, { x: x, y: y }, { taught: 'rock', w: 3 }, f); }
function star(g, cx, cy, r1, r2, n) { g.beginPath(); for (var i = 0; i < n * 2; i++) { var r = i % 2 ? r2 : r1, a = i / (n * 2) * Math.PI * 2; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.closePath(); g.fill(); }
function dashRect(g, x, y, w, h, col) { g.save(); g.strokeStyle = col; g.lineWidth = 2; g.setLineDash([6, 4]); g.strokeRect(x, y, w, h); g.restore(); }
function drawBrackets(g, X, Y, col) {
  g.fillStyle = col; var L = 10, w = 3;
  g.fillRect(X + 1, Y + 1, L, w); g.fillRect(X + 1, Y + 1, w, L);
  g.fillRect(X + T - 1 - L, Y + 1, L, w); g.fillRect(X + T - 1 - w, Y + 1, w, L);
  g.fillRect(X + 1, Y + T - 1 - w, L, w); g.fillRect(X + 1, Y + T - 1 - L, w, L);
  g.fillRect(X + T - 1 - L, Y + T - 1 - w, L, w); g.fillRect(X + T - 1 - w, Y + T - 1 - L, w, L);
}
function drawKey(g, cx, y, label) {
  g.font = 'bold 12px Consolas, monospace'; var w = g.measureText(label).width + 10;
  var x = Math.max(2, Math.min(718 - w, cx - w / 2)); if (y > 510) y -= T + 20;
  g.fillStyle = '#2a2633'; g.fillRect(x, y, w, 17); g.strokeStyle = '#a59fb3'; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, w - 1, 16);
  g.fillStyle = '#f1ece2'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(label, x + 5, y + 9);
}
// 칸 이름표: 아래 칸이 정보(숫자·분필)를 가리면 위에 둔다
function drawCellLabel(g, f, x, y, label) {
  function busy(cx, cy) { var c = Core.cellAt(f, cx, cy); if (!c) return cy < 0 || cy >= BH; if (cx === run.d.px && cy === run.d.py) return false; if (c.cover !== 'open') return c.mark || c.probe; return Core.numAt(f, c) > 0; }
  function rowBusy(cy) { return busy(x - 1, cy) || busy(x, cy) || busy(x + 1, cy); }   // 이름표는 세 칸 너비
  var below = !rowBusy(y + 1) || rowBusy(y - 1);
  drawKey(g, x * T + 24, below ? y * T + T + 2 : y * T - 19, label);
}
function drawStairHint(g, X, Y) {   // 숫자 아래 밑줄 + 칸 왼쪽 아래 작은 계단 그림
  g.fillStyle = '#c9b49c';
  g.fillRect(X + 15, Y + 38, 18, 3);
  g.fillRect(X + 3, Y + 42, 3, 3); g.fillRect(X + 3, Y + 39, 6, 3); g.fillRect(X + 3, Y + 36, 9, 3);
}
function drawProbe(g, X, Y, r) {
  if (r === 'mine') { g.fillStyle = '#3a0f14'; g.fillRect(X + 10, Y + 34, 28, 10); g.fillStyle = '#e5484d'; [14, 21, 28].forEach(function (dx) { g.fillRect(X + dx + 1, Y + 36, 6, 6); }); }
  else { g.strokeStyle = '#f2c14e'; g.lineWidth = 3; g.beginPath(); g.arc(X + 24, Y + 24, 11, 0, 7); g.stroke(); }
}
// ---------- 층을 떠날 때 답 공개(R90): 왼쪽 줄부터 오른쪽으로 한 줄씩 ----------
var SWEEP = { col: 55, hold: 350 };   // 줄마다 55 ms(16줄이면 약 0.9초) + 다 열린 뒤 0.35초
function startSweep(then, delay) {
  var f = run.d && run.d.floor;
  if (!f || !f.cells.some(function (c) { return c.cover !== 'open' && (c.haz || c.mark); })) { then(); return; }
  ui.sweep = { t0: performance.now() + (delay || 0), f: f, then: then };
  ui.mode = null; ui.aim = null; ui.hudDirty = true;
}
function sweepTotal() { return BW * SWEEP.col + SWEEP.hold; }
function endSweep() { var s = ui.sweep; if (!s) return; ui.sweep = null; s.then(); }
function drawSweep(g, f, now) {
  var s = ui.sweep; if (!s || s.f !== f) return;
  var col = Math.floor((now - s.t0) / SWEEP.col);
  if (col < 0) return;
  for (var y = 0; y < BH; y++) for (var x = 0; x <= Math.min(col, BW - 1); x++) {
    var c = f.cells[y * BW + x], X = x * T, Y = y * T;
    if (c.cover === 'open') continue;
    if (c.haz === 'mine' || c.haz === 'treasure' || c.haz === 'chunk') drawDebug(g, X, Y, c);
    var wrong = (c.mark === 1 && c.haz !== 'mine') || (c.mark === 2 && c.haz !== 'treasure' && c.haz !== 'chunk');
    if (wrong) { g.strokeStyle = '#e5484d'; g.lineWidth = 3; g.strokeRect(X + 3, Y + 3, T - 6, T - 6); }
  }
  if (col < BW) { g.fillStyle = 'rgba(255,210,90,0.22)'; g.fillRect(col * T, 0, T, BH * T); }
}
function drawDebug(g, X, Y, c) {
  g.globalAlpha = 0.85;
  if (c.haz === 'mine') g.drawImage(SPR.mine, X + 8, Y + 8, 32, 32);
  else if (c.haz === 'treasure') g.drawImage(SPR.tier[c.tier], X + 8, Y + 8, 32, 32);
  else if (c.haz === 'chunk') g.drawImage(SPR.chunk, X + 10, Y + 10, 28, 28);
  else if (c.stair) g.drawImage(SPR.stair, X + 12, Y + 12, 24, 24);
  else if (c.res) g.drawImage(SPR.pebble, X + 8, Y + 8, 32, 32);
  g.globalAlpha = 1;
}
var FLAME_COL = [null, '#f2c14e', '#ffb347', '#ff8a3d', '#ff8a3d', '#ff8a3d', '#ff6b6b', '#ff6b6b', '#ff6b6b'];
function drawPickFlame(g, X, Y, lvl, now) {
  if (!lvl) return;
  var s = 3, h = Math.min(5, 1 + lvl), w = Math.min(3, 1 + (lvl >> 1)), fl = Math.floor(now / 140) % 2;
  g.fillStyle = FLAME_COL[Math.min(lvl, 8)];
  for (var i = 0; i < h; i++) { var ww = Math.max(1, w - (i > h - 2 ? 1 : 0)); g.fillRect(X + (3 - ww) * s / 2 + (i === h - 1 && fl ? s : 0), Y + (5 - i) * s, ww * s, s); }
  if (lvl >= 4) { g.fillStyle = '#fff4c2'; g.fillRect(X + s, Y + 4 * s, s, s); }
}
function wrapText(g, text, maxW) {
  var out = [], line = '';
  for (var i = 0; i < text.length; i++) { var t2 = line + text[i]; if (g.measureText(t2).width > maxW && line) { out.push(line); line = text[i] === ' ' ? '' : text[i]; } else line = t2; }
  if (line) out.push(line);
  return out;
}
// 낙서가 보이는 조건(01 16.3)
function graffitiVisible(f, gr, d, now) {
  if (gr.after === 'mine' && (gr.mine ? Core.cellAt(f, gr.mine[0], gr.mine[1]).cover !== 'open' : !ui.seenMine)) return false;   // 06 장면 4: 지뢰가 터진 뒤에만
  if (gr.after === 'treasure' && !f.treasuresDug) return false;
  if (gr.watch && !gr.watch.every(function (q) { return Core.neighbors(f, q[0], q[1]).some(function (n) { return n.cover === 'open' && !anim.pend[n.y * BW + n.x]; }); })) return false;
  if (gr.stairWall && !(f.stair && f.stair.found)) return false;
  var p = anim.pend[gr.y * BW + gr.x]; if (p && now < p.t) return false;   // 연쇄가 그 자리에 닿은 뒤에 보인다
  return true;
}
function drawGraffiti(g, gr) {
  var X = gr.x * T + 4, Y = gr.y * T, W = (gr.w || 3) * T - 8;
  g.font = (gr.w === 1 ? '11px' : '13px') + ' "Galmuri11", "Malgun Gothic", "Noto Sans CJK KR", sans-serif'; g.textAlign = 'left'; g.textBaseline = 'top';
  var lines = wrapText(g, gr.text, W).slice(0, 3);
  var y0 = Y + Math.max(2, (T - lines.length * 15) / 2);
  g.fillStyle = 'rgba(29,20,14,0.55)'; g.fillRect(X - 2, y0 - 2, W + 4, lines.length * 15 + 3);
  g.fillStyle = 'rgba(230,225,214,0.92)';
  lines.forEach(function (l, i) {
    g.fillText(l, X, y0 + i * 15);
  });
}
function drawTally() {
  var cv = $('tally'), g = cv.getContext('2d'), f = run && run.d && run.d.floor;
  g.clearRect(0, 0, 16, 528);
  cv.style.display = f && f.rule === 'tally' && run.phase !== 'deed' ? 'block' : 'none';
  if (!f || f.rule !== 'tally') return;
  for (var y = 0; y < BH; y++) {
    var k = Core.tallyRow(f, y);
    g.fillStyle = '#3d2a1c'; g.fillRect(0, y * T + 2, 16, T - 4);
    g.fillStyle = k ? '#e6e1d6' : '#5d5868';
    for (var i = 0; i < Math.min(k, 6); i++) g.fillRect(3 + (i % 2) * 6, y * T + 6 + Math.floor(i / 2) * 9, 4, 6);
    if (!k) g.fillRect(4, y * T + 22, 8, 3);
  }
}

// ---------- 촛불 그림(1차 그대로) ----------
var cctx = $('candleCv').getContext('2d');
function drawCandle(now) {
  var g = cctx, d = run.d; g.clearRect(0, 0, 24, 24);
  if (!d) return;
  var ratio = Math.max(0, Math.min(1, d.candle / d.candleMax));
  function px(x, y, c) { g.fillStyle = c; g.fillRect(x, y, 1, 1); }
  for (var x = 6; x <= 17; x++) { px(x, 22, '#3a3542'); px(x, 21, '#9aa0b0'); }
  var h = d.candle > 0 ? Math.max(1, Math.round(ratio * 14)) : 0, top = 20 - h + 1;
  for (var y = top; y <= 20; y++) { px(8, y, '#3a3542'); for (x = 9; x <= 13; x++) px(x, y, '#efe7d6'); px(14, y, '#c9c0ad'); px(15, y, '#3a3542'); }
  var wy = top - 1;
  if (d.candle > 0) {
    px(11, wy, '#1a120b');
    var period = ratio > 0.4 ? 160 : 110, fr = Math.floor(now / period) % 3, small = d.candle <= CONFIG.lowLight;
    px(11, wy - 1, '#ffd25a'); px(11, wy - 2, '#fff4c2');
    if (!small) { px(10, wy - 2, '#ffd25a'); px(12, wy - 2, '#ffd25a'); px(11, wy - 3, '#fff4c2'); px(11 + (fr === 1 ? -1 : fr === 2 ? 1 : 0), wy - 4, '#ffd25a'); }
  } else {
    var s = Math.floor(now / 300) % 3;
    px(11, 19, '#e8743a'); px(11 + (s - 1), 17, '#5d5868'); px(12, 15 - s % 2, '#5d5868');
  }
}
var flameCtx = $('flameCv').getContext('2d');
function drawFlameIc(lvl) {
  var g = flameCtx; g.clearRect(0, 0, 10, 10);
  g.fillStyle = '#5d5868'; g.fillRect(4, 8, 2, 2);
  if (!lvl) return;
  var h = Math.min(7, 2 + lvl), w = Math.min(4, 1 + Math.ceil(lvl / 2));
  g.fillStyle = FLAME_COL[Math.min(lvl, 8)];
  for (var i = 0; i < h; i++) { var ww = i > h - 3 ? Math.max(1, w - 1) : w; g.fillRect(5 - Math.ceil(ww / 2), 7 - i, ww, 1); }
  if (lvl >= 4) { g.fillStyle = '#fff4c2'; g.fillRect(4, 5, 2, 2); }
}

// ---------- HUD ----------
(function initHud() {
  $('pouchIc').innerHTML = iconHtml('pouch', 24);
  $('coinsIc').innerHTML = iconHtml('coins', 18);
  $('bCal').innerHTML = iconHtml('ui.cal', 24); $('bCal').title = '달력';
  $('bGear').innerHTML = iconHtml('ui.gear', 24); $('bGear').title = '설정';
  $('bCal').onclick = function () { if (run && run.phase === 'mine' && !ui.sub) { ui.mode = null; ui.sub = 'cal'; renderOverlay(); } };
  $('bGear').onclick = function () { if (run && run.phase === 'mine' && !ui.sub) { ui.mode = null; ui.sub = 'pause'; renderOverlay(); } };
  $('bReturn').onclick = function () { askReturn(); };   // R53: 버튼 → 확인 창
  $('sign').addEventListener('click', function () { var f = run && run.d && run.d.floor; if (f) setDesc('<b>' + RULES[f.rule].name + '</b><br>' + esc(RULES[f.rule].sign) + '<br><span class="muted">' + esc(RULES[f.rule].help) + '</span><br>' + veinDiagram(f.rule)); });
})();
// 광맥 그림(5×5): g 보물, m 지뢰, o 보물이 나올 수 있는 칸, x 보물이 없는 칸, 숫자는 눈금
var VEIN_PAT = {
  plain: ['..g..', 'm....', '...m.', '.g...', '....m'],
  pair: ['.....', '.gg..', '.....', '...g.', '...g.'],
  border: ['ooooo', 'oxxxo', 'oxmxo', 'oxxxo', 'ogooo'],
  lonely: ['.....', '.xxx.', '.xgx.', '.xxx.', '.....'],
  rows: ['xxxxx', 'oogoo', 'xxxxx', 'xxxxx', 'ooogo'],
  tally: ['1g...', '0xxxx', '2.g.g', '0xxxx', '1...g'],
  minepair: ['.....', '.mm..', '.....', '...m.', '...m.']
};
function veinDiagram(rule) {
  var P = VEIN_PAT[rule]; if (!P) return '';
  var h = '<span class="vein" aria-hidden="true">';
  P.forEach(function (row) { for (var i = 0; i < 5; i++) { var ch = row[i]; h += /[0-9]/.test(ch) ? '<i>' + ch + '</i>' : '<i class="' + (ch === '.' ? '' : ch) + '">' + (ch === 'x' ? '×' : '') + '</i>'; } });
  return h + '</span>';
}
// 용어 설명 말풍선: data-term이 붙은 말에 마우스를 올리면 뜬다(판 위 숫자는 가리지 않게 그 말 아래에)
(function termTips() {
  var tip = $('termTip'), stageEl = $('stage');
  stageEl.addEventListener('mouseover', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-term]') : null;
    var def = el && TEXT.terms[el.getAttribute('data-term')];
    if (!def) { tip.style.display = 'none'; return; }
    tip.innerHTML = '<b>' + esc(el.getAttribute('data-term')) + '</b><br>' + esc(def);
    var sr = stageEl.getBoundingClientRect(), k = sr.width / 1280, r = el.getBoundingClientRect();
    tip.style.display = 'block';
    var x = (r.left - sr.left) / k, y = (r.bottom - sr.top) / k + 6, w = tip.offsetWidth, hh = tip.offsetHeight;
    if (x + w > 1270) x = 1270 - w; if (y + hh > 712) y = (r.top - sr.top) / k - hh - 6;
    tip.style.left = Math.max(4, x) + 'px'; tip.style.top = Math.max(4, y) + 'px';
  });
  stageEl.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
})();
function setDesc(h) { ui.desc = h; ui.descAt = performance.now(); ui.hudDirty = true; }
function goalLine(run) {   // 02 6.1: "다음 도장까지 120 · 3일째"
  var G = Core.goalInfo(run); if (!G) return '';
  if (G.daysLeft === 0) return G.left > 0 ? '<span class="warnTxt">오늘 도장 찍는 날</span> · <b class="acc">' + fmt(G.left) + '</b> 모자라요' : '<span class="acc">오늘 도장 찍는 날</span> · 다음 도장 채움';
  if (G.left <= 0) return '<span class="acc">다음 도장 채움</span> · ' + G.day + '일째';
  return '다음 도장까지 <b class="acc">' + fmt(G.left) + '</b> · ' + G.day + '일째' + (run.loan && run.loan.day === G.day ? ' <span class="note">(심 씨 빚 ' + fmt(run.loan.amount) + ' 포함)</span>' : '');
}
function updateHUD() {
  var d = run.d, f = d && d.floor;
  var inMine = d && (run.phase === 'mine' || run.phase === 'room');
  // 머리
  if (f) {
    $('floorName').innerHTML = '지하 <span class="px">' + f.depth + '</span>층';
    var R = RULES[f.rule];
    $('signIc').innerHTML = iconHtml('rules.' + f.rule, 24);
    $('signName').innerHTML = esc(R.name) + (f.chunk && !f.chunk.done ? ' <span class="badge gold">' + (CONFIG.features.chunkShown ? '큰 덩이 (' + f.chunk.w + '×' + f.chunk.h + ') · 금빛 테두리' : '이 층 어딘가에 큰 덩이 (' + f.chunk.w + '×' + f.chunk.h + ')') + '</span>' : '') + (f.chunk && f.chunk.done ? ' <span class="badge gold">덩이 캠</span>' : '');
    $('signText').textContent = R.sign;
    var rem = CONFIG.countsShown ? Core.remaining(f) : null;   // 재미 보고서 1주차: 이 층에 남은 보물·지뢰 수
    var boxH = f.box && f.box.state === 'buried' ? '<span data-term="옛 연장함" class="boxGlyph" style="display:inline-flex;align-items:center;gap:2px;margin-right:10px;font-size:13px;color:#ffd25a">' + iconHtml('icons.box', 20) + '연장함</span>' : '';   // 이 층에 옛 연장함이 묻혀 있어요(어느 칸인지는 안 보여요)
    $('stairSt').innerHTML = (rem ? '<span data-term="남은 보물·지뢰" style="display:inline-flex;align-items:center;gap:2px;margin-right:10px;font-size:14px">' + iconHtml('gem', 20) + '<b class="px">' + rem.t + '</b><span style="width:6px"></span>' + iconHtml('mine', 20) + '<b class="px">' + rem.m + '</b></span>' : '') + boxH + (f.stair && f.stair.found ? (f.stair.blocked ? iconHtml('icons.stairsDim', 24) + '<span style="font-size:12px;color:#a59fb3"> 막힘</span>' : iconHtml('icons.stairs', 24) + '<span style="font-size:12px;color:#c9b49c"> ' + (CONFIG.stairShown ? '계단 열림' : '계단 찾음') + '</span>') : iconHtml('icons.stairsDim', 24) + '<span style="font-size:12px;color:#a59fb3"> ' + (CONFIG.stairShown ? '계단 닫힘' : '계단 못 찾음') + '</span>');   // 그림만으로는 뜻을 알 수 없어 늘 글자를 붙여요
  } else { $('floorName').textContent = '지상'; $('signIc').innerHTML = ''; $('signName').textContent = ''; $('signText').textContent = ''; $('stairSt').innerHTML = ''; }
  $('mutIcons').innerHTML = (d && d.mutations || []).map(function (m) { return '<span title="' + esc(MUTATIONS[m].name + ': ' + MUTATIONS[m].today) + '">' + iconHtml('muts.' + m, 24) + '</span>'; }).join('');
  // 판: 날짜(달력·설정 단추는 같은 줄)
  $('runDay').innerHTML = dayHead();
  $('runLeft').textContent = dayLeft();
  var hintH = hintText();   // 마우스를 올린 칸에서 할 일. 촛불 막대의 미리 보기(ui.preCost)도 여기서 정해요
  // 오늘 주머니 / 금고
  var pocketShow = d ? Math.max(0, Math.round(d.pocket - ui.pocketPending)) : 0;
  $('pocketVal').textContent = fmt(pocketShow);
  var danger = d && inMine && ((d.hp === 1 && !(run.tutorial && run.day === 1)) || d.embersOn);   // R38: 첫 판 Day 1은 체력 1이어도 붉게 강조하지 않는다
  $('pocketBox').classList.toggle('danger', !!danger);
  $('pocketNote').innerHTML = danger ? '<span class="badge">쓰러지면 절반을 잃어요</span>' : (d && inMine ? '올라가면 금고로 들어가요' : '');
  $('goalTxt').innerHTML = goalLine(run);
  $('vaultTxt').innerHTML = '금고 <b class="px" style="font-size:14px">' + fmt(run.cash) + '</b>';
  var np = Core.nextPayment(run), amt = np ? np.amount : 1;
  var bars = $('payBar').children;
  bars[0].style.width = Math.min(100, run.cash / amt * 100) + '%';
  bars[1].style.left = Math.min(100, run.cash / amt * 100) + '%'; bars[1].style.width = Math.max(0, Math.min(100 - run.cash / amt * 100, pocketShow / amt * 100)) + '%';
  // 촛불
  if (d) {
    $('candleVal').textContent = d.embersOn ? '0' : d.candle;
    $('candleVal').style.color = d.candle <= CONFIG.lowLight ? '#ff9a4d' : '#ffd25a';
    var cmax = Math.max(d.candleMax, d.candle), cb = $('candleBar');
    cb.firstChild.style.width = (d.candle / cmax * 100) + '%';
    cb.lastChild.style.left = (CONFIG.lowLight / cmax * 100) + '%';
    var pc = Math.min(ui.preCost || 0, d.candle), pre = cb.children[1];   // 누르면 탈 촛불을 막대 끝에 미리 보여 줘요
    pre.style.display = pc > 0 ? 'block' : 'none';
    if (pc > 0) { pre.style.left = ((d.candle - pc) / cmax * 100) + '%'; pre.style.width = (pc / cmax * 100) + '%'; }
    cb.lastChild.style.display = CONFIG.features.lowLight ? 'block' : 'none';
    var er = $('embersRow');
    if (d.embersOn) {
      cb.style.display = 'none'; er.style.display = 'flex';
      var tot = CONFIG.embers + (Core.gang(run, 'ember') ? 2 : 0), h = '';
      for (var i = 0; i < tot; i++) h += iconHtml(i < d.embers ? 'emberOn' : 'emberOff', 16);
      er.innerHTML = h + ' <span style="font-size:12px;margin-left:4px">불씨 ' + d.embers + ' · ' + TEXT.ember.bar + '</span>';
      $('candleCost').textContent = '캐기와 이동만 할 수 있어요';
    } else {
      cb.style.display = 'block'; er.style.display = 'none';
      var nextC = f ? (f.stair && f.stair.blocked ? '없음' : Core.travelCost(run, f.depth + 1)) : 0;
      var emLeft = d.embersGiven ? (d.embers > 0 ? ' · <span class="acc">남은 불씨 ' + d.embers + '</span>' : ' · <span class="warnTxt">불씨 없음</span>') : '';
      $('candleCost').innerHTML = (f && f.awake ? '<span class="badge">캐기 2</span>' : '캐기 1') + ' · 계단 ' + nextC + (d.probesMax ? ' · 두드려 보기 2' : '') + ' · 발파 ' + Core.igniteCost(run) + (d.candle === 1 && !d.embersGiven && CONFIG.features.embers ? ' · <span class="acc">마지막 1이에요. 다음은 불씨예요</span>' : emLeft);
    }
    $('awakeBadge').innerHTML = f && f.awake && !(f.chunk && f.chunk.done) ? '<span class="badge" style="margin-left:8px">광산 깨어남</span>' : '';
  }
  // 콤보
  if (d) {
    var cap = Core.streakCapIdx(run), mul = Core.streakMult(run);
    var fxs = ui.streakFx, now = performance.now();
    var showLvl = d.streak;
    if (fxs && fxs.kind === 'break' && now < fxs.t0 + 480 && now >= fxs.t0) { $('streakVal').textContent = multTxt(CONFIG.streakLadder[fxs.from]) + ' → ' + multTxt(mul); $('streakBox').classList.add('broke'); }
    else { $('streakVal').textContent = multTxt(mul); $('streakBox').classList.remove('broke'); }
    $('streakBox').classList.toggle('max', d.streak >= cap && cap > 0);
    var st = '', n = cap + 1; for (var j = 0; j < n; j++) st += '<i class="' + (j <= d.streak && d.streak > 0 ? 'on' : '') + '" style="width:' + Math.floor(110 / n) + 'px"></i>';
    $('streakSteps').innerHTML = st;
    $('streakNext').textContent = d.streak === 0 ? '연달아 캐면 값이 올라요' : '다음 보물 ' + multTxt(mul) + ' · 지뢰면 ×1';
    drawFlameIc(showLvl);
    var hs = ''; for (var k = 0; k < d.hpMax; k++) hs += iconHtml(k < d.hp ? 'heart' : 'heartE', 28);
    $('hearts').innerHTML = hs;
  }
  // 캐릭터 칸: 지금 캐릭터와 X·O 스킬(마우스를 올리면 설명 칸에 자세히)
  var chc = Core.charOf(run), ckey = chc.id + '|' + (d ? d.survey + '/' + d.surveyMax + '|' + Core.igniteCost(run) : '');
  if ($('charBox')._k !== ckey) {
    $('charBox')._k = ckey;
    var xExtra = '촛불 ' + (d ? Core.igniteCost(run) : CONFIG.igniteCost + (chc.igniteDelta || 0));
    var oExtra = chc.id === 'surveyor' ? (d ? '오늘 ' + d.survey + '/' + d.surveyMax + '번' : '하루 ' + chc.surveyPerDay + '번') : '';
    $('charBox').innerHTML = '<div class="prow">' + iconHtml('minerBy.' + chc.id, 32) + '<div style="min-width:0;flex:1"><div class="prow" style="gap:6px"><b style="font-size:15px">' + esc(chc.name) + '</b>' +
      (chc.weak ? '<span class="note warnTxt" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(chc.weak) + '</span>' : chc.perk ? '<span class="note acc">' + esc(chc.perk) + '</span>' : '') + '</div>' +
      '<div class="prow" style="gap:14px;margin-top:2px"><span data-skill="x">' + skillRow('x', chc.x, xExtra) + '</span><span data-skill="o">' + skillRow('o', chc.o, oExtra) + '</span></div></div></div>';
    $('charBox').querySelectorAll('[data-skill]').forEach(function (el) {
      el.onmouseenter = function () { var k = el.getAttribute('data-skill'), sk = Core.charOf(run)[k]; ui.desc = '<b>' + (k === 'x' ? 'X 칸' : 'O 칸') + ' · ' + esc(sk.name) + '</b><br>' + esc(sk.desc); ui.hudDirty = true; };
      el.onmouseleave = function () { ui.desc = null; ui.hudDirty = true; };
    });
  }
  // 도구 칸
  reveal(run.owned.concat(Core.innate(run)).concat(run.keeps || []));
  var nSl = Core.slotsOf(run), slW = Math.min(48, Math.floor((408 - 4 * (nSl - 1)) / nSl)), slSt = ' style="width:' + slW + 'px;height:' + slW + 'px"';   // 칸이 늘면 작아져요(한 줄)
  $('ownLbl').textContent = '가진 도구 ' + run.owned.length + '/' + nSl;
  var os = '';
  for (var s = 0; s < nSl; s++) {
    var id = run.owned[s];
    if (id) { var t = Core.TOOL_BY_ID[id]; var popd = ui.slotPop[id] && performance.now() - ui.slotPop[id] < 150, rv = ui.revealAt[id] && performance.now() - ui.revealAt[id] < 1200; os += '<div class="slot' + (popd ? ' pop' : '') + (rv ? ' reveal' : '') + '" data-tool="' + id + '"' + slSt + '>' + iconHtml('icons.' + t.icon, Math.min(30, slW - 12)) + '</div>'; }
    else os += '<div class="slot empty"' + slSt + '></div>';
  }
  if ($('ownSlots')._h !== os) { $('ownSlots').innerHTML = os; $('ownSlots')._h = os; $('ownSlots').style.gap = '4px'; bindSlotEvents(); }
  // 유품 줄: 도구 칸 아래 작은 그림. 마우스를 올리면 설명
  var ks = (run.keeps || []).map(function (id) { var k = Core.KEEP_BY_ID[id], rv = ui.revealAt[id] && performance.now() - ui.revealAt[id] < 1200; return '<span class="keep' + (rv ? ' reveal' : '') + '" data-keep="' + id + '">' + iconHtml('icons.' + k.icon, 20) + '</span>'; }).join('');
  var kr = $('keepRow');
  if (kr._h !== ks) { kr._h = ks; kr.innerHTML = ks ? '<span class="lbl" style="margin:0 6px 0 0">' + esc(TEXT.keep.row) + '</span>' + ks : ''; kr.style.display = ks ? 'flex' : 'none';
    var ke = kr.querySelectorAll('[data-keep]'); for (var ki = 0; ki < ke.length; ki++) ke[ki].onmouseenter = function () { var k = Core.KEEP_BY_ID[this.dataset.keep]; ui.desc = '<b>' + esc(k.name) + '</b> <span class="muted">유품</span><br>' + esc(k.desc); ui.hudDirty = true; }; }
  // R53 버튼: 두드려 보기·소모품 → 고르기 상태. 발파는 X 칸을 누르면 돼서 버튼이 없어요(R94)
  var md = ui.mode || {};
  var us = d && !d.probesMax && !CONFIG.features.probeBase ? '<div class="uslot off"><span class="muted">빈 칸</span></div>' :   // v22: 두드려 보기는 청진 망치가 있을 때만
    '<div class="uslot' + (modeOk('probe') ? '' : ' off') + (md.kind === 'probe' ? ' on' : '') + '" data-use="probe" data-tip="probe"><span>두드려 보기<br>' + (d ? d.probes + '/' + d.probesMax : '') + ' · −2</span></div>';
  for (var u = 0; u < CONFIG.shop.consSlots; u++) {
    var a = run.cons[u];
    us += a ? '<div class="uslot' + (md.kind === 'cons' && md.slot === u ? ' on' : '') + '" data-use="' + u + '" data-tool="' + a.id + '">' + iconHtml('icons.' + Core.TOOL_BY_ID[a.id].icon, 18) + '<span>' + Core.TOOL_BY_ID[a.id].short + '<br>×' + a.n + '</span></div>' : '<div class="uslot off"><span class="muted">빈 칸</span></div>';
  }
  if ($('useSlots')._h !== us) { $('useSlots').innerHTML = us; $('useSlots')._h = us; bindSlotEvents(); }
  // 버튼으로 쓸 것이 하나도 없으면 줄째 숨겨요(빈 칸만 늘어놓지 않아요)
  var anyUse = (d && (d.probesMax || CONFIG.features.probeBase)) || run.cons.some(function (a) { return a; });
  $('useWrap').style.display = anyUse ? 'block' : 'none';

  // 설명 칸
  var dh = ui.desc;
  if (!dh) {
    dh = '';
    if (run.gang) dh += '<b>오늘 갱 상태</b> ' + esc(run.gang.name) + ' · ' + esc(run.gang.desc) + '<br>';
    if (d && d.mutations.length) dh += d.mutations.map(function (m) { return '<span class="warnTxt">오늘 변덕: ' + esc(MUTATIONS[m].name) + '</span> · ' + esc(MUTATIONS[m].today); }).join('<br>') + '<br>';
    if (d && d.chunkSpec && !d.chunkDone) dh += '<b>큰 덩이</b> 지하 ' + d.chunkSpec.depth + '층 · ' + d.chunkSpec.w + '×' + d.chunkSpec.h + ' · 값 ' + fmt(d.chunkSpec.value * Core.stage(run).valueMul) + ' × 콤보<br>';
    if (f && !(d.mutations.length && d.chunkSpec && !d.chunkDone)) dh += '<span class="muted">표지판: ' + esc(RULES[f.rule].help) + '</span>';   // 칸이 모자라면 표지판 보조 줄은 머리 표지판(누르면 보임)에 맡긴다
  }
  $('descBody').innerHTML = dh;
  $('hint').innerHTML = hintH;
  // 올라가기 버튼
  $('bReturn').classList.toggle('hot', !!danger);
  $('bReturn').disabled = !inMine;
  var rl = $('bReturn').lastChild; if (rl._t !== 'r') { rl.innerHTML = '올라가기'; rl._t = 'r'; }
  board.style.cursor = ui.mode ? 'crosshair' : 'pointer';
  // 범례·주문·로그
  var lg = $('legend');
  if (ui.mode) lg.innerHTML = '<span class="acc" style="font-weight:700">' + esc(ui.mode.kind === 'probe' ? TEXT.ops.probe : TEXT.ops.powder) + '</span>';   // 고르기 상태 안내(화면 아래 한 줄)
  else if (ui.judge && d && run.phase === 'mine') lg.innerHTML = iconHtml('mine', 20) + ' <b class="' + (ui.judge.kind === 'known' ? 'warnTxt' : 'acc') + '">' + esc(ui.judge.text) + '</b>';
  else if (d && d.embersOn) lg.innerHTML = '<span class="warnTxt" style="font-weight:700">불씨 다섯 번이에요. 지뢰를 터뜨리면 쓰러져요</span><span class="sep">|</span><span class="muted">' + TEXT.ember.bar + '</span>';
  else lg.innerHTML = '<span class="px" style="color:' + NUMC[2] + ';font-size:16px">2</span> ' + iconHtml('mine', 20) + iconHtml('gem', 20) + ' <b>숫자 = 주변 8칸의 지뢰 + 보물</b><span class="sep">|</span><span class="muted">오른쪽 클릭: 분필 X → O → 지움</span>';
  var o = run.order, ol = '';
  if (o) { var def = Core.ORDER_BY_ID[o.id]; ol = '주문: ' + esc(def.text) + ' (' + Math.min(o.prog, def.goal) + '/' + def.goal + ')' + (o.done ? ' <span class="acc">달성</span>' : o.failed ? ' <span class="muted">못 이룸</span>' : ''); }
  $('orderLine').innerHTML = ol;
  $('orderLine').style.display = ol ? 'block' : 'none';
  var tall = !ol; if ($('log')._tall !== tall) { $('log')._tall = tall; $('log').classList.toggle('tall', tall); $('log')._k = null; }
  renderLog();
}
function bindSlotEvents() {
  var els = $('toolsBox').querySelectorAll('[data-tool]');
  for (var i = 0; i < els.length; i++) {
    els[i].onmouseenter = function () { var t = Core.TOOL_BY_ID[this.dataset.tool]; ui.desc = '<b>' + esc(t.name) + '</b>' + ' <span class="muted">' + axisName(t) + '</span>' + '<br>' + esc(t.desc); ui.hudDirty = true; };
    els[i].onmouseleave = function () { ui.desc = null; ui.hudDirty = true; };
  }
  var us = $('toolsBox').querySelectorAll('[data-use]');
  for (i = 0; i < us.length; i++) {
    us[i].onclick = function () { var u = this.dataset.use; if (u === 'probe') toggleMode(u); else toggleMode('cons', +u); };
    if (us[i].dataset.tip) { us[i].onmouseenter = function () { ui.desc = '<b>두드려 보기</b><br>고른 칸 하나가 지뢰인지 아닌지 알려 줘요. 촛불이 2 들어요'; ui.hudDirty = true; }; us[i].onmouseleave = function () { ui.desc = null; ui.hudDirty = true; }; }
  }
}
// 버튼 줄 아래 한 줄: 마우스를 올린 칸 설명(01 2.5)
function hintText() {
  ui.preCost = 0;
  var d = run.d; if (!d || run.phase !== 'mine') return '';
  if (ui.mode) return '오른쪽 클릭이나 버튼을 다시 누르면 그만둬요';
  var h = ui.hover;
  var aimTxt = function (q) { ui.preCost = q.mark === 1 ? Core.igniteCost(run) : Core.hitCost(run); return q.mark === 1 ? '한 번 더 누르면 터뜨려요 · 촛불 −' + Core.igniteCost(run) : TEXT.ops.aimed.replace('{n}', Core.hitCost(run)); };
  if (!h) { var ac0 = ui.aim && Core.cellAt(d.floor, ui.aim.x, ui.aim.y); return ac0 ? esc(aimTxt(ac0)) : ''; }
  var c = Core.cellAt(d.floor, h.x, h.y);
  if (c.cover !== 'open') {
    var ch = Core.charOf(run), isX = c.mark === 1, survey = c.mark === 2 && d.survey > 0;
    var verb = isX ? (ch.id === 'defuser' ? '해체해요' : ch.id === 'blaster' ? '크게 터뜨려요' : '터뜨려요') : survey ? '청진하고 캐요' : (c.mark === 2 && ch.id === 'gambler') ? '걸고 캐요' : '캐요';
    var cost = isX ? Core.igniteCost(run) : Core.hitCost(run) + (survey ? CONFIG.probeCost : 0);
    if (!settings.aim) ui.preCost = cost;
    if (ui.aim && ui.aim.x === h.x && ui.aim.y === h.y) return esc(aimTxt(c));
    if (!settings.aim) return (Core.cheb(d.px, d.py, h.x, h.y) === 1 ? '누르면 ' : '누르면 걸어가서 ') + verb + ' · 촛불 −' + cost;
    return '누르면 옆으로 가요. 한 번 더 누르면 ' + verb;
  }
  if (h.x === d.px && h.y === d.py && Core.onStair(run)) return esc(TEXT.ops.stair + ' · 깊을수록 보물이 많고 비싸요');
  var ci = Core.chordInfo(run, h.x, h.y);   // 둘레 한꺼번에 열기
  if (ci && ci.ready && (!settings.aim || (h.x === d.px && h.y === d.py))) ui.preCost = Core.hitCost(run);
  if (ci && ci.ready) return h.x === d.px && h.y === d.py ? esc(TEXT.chord.hint.replace('{n}', Core.hitCost(run))) : !settings.aim ? '누르면 걸어가서 주변 칸을 한꺼번에 열어요 · 촛불 −' + Core.hitCost(run) : '누르면 그 숫자로 걸어가요. 한 번 더 누르면 주변 칸을 한꺼번에 열어요';
  var fs0 = d.floor.stair;
  if (fs0 && fs0.found && fs0.x === h.x && fs0.y === h.y && !settings.aim) return '누르면 걸어가서 내려갈 층을 골라요 · 깊을수록 보물이 많고 비싸요';
  if (h.x === d.px && h.y === d.py && ci && ci.marked > 0) return esc(TEXT.chord.need);
  return '누르면 그 칸으로 걸어가요';
}
function renderLog() {
  var el = $('log'), L = run.log.filter(function (m) { return m.id > ui.logFrom; }).slice(el._tall ? -3 : -2);
  var key = L.map(function (m) { return m.id; }).join(',');
  if (el._k === key) return; el._k = key;
  el.innerHTML = L.map(function (m, i) { return '<div style="color:' + (i === L.length - 1 ? (m.kind === 'bad' ? '#ff9a4d' : m.kind === 'good' ? '#f1ece2' : '#f1ece2') : '#a59fb3') + '">' + esc(m.text) + '</div>'; }).join('');
}

// ---------- 오버레이 화면 ----------
var OV = $('ov');
function stampIdx(day) { var P = Core.payments(run); for (var i = 0; i < P.length; i++) if (P[i].day === day) return i; return -1; }
function stampNm(day) { var i = stampIdx(day); return i >= 0 ? Core.stampNames(run)[i] : ''; }
var NUM_KO = ['', '한', '두', '세', '네', '다섯', '여섯'];
function gradeName(g) { return CONFIG.gradeNames[(g || 1) - 1] || CONFIG.gradeNames[0]; }
// 머리 줄 날짜: 15일 판은 "n일째 / 15", 끝없는 갱은 "n일째 · 끝없는 갱"
function dayHead() { return '<span class="px">' + run.day + '</span>일째 <span class="muted" style="font-weight:400">' + (run.endless ? '· ' + esc(TEXT.endless.tag) : '/ ' + CONFIG.days) + '</span>'; }
function dayLeft() { if (!run.endless) return (CONFIG.days - run.day + 1) + '일 남음'; var g = Core.goalInfo(run); return g ? '도장까지 ' + g.daysLeft + '일' : ''; }
function seedLine() { return esc(TEXT.seed.label) + ' ' + Core.seedCode(run.seed) + ' · ' + CONFIG.genVersion + (run.seedSet ? ' · ' + esc(TEXT.seed.mark) : ''); }
function copySeed(btn) {   // 클립보드가 막혀 있으면 글자를 골라 둬요
  var code = Core.seedCode(run.seed), done = function () { if (btn) btn.textContent = TEXT.seed.copied; };
  try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(code).then(done, function () {}); return; } } catch (e) {}
  done();
}
function bestKey() { return run.daily ? 'daily:' + run.daily : 'grade:' + (run.grade || 1); }
// 캐릭터 고르기(권리증 화면 오른쪽). 첫 판은 광부로만 해요
function skillRow(k, sk, extra) { return '<div class="skRow"><span class="mk ' + k + '">' + (k === 'x' ? 'X' : 'O') + '</span><b>' + esc(sk.name) + '</b>' + (extra ? ' <span class="muted">' + extra + '</span>' : '') + '</div>'; }
function charPickHtml() {
  var cur = Core.charOf(run), list = run.tutorial ? CHARACTERS.slice(0, 1) : CHARACTERS;
  var h = '<div style="flex:1;min-width:0"><div class="lbl big" style="margin-bottom:8px">누구로 캘까요?</div><div class="charList">';
  list.forEach(function (c) {
    if (!charOpen(c.id)) { h += '<div class="charPick locked" title="' + esc(TEXT.charLock[c.id] || '') + '"><span class="sil">' + iconHtml('minerBy.' + c.id, 40) + '</span><div style="min-width:0"><div class="nm">???</div><div class="note">' + esc(TEXT.charLock[c.id] || '') + '</div></div></div>'; return; }
    h += '<div class="charPick' + (c.id === cur.id ? ' sel' : '') + '" data-char="' + c.id + '">' + iconHtml('minerBy.' + c.id, 40) + '<div style="min-width:0"><div class="nm">' + esc(c.name) + '</div><div class="note">X ' + esc(c.x.name) + ' · O ' + esc(c.o.name) + '</div></div></div>';
  });
  h += '</div><div class="panel charInfo"><div style="color:#c9c3d6;margin-bottom:6px">' + esc(cur.line) + '</div>' +
    skillRow('x', cur.x) + '<div class="note skDesc">' + esc(cur.x.desc) + '</div>' + skillRow('o', cur.o) + '<div class="note skDesc">' + esc(cur.o.desc) + '</div>' +
    (cur.perk ? '<div class="acc" style="margin-top:6px">' + esc(cur.perk) + '</div>' : '') + (cur.weak ? '<div class="warnTxt" style="margin-top:4px">약점: ' + esc(cur.weak) + '</div>' : '') + '</div>' +
    (run.tutorial ? '<div class="note" style="margin-top:8px">첫 판은 광부로 해요. 다른 사람은 판을 하며 하나씩 열려요.</div>' : '') + '</div>';
  return h;
}
function deedHtml(stampsShown, anim, focusFirst) {   // focusFirst: 첫 판은 첫 도장만 또렷하게
  var P = Core.payments(run);
  var h = '<div class="deedCard"><div class="ttl">' + gradeName(run.grade) + ' 권리증 (가)' + (run.daily ? ' · ' + TEXT.daily + ' ' + run.daily : '') + '</div><div style="font-size:14px;margin-bottom:6px">광산 값은 ' + NUM_KO[P.length] + ' 번에 나눠 내요. 낼 때마다 도장 하나예요.</div>';
  P.forEach(function (p, i) {
    var stamped = i < stampsShown, fall = anim && i === stampsShown - 1;
    h += '<div class="stampRow"' + (focusFirst && i > 0 ? ' style="opacity:0.3"' : '') + '><div class="stampSlot">' + (stamped ? '<div class="stamp' + (fall ? ' fall' : '') + '" style="' + (fall ? 'opacity:0;animation-delay:1400ms' : '') + '">도장</div>' : '') + '</div><b style="width:110px">' + Core.stampNames(run)[i] + '</b>' + iconHtml('coins', 18) + '<span class="px" style="font-size:15px;width:80px;text-align:right">' + fmt(p.amount) + '</span><span style="margin-left:14px">· ' + p.day + '일째</span>' + iconHtml('', 0) + '</div>';
  });
  return h + '</div>';
}
// ---------- 기록 장치(재미 보고서 1주차) ----------
// 하루가 끝날 때 한 줄씩 브라우저에 쌓아요: 걸린 시간, 클릭 수, 결과를 모르고 고른 수, 하루가 끝난 이유. 설정에서 내려받아요
var PLAYLOG_KEY = 'ocd2_playlog', PLAYLOG_MAX = 600;
function playlogLoad() { try { return JSON.parse(localStorage.getItem(PLAYLOG_KEY) || '[]') || []; } catch (e) { return []; } }
function playlogSave(list) { try { localStorage.setItem(PLAYLOG_KEY, JSON.stringify(list.slice(-PLAYLOG_MAX))); } catch (e) {} }
function uncertainOf(r) { return r ? r.bet + r.unknown + r.blastBet : 0; }
function recordDay() {
  if (!ui.dayT0 || ui.dayRecorded || !run.history.length) return;
  ui.dayRecorded = true;
  var h = run.history[run.history.length - 1];
  var list = playlogLoad();
  list.push({ at: new Date().toISOString(), seed: run.seed, tutorial: !!run.tutorial, day: h.day, ms: Date.now() - ui.dayT0, clicks: ui.dayClicks || 0,
              char: run.char, reason: h.reason, income: h.income, depth: h.depth, candleLeft: h.candleLeft, hpLeft: run.d ? run.d.hp : null, stamps: run.stamps,
              uncertain: uncertainOf(h.rec), rec: h.rec });
  playlogSave(list);
}
function playlogSummary() {
  var L = playlogLoad(); if (!L.length) return '아직 기록된 하루가 없어요';
  var ms = L.map(function (x) { return x.ms; }).sort(function (a, b) { return a - b; }), med = ms[ms.length >> 1];
  var mins = L.reduce(function (a, x) { return a + x.ms; }, 0) / 60000, unc = L.reduce(function (a, x) { return a + (x.uncertain || 0); }, 0);
  return '기록된 하루 ' + L.length + '개 · 하루 중앙값 ' + Math.floor(med / 60000) + '분 ' + Math.round(med / 1000) % 60 + '초 · 1분에 결과를 모르고 고른 수 ' + (mins ? (unc / mins).toFixed(1) : '0') + '번';
}
function playlogDownload() {
  try {
    var blob = new Blob([JSON.stringify(playlogLoad(), null, 1)], { type: 'application/json' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'one-candle-deep-playlog.json';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  } catch (e) {}
}
function renderOverlay() {
  if (ui.opening != null) { OV.innerHTML = openingHtml(); OV.className = 'show'; clearBubbles(); bindOverlay(); drawOpening(); return; }
  if (ui.title) { OV.innerHTML = titleHtml() + (ui.sub === 'codex' ? codexHtml() : ''); OV.className = 'show'; bindOverlay(); return; }
  if (run.phase === 'settle') recordDay();
  var p = run.phase, h = '';
  if (run.boxOffer) h = boxHtml();   // 옛 연장함 고르기가 먼저예요(하루가 같은 순간에 끝나도)
  else if (ui.sub === 'codex') h = codexHtml();
  else if (p === 'deed') {
    h = '<div class="dim" style="background:#14121a"></div><div class="dlg" style="width:1060px;border:none;background:transparent;text-align:left;display:flex;gap:28px;align-items:flex-start"><div style="width:620px;flex:none">' +
      '<div class="muted" style="font-size:13px;margin-bottom:10px">원 캔들 딥 · 2차 프로토타입</div>' + deedHtml(0, false, run.tutorial) +
      '<div style="font-size:15px;margin-top:12px;line-height:24px">도장 찍는 날 밤에 금고가 모자라면 계약이 끝나요.<br>' + (CONFIG.preset === 'v22' ? '도장이 찍히면 다음 날부터 캔 값이 오르거나 갱이 깊어져요. 도장마다 선물도 하나 골라요.' : '도장이 찍히면 다음 날부터 캔 값이 올라요.') + '<br>마지막 도장을 찍고 금고에 남은 돈이 이번 판 점수예요.</div>' +
      '<div style="text-align:right;color:#c9c3d6;margin-top:6px">중개인 구 실장</div>' +
      '<div style="display:flex;gap:10px;justify-content:space-between;align-items:center;margin-top:14px">' +
      (run.tutorial ? '<button id="oSkipTut">첫 판 안내 건너뛰기</button>' : '<span style="display:flex;gap:8px"><button id="oTut">첫 판 안내로 시작</button>' + (run.daily ? '<button id="oNormal">보통 광산으로</button>' : '<button id="oDaily">' + TEXT.daily + '</button>') + '<button id="oCodex">도감</button></span>') +
      '<button class="primary" id="oGoDeed">' + '다음' + '</button></div>' +
      (!run.tutorial && !run.daily && (settings.gradeOpen || 1) > 1 ? '<div style="display:flex;gap:8px;margin-top:10px;align-items:center"><span class="note">광산 고르기</span>' + [1, 2, 3].filter(function (g) { return g <= settings.gradeOpen; }).map(function (g) { return '<button data-grade="' + g + '"' + (g === run.grade ? ' class="primary"' : '') + '>' + gradeName(g) + '</button>'; }).join('') + '</div>' : '') +
      (!run.tutorial && !run.daily ? '<div style="display:flex;gap:8px;margin-top:10px;align-items:center"><span class="note">' + esc(TEXT.seed.label) + '</span><input id="seedIn" spellcheck="false" autocomplete="off" placeholder="' + esc(TEXT.seed.hint) + '" style="width:150px" value="' + (run.seedSet ? Core.seedCode(run.seed) : '') + '"><button id="oSeed">' + esc(TEXT.seed.apply) + '</button><span class="note">지금 ' + Core.seedCode(run.seed) + ' · ' + CONFIG.genVersion + '</span></div>' : '') +
      (run.daily ? '<div class="note" style="margin-top:8px">모두 같은 판을 받아요. 이 브라우저 최고 점수 ' + fmt((settings.bestBy || {})[bestKey()] || 0) + '</div>' : '') + '</div>' + (run.tutorial ? '' : charPickHtml()) + '</div>';   // 첫 판은 캐릭터 칸 없이
  } else if (p === 'gift') h = giftHtml();
  else if (p === 'board') h = boardHtml();
  else if (p === 'mine' && ui.sub === 'fork') h = forkHtml();
  else if (p === 'room') h = run.room.kind === 'spring' ? springHtml() : shopHtml(true);
  else if (p === 'settle') h = settleHtml();
  else if (p === 'payment') h = paymentHtml();
  else if (p === 'shop') h = run.deedLater && !run.deedHanded ? deedLateHtml() : shopHtml(false);
  else if (p === 'final') h = finalHtml();
  else if (ui.sub === 'pause') h = pauseHtml();
  else if (ui.sub === 'bag') h = bagHtml();
  else if (ui.sub === 'cal') h = calHtml();
  OV.innerHTML = h;
  OV.className = h ? 'show' : '';
  if (h && p !== 'mine') clearBubbles();
  bindOverlay();
  saveRun();
}
function boardHtml() {
  var np = Core.nextPayment(run), pay = Core.paymentFor(run.day), G = Core.goalInfo(run);
  var futMut = np ? (run.mutationPlan[np.day] || []) : [];
  var sparse = !run.gang && !run.orders.length && !(run.mutationPlan[run.day] || []).length;   // 갱 상태·주문·변덕이 없으면 쪽지 하나뿐이라 좁게
  var h = '<div class="dim" style="background:#14121a"></div><div class="dlg" style="width:' + (sparse ? 480 : 1040) + 'px;background:#2a2018;border:3px solid #5a3d28;padding:16px 20px">';
  var colW = sparse ? '' : 'width:360px;';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><h2 style="margin:0">' + run.day + '일째 아침 · 갱 입구 게시판</h2><span class="muted">' + (CONFIG.days - run.day + 1) + '일 남음</span></div>';
  h += '<div style="display:flex;gap:16px' + (sparse ? ';flex-direction:column' : '') + '">';   // 쪽지가 하나뿐이면 권리증 아래로 한 줄로 쌓아요
  // 왼쪽: 권리증 칸
  h += '<div class="panel" style="' + colW + 'padding:12px 14px;' + (pay ? 'border-color:#c4432b' : '') + '">';
  h += '<div class="lbl" style="font-size:14px;color:' + (pay ? '#e5484d' : '#a59fb3') + '">' + (pay ? '오늘 도장 찍는 날 · ' + stampNm(run.day) : '권리증') + '</div>';
  h = h.replace(/<div class="lbl" style="font-size:14px;color:([^"]*)">([^<]*)<\/div>$/, '<div class="lbl" style="font-size:14px;color:$1" data-term="도장">$2</div>');
  var stamps = ''; for (var i = 0; i < Core.payments(run).length; i++) stamps += '<div class="stampSlot" style="width:34px;height:34px;border-color:#5d5868">' + (i < run.stamps ? '<div class="stamp" style="width:32px;height:32px;font-size:11px">도장</div>' : '') + '</div>';
  h += '<div style="display:flex;gap:8px;margin:8px 0">' + stamps + '</div>';
  if (G) {
    h += '<div style="font-size:17px;font-weight:700">' + stampNm(G.day) + ' ' + fmt(G.amount) + ' · ' + G.day + '일째 <span class="muted" style="font-size:14px">(' + (G.daysLeft === 0 ? '오늘 밤' : G.daysLeft + '일 뒤') + ')</span></div>';
    h += '<div style="margin:6px 0">' + iconHtml('coins', 18) + ' 금고 <b>' + fmt(run.cash) + '</b></div>';
    h += '<div>' + (G.left > 0 ? '다음 도장까지 <b class="acc">' + fmt(G.left) + '</b>' : '<span class="acc">다음 도장 채움</span>') + '</div>';
    h += '<div id="payBar" style="position:relative;height:10px;background:#1d1a24;border:1px solid #34303f;margin-top:6px"><i style="position:absolute;left:0;top:0;bottom:0;width:' + Math.min(100, run.cash / G.amount * 100) + '%;background:#b87333"></i></div>';
  }
  // 시세(01 5.4, 02 6.1 게시판 시세 표기)
  h += '<div style="margin-top:10px;font-size:14px;line-height:21px" data-term="시세">' + esc(Core.rateText(run)) + '</div>';
  if (futMut.length) h += '<div style="margin-top:12px;font-size:14px">' + np.day + '일째 광산 변덕:<br>' + futMut.map(function (m) { return iconHtml('muts.' + m, 20) + ' ' + MUTATIONS[m].name; }).join('<br>') + '</div>';
  h += '</div>';
  // 오른쪽
  h += '<div style="flex:1;display:flex;flex-direction:column;gap:10px">';
  var dm = run.mutationPlan[run.day] || [];
  if (dm.length) h += dm.map(function (m) { return '<div class="panel" style="padding:6px 12px;border-color:#c4432b;font-size:15px"><span class="warnTxt" style="font-weight:700">오늘 변덕: ' + MUTATIONS[m].name + '</span> · ' + esc(MUTATIONS[m].today) + '</div>'; }).join('');
  if (pay && CONFIG.chunks[run.day]) { var ch = CONFIG.chunks[run.day]; h += '<div class="panel" style="padding:6px 12px;border-color:#a8781c;font-size:15px">' + iconHtml('chunk', 20) + ' ' + esc((ch.w * ch.h === 4 ? TEXT.chunk.morning4 : TEXT.chunk.morning6).replace('{n}', ch.depth)) + '</div>'; }
  var gg = run.gang;
  h += '<div style="display:flex;gap:10px">';
  if (gg) h += '<div class="paper" style="cursor:default;flex:1.4"><span class="pinI">' + iconHtml('pin', 20) + '</span><div style="font-size:13px;color:#5a3d28;font-weight:700">오늘 갱 상태' + (gg.good ? ' · 좋은 날' : '') + '</div><div style="font-size:18px;font-weight:700">' + esc(gg.name) + '</div><div style="font-size:15px">' + esc(gg.desc) + '</div></div>';
  var fr = run.firstRule || 'plain', fd = Core.gang(run, 'toss') ? 2 : 1;
  h += '<div class="paper" style="cursor:default;flex:1"><span class="pinI">' + iconHtml('pin', 20) + '</span><div style="font-size:13px;color:#5a3d28;font-weight:700">오늘 첫 층 · 지하 ' + fd + '층</div><div style="font-size:17px;font-weight:700;display:flex;align-items:center;gap:6px">' + iconHtml('rules.' + fr, 20) + esc(RULES[fr].name) + '</div><div style="font-size:14px">' + esc(RULES[fr].sign) + '</div></div>';
  h += '</div>';
  if (run.orders.length) h += '<div class="lbl" style="font-size:14px">주문 하나 고르기 <span class="muted" style="font-weight:400">상인 심 씨: "' + esc(TEXT.boardTalk) + '"</span></div>';
  h += '<div style="display:flex;gap:14px">';
  run.orders.forEach(function (o, k) {
    var R = o.reward, rt = R.pocket ? '주머니 +' + fmt(Core.orderPocket(run, R.pocket)) : R.candle ? '촛불 +' + R.candle : Core.TOOL_BY_ID[R.cons].name + ' ' + R.n + '개';
    var room = R.cons ? consRoom(R.cons) : 99, lack = R.cons && room < R.n ? ' <span class="badge">받을 칸이 ' + (R.n - room) + '개 모자람</span>' : '';
    h += '<div class="paper' + (ui.sel === k ? ' sel' : '') + '" data-order="' + k + '" style="flex:1"><span class="pinI">' + iconHtml('pin', 20) + '</span><div style="font-size:13px;color:#5a3d28;font-weight:700"> 주문서</div><div style="font-size:16px;font-weight:700;margin:4px 0">' + esc(o.text) + '</div><div style="font-size:15px">→ <b>' + rt + '</b>' + lack + '</div></div>';
  });
  h += '</div></div></div>';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px"><span class="note">' + (run.orders.length ? '주문서를 클릭해서 골라요' : '') + '</span><button class="primary" id="oGoBoard">' + (run.orders.length ? '이 주문으로 내려가기' : '내려가기') + '</button></div></div>';
  return h;
}
function rateLine(run) {   // 02 6.1 게시판 시세 표기: "도장 1개: 캔 값 ×1.5 · 금 알갱이 30 …"
  var st = Math.min(run.stamps, CONFIG.stages.length - 1), vm = CONFIG.stages[st].valueMul, nvm = st + 1 < CONFIG.stages.length ? CONFIG.stages[st + 1].valueMul : '';
  return esc(TEXT.rate[Math.min(st, 2)].replace('{mul}', vm).replace('{g}', Math.floor(CONFIG.treasureValue[1] * vm)).replace('{b}', Math.floor(CONFIG.treasureValue[2] * vm)).replace('{r}', Math.floor(CONFIG.treasureValue[3] * vm)).replace('{next}', nvm));
}
function consRoom(id) {   // 소모품을 더 받을 수 있는 개수
  var n = 0; run.cons.forEach(function (a) { if (a.id === id) n += CONFIG.shop.stack - a.n; });
  return n + (CONFIG.shop.consSlots - run.cons.length) * CONFIG.shop.stack;
}
function forkHtml() {
  var d = run.d, f = d.floor, opts = f.forkOptions, cost = Core.travelCost(run, f.depth + 1);
  var h = '<div class="dim" style="background:rgba(11,10,16,0.6)"></div><div class="dlg" style="width:760px"><h2>어느 쪽으로 내려갈까요?</h2>';
  h += '<div style="font-size:16px;margin-bottom:4px">지하 ' + (f.depth + 1) + '층으로 내려가요 · <b class="acc">촛불 -' + cost + '</b> (' + d.candle + ' → ' + (d.candle - cost) + ')' + (d.candle < cost ? ' <span class="badge">촛불 모자람</span>' : '') + '</div>';
  h += '<div class="sub" style="margin-bottom:12px;font-size:14px" data-term="지하 층">' + esc(TEXT.deeper) + '</div>';
  h += '<div style="display:flex;gap:14px">';
  opts.forEach(function (o, i) {
    h += '<div class="fork panel' + (ui.sel === i ? ' sel' : '') + '" data-fork="' + i + '">';
    if (o.kind === 'floor') {
      var R = RULES[o.rule];
      if (!ui.rulesSeen[o.rule]) h += '<span class="badge gold first">처음</span>';
      h += iconHtml('rules.' + o.rule, 48) + '<div class="nm">' + R.name + '</div><div class="tx">' + esc(R.sign) + '</div>' + veinDiagram(o.rule) + '<div class="hp2">' + esc(R.help) + '</div>';
      if (o.est) h += '<div class="tx" style="margin-top:6px;color:#c9c3d6">' + (CONFIG.countsShown ? '보물 ' + o.est.t + '개 · 지뢰 ' + o.est.m + '개' : '보물 ' + o.est.t + '개쯤 · 지뢰 ' + o.est.m + '개쯤') + '</div>';
      if (o.est && o.est.tiers) h += '<div class="tx" style="color:#c9c3d6;font-size:13px">' + (o.est.tierUp ? '보물이 한 등급 높아요 · ' : '') + '금 알갱이 ' + o.est.tiers[0] + '% · 청록 보석 ' + o.est.tiers[1] + '% · 유물 ' + o.est.tiers[2] + '%</div>';   // 02 6.5 갈림길 카드 네 줄
      if (o.bonus) h += '<div style="margin-top:6px;font-size:15px;font-weight:700;color:#ffd25a">' + esc(bonusText(o.bonus)) + '</div>';
      if (o.chunk) h += '<div style="margin-top:8px"><span class="badge gold">큰 덩이 있음 (' + d.chunkSpec.w + '×' + d.chunkSpec.h + ')</span></div>';
    } else if (o.kind === 'spring') {
      h += iconHtml('icons.spring', 48) + '<div class="nm">샘</div><div class="tx">체력 +1이나 촛불 +' + CONFIG.spring.candle + ' 중 하나를 골라요</div><div class="hp2">→ 지하 ' + o.depth + '층(맨땅)</div>';
    } else {
      h += iconHtml('icons.merchant', 48) + '<div class="nm">상인 방</div><div class="tx">도구 3개, 한 번 쓰는 물건 1개가 있어요. 금고 돈으로 사요</div><div class="hp2">→ 지하 ' + o.depth + '층(맨땅)</div>';
    }
    h += '</div>';
  });
  h += '</div><div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px"><span class="sub">지금: 콤보 ' + multTxt(Core.streakMult(run)) + ' · 체력 ' + d.hp + '/' + d.hpMax + ' · 주머니 ' + fmt(d.pocket) + '</span>' +
    '<span><button id="oStay">더 파기</button> <button class="primary" id="oGo">내려가기</button></span></div></div>';
  return h;
}
function bonusText(b) {
  var B = CONFIG.forkBonus;
  return { value: '덤: 이 층 보물 값 ×' + B.valueMul, candle: '덤: 도착하면 촛불 +' + B.candle, streak: '덤: 콤보 한 단계 올리고 시작',
           more: '덤: 더 묻힌 층 · 지뢰 +' + B.moreMines + ', 보물 +' + B.moreTreasures, merchant: '덤: 가는 길에 상인 방', spring: '덤: 가는 길에 샘' }[b] || '';
}
function springHtml() {
  var d = run.d, full = d.hp >= d.hpMax;
  return '<div class="dim"></div><div class="dlg" style="width:560px"><h2>샘</h2><div class="sub">물소리가 나요. 하나만 고르세요. 나가면 지하 ' + run.room.next + '층(' + RULES[run.room.rule || 'plain'].name + ').</div>' +
    '<div style="display:flex;gap:12px;margin-top:14px"><button class="primary" id="oHp" style="flex:1;padding:12px" ' + (full ? 'disabled' : '') + '> 체력 +1 ' + (full ? '(가득)' : '(지금 ' + d.hp + '/' + d.hpMax + ')') + '</button>' +
    '<button class="primary" id="oCd" style="flex:1;padding:12px"> 촛불 +' + CONFIG.spring.candle + ' (지금 ' + d.candle + ')</button></div></div>';
}
function settleHtml() {
  var S = run.settle;
  var title = S.reason === 'collapse' ? '쓰러졌어요 · 구조꾼 곽 씨가 업고 나왔어요' : S.reason === 'return' ? '일찍 올라왔어요' + (run.d.candle > 0 ? ' · 버린 촛불 ' + run.d.candle : '') : '불씨까지 다 쓰고 올라왔어요';
  var h = '<div class="dim"></div><div class="dlg" id="settleDlg" style="width:640px"><h2>' + S.day + '일째 끝 · ' + title + '</h2>';
  if (S.quote) h += '<div class="quote fadein">구조꾼 곽 씨: "' + esc(S.quote) + '"</div>';
  h += '<h3>층별 수입</h3>';
  var delay = 250;
  S.floors.forEach(function (fl, i) {
    if (i >= 6) return;
    h += '<div class="row fadein" style="animation-delay:' + delay + 'ms"><span>지하 ' + fl.depth + '층 (' + RULES[fl.rule].name + ')' + (fl.perfect ? ' <span class="badge gold">완벽한 층</span>' : '') + '</span><span>' + fmt(fl.value) + '</span></div>'; delay += 120;
  });
  if (S.lines.gravel) { h += '<div class="row fadein muted" style="animation-delay:' + delay + 'ms;font-size:14px"><span>그중 자갈' + (CONFIG.features.gravel === 'chain' ? '(큰 와르르)' : '') + '</span><span>' + fmt(S.lines.gravel) + '</span></div>'; delay += 120; }
  if (S.lines.sold) { h += '<div class="row fadein muted" style="animation-delay:' + delay + 'ms;font-size:14px"><span>그중 곽 씨에게 넘긴 도구</span><span>' + fmt(S.lines.sold) + '</span></div>'; delay += 120; }
  if (S.lines.order) { h += '<div class="row fadein" style="animation-delay:' + delay + 'ms"><span>주문 보수</span><span>' + fmt(S.lines.order) + '</span></div>'; delay += 120; }
  ui.settleT0 = performance.now(); ui.settleDur = delay + 1100;
  h += '<div style="display:flex;align-items:center;gap:14px;margin:14px 0;font-size:17px">' + iconHtml('pouch', 32) + '<span>오늘 주머니 <b class="px" id="sPocket">' + fmt(S.gross) + '</b></span>' +
       (S.lost ? '<span class="note" id="sLost" style="display:none">(절반은 곽 씨 수고비 -' + fmt(S.lost) + ')</span>' : '') +
       '<span style="color:#a59fb3">────▶</span>' + iconHtml('coins', 32) + '<span>금고 ' + fmt(S.before) + ' → <b class="px acc" id="sVault">' + fmt(S.before) + '</b></span></div>';
  if (S.line) h += '<div class="quote fadein" style="animation-delay:' + (delay + 800) + 'ms">중개인 구 실장: "' + esc(S.line) + '"</div>';
  var o = run.order;
  if (o) { var def = Core.ORDER_BY_ID[o.id]; h += '<div class="fadein note" style="animation-delay:' + (delay + 900) + 'ms;font-size:14px">주문 ' + esc(def.text) + ': ' + (o.done ? '<span class="acc">달성</span>' : Math.min(o.prog, def.goal) + '/' + def.goal + ' · 못 이룸') + '</div>'; }
  var np = Core.nextPayment(run);
  if (np && !(S.line && /도장/.test(S.line))) h += '<div class="fadein" style="animation-delay:' + (delay + 900) + 'ms;margin-top:8px;font-size:15px">' + goalLine(run) + '</div>';
  if (np && np.day > run.day) h += stampProgress(np, delay + 950);   // 구 실장 말에 이미 있으면 되풀이하지 않아요
  h += '<div class="fadein" style="animation-delay:' + (delay + 1000) + 'ms;margin-top:14px;text-align:right"><button class="primary" id="oNext">' + (S.payDay ? '도장 찍으러 가기' : '상점으로') + '</button></div></div>';
  return h;
}
// 다음 도장까지 얼마나 모았는지: 도장 모양 칸이 금고만큼 차요(reviews/16)
// 판 끝 '이번 판에 열린 것': 도감에 새로 열린 도구·유품, 새로 열린 사람, 다음에 열릴 사람 하나(reviews/16)
function unlockBlock() {
  var items = (run.newSeen || []).filter(function (id, i, a) { return a.indexOf(id) === i; }).map(function (id) { var t = Core.TOOL_BY_ID[id] || Core.KEEP_BY_ID[id]; return t ? iconHtml('icons.' + t.icon, 20) + ' ' + esc(t.name) : ''; }).filter(Boolean);
  (run.newChars || []).forEach(function (id) { var c = Core.CHAR_BY_ID[id]; items.push(iconHtml('minerBy.' + id, 22) + ' <b class="acc">' + esc(TEXT.firstRun.newChar) + '</b> ' + esc(c.name)); });
  var next = CHARACTERS.filter(function (c) { return !charOpen(c.id); })[0];
  return '<div class="panel" style="padding:8px 12px;margin-top:10px"><div class="note">' + esc(TEXT.firstRun.unlocked) + '</div><div style="display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:4px;align-items:center;font-size:14px">' +
    (items.length ? items.map(function (x) { return '<span style="display:inline-flex;align-items:center;gap:4px">' + x + '</span>'; }).join('') : '<span class="muted">' + esc(TEXT.firstRun.none) + '</span>') + '</div>' +
    (next ? '<div class="note" style="margin-top:4px">' + esc(TEXT.firstRun.nextUnlock.replace('{name}', '???').replace('{cond}', TEXT.charLock[next.id] || '')) + '</div>' : '') + '</div>';
}
function stampProgress(np, delayMs) {
  var names = Core.stampNames(run), idx = Core.payments(run).indexOf(np), have = Math.min(run.cash, np.amount), k = np.amount ? have / np.amount : 1;
  return '<div class="fadein" style="animation-delay:' + delayMs + 'ms;display:flex;align-items:center;gap:10px;margin-top:8px"><div class="stampSlot" style="width:34px;height:34px;flex:none;position:relative;overflow:hidden"><div style="position:absolute;left:0;right:0;bottom:0;height:' + Math.round(k * 100) + '%;background:rgba(196,67,43,0.55)"></div></div>' +
    '<div style="flex:1"><div style="height:8px;background:#2a2633;border:1px solid #3a3542"><div style="height:100%;width:' + Math.round(k * 100) + '%;background:#c4432b"></div></div><div class="note" style="margin-top:3px">' + esc(TEXT.firstRun.progress.replace('{name}', names[idx] || np.name).replace('{amt}', fmt(np.amount)).replace('{have}', fmt(have))) + '</div></div></div>';
}
function settleTick(now) {
  if (run.phase !== 'settle') return;
  var S = run.settle, k = now - ui.settleT0, rows = S.floors.length;
  var tCoin = 250 + Math.min(6, rows) * 120 + 250, el = $('sPocket'), ev = $('sVault');
  if (!el) return;
  var pocket = S.gross;
  if (S.lost) { var p0 = Math.min(1, Math.max(0, (k - (tCoin - 200)) / 400)); pocket = Math.round(S.gross - S.lost * p0); if (p0 > 0 && $('sLost')) $('sLost').style.display = 'inline'; tCoin += 400; }
  var p = Math.min(1, Math.max(0, (k - tCoin - 230) / 600));
  el.textContent = fmt(Math.round(pocket * (1 - p)));
  ev.textContent = fmt(Math.round(S.before + S.net * p));
}
function paymentHtml() {
  var P = run.payment;
  ui.payT0 = performance.now();
  var h = '<div class="dim" style="background:#14121a"></div><div class="dlg" style="width:680px"><h2>' + run.day + '일째 밤 · ' + stampNm(run.day) + ' 찍는 날</h2>';
  h += '<div class="quote">중개인 구 실장: "' + esc(P.quote) + '"</div>';
  if (P.pending) {   // 오늘 밤 안에 채우면 도장을 찍어요: 도구를 팔거나 심 씨에게 빌려요
    var shortNow = Math.max(0, P.amount - run.cash), L = Core.loanInfo(run);
    h += '<div style="font-size:20px;margin:12px 0">' + iconHtml('coins', 28) + ' <span class="px">' + fmt(run.cash) + '</span> / ' + stampNm(run.day) + ' ' + fmt(P.amount) + ' · ' + (shortNow > 0 ? '<span style="font-size:26px;font-weight:700;color:#e5484d">' + fmt(shortNow) + ' 모자라요</span>' : '<b class="acc">채웠어요</b>') + '</div>';
    if (CONFIG.features.toolSell && run.owned.length) {
      h += '<h3>' + esc(TEXT.short.sell) + ' <span class="note">심 씨가 상점 값의 ' + (Core.owns(run, 'regular') ? '75%' : '절반') + '에 사요</span></h3><div style="display:flex;gap:6px;flex-wrap:wrap">';
      run.owned.forEach(function (id) { var t = Core.TOOL_BY_ID[id], rm = Core.canRemove(run, id, false); h += '<button data-psell="' + id + '"' + (rm ? '' : ' disabled') + ' style="display:flex;align-items:center;gap:4px;padding:4px 8px">' + iconHtml('icons.' + t.icon, 18) + esc(t.short) + ' <span class="note">+' + fmt(Core.sellPrice(run, id)) + '</span></button>'; });
      h += '</div>';
    }
    if (L) h += '<div class="panel" style="padding:8px 12px;margin-top:12px">' + (L.ok ? '<div class="sub">상인 심 씨: "' + esc(TEXT.short.loanAsk.replace('{short}', fmt(L.short)).replace('{repay}', fmt(L.repay))) + '"</div><div style="text-align:right;margin-top:6px"><button id="oLoan">' + esc(TEXT.short.loan.replace('{short}', fmt(L.short)).replace('{repay}', fmt(L.repay))) + '</button></div>' : '<span class="note">' + esc(L.last ? TEXT.short.lastNo : L.used ? TEXT.short.loanUsed : '') + '</span>') + '</div>';
    h += '<div style="margin-top:14px;display:flex;justify-content:flex-end;gap:10px"><button id="oPay">' + TEXT.short.giveUp + '</button><button class="primary" id="oPayNow"' + (shortNow > 0 ? ' disabled' : '') + '>' + TEXT.short.payNow + '</button></div></div>';
    return h;
  }
  if (P.ok) h += '<div style="font-size:20px;margin:12px 0;display:flex;align-items:center;gap:10px">' + iconHtml('coins', 28) + ' <span class="px" id="pVault">' + fmt(P.before) + '</span> − ' + stampNm(run.day) + ' ' + fmt(P.amount) + ' = <b class="px acc">' + fmt(P.after) + '</b></div>';
  else h += '<div style="font-size:20px;margin:12px 0">' + iconHtml('coins', 28) + ' <span class="px">' + fmt(P.before) + '</span> / ' + stampNm(run.day) + ' ' + fmt(P.amount) + ' · <span id="pShort" style="font-size:28px;font-weight:700;color:#e5484d">' + fmt(P.short) + ' 모자라요</span></div>';
  h += '<div style="position:relative">' + deedHtml(run.stamps, P.ok) + (P.ok ? '' : '<div class="voidLine" style="top:39%;animation-delay:1100ms"></div><div class="voidLine" style="top:62%;animation-delay:1250ms"></div><div class="voidLine" style="top:85%;animation-delay:1400ms"></div>') + '</div>';
  if (P.ok && P.next) {
    h += '<div class="fadein" style="animation-delay:2100ms;margin-top:12px;font-size:16px;line-height:24px"><b class="acc">' + esc(P.fixed[0]) + '</b><br>' + esc(P.fixed[1]) + ' <span class="muted">(' + (P.next.day - run.day) + '일 뒤)</span>' + (P.fixed[2] ? '<br><span class="warnTxt">' + esc(P.fixed[2]) + '</span>' : '') + '</div>';
    if (P.next.mutations.length) {
      h += '<div class="fadein" style="animation-delay:2300ms;font-size:14px;margin-top:6px">' + P.next.day + '일째 광산 변덕 ' + (P.next.mutations.length === 1 ? '하나' : '두 가지') + '</div>';
      P.next.mutations.forEach(function (m, i) { h += '<div class="panel fadein" style="animation-delay:' + (2400 + i * 200) + 'ms;padding:6px 10px;margin-top:4px;font-size:14px">' + iconHtml('muts.' + m, 20) + ' <b>' + MUTATIONS[m].name + '</b> · <span class="muted">구 실장:</span> "' + esc(MUTATIONS[m].warn) + '"</div>'; });
    }
  }
  h += '<div style="margin-top:14px;text-align:right"><button class="primary" id="oPay">' + (P.ok ? (!run.endless && run.day >= CONFIG.days ? '권리증 받기' : CONFIG.features.stampReward ? '도장 선물 고르기' : '상점으로') : '다음') + '</button></div></div>';
  return h;
}
function finalHtml() {
  var F = run.final, h;
  countRun(!!F.success);
  var hist = run.history, mx = Math.max.apply(null, hist.map(function (x) { return x.income; }).concat([1]));
  var chart = '<div class="chart">';
  for (var i = 0; i < Math.max(CONFIG.days, hist.length); i++) { var hi = hist[i], pay = !!Core.paymentFor(i + 1); chart += hi ? '<i class="' + (hi.collapsed ? 'col ' : '') + (pay ? 'pay' : '') + '" title="' + hi.day + '일째: ' + hi.income + '" style="height:' + Math.max(4, hi.income / mx * 86) + 'px"></i>' : '<i style="background:transparent' + (pay ? ';outline:1px dashed #5d5868' : '') + '"></i>'; }
  chart += '</div><div class="note">날마다 수입 (테두리 = 도장 찍는 날, 빗금 = 쓰러진 날)</div>';
  var st = '가장 깊이 간 층 지하 ' + run.stats.deepest + ' · 보물 ' + run.stats.treasures + ' · 발파 ' + run.stats.blasts + ' · 쓰러진 날 ' + run.stats.collapses + (CONFIG.features.perfect ? ' · 완벽한 층 ' + (run.stats.perfect || 0) : '');
  if (F.success) {
    if (!settings.bestBy) settings.bestBy = {};
    var bk = F.endless ? 'endless:' + (run.grade || 1) : bestKey(), fv = F.endless ? F.endless.day : F.score;   // 끝없는 갱은 버틴 날로 따로 겨뤄요
    var best = settings.bestBy[bk] || (bk === 'grade:1' ? settings.best || 0 : 0), isNew = fv > best;
    if (isNew) { settings.bestBy[bk] = fv; if (bk === 'grade:1') settings.best = fv; }
    var unlocked = !run.daily && !run.tutorial && (run.grade || 1) < 3 && (settings.gradeOpen || 1) <= (run.grade || 1) && !ui.unlockShown;
    if (!run.daily && (run.grade || 1) >= (settings.gradeOpen || 1) && (run.grade || 1) < 3) { settings.gradeOpen = (run.grade || 1) + 1; }
    if (unlocked) ui.unlockShown = true;
    saveSettings();
    var mini = '<div class="deedCard" style="display:flex;gap:14px;align-items:center;padding:10px 16px;flex-wrap:wrap"><b>' + gradeName(run.grade) + ' 권리증</b>' + Core.payments(run).map(function (p, i) { return '<span style="display:flex;align-items:center;gap:6px"><span class="stamp" style="width:34px;height:34px;font-size:11px">도장</span>' + Core.stampNames(run)[i] + '</span>'; }).join('') + '</div>';
    var EN = F.endless;
    h = '<div class="dim" style="background:#14121a"></div><div class="dlg" style="width:800px"><h2>' + (EN ? esc(TEXT.endless.title.replace('{day}', EN.day)) : '15일째 · 그믐 · 마지막 도장을 찍었어요. ' + gradeName(run.grade) + '은 이제 내 거예요') + '</h2>' + (EN ? '<div class="sub">' + esc(TEXT.endless.sub.replace('{n}', EN.stamps)) + (run.payment && run.payment.quote ? ' · 중개인 구 실장: "' + esc(run.payment.quote) + '"' : '') + '</div>' : mini) +
      (EN ? '<div style="font-size:20px;margin:14px 0">버틴 날 <b class="px acc" style="font-size:26px">' + EN.day + '</b>일째 <span class="sub" style="font-size:14px">남긴 돈 ' + fmt(F.score) + '</span></div>' : '<div style="font-size:20px;margin:14px 0">남긴 돈 (이번 판 점수) <b class="px acc" style="font-size:26px">' + fmt(F.score) + '</b></div>') +
      '<div class="sub">' + (run.daily ? TEXT.daily + ' ' + run.daily + ' · ' : '') + (best ? (EN ? '이 광산 끝없는 갱 최고 ' + best + '일째' : '이 광산 최고 점수 ' + fmt(best)) + (isNew ? ' → <span class="acc">새 기록</span>' : '') : '이 광산 첫 기록') + '</div>' +
      (unlocked ? '<div class="panel" style="padding:6px 12px;margin-top:8px;border-color:#a8781c"><b class="acc">' + gradeName((run.grade || 1) + 1) + '</b>이 열렸어요. 새 광맥 하나가 더 나오고 값이 올라요. 권리증 화면에서 골라요</div>' : '') + chart + '<div style="margin-top:6px;font-size:14px">' + st + '</div>' +
      '<div class="panel" style="padding:8px 12px;margin-top:10px"><div class="note">권리증 뒷면, 작은 글씨</div><div>' + esc(TEXT.deedBack) + '</div><div class="sub" style="margin-top:4px">중개인 구 실장: "' + esc(TEXT.deedNext) + '"</div></div>' +
      unlockBlock() +
      '<div class="note" style="margin-top:10px">' + seedLine() + ' <button id="oSeedCopy">' + esc(TEXT.seed.copy) + '</button></div>' +
      (!EN && !run.tutorial ? '<div class="quote" style="margin-top:10px">중개인 구 실장: "' + esc(TEXT.endless.ask) + '"</div>' : '') +
      '<div style="margin-top:14px;display:flex;justify-content:flex-end;gap:10px">' + (!EN && !run.tutorial ? '<button id="oEndless">' + esc(TEXT.endless.button) + '</button>' : '') + '<button class="primary" id="oAgain">같은 광산 다시</button></div></div>';
  } else {
    var paid = Core.payments(run).slice(0, run.stamps).map(function (p, i) { return Core.stampNames(run)[i] + ' ' + fmt(p.amount); }).join(', ') || '없어요';
    h = '<div class="dim" style="background:#0b0a10"></div><div class="dlg" style="width:720px"><h2 style="color:#e5484d">계약 해지</h2>' +
      F.body.map(function (b) { return '<div class="quote">' + esc(b) + '</div>'; }).join('') +
      '<div style="font-size:24px;font-weight:700;color:#e5484d;margin:10px 0">' + fmt(F.short) + ' 모자랐어요</div>' +
      (F.compare ? '<div style="font-size:15px;margin-bottom:6px">' + esc(F.compare) + '</div>' : '') +
      '<h3>이번 판 기록</h3><div style="font-size:14px">낸 돈: ' + paid + '<br>' + st + '</div>' + chart +
      unlockBlock() +
      '<div class="note" style="margin-top:10px">' + seedLine() + ' <button id="oSeedCopy">' + esc(TEXT.seed.copy) + '</button></div>' +
      '<div style="margin-top:14px;text-align:right"><button class="primary" id="oAgain">다시 계약하기</button></div></div>';
  }
  ui.finalAt = performance.now();
  return h;
}
function shopHtml(merchant) {
  var S = merchant ? run.room : run.shop, np = Core.nextPayment(run), G = Core.goalInfo(run);
  var eve = !merchant && np && np.day === run.day + 1;
  var h = '<div class="dim" style="' + (merchant ? '' : 'background:#14121a') + '"></div><div class="dlg" style="width:1080px;height:660px;display:flex;flex-direction:column;padding:14px 22px;' + (eve ? 'border-color:#c4432b' : '') + '">';
  h += '<div style="display:flex;justify-content:space-between;align-items:baseline"><h2 style="margin-bottom:4px">' + (merchant ? '상인 방 · 광산 안 (산 도구는 바로 효과)' : '지상 · ' + run.day + '일째 밤 · 상인 심 씨') + (eve ? ' <span class="badge">내일 도장 찍는 날</span>' : '') + '</h2><div style="font-size:16px">' + iconHtml('coins', 20) + ' 금고 <b class="px acc">' + fmt(run.cash) + '</b></div></div>';
  h += '<div style="font-size:15px;margin-bottom:4px">' + goalLine(run) + '</div>';
  h += '<div class="sub" style="font-size:14px;margin-bottom:8px">상인 심 씨: "' + esc(merchant ? '금고 돈으로만 받아. 산 도구는 지금부터 효과가 나.' : TEXT.shopTalk[run.day % TEXT.shopTalk.length]) + '"</div>';
  h += '<div style="display:flex;gap:16px;flex:1;min-height:0"><div style="flex:1.6;display:flex;flex-direction:column;gap:6px">';
  S.stock.forEach(function (id, i) {
    if (!id) { h += '<div class="card panel sold"><div class="t muted">빈 자리</div></div>'; return; }
    var t = Core.TOOL_BY_ID[id];
    if (S.sold[i]) { h += '<div class="card panel sold"><div class="ic">' + iconHtml('icons.' + t.icon, 30) + '</div><div class="t"><div class="n">' + esc(tName(id)) + '</div><div class="d">팔렸어요</div></div></div>'; return; }
    var pr = Core.priceOf(run, id, merchant), can = run.cash >= pr, left = run.cash - pr;
    var short = np ? Math.max(0, np.amount - left) : 0;
    var warn = np && np.day === run.day + (merchant ? 0 : 1) && left < np.amount;
    h += '<div class="card panel' + (ui.shopSel === i ? ' sel' : '') + '" data-buy="' + i + '" data-tool="' + id + '" style="position:relative">' + '<div class="ic">' + iconHtml('icons.' + t.icon, 30) + '</div><div class="t"><div class="n' + (t.kind === 'passive' && !codex.seen[id] ? ' unknown' : '') + '">' + (t.kind === 'passive' ? tName(id) : t.name) +
      ' <span class="muted" style="font-size:12px;font-weight:400">' + axisName(t) + '</span></div><div class="d">' + esc(t.desc) + '</div>' +
      (can ? '<div class="note">사면 금고 ' + fmt(left) + (np ? ' · 다음 도장까지 ' + fmt(short) + (warn ? ' <span class="badge">모자라요</span>' : '') : '') + '</div>' : '') + '</div><div class="p"' + (can ? '' : ' style="color:#6f6880"') + '>' + fmt(pr) + '</div>' +
      '<button ' + (can ? '' : 'disabled') + ' data-buyb="' + i + '">사기</button></div>';
  });
  if (!merchant) h += '<div style="display:flex;gap:10px;align-items:center"><button id="oReroll" ' + (run.cash >= Core.rerollPrice(run) ? '' : 'disabled') + '>다른 물건 보기 ' + Core.rerollPrice(run) + '</button><span class="note">도구 세 자리만 바뀌어요</span></div>';
  else h += '<div style="display:flex;gap:10px;align-items:center"><button id="oService" ' + (!run.room.serviced && run.cash >= Core.servicePrice(run) ? '' : 'disabled') + '>촛불 손질 ' + Core.servicePrice(run) + ': 촛불 +' + CONFIG.shop.merchantService.candle + (run.room.serviced ? ' (했어요)' : '') + '</button><span class="note">지금 촛불 ' + run.d.candle + '</span></div>';
  var canSell = !merchant && (CONFIG.features.sellBack || CONFIG.features.toolSell) && (!run.tutorial || run.owned.length >= Core.slotsOf(run));   // 첫 판은 칸이 찼을 때만 팔기(reviews/16)
  h += '</div><div style="flex:1;display:flex;flex-direction:column;gap:5px;min-height:0"><div class="lbl" data-term="가진 도구">가진 도구 ' + run.owned.length + '/' + Core.slotsOf(run) + (!canSell ? '' : CONFIG.features.toolSell ? ' · 심 씨는 상점 값의 ' + (Core.owns(run, 'regular') ? '75%' : '절반') + '에 사요' : ' · 되팔면 산 값의 절반이에요') + '</div>';
  if (!merchant && S.fuse && S.fuse.length) S.fuse.forEach(function (fid) {   // 합치기: 재료 둘을 가진 밤
    var ft = Core.TOOL_BY_ID[fid], a = Core.TOOL_BY_ID[ft.fusion[0]], b = Core.TOOL_BY_ID[ft.fusion[1]];
    h += '<div class="panel" style="padding:8px 10px;border-color:#a8781c"><div class="sub" style="font-size:13px">구조꾼 곽 씨: "' + esc(TEXT.fuse.talk) + '"</div><div style="display:flex;align-items:center;gap:6px;margin-top:4px">' + iconHtml('icons.' + a.icon, 22) + '+' + iconHtml('icons.' + b.icon, 22) + '→' + iconHtml('icons.' + ft.icon, 26) +
      '<b style="flex:1"' + (codex.seen[fid] ? '' : ' class="unknown"') + '>' + esc(tName(fid)) + '</b><button class="primary" data-fuse="' + fid + '" data-tool="' + fid + '">' + TEXT.fuse.button + '</button></div><div class="d" style="font-size:12px;margin-top:2px">' + esc(ft.desc) + '</div></div>';
  });
  run.owned.forEach(function (id) {
    var t = Core.TOOL_BY_ID[id], rm = Core.canRemove(run, id, false);
    h += '<div class="card panel" style="padding:2px 8px;cursor:default;min-height:0;align-items:center" data-tool="' + id + '"><div class="ic" style="width:24px;height:24px">' + iconHtml('icons.' + t.icon, 20) + '</div><div class="t"><div class="n" style="font-size:13px">' + t.name + '</div></div>' +   // 효과는 마우스를 올리면 아래 설명 칸에
      (!canSell ? '' : '<button data-sell="' + id + '"' + (rm ? '' : ' disabled title="이걸 빼면 칸이 모자라요"') + '>' + (CONFIG.features.toolSell ? '팔기' : '되팔기') + ' +' + Core.sellPrice(run, id) + '</button>') + '</div>';
  });
  if (!run.owned.length) h += '<div class="note">아직 없어요</div>';
  h += '<div class="lbl" style="margin-top:6px" data-term="버튼으로 쓰는 것">버튼으로 쓰는 것</div><div class="note">' + [(CONFIG.features.probeBase || Core.owns(run, 'tapper') ? '두드려 보기' : '')].concat(run.cons.map(function (a) { return Core.TOOL_BY_ID[a.id].name + ' ×' + a.n; })).filter(Boolean).join(' · ') + (run.cons.length ? '' : (CONFIG.features.probeBase || Core.owns(run, 'tapper') ? ' · ' : '') + '한 번 쓰는 물건은 없어요') + '</div>';
  h += '<div class="panel" id="shopDesc" style="padding:8px 10px;margin-top:auto;min-height:80px;font-size:13px;line-height:18px"><span class="muted">물건에 마우스를 올리면 설명과 엮이는 도구가 보여요.</span></div></div></div>';
  h += '<div style="display:flex;justify-content:flex-end;gap:10px;align-items:center;margin-top:8px">' +
    (merchant ? '<button class="primary" id="oLeave">나가기: 지하 ' + run.room.next + '층(' + RULES[run.room.rule || 'plain'].name + ')</button>' : '<button class="primary" id="oDay">다음 날로</button>') + '</div></div>';
  return h;
}
function pauseHtml() {   // 설정(Esc 또는 오른쪽 위 톱니 단추). 화면 → 이번 판 → 기록 순으로 묶어요
  function tg(id, label, on, note) { return '<button id="' + id + '" style="display:flex;justify-content:space-between;align-items:center;gap:12px;text-align:left"><span>' + label + (note ? '<br><span class="note" style="font-weight:400">' + note + '</span>' : '') + '</span><span style="flex:none" class="' + (on ? 'acc' : 'muted') + '">' + (on ? '켬' : '끔') + '</span></button>'; }
  return '<div class="dim"></div><div class="dlg" style="width:540px"><h2>설정</h2>' +
    '<h3>조작과 화면</h3><div style="display:flex;flex-direction:column;gap:6px">' +
    tg('oAim', '조준', settings.aim, '켜면 한 번 눌러 고르고, 한 번 더 눌러 캐거나 터뜨려요. 끄면 한 번에 걸어가서 해요') + tg('oShake', '화면 흔들림', settings.shake) +
    tg('oFlash', '지뢰 플래시', settings.flash) +
    '<div class="note">키보드: Esc 설정 · Tab 가방 · R 올라가기 · Enter·Space 다음 화면 · 숫자 키로 카드 고르기</div></div>' +
    '<h3 style="margin-top:14px">이번 판</h3><div style="display:flex;gap:6px"><button id="oRestart" style="flex:1">새 판 시작</button><button id="oRestartTut" style="flex:1">첫 판 안내로 다시</button><button id="oGiveUp" style="flex:1">판 포기</button></div>' +
    '<h3 style="margin-top:14px">기록</h3><div class="note">' + esc(statsLine()) + (bestLine() ? '<br>' + esc(bestLine()) : '') + '<br>' + esc(playlogSummary()) + '</div>' +
    '<div style="display:flex;gap:6px;margin-top:6px"><button id="oLogGet" style="flex:1">플레이 기록 내려받기</button><button id="oLogClear" style="flex:1">플레이 기록 지우기</button><button id="oOpening" style="flex:1">오프닝 만화 다시 보기</button></div>' +
    '<div style="display:flex;gap:6px;margin-top:6px"><button id="oCodex" style="flex:1">도구 도감</button></div>' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px"><span class="note">' + esc(Core.charOf(run).name) + ' · ' + seedLine() + ' <button id="oSeedCopy">' + esc(TEXT.seed.copy) + '</button> · 규칙 ' + (CONFIG.preset === 'v21' ? '2차 기획 v2.1' : 'v2.2 시험') + (run.daily ? ' · ' + TEXT.daily + ' ' + run.daily : '') + '</span><span style="display:flex;gap:8px;flex:none"><button id="oTitle">타이틀로</button><button class="primary" id="oClose">계속하기</button></span></div></div>';
}
// ---------- 타이틀(reviews/17): 켤 때 한 번 지나가요. 메뉴는 쓸 일이 생기면 하나씩 늘어요 ----------
function showTitle() {
  if (run) saveRun();
  run = null; ui.title = true; ui.save = loadSave(); ui.sub = null; ui.opening = null;
  resetView(); clearBubbles();
  renderOverlay();
}
function saveLine(sv) {
  var r = sv.run, fv = r.d && r.d.floorsVisited && r.d.floorsVisited[r.d.floorsVisited.length - 1];
  var where = r.phase === 'mine' || r.phase === 'room' ? (fv ? '지하 ' + fv.depth + '층' : '갱 안') : r.phase === 'shop' || r.phase === 'settle' || r.phase === 'payment' ? '밤' : '아침';
  var goal = goalLine(r).replace(/<[^>]+>/g, '');
  return (r.tutorial ? '첫 판 · ' : '') + r.day + '일째 ' + where + (r.endless ? ' · ' + TEXT.endless.tag : '') + (goal ? ' · ' + goal : '');
}
function titleHtml() {
  var sv = ui.save, st = settings.stats || {}, fresh = !settings.tutorialDone && !sv;
  var h = '<div class="title"><canvas id="titleCv" width="320" height="180"></canvas><div class="tMenu"><div class="tName">원 캔들 딥</div><div class="tEn px">ONE CANDLE DEEP</div><div class="tBtns">';
  if (sv) h += '<button class="primary tBig" id="tCont">이어하기<span class="tSub">' + esc(saveLine(sv)) + '</span></button>';
  h += '<button id="tNew"' + (sv ? '' : ' class="primary tBig"') + '>' + (fresh ? '시작하기' : '새 판') + '</button>';
  if (st.plays || Object.keys(codex.seen).length) h += '<button id="tCodex">도감</button>';
  if (settings.openingSeen) h += '<button id="tOpening">오프닝 다시 보기</button>';
  h += '</div>' + (st.plays ? '<div class="note tStat">' + esc(statsLine()) + (bestLine() ? '<br>' + esc(bestLine()) : '') + '</div>' : '') + '</div>' +
    '<div class="note tVer">2차 프로토타입 · 규칙 ' + (CONFIG.preset === 'v21' ? 'v2.1' : 'v2.2 시험') + '</div></div>';
  return h;
}
function titleNew() {
  var sv = ui.save;
  function go() { if (sv) run = sv.run; startNewRun(!settings.tutorialDone); }
  if (sv) askConfirm('이어하던 판(' + sv.run.day + '일째)을 버리고 새 판을 시작할까요? 버린 판은 진 판으로 세요.', go, { yes: '새 판 시작', no: '그만두기' });
  else go();
}
// 그림: 밤의 갱구와 촛불 하나. 판을 하며 열린 사람들이 갱구 앞에 하나씩 늘어요
var TITLE_STARS = (function () { var a = [], q = 7; for (var i = 0; i < 46; i++) { q = (q * 1103515245 + 12345) >>> 0; var x = (q >>> 8) % 320; q = (q * 1103515245 + 12345) >>> 0; a.push([x, (q >>> 8) % 92, i]); } return a; })();
function pxCircle(g, cx, cy, r) { for (var dy = -r; dy <= r; dy++) { var w = Math.floor(Math.sqrt(r * r - dy * dy)); g.fillRect(cx - w, cy + dy, w * 2 + 1, 1); } }
function drawTitle(now) {
  var cv = $('titleCv'); if (!cv) return;
  var g = cv.getContext('2d'), t = now / 1000, x, y, i;
  var SKY = ['#0b0a10', '#0e0c14', '#121018', '#17141e'];
  for (i = 0; i < 4; i++) rc(g, SKY[i], 0, i * 30, 320, 30);
  for (i = 1; i < 4; i++) for (x = i % 2; x < 320; x += 2) rc(g, SKY[i], x, i * 30 - 1, 1, 1);
  TITLE_STARS.forEach(function (st) { var tw = Math.sin(t * 0.7 + st[2] * 1.7) > 0.75; rc(g, tw ? '#a59fb3' : st[2] % 3 ? '#3a3542' : '#5d5868', st[0], st[1], 1, 1); });
  for (x = 0; x < 320; x++) { y = 102 + Math.round(6 * Math.sin(x / 23) + 3 * Math.sin(x / 9 + 1)); rc(g, '#141119', x, y, 1, 132 - y); }   // 먼 산
  for (x = 150; x < 320; x++) { y = x < 236 ? Math.round(132 - (x - 150) * 0.72) : Math.round(70 + (x - 236) * 0.1); rc(g, '#1f1b26', x, y, 1, 132 - y); }   // 갱구가 난 언덕
  [[176, 118], [196, 104], [268, 92], [292, 110], [304, 84], [262, 120], [184, 126]].forEach(function (q) { rc(g, '#29243a', q[0], q[1], 3, 1); rc(g, '#17141e', q[0], q[1] + 1, 3, 1); });
  rc(g, '#1d1a24', 0, 132, 320, 48); rc(g, '#2a2633', 0, 132, 320, 1);
  for (y = 136; y < 180; y += 7) { var l0 = Math.round(220 - (y - 132) * 0.5), r0 = Math.round(242 + (y - 132) * 0.5); rc(g, '#2a2018', l0 - 2, y, r0 - l0 + 5, 2); }   // 침목
  for (y = 132; y < 180; y++) { rc(g, '#3a3542', Math.round(220 - (y - 132) * 0.5), y, 1, 1); rc(g, '#3a3542', Math.round(242 + (y - 132) * 0.5), y, 1, 1); }   // 레일
  rc(g, '#0b0a10', 213, 93, 36, 39);   // 갱구 안
  rc(g, '#5a3d28', 208, 93, 5, 39); rc(g, '#3d2a1c', 212, 93, 1, 39); rc(g, '#5a3d28', 249, 93, 5, 39); rc(g, '#3d2a1c', 253, 93, 1, 39);
  rc(g, '#5a3d28', 204, 88, 54, 5); rc(g, '#3d2a1c', 204, 92, 54, 1); rc(g, '#7a5538', 204, 88, 54, 1);
  var fl = Math.floor(now / 90), n = Math.sin(fl * 12.9898) * 43758.5453; n -= Math.floor(n);   // 불꽃은 90 ms마다 한 번 떨려요
  var R = 50 + Math.round(n * 3 - 1);
  g.fillStyle = 'rgba(255,190,110,0.022)'; [1, 0.84, 0.69, 0.55, 0.42, 0.3, 0.19].forEach(function (k) { pxCircle(g, 228, 118, Math.round(R * k)); });   // 빛은 겹겹이 옅게
  openChars().forEach(function (id, k) { var sp = SPR.minerBy[id]; if (sp) g.drawImage(sp, 192 - k * 15, 132 - sp.height); });
  rc(g, '#34303f', 222, 128, 12, 4); rc(g, '#2a2633', 222, 131, 12, 1);   // 받침돌
  rc(g, '#efe7d6', 227, 121, 3, 7); rc(g, '#c9c3d6', 229, 121, 1, 7); rc(g, '#1a120b', 228, 120, 1, 1);
  var hgt = n > 0.66 ? 5 : n > 0.33 ? 4 : 3;
  rc(g, '#ff8a3d', 227, 120 - hgt, 3, hgt); rc(g, '#ffd25a', 228, 119 - hgt, 1, hgt); if (n > 0.5) rc(g, '#ff8a3d', 228, 118 - hgt, 1, 1);
  for (i = 0; i < 6; i++) { var ph = (t * 0.12 + i * 0.167) % 1; rc(g, 'rgba(255,210,90,' + (0.7 * (1 - ph)).toFixed(2) + ')', 228 + Math.round(Math.sin(t * 0.8 + i * 2.1) * 5), Math.round(113 - ph * 46), 1, 1); }   // 떠오르는 불티
}
// ---------- 오프닝 3컷 만화(R52, 02 6.12). 시안 A 팔레트의 단순한 픽셀 그림 ----------
function openingHtml() {
  var k = ui.opening, h = '<div class="dim" style="background:#0b0a10"></div><div class="dlg" style="width:1010px;border:none;background:transparent"><div style="display:flex;gap:16px;justify-content:center">';
  TEXT.opening.forEach(function (o, i) {
    var on = i <= k;
    h += '<div style="width:312px;opacity:' + (on ? 1 : 0.12) + ';transition:opacity 0.4s"><canvas class="opCv" data-i="' + i + '" width="104" height="78" style="width:312px;height:234px;image-rendering:pixelated;border:3px solid #34303f;display:block"></canvas>' +
      '<div style="min-height:72px;margin-top:8px;font-size:15px;line-height:22px;color:#f1ece2">' + (on ? (o.who ? '<b class="acc">' + esc(o.who) + '</b>: "' + esc(o.cap) + '"' : esc(o.cap)) : '') + '</div></div>';
  });
  h += '</div><div style="display:flex;justify-content:space-between;margin-top:10px"><span style="display:flex;gap:8px"><button id="oOpSkip">건너뛰기</button>' + (run && run.tutorial && !settings.openingSeen ? '<button id="oSkipTut">첫 판 안내 건너뛰기</button>' : '') + '</span><button class="primary" id="oOpNext">' + (k >= 2 ? '시작하기' : '다음') + '</button></div></div>';
  return h;
}
function drawOpening() {
  var cs = OV.querySelectorAll('.opCv');
  for (var i = 0; i < cs.length; i++) { var g = cs[i].getContext('2d'); g.imageSmoothingEnabled = false; OPENING_ART[i](g); }
}
function rc(g, c, x, y, w, h) { g.fillStyle = c; g.fillRect(x, y, w, h); }
function opPerson(g, x, y, coat, hat) {   // 작은 사람(머리 4, 몸 6×9)
  rc(g, '#e8c9a0', x + 1, y, 4, 4); if (hat) rc(g, hat, x, y - 1, 6, 2);
  rc(g, coat, x, y + 4, 6, 9); rc(g, '#1d1a24', x + 1, y + 13, 2, 4); rc(g, '#1d1a24', x + 4, y + 13, 2, 4);
}
var OPENING_ART = [
  function (g) {   // 1: 비 오는 골목 게시판, 한 장만 값이 한 자리
    rc(g, '#14121a', 0, 0, 104, 78);
    for (var y = 0; y < 60; y += 6) for (var x = (y / 6) % 2 ? 0 : 6; x < 104; x += 12) rc(g, '#1d1a24', x, y, 11, 5);
    rc(g, '#2a2633', 0, 60, 104, 18); rc(g, '#34303f', 0, 60, 104, 1);
    rc(g, '#5a3d28', 14, 10, 62, 40); rc(g, '#3d2a1c', 16, 12, 58, 36);
    [[19, 15], [33, 14], [47, 16], [61, 15], [20, 31], [48, 32], [62, 31]].forEach(function (q) { rc(g, '#a59fb3', q[0], q[1], 10, 13); rc(g, '#5d5868', q[0] + 2, q[1] + 3, 6, 1); rc(g, '#5d5868', q[0] + 2, q[1] + 6, 5, 1); rc(g, '#5d5868', q[0] + 2, q[1] + 9, 6, 1); });
    rc(g, '#efe7d6', 33, 30, 12, 15); rc(g, '#c4432b', 35, 32, 8, 2); rc(g, '#5d5868', 35, 36, 7, 1); rc(g, '#ffd25a', 37, 39, 3, 4);   // 값이 한 자리인 전단
    opPerson(g, 70, 46, '#5a3d28', '#3a3542');
    g.fillStyle = 'rgba(165,159,179,0.55)'; for (var i = 0; i < 40; i++) g.fillRect((i * 37) % 104, (i * 23) % 70, 1, 4);
  },
  function (g) {   // 2: 달못 중개소 책상, 구 실장이 권리증을 내민다(빈 도장 칸 셋)
    rc(g, '#1d1a24', 0, 0, 104, 78); rc(g, '#2a2018', 0, 0, 104, 40);
    rc(g, '#3a3220', 70, 6, 24, 16); rc(g, '#ffd25a', 72, 8, 20, 12); rc(g, '#a8781c', 80, 8, 2, 12);
    opPerson(g, 44, 18, '#3a3542', null); rc(g, '#1a120b', 45, 17, 4, 2); rc(g, '#c4432b', 46, 23, 2, 4);
    rc(g, '#5a3d28', 6, 38, 92, 6); rc(g, '#3d2a1c', 6, 44, 92, 34);
    rc(g, '#efe7d6', 30, 30, 44, 12); rc(g, '#5a3d28', 32, 31, 20, 1);
    [36, 50, 64].forEach(function (x) { rc(g, '#c4432b', x - 3, 34, 7, 7); rc(g, '#efe7d6', x - 2, 35, 5, 5); });
    rc(g, '#e8c9a0', 26, 32, 5, 3);
  },
  function (g) {   // 3: 보름달 아래 갱구, 촛불 든 주인공과 옆 갱구의 곽 씨
    rc(g, '#14121a', 0, 0, 104, 78);
    rc(g, '#f1ece2', 76, 6, 14, 14); rc(g, '#f1ece2', 74, 9, 18, 8); rc(g, '#ffd25a', 80, 10, 4, 3);
    rc(g, '#2a2633', 0, 34, 104, 44); rc(g, '#34303f', 0, 34, 104, 2);
    rc(g, '#5a3d28', 30, 30, 4, 30); rc(g, '#5a3d28', 58, 30, 4, 30); rc(g, '#5a3d28', 28, 28, 36, 4); rc(g, '#0b0a10', 34, 32, 24, 28);
    rc(g, '#5a3d28', 80, 42, 3, 18); rc(g, '#5a3d28', 96, 42, 3, 18); rc(g, '#5a3d28', 79, 40, 21, 3); rc(g, '#0b0a10', 83, 43, 13, 17);
    opPerson(g, 42, 48, '#5a3d28', '#3a3542');
    g.fillStyle = 'rgba(255,200,120,0.25)'; g.fillRect(36, 42, 20, 18);
    rc(g, '#efe7d6', 49, 50, 2, 4); rc(g, '#ffd25a', 49, 48, 2, 2);
    rc(g, '#e8c9a0', 72, 52, 4, 4); rc(g, '#3a3542', 71, 56, 6, 6); rc(g, '#1d1a24', 71, 62, 8, 2);
  }
];
// 첫 판: 만화 뒤 곧장 판으로 들어갔으니, 첫 밤 정산 뒤 구 실장이 권리증을 건네요. 첫 도장만 또렷하게
function deedLateHtml() {
  return '<div class="dim" style="background:#14121a"></div><div class="dlg" style="width:640px"><div class="quote">중개인 구 실장: "' + esc(TEXT.firstRun.deedHand) + '"</div>' + deedHtml(0, false, true) +
    '<div class="note" style="margin-top:8px">' + esc(TEXT.firstRun.more) + '</div><div style="text-align:right;margin-top:12px"><button class="primary" id="oDeedTake">' + esc(TEXT.firstRun.deedTake) + '</button></div></div>';
}
function deedTake() { if (!run.deedLater || run.deedHanded) return; run.deedHanded = true; ui.shownAt = performance.now(); renderOverlay(); ui.hudDirty = true; }
function openingNext() { if (ui.opening == null) return; if (ui.opening >= 2) openingEnd(); else { ui.opening++; renderOverlay(); } }
function openingEnd() { var first = !settings.openingSeen; ui.opening = null; if (first) { settings.openingSeen = true; saveSettings(); } ui.shownAt = performance.now() - 2000;
  if (first && run.tutorial && run.phase === 'deed' && run.day === 1) { run.deedLater = true; beginDay(); return; }   // 첫 판은 만화 뒤 곧장 지하 1층. 권리증은 첫 밤에(reviews/16)
  renderOverlay(); ui.hudDirty = true; }
// 달력: 한 줄이 도장 하나까지의 날들이에요. 지난날은 번 돈, 오늘은 금빛, 도장 날은 동그라미(찍으면 붉은 도장)
function calHtml() {
  var P = Core.payments(run), S = CONFIG.stages, names = Core.stampNames(run), G = Core.goalInfo(run), start = 1, rows = '';
  var incOf = {}; run.history.forEach(function (x) { incOf[x.day] = x; });
  P.forEach(function (p, i) {
    var cells = '';
    for (var day = start; day <= p.day; day++) {
      var past = day < run.day, today = day === run.day, sd = day === p.day, done = sd && i < run.stamps, hx = incOf[day];
      var cls = 'cday' + (past ? ' past' : '') + (today ? ' today' : '') + (sd ? ' stampDay' : '') + (done ? ' stamped' : '');
      var inner = '<span class="n px">' + day + '</span>';
      if (hx) inner += hx.collapsed ? '<span class="inc bad">쓰러짐</span>' : '<span class="inc">+' + fmt(hx.income) + '</span>';
      else if (today) inner += '<span class="inc" style="color:#ffd25a">오늘</span>';
      cells += '<div class="' + cls + '">' + inner + '</div>';
    }
    var a = S[Math.min(i, S.length - 1)], b = S[Math.min(i + 1, S.length - 1)], fx = [];
    if (i === P.length - 1) fx.push('남은 금고가 이번 판 점수예요');
    else {
      if (b.valueMul !== a.valueMul) fx.push('다음 날부터 캔 값이 ×' + b.valueMul + '로 올라요');
      if (b.rowShift > a.rowShift) fx.push('다음 날부터 갱이 한 층 깊어져요');
      if (CONFIG.features.stampReward) fx.push('도장 선물을 하나 골라요');
    }
    var ck = CONFIG.chunks && CONFIG.chunks[p.day];
    if (ck) fx.push('그날 지하 ' + ck.depth + '층에 큰 덩이가 묻혀요');
    var st = i < run.stamps ? '<span style="color:#e5484d;font-weight:700">찍었어요</span>'
      : (G && G.day === p.day ? (G.left > 0 ? '<span class="warnTxt">' + fmt(G.left) + ' 모자라요</span>' : '<span class="acc">채웠어요</span>') : '');
    rows += '<div class="calRow">' + cells + '<div class="calSide"><span class="amt">' + esc(names[i] || ('도장 ' + (i + 1))) + ' ' + fmt(p.amount) + '</span> · ' + p.day + '일째' + (st ? ' · ' + st : '') +
      '<div class="note">' + esc(fx.join(' · ')) + '</div></div></div>';
    start = p.day + 1;
  });
  return '<div class="dim" id="oCalDim"></div><div class="dlg" style="width:760px"><div style="display:flex;align-items:baseline;gap:12px"><h2>달력</h2><span class="muted">' + run.day + '일째 · ' + (CONFIG.days - run.day + 1) + '일 남음</span></div>' +
    '<div class="note" style="margin-bottom:4px">한 줄이 도장 하나까지의 날들이에요. 동그라미가 도장 찍는 날이고, 그날 밤 금고에서 내요.</div>' + rows +
    '<div style="text-align:right;margin-top:12px"><button class="primary" id="oClose">닫기</button></div></div>';
}
function bagHtml() {
  var d = run.d, f = d && d.floor;
  var h = '<div class="dim" style="background:rgba(11,10,16,0.75)"></div><div class="dlg" style="width:620px"><h2>가방</h2>';
  if (f) h += '<h3>표지판</h3><div><b>' + RULES[f.rule].name + '</b> · ' + esc(RULES[f.rule].sign) + '<br><span class="note">' + esc(RULES[f.rule].help) + '</span></div>';
  if (run.gang) h += '<h3>오늘 갱 상태</h3><div>' + esc(run.gang.name) + ' · ' + esc(run.gang.desc) + '</div>';
  if (d && d.mutations.length) h += '<h3>오늘 광산 변덕</h3>' + d.mutations.map(function (m) { return '<div>' + MUTATIONS[m].name + ' · ' + MUTATIONS[m].today + '</div>'; }).join('');
  if (run.order) h += '<h3>주문</h3><div>' + esc(Core.ORDER_BY_ID[run.order.id].text) + ' (' + Math.min(run.order.prog, Core.ORDER_BY_ID[run.order.id].goal) + '/' + Core.ORDER_BY_ID[run.order.id].goal + ')</div>';
  h += '<h3>가진 도구</h3>' + (run.owned.length ? run.owned.map(function (id) { var t = Core.TOOL_BY_ID[id]; return '<div style="font-size:14px;margin:3px 0"><b>' + t.name + '</b> <span class="note">' + esc(t.desc) + '</span></div>'; }).join('') : '<div class="note">없음</div>');
  return h + '<div style="text-align:right;margin-top:12px"><button class="primary" id="oClose">닫기</button></div></div>';
}
function bindOverlay() {
  function on(id, fn) { var e = document.getElementById(id); if (e) e.onclick = function (ev) { ev.stopPropagation(); fn(); }; }
  on('oGoDeed', deedGo); on('oSkipTut', function () { settings.tutorialDone = true; saveSettings(); startNewRun(false); });
  on('oTut', function () { startNewRun(true); });
  on('oGoBoard', boardGo);
  on('oGo', function () { forkGo(ui.sel); }); on('oStay', function () { ui.sub = null; renderOverlay(); });
  on('oHp', function () { Core.springChoose(run, 'hp'); afterAction(); }); on('oCd', function () { Core.springChoose(run, 'candle'); afterAction(); });
  on('oNext', settleNext); on('oPay', payNext);
  on('oReroll', function () { Core.reroll(run); renderOverlay(); ui.hudDirty = true; });
  on('oDay', goNextDay); on('oLeave', function () { Core.leaveRoom(run); afterAction(); });
  on('oService', function () { Core.merchantService(run); drainFx(); renderOverlay(); });
  on('oAgain', function () { startNewRun(false, { grade: run.grade, daily: !!run.daily }); });
  on('oEndless', function () { if (Core.continueEndless(run).ok) { ui.shownAt = performance.now(); renderOverlay(); ui.hudDirty = true; } });
  on('oSeedCopy', function () { copySeed(this); });
  on('oSeed', function () { var sv = Core.parseSeed(($('seedIn') || {}).value); startNewRun(false, { seed: sv, grade: run.grade }); });
  on('oDaily', function () { startNewRun(false, { daily: true }); });
  on('oNormal', function () { startNewRun(false); });
  on('oGiftCash', function () { giftGo(-1); });
  OV.querySelectorAll('[data-char]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); if (run.phase !== 'deed' || run.d) return; run.char = b.getAttribute('data-char'); settings.char = run.char; saveSettings(); renderOverlay(); ui.hudDirty = true; }; });
  OV.querySelectorAll('[data-grade]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); settings.grade = +b.getAttribute('data-grade'); saveSettings(); startNewRun(false, { grade: settings.grade }); }; });
  on('oAim', function () { settings.aim = !settings.aim; ui.aim = null; saveSettings(); renderOverlay(); });
  on('oOpening', function () { ui.sub = null; ui.opening = 0; renderOverlay(); });
  on('oLogGet', playlogDownload);
  on('oLogClear', function () { askConfirm('기록된 하루 ' + playlogLoad().length + '개를 지울까요? 되돌릴 수 없어요', function () { playlogSave([]); ui.sub = 'pause'; renderOverlay(); }, { yes: '지우기', no: '그대로 두기' }); });
  on('oDeedTake', deedTake);
  on('oOpSkip', function () { openingEnd(); }); on('oOpNext', function () { openingNext(); });
  on('oShake', function () { settings.shake = !settings.shake; saveSettings(); renderOverlay(); });
  on('oFlash', function () { settings.flash = !settings.flash; saveSettings(); renderOverlay(); });
  on('oRestart', function () { askConfirm('지금 판을 버리고 새 판을 시작할까요?', function () { startNewRun(false); }); });
  on('oRestartTut', function () { askConfirm('첫 판 안내(정해진 층)로 새로 시작할까요?', function () { startNewRun(true); }); });
  on('oGiveUp', function () { askConfirm('판을 포기할까요? 계약 해지가 돼요.', function () { ui.sub = null; run.payment = { short: Math.max(0, (Core.nextPayment(run) || { amount: 0 }).amount - run.cash) }; run.final = { success: false, score: 0, stamps: run.stamps, day: run.day, short: run.payment.short, body: ['판을 포기했어요. 갱구는 잠겼고 다음 보름에 다시 열려요.'] }; run.phase = 'final'; renderOverlay(); }); });
  on('oClose', function () { ui.sub = null; renderOverlay(); });
  on('oTitle', showTitle);
  on('tCont', function () { var sv = loadSave(); if (sv) resumeRun(sv); else { ui.save = null; renderOverlay(); } });
  on('tNew', titleNew);
  on('tCodex', function () { ui.sub = 'codex'; renderOverlay(); });
  on('tOpening', function () { ui.opening = 0; renderOverlay(); });
  on('oCalDim', function () { ui.sub = null; renderOverlay(); });
  var q = OV.querySelectorAll('[data-order]');
  for (var i = 0; i < q.length; i++) q[i].onclick = function () { ui.sel = +this.dataset.order; renderOverlay(); };
  on('oGift', function () { giftGo(); });
  q = OV.querySelectorAll('[data-gift]');
  for (i = 0; i < q.length; i++) q[i].onclick = function () { ui.sel = +this.dataset.gift; renderOverlay(); };
  q = OV.querySelectorAll('[data-fork]');
  for (i = 0; i < q.length; i++) q[i].onclick = function () { forkGo(+this.dataset.fork); };
  q = OV.querySelectorAll('[data-buyb]');
  for (i = 0; i < q.length; i++) q[i].onclick = function (ev) { ev.stopPropagation(); buyTool(+this.dataset.buyb); };
  q = OV.querySelectorAll('[data-buy]');
  for (i = 0; i < q.length; i++) q[i].onclick = function () { buyTool(+this.dataset.buy); };
  q = OV.querySelectorAll('[data-sell]');
  for (i = 0; i < q.length; i++) q[i].onclick = function (ev) { ev.stopPropagation(); var sid = this.dataset.sell; askConfirm(Core.josa(Core.TOOL_BY_ID[sid].name, '을', '를') + ' 팔까요? 금고 +' + Core.sellPrice(run, sid), function () { Core.sellBack(run, sid); ui.hudDirty = true; renderOverlay(); }); };
  q = OV.querySelectorAll('[data-fuse]');
  for (i = 0; i < q.length; i++) q[i].onclick = function (ev) { ev.stopPropagation(); var fid = this.dataset.fuse; if (Core.fuse(run, fid).ok) { reveal([fid]); ui.slotPop[fid] = performance.now(); } ui.hudDirty = true; renderOverlay(); };
  q = OV.querySelectorAll('[data-boxpick]');
  for (i = 0; i < q.length; i++) q[i].onclick = function (ev) { ev.stopPropagation(); ui.boxSel = +this.dataset.boxpick; renderOverlay(); };
  q = OV.querySelectorAll('[data-boxdrop]');
  for (i = 0; i < q.length; i++) q[i].onclick = function (ev) { ev.stopPropagation(); ui.boxDrop = this.dataset.boxdrop; renderOverlay(); };
  on('oBoxTake', function () { boxGo(ui.boxSel || 0); }); on('oBoxPass', function () { boxGo(-1); });
  on('oCodex', function () { ui.sub = 'codex'; renderOverlay(); }); on('oCodexClose', function () { ui.sub = null; renderOverlay(); });
  q = OV.querySelectorAll('[data-psell]');   // 도장 날 모자랄 때 도구를 팔아 채우기
  for (i = 0; i < q.length; i++) q[i].onclick = function (ev) { ev.stopPropagation(); var sid = this.dataset.psell; askConfirm(Core.josa(Core.TOOL_BY_ID[sid].name, '을', '를') + ' 팔까요? 금고 +' + Core.sellPrice(run, sid), function () { Core.sellBack(run, sid); ui.hudDirty = true; renderOverlay(); }); };
  on('oLoan', function () { if (Core.takeLoan(run).ok) { ui.payT0 = performance.now(); renderOverlay(); ui.hudDirty = true; } });
  on('oPayNow', function () { if (Core.payNow(run).ok) { renderOverlay(); ui.hudDirty = true; } });
  q = OV.querySelectorAll('[data-tool]');
  for (i = 0; i < q.length; i++) q[i].onmouseenter = function () { var sd = $('shopDesc'); if (!sd) return; var t = Core.TOOL_BY_ID[this.dataset.tool]; sd.innerHTML = '<b class="acc">' + esc(t.kind === 'passive' ? tName(t.id) : t.name) + '</b> ' + '<span class="muted">' + axisName(t) + '</span>' + '<br>' + esc(t.desc) + synergyLine(t); };
}
function axisName(t) { return t.kind === 'consumable' ? '한 번 쓰는 물건' : TEXT.axisName[t.axis || ''] || TEXT.axisName['']; }   // 02 6.11: 화면에 '축'을 쓰지 않는다
function synergyLine(t) {
  var same = run.owned.filter(function (id) { var o = Core.TOOL_BY_ID[id]; return o.axis && o.axis === t.axis && id !== t.id; });
  var out = same.length ? '<br><span class="sub">엮임: 같은 ' + axisName(t) + ' ' + same.map(function (id) { return Core.TOOL_BY_ID[id].name; }).join(', ') + '</span>' : '';
  if (CONFIG.features.fusion && !run.tutorial) {   // 합쳐지는 재료: 만들어 본 적이 있으면 짝과 결과를, 없으면 귀띔만
    var fu = TOOLS.filter(function (q) { return q.fusion && q.fusion.indexOf(t.id) >= 0; })[0];
    if (fu) { var mate = Core.TOOL_BY_ID[fu.fusion[0] === t.id ? fu.fusion[1] : fu.fusion[0]]; out += '<br><span class="acc">' + esc(codex.seen[fu.id] ? TEXT.fuse.recipe.replace('{mate}', Core.josa(mate.name, '과', '와')).replace('{name}', fu.name) : TEXT.fuse.hint) + '</span>'; }
  }
  if (run.boxed && run.boxed[t.id] && run.owned.indexOf(t.id) >= 0) out += '<br><span class="note">' + esc(TEXT.fuse.old) + '</span>';
  return out;
}
// 옛 연장함: 캔 자리에서 둘 중 하나를 골라요. 칸이 가득이면 하나를 내려놓고(곽 씨가 4분의 1 값에 받아 감), 싫으면 통째로 곽 씨에게 넘겨요
function boxHtml() {
  if (run.boxOffer.keep) return keepHtml();
  var B = run.boxOffer, full = run.owned.length >= Core.slotsOf(run), pv = Core.boxPassValue(run);
  if (ui.boxSel == null || ui.boxSel >= B.opts.length) ui.boxSel = 0;
  if (ui.boxDrop && run.owned.indexOf(ui.boxDrop) < 0) ui.boxDrop = null;
  var h = '<div class="dim" style="background:rgba(11,10,16,0.78)"></div><div class="dlg" style="width:860px"><h2 style="display:flex;align-items:center;gap:8px">' + iconHtml('icons.box', 30) + esc(TEXT.box.title) + (B.scorch ? ' <span class="badge">그을림</span>' : '') + '</h2>';
  h += '<div class="quote">구조꾼 곽 씨: "' + esc(B.quote) + '"</div>';
  if (B.opts.length) {
    h += '<div style="display:flex;gap:14px;margin-top:10px">';
    B.opts.forEach(function (id, i) {
      var t = Core.TOOL_BY_ID[id];
      h += '<div class="fork panel' + (ui.boxSel === i ? ' sel' : '') + '" data-boxpick="' + i + '" data-tool="' + id + '" style="min-height:170px;position:relative">' + iconHtml('icons.' + t.icon, 40) +
        '<div class="nm' + (codex.seen[id] ? '' : ' unknown') + '">' + esc(tName(id)) + '</div><div class="note" style="margin-bottom:6px">' + axisName(t) + ' · ' + t.rarity + ' · 상점 값 ' + fmt(t.price) + '</div><div class="tx">' + esc(t.desc) + '</div>' + (CONFIG.features.fusion && !run.tutorial && isPart(id) ? '<div class="acc" style="font-size:12px;margin-top:6px">' + esc(TEXT.fuse.boxHint) + '</div>' : '') + '</div>';
    });
    h += '</div>';
  } else h += '<div class="note" style="margin-top:10px">쓸 만한 도구는 이미 다 가졌어요</div>';
  if (full && B.opts.length) {
    h += '<div class="note warnTxt" style="margin-top:12px">' + esc(TEXT.box.full) + '</div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">';
    run.owned.forEach(function (id) {
      var t = Core.TOOL_BY_ID[id], ok = Core.canRemove(run, id, true);
      h += '<button data-boxdrop="' + id + '" data-tool="' + id + '"' + (ok ? '' : ' disabled title="이걸 빼면 칸이 모자라요"') + ' class="' + (ui.boxDrop === id ? 'primary' : '') + '" style="display:flex;align-items:center;gap:4px;padding:4px 8px">' + iconHtml('icons.' + t.icon, 18) + esc(t.short) + ' <span class="note">+' + fmt(Core.toolValue(run, id, 'site')) + '</span></button>';
    });
    h += '</div>';
  }
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px"><span class="note">카드를 눌러 골라요. 돈은 오늘 주머니로 들어가요</span><span style="display:flex;gap:10px">' +
    '<button id="oBoxPass">' + esc((B.opts.length ? TEXT.box.pass : TEXT.box.passEmpty).replace('{n}', fmt(pv))) + '</button>' +
    (B.opts.length ? '<button class="primary" id="oBoxTake"' + (full && !ui.boxDrop ? ' disabled' : '') + '>' + (full ? '바꿔서 가져가기' : '가져가기') + '</button>' : '') + '</span></div></div>';
  return h;
}
function isPart(id) { return TOOLS.some(function (q) { return q.fusion && q.fusion.indexOf(id) >= 0; }); }
// 유품: 하나뿐이라 챙기거나 두고 가요
function keepHtml() {
  var B = run.boxOffer, k = Core.KEEP_BY_ID[B.keep];
  var h = '<div class="dim" style="background:rgba(11,10,16,0.78)"></div><div class="dlg" style="width:560px"><h2 style="display:flex;align-items:center;gap:8px">' + iconHtml('icons.box', 30) + esc(TEXT.keep.title) + '</h2>';
  h += '<div class="quote">구조꾼 곽 씨: "' + esc(B.quote) + '"</div>';
  h += '<div class="fork panel sel" style="min-height:150px;margin-top:10px;cursor:default">' + iconHtml('icons.' + k.icon, 44) + '<div class="nm' + (codex.seen[k.id] ? '' : ' unknown') + '">' + esc(kName(k.id)) + '</div><div class="tx">' + esc(k.desc) + '</div></div>';
  h += '<div class="note" style="margin-top:8px">' + esc(TEXT.keep.note) + '</div>';
  h += '<div style="display:flex;justify-content:flex-end;gap:10px;margin-top:14px"><button id="oBoxPass">' + esc(TEXT.keep.leave) + '</button><button class="primary" id="oBoxTake">' + esc(TEXT.keep.take) + '</button></div></div>';
  return h;
}
function boxGo(i) {
  if (performance.now() - ui.shownAt < 400) return;
  var id = i >= 0 ? (run.boxOffer.keep || run.boxOffer.opts[i]) : null, isKeep = !!run.boxOffer.keep;
  var r = Core.chooseBox(run, i, ui.boxDrop);
  if (!r.ok) { blinkEl('ov', 'x', 1); return; }
  ui.boxSel = 0; ui.boxDrop = null;
  if (id) { if (isKeep) ui.keepPop[id] = performance.now(); else ui.slotPop[id] = performance.now(); reveal([id]); }
  ui.shownAt = performance.now();
  afterAction(); renderOverlay(); ui.hudDirty = true;
}
// 도감: 처음엔 이름이 가려져 있고 얻으면 열려요. 합친 도구도 처음 만들 때 열려요
function codexHtml() {
  var all = TOOLS.filter(function (t) { return t.kind === 'passive' && (!t.sets || t.sets.indexOf(CONFIG.toolSet) >= 0); });
  var seenN = all.filter(function (t) { return codex.seen[t.id]; }).length;
  var h = '<div class="dim" style="background:rgba(11,10,16,0.85)"></div><div class="dlg" style="width:1000px;max-height:660px;overflow:auto"><div style="display:flex;justify-content:space-between;align-items:baseline"><h2>도구 도감</h2><span class="muted">' + seenN + ' / ' + all.length + '</span></div>';
  h += '<div class="note" style="margin-bottom:10px">한 번 얻은 도구는 이름과 효과가 열려요. 이 브라우저에 남아요</div><div class="codexGrid">';
  all.forEach(function (t) {
    var seen = !!codex.seen[t.id];
    h += '<div class="panel codexCell' + (seen ? '' : ' unseen') + '">' + iconHtml('icons.' + t.icon, 30) + '<div style="min-width:0"><div class="n">' + esc(tName(t.id)) + '</div>' +
      '<div class="note">' + (t.fusion ? '합친 도구' : axisName(t) + ' · ' + t.rarity) + '</div>' + (seen ? '<div class="d">' + esc(t.desc) + '</div>' : '<div class="d muted">' + (t.fusion ? '두 도구를 합치면 나와요. 하나는 연장함에서 나온 것이어야 해요' : '아직 못 얻었어요') + '</div>') + '</div></div>';
  });
  var KS = Core.KEEPSAKES, kSeen = KS.filter(function (k) { return codex.seen[k.id]; }).length;
  h += '</div><h3 style="margin-top:16px">유품 ' + kSeen + '/' + KS.length + '</h3><div class="note" style="margin-bottom:10px">' + esc(TEXT.keep.note) + '</div><div class="codexGrid">';
  KS.forEach(function (k) {
    var seen = !!codex.seen[k.id];
    h += '<div class="panel codexCell' + (seen ? '' : ' unseen') + '">' + iconHtml('icons.' + k.icon, 30) + '<div style="min-width:0"><div class="n">' + esc(kName(k.id)) + '</div><div class="note">유품</div>' + (seen ? '<div class="d">' + esc(k.desc) + '</div>' : '<div class="d muted">아직 못 얻었어요</div>') + '</div></div>';
  });
  h += '</div><div style="text-align:right;margin-top:12px"><button class="primary" id="oCodexClose">닫기</button></div></div>';
  return h;
}
function giftHtml() {
  var stampR = run.giftKind === 'stamp', full = run.owned.length >= Core.slotsOf(run);
  var h = '<div class="dim" style="background:#14121a"></div><div class="dlg" style="width:900px"><h2>' + (stampR ? TEXT.reward.title + ' · 도장 ' + run.stamps + '개' : TEXT.gift.title) + '</h2>';
  var q = stampR ? TEXT.reward.enter + ' ' + TEXT.reward.cashEnter.replace('{cash}', fmt(run.giftCash)) : run.tutorial ? TEXT.gift.enter : TEXT.gift.enter + ' ' + TEXT.gift.enter2;
  h += '<div class="quote">중개인 구 실장: "' + esc(q) + '"</div>' + (stampR && full ? '<div class="note" style="margin-top:6px">' + esc(TEXT.reward.full) + '</div>' : '') + '<div style="display:flex;gap:14px;margin-top:10px;' + (stampR && full ? 'opacity:0.45' : '') + '">';
  run.giftOpts.forEach(function (id, i) {
    var t = Core.TOOL_BY_ID[id];
    h += '<div class="fork panel' + (ui.sel === i ? ' sel' : '') + '" data-gift="' + i + '" style="min-height:210px;position:relative">' + iconHtml('icons.' + t.icon, 40) +
      '<div class="nm' + (codex.seen[id] ? '' : ' unknown') + '">' + esc(tName(id)) + '</div><div class="note" style="margin-bottom:6px">' + axisName(t) + ' · 상점 값 ' + fmt(t.price) + '</div><div class="tx">' + esc(t.desc) + '</div>' +
      '</div>';
  });
  h += '</div><div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px"><span class="note">카드를 클릭해서 골라요</span><span style="display:flex;gap:10px">' +
    (stampR ? '<button id="oGiftCash">' + esc(TEXT.reward.cash.replace('{cash}', fmt(run.giftCash))) + '</button>' : '') +
    (stampR && full ? '' : '<button class="primary" id="oGift">' + TEXT.gift.button + '</button>') + '</span></div></div>';
  return h;
}
function giftGo(i) {
  if (performance.now() - ui.shownAt < 500) return;
  var r = Core.chooseGift(run, i == null ? ui.sel : i);
  if (!r.ok) return;
  if (r.id) reveal([r.id]);
  ui.sel = 0; ui.shownAt = performance.now();
  if (run.phase === 'shop') { renderOverlay(); ui.hudDirty = true; return; }   // 도장 선물 → 상점
  ui.giftLine = '중개인 구 실장: "' + TEXT.gift.after + '" · 받은 도구: ' + Core.TOOL_BY_ID[r.id].name;
  if (run.phase === 'board') { renderOverlay(); ui.hudDirty = true; } else beginDay();
}
function deedGo() {
  if (performance.now() - ui.shownAt < 1200) return;
  if (Core.toGift(run)) { ui.sel = 0; ui.shownAt = performance.now(); renderOverlay(); return; }
  if (run.orders.length) { run.phase = 'board'; ui.sel = 0; ui.shownAt = performance.now(); renderOverlay(); }
  else beginDay();
}
function boardGo() { if (performance.now() - ui.shownAt < 800) return; Core.chooseOrder(run, ui.sel); beginDay(); }
function forkGo(i) {
  var d = run.d, f = d.floor, o = f.forkOptions[i];
  if (!o) return;
  ui.sel = i;
  var go = function () {
    var r = Core.descend(run, i);
    if (r.ok) { ui.sub = null; anim.pend = {}; if (o.kind === 'floor') ui.rulesSeen[o.rule] = true; }
    afterAction(); renderOverlay();
  };
  var leave = function () {   // 촛불이 모자라면 공개 없이 안내만
    if (d.candle < Core.travelCost(run, o.depth)) { go(); return; }
    ui.sub = null; renderOverlay(); startSweep(go);
  };
  if (f.chunk && !f.chunk.done && f.chunk.dug > 0) askConfirm(TEXT.chunk.leave.replace('{n}', f.chunk.total - f.chunk.dug), leave);
  else leave();
}
function buyTool(i) { var bid = run.shop && run.shop.stock[i]; var r = Core.buy(run, i); if (r.ok) { ui.hudDirty = true; if (bid && Core.TOOL_BY_ID[bid].kind === 'passive') reveal([bid]); } else if (r.poor) blinkEl('ov', 'x', 1); renderOverlay(); }
function settleNext() {
  var dlg = $('settleDlg');
  if (performance.now() - ui.settleT0 < ui.settleDur && dlg && !dlg.classList.contains('instant')) { dlg.classList.add('instant'); ui.settleT0 = -1e9; return; }
  Core.afterSettle(run); ui.shownAt = performance.now(); renderOverlay(); ui.hudDirty = true;
}
function payNext() {
  if (performance.now() - ui.payT0 < (run.payment && !run.payment.ok ? 600 : 300)) return;
  Core.afterPayment(run); ui.shownAt = performance.now();
  if (run.phase === 'final' && run.tutorial) { settings.tutorialDone = true; saveSettings(); }
  renderOverlay(); ui.hudDirty = true;
}
function goNextDay() {
  Core.nextDay(run);
  if (run.tutorial && run.day > 3) { settings.tutorialDone = true; saveSettings(); }
  ui.shownAt = performance.now(); ui.sel = 0; anim.pend = {}; anim.pops = []; ui.desc = null;
  renderOverlay(); ui.hudDirty = true;
}

// ---------- 화면 안 확인 창(브라우저 confirm 대신) ----------
var cmodalYes = null;
function askConfirm(msg, onYes, lab) { lab = lab || {}; $('cmodalMsg').textContent = msg; $('cmodalOk').textContent = lab.yes || '네'; $('cmodalNo').textContent = lab.no || '아니요'; cmodalYes = onYes; $('cmodal').style.display = 'flex'; }
function closeConfirm(ok) { $('cmodal').style.display = 'none'; var f = cmodalYes; cmodalYes = null; if (ok && f) f(); }
function confirmOpen() { return $('cmodal').style.display === 'flex'; }
$('cmodalNo').onclick = function (e) { e.stopPropagation(); closeConfirm(false); };
$('cmodalOk').onclick = function (e) { e.stopPropagation(); closeConfirm(true); };

// ---------- 행동 래퍼 ----------
function afterAction() {
  drainFx();
  saveRun();
  var ph = run.phase;
  if (ph !== 'mine') { ui.sub = null; ui.mode = null; }
  if (afterAction.lastPhase === 'mine' && ph === 'settle' && run.d && run.d.endReason !== 'return' && !ui.sweep) {   // 촛불이 다 타거나 쓰러짐: 공개 뒤에 정산 창
    afterAction.lastPhase = ph; ui.hudDirty = true;
    startSweep(function () { ui.shownAt = performance.now(); renderOverlay(); }, 300);
    if (ui.sweep) return;
  }
  if (ph !== afterAction.lastPhase || ph !== 'mine' || ui.sub) { if (ph === 'settle' || ph === 'room') ui.shownAt = performance.now(); renderOverlay(); }
  afterAction.lastPhase = ph;
  if (ph === 'mine' && run.tutorial) {   // 말풍선 6: X 칸이 처음 둘레 8칸에 들어온 순간(첫 판 끝까지 유효). 낙서 7은 Day 1~3
    var d = run.d, nx = Core.neighbors(d.floor, d.px, d.py).filter(function (c) { return c.cover !== 'open' && c.mark === 1; });
    if (nx.length) { bubble('xmark', TEXT.bubbles.xmark, { cell: { x: nx[0].x, y: nx[0].y } }); if (run.day <= 3) teachHere('x', TUTORIAL.b3Graffiti.x, { x: nx[0].x, y: nx[0].y }); }
    if (run.day <= 3 && d.candle <= 20 && d.candle > 0 && CONFIG.features.embers) teachHere('ember', TUTORIAL.b3Graffiti.o, { x: d.px, y: d.py });   // 낙서 8: 촛불이 처음 20 이하가 된 자리
  }
  if (ui.aim && run.d && Core.cellAt(run.d.floor, ui.aim.x, ui.aim.y).cover === 'open') ui.aim = null;
  ui.hudDirty = true;
}
// 처음 그 상황이 온 층에 낙서를 그린다(R38). 이미 그 낙서가 있는 층이면 그대로
function teachHere(key, text, near, extra) {
  if (!run.taught) run.taught = {};
  if (run.taught[key]) return;
  run.taught[key] = true;
  var f = run.d.floor;
  if (f.graffiti.some(function (g) { return g.taught === key; })) return;
  Core.placeGraffiti(f, text, near, Object.assign({ taught: key }, extra || {}), f);
}
function say(text, p) {   // 칸 위 짧은 안내 + 기록 창
  run.log.push({ text: text, id: ++run.logSeq });
  if (p) { var q = stageXY(p.x, p.y); addFly({ x: Math.max(160, Math.min(650, q.x)), y: q.y - 30, showAt: 0, flyAt: null, fadeAt: 1600, size: 13, rise: 8, color: '#f1ece2', steps: [{ t: 0, h: esc(text) }] }); anim.pops.push({ x: p.x, y: p.y, t0: performance.now(), kind: 'locked' }); }
  ui.hudDirty = true;
}
function noPath(p) { say(TEXT.ops.noPath, p); }
function openFork() {
  if (run.phase !== 'mine' || ui.sweep) return;
  var fs = run.d.floor.stair;
  if (fs && fs.blocked && fs.found) { say('계단이 막혀 있어요. 오늘은 여기까지예요. 촛불을 다 쓰거나 올라가기를 누르세요.'); return; }
  if (!Core.onStair(run)) { say('계단 위에 올라서서 계단을 한 번 더 클릭하세요.'); return; }
  if (run.d.embersOn) { say('불씨로는 계단을 내려갈 수 없어요.'); return; }
  ui.mode = null; ui.sub = 'fork'; ui.sel = 0; renderOverlay();
}
// 올라가기(R53): 버튼 → 확인 창
function askReturn() {
  if (ui.sweep || !run || (run.phase !== 'mine' && run.phase !== 'room')) return;
  var d = run.d;
  var msg = d.embersOn ? '버리는 불씨 ' + d.embers + ' · 금고로 가는 주머니 ' + fmt(d.pocket) : TEXT.ops.returnAsk.replace('{c}', d.candle).replace('{p}', fmt(d.pocket));
  askConfirm(msg, function () { var up = function () { if (run.phase === 'mine' || run.phase === 'room') { Core.returnUp(run); afterAction(); } }; if (run.phase === 'mine') startSweep(up); else up(); }, { yes: '올라가기', no: '계속 파기' });
}
// 고르기 상태(R53): 두드려 보기·소모품
function modeOk(kind) {
  var d = run.d; if (!d || run.phase !== 'mine') return false;
  if (kind === 'probe') return d.probes > 0 && d.candle >= CONFIG.probeCost && !d.embersOn;
  return true;
}
function toggleMode(kind, slot) {
  if (!run || run.phase !== 'mine' || ui.sub || ui.sweep) return;
  if (ui.mode && ui.mode.kind === kind && ui.mode.slot === slot) { ui.mode = null; ui.hudDirty = true; return; }
  var d = run.d;
  if (kind === 'cons') {
    var a = run.cons[slot]; if (!a) return;
    if (a.id === 'match') { Core.useCons(run, slot); afterAction(); return; }   // 성냥은 칸 없이 바로
    if (d.embersOn) { say(TEXT.ember.noFire); return; }
  } else if (!modeOk(kind)) { say(d.embersOn ? '불씨로는 두드려 볼 수 없어요.' : d.probes <= 0 ? '오늘은 더 두드려 볼 수 없어요.' : '촛불이 모자라요. 두드려 보기는 촛불 2.'); return; }
  if (kind === 'cons' && !d.floor.cells.some(function (c) { return c.cover !== 'open' && c.mark === 1; })) { say(TEXT.ops.noX); return; }
  ui.mode = { kind: kind, slot: slot }; ui.aim = null; ui.hudDirty = true;
}
function modeClick(p) {
  var d = run.d, f = d.floor, c = Core.cellAt(f, p.x, p.y), m = ui.mode;
  if (c.cover === 'open') { say(m.kind === 'probe' ? '덮인 칸을 클릭하세요.' : TEXT.ops.needX, p); return; }
  if (m.kind !== 'probe' && c.mark !== 1) { say(TEXT.ops.needX, p); return; }
  if (Core.cheb(d.px, d.py, p.x, p.y) !== 1) { var ra = Core.approach(run, p.x, p.y); if (!ra.ok) { noPath(p); return; } }   // 떨어진 칸이면 옆까지 걸어가서 쓴다(01 2.4)
  var r = m.kind === 'probe' ? Core.probe(run, p.x, p.y) : Core.useCons(run, m.slot, p.x, p.y);
  if (r.ok) ui.mode = null;
  afterAction();
}
// 왼쪽 클릭(R92): 떨어진 바위·X → 옆으로 가서 조준, 옆 칸 → 바위는 캐기, X는 발파. 설정 '조준'을 켜면 옆 칸도 한 번은 조준
function clickCell(p) {
  var d = run.d, f = d.floor, c = Core.cellAt(f, p.x, p.y);
  if (ui.mode) { modeClick(p); return; }
  if (c.cover !== 'open') {
    var adj = Core.cheb(d.px, d.py, p.x, p.y) === 1, aimedHere = ui.aim && ui.aim.x === p.x && ui.aim.y === p.y;
    if (!adj && !settings.aim) { var ra0 = Core.approach(run, p.x, p.y); if (!ra0.ok) { noPath(p); return; } adj = true; }   // R93: 조준이 꺼져 있으면 떨어진 칸도 걸어가서 바로
    if (adj && (aimedHere || !settings.aim)) {   // R92: 바위는 캐고, X 칸은 터뜨려요
      d.face = { dx: p.x - d.px, dy: p.y - d.py };
      var r = c.mark === 1 ? Core.ignite(run, p.x, p.y) : Core.hit(run, p.x, p.y); if (r.ok) ui.aim = null; afterAction(); return;
    }
    if (!adj) { var ra = Core.approach(run, p.x, p.y); if (!ra.ok) { noPath(p); return; } }
    else d.face = { dx: p.x - d.px, dy: p.y - d.py };
    ui.aim = { x: p.x, y: p.y }; afterAction(); return;
  }
  ui.aim = null;
  if (p.x === d.px && p.y === d.py) {
    if (f.stair && f.stair.found && f.stair.x === p.x && f.stair.y === p.y) { openFork(); return; }
    var ci = Core.chordInfo(run, p.x, p.y);
    if (ci) { if (ci.ready) { Core.chord(run, p.x, p.y); afterAction(); } else anim.pops.push({ x: p.x, y: p.y, t0: performance.now(), kind: 'nope' }); }   // 안 열리면 글 없이 칸만 흔들려요(R89)
    return;
  }
  if (!Core.walkable(f, c)) { noPath(p); return; }
  var isStair = f.stair && f.stair.found && f.stair.x === p.x && f.stair.y === p.y, ci2 = Core.chordInfo(run, p.x, p.y);
  var rt = Core.travelTo(run, p.x, p.y); if (!rt.ok) { noPath(p); return; }
  if (!settings.aim && d.px === p.x && d.py === p.y) {   // R94: 조준이 꺼져 있으면 걸어간 김에 바로
    if (isStair) { afterAction(); openFork(); return; }
    if (ci2 && ci2.ready) { Core.chord(run, p.x, p.y); afterAction(); return; }
  }
  afterAction();
}

// ---------- 입력 ----------
// 키보드(R93): 판 위 조작(이동·캐기·분필·발파)은 마우스로만. 키는 창 넘기기·고르기와 Esc·Tab·R만 남긴다
document.addEventListener('keydown', function (e) {
  var tg = e.target && e.target.tagName; if (tg === 'INPUT' || tg === 'TEXTAREA') { if (e.key === 'Enter' && e.target.id === 'seedIn') { e.preventDefault(); var sb = $('oSeed'); if (sb) sb.click(); } return; }   // 시드 칸에 글을 쓰는 동안은 단축키를 쓰지 않아요
  if (ui.sweep) { e.preventDefault(); if (!e.repeat) endSweep(); return; }
  if (confirmOpen()) { if (e.key === 'Escape') { e.preventDefault(); closeConfirm(false); } else if (e.key === 'Enter') { e.preventDefault(); closeConfirm(true); } return; }
  var code = e.code;
  if (['F2', 'F3', 'F4', 'F8', 'F9', 'Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].indexOf(code) >= 0) e.preventDefault();
  if (ui.title && !run) {   // 타이틀: Enter·Space는 맨 위 단추, Esc는 도감·만화를 닫아요
    if (ui.opening != null) { if (code === 'Enter' || code === 'Space') openingNext(); else if (code === 'Escape') openingEnd(); return; }
    if (ui.sub === 'codex') { if (code === 'Escape') { ui.sub = null; renderOverlay(); } return; }
    if ((code === 'Enter' || code === 'Space') && !e.repeat) { var tb = $(ui.save ? 'tCont' : 'tNew'); if (tb) tb.click(); }
    return;
  }
  if (!run) return;
  if (['ShiftLeft', 'ShiftRight', 'ControlLeft', 'AltLeft', 'MetaLeft'].indexOf(code) < 0 && !e.repeat) flushAll();   // 연출 건너뛰기
  // 디버그(개발용)
  if (code === 'F2') { ui.debugReveal = !ui.debugReveal; return; }
  if (code === 'F3') { Core.debugFillCandle(run); ui.hudDirty = true; return; }
  if (code === 'F4') { run.cash += 500; ui.hudDirty = true; if (run.phase === 'shop' || run.phase === 'room' || run.phase === 'board') renderOverlay(); return; }
  if (code === 'F8') { Core.debugEndDay(run); afterAction(); return; }
  if (code === 'F9') { Core.debugSkipDay(run); ui.sub = null; ui.opening = null; ui.shownAt = 0; run.fx = []; hideBubble(); renderOverlay(); ui.hudDirty = true; return; }
  var p = run.phase;
  if (code === 'Escape') {   // 설정은 Esc로 연다
    if (ui.mode) { ui.mode = null; ui.hudDirty = true; return; }
    if (ui.sub === 'fork' || ui.sub === 'pause' || ui.sub === 'bag' || ui.sub === 'cal') { ui.sub = null; renderOverlay(); return; }
    if (p === 'mine') { ui.sub = 'pause'; renderOverlay(); }
    return;
  }
  if (ui.opening != null) { if (code === 'Enter' || code === 'Space') openingNext(); return; }
  if (p === 'deed') { if (code === 'Enter' || code === 'Space') deedGo(); return; }
  if (p === 'gift') {
    var gm = /^Digit([1-3])$/.exec(code);
    if (gm) { ui.sel = +gm[1] - 1; renderOverlay(); }
    if (code === 'ArrowLeft' || code === 'KeyA') { ui.sel = Math.max(0, ui.sel - 1); renderOverlay(); }
    if (code === 'ArrowRight' || code === 'KeyD') { ui.sel = Math.min(run.giftOpts.length - 1, ui.sel + 1); renderOverlay(); }
    if (code === 'Enter' || code === 'Space') giftGo();
    return;
  }
  if (p === 'board') {
    if (code === 'ArrowLeft' || code === 'Digit1' || code === 'KeyA') { ui.sel = 0; renderOverlay(); }
    if (code === 'ArrowRight' || code === 'Digit2' || code === 'KeyD') { ui.sel = Math.min(run.orders.length - 1, 1); renderOverlay(); }
    if (code === 'Enter' || code === 'Space') boardGo();
    return;
  }
  if (p === 'settle') { if (!e.repeat && (code === 'Enter' || code === 'Space')) settleNext(); return; }
  if (p === 'payment') { if (!e.repeat && (code === 'Enter' || code === 'Space')) payNext(); return; }
  if (p === 'final') { if ((code === 'Enter') && performance.now() - ui.finalAt > 600) startNewRun(false); return; }
  if (p === 'shop' || (p === 'room' && run.room.kind === 'merchant')) {
    if (code === 'Enter') { if (p === 'shop' && run.deedLater && !run.deedHanded) deedTake(); else if (p === 'shop') goNextDay(); else { Core.leaveRoom(run); afterAction(); } }
    var m = /^Digit([1-9])$/.exec(code);
    if (m) buyTool(+m[1] - 1);
    return;
  }
  if (p === 'room') { if (code === 'Digit1') { Core.springChoose(run, 'hp'); afterAction(); } if (code === 'Digit2') { Core.springChoose(run, 'candle'); afterAction(); } return; }
  if (ui.sub === 'fork') {
    if (code === 'ArrowLeft' || code === 'KeyA') { ui.sel = 0; renderOverlay(); }
    else if (code === 'ArrowRight' || code === 'KeyD') { ui.sel = 1; renderOverlay(); }
    else if (code === 'Digit1') forkGo(0); else if (code === 'Digit2') forkGo(1);
    else if (code === 'Enter') forkGo(ui.sel);
    return;
  }
  if (ui.sub === 'bag') { if (code === 'Tab') { ui.sub = null; renderOverlay(); } return; }
  if (ui.sub) return;
  if (code === 'Tab') { ui.sub = 'bag'; renderOverlay(); return; }
  if (code === 'KeyR' && !e.repeat) askReturn();
});
OV.addEventListener('click', function (e) {
  if (ui.sweep) { endSweep(); return; }
  if (!run && ui.opening != null && !e.target.closest('button')) { openingNext(); return; }
  if (!run || e.target.closest('button') || e.target.closest('[data-order]') || e.target.closest('[data-fork]') || e.target.closest('[data-buy]') || e.target.closest('[data-gift]')) return;
  flushAll();
  if (ui.opening != null) { openingNext(); return; }
  if (run.phase === 'settle') settleNext();
  else if (run.phase === 'payment') payNext();
});
function boardCell(e) {
  var r = board.getBoundingClientRect();
  var x = Math.floor((e.clientX - r.left) / r.width * BW), y = Math.floor((e.clientY - r.top) / r.height * BH);
  return x >= 0 && y >= 0 && x < BW && y < BH ? { x: x, y: y } : null;
}
board.addEventListener('mousemove', function (e) { var h = boardCell(e); if (!ui.hover || !h || h.x !== ui.hover.x || h.y !== ui.hover.y) ui.hudDirty = true; ui.hover = h; });
board.addEventListener('mouseleave', function () { ui.hover = null; ui.hudDirty = true; });
board.addEventListener('contextmenu', function (e) { e.preventDefault(); });
board.addEventListener('mousedown', function (e) {
  if (ui.sweep) { endSweep(); return; }   // 답 공개 중: 누르면 건너뛰어요
  if (!run || run.phase !== 'mine' || ui.sub || ui.opening != null) return;
  flushAll(); bubbleOnAction();
  var p = boardCell(e); if (!p) return;
  if (e.button === 2) {   // 오른쪽 클릭: 고르기 상태면 취소, 아니면 분필 순환(거리 제한 없음)
    if (ui.mode) { ui.mode = null; ui.hudDirty = true; return; }
    ui.dayClicks = (ui.dayClicks || 0) + 1;
    var c = Core.cellAt(run.d.floor, p.x, p.y); if (c.cover !== 'open') { if (Core.mark(run, p.x, p.y).faded) { var fq = stageXY(p.x, p.y); addFly({ x: Math.max(160, Math.min(650, fq.x)), y: fq.y - 30, showAt: 0, flyAt: null, fadeAt: 1400, size: 13, rise: 8, color: '#c8c0b0', steps: [{ t: 0, h: esc(TEXT.faded.locked) }] }); } else ui.chalkHintDone = true; } afterAction(); return;
  }
  if (e.button !== 0) return;
  ui.dayClicks = (ui.dayClicks || 0) + 1;
  clickCell(p);
});

// ---------- 루프 ----------
function frame(now) {
  if (ui.title && !run) drawTitle(now);
  if (run) {
    runSched(now);
    if (ui.sweep && now - ui.sweep.t0 > sweepTotal()) endSweep();
    if (run.fx.length) drainFx();
    if (ui.bubble && now - ui.bubble.t0 > 7000) hideBubble();
    if (ui.hudDirty || ui.flys.length || (ui.streakFx && now - ui.streakFx.t0 < 600) || Object.keys(ui.slotPop).some(function (k) { return now - ui.slotPop[k] < 200; })) { ui.hudDirty = false; if (run.d || run.phase === 'deed' || run.phase === 'board') updateHUDSafe(); }
    if (run.d) { drawBoard(now); drawCandle(now); }
    drawTally();
    updateFlys(now);
    settleTick(now);
  }
  requestAnimationFrame(frame);
}
function updateHUDSafe() {
  if (!run.d) { // 아침 화면: 머리만
    $('runDay').innerHTML = dayHead(); $('runLeft').textContent = dayLeft();
    $('vaultTxt').innerHTML = '금고 <b class="px" style="font-size:14px">' + fmt(run.cash) + '</b>'; $('goalTxt').innerHTML = goalLine(run);
    return;
  }
  updateHUD();
}
fitStage();
showTitle();   // 켤 때는 타이틀부터(reviews/17)
// 개발 서버에서만: 화면 점검 스크립트가 상태를 읽는 손잡이(빌드에는 빠져요)
if (import.meta.env && import.meta.env.DEV) window.__ocd = { get run() { return run; }, Core: Core, afterAction: afterAction };
requestAnimationFrame(frame);
