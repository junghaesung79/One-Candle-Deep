import { Core, CONFIG, CHARACTERS } from './core.js';

// ================= 스프라이트 (문자열 + 팔레트, 3배 표시). 1차 시안 A 스프라이트를 그대로 쓰고 2차 요소를 같은 톤으로 더했다 =================
var SPR = {};
function mkSprite(rows, pal, w, h) {
  w = w || rows[0].length; h = h || rows.length;
  var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  var g = cv.getContext('2d');
  for (var y = 0; y < h; y++) { var r = rows[y] || ''; for (var x = 0; x < w; x++) { var ch = r[x]; if (ch && ch !== '.' && pal[ch]) { g.fillStyle = pal[ch]; g.fillRect(x, y, 1, 1); } } }
  return cv;
}
var SPR_URL = {};
function sprUrl(name, cv) { if (!SPR_URL[name]) SPR_URL[name] = cv.toDataURL(); return SPR_URL[name]; }
function iconHtml(name, size, cls) {
  var cv = name.split('.').reduce(function (o, k) { return o && o[k]; }, SPR);
  if (!cv) return '';
  return '<img class="pix ' + (cls || '') + '" width="' + size + '" height="' + size + '" style="width:' + size + 'px;height:' + size + 'px" src="' + sprUrl(name, cv) + '" alt="">';
}

(function buildSprites() {
  var ROCK_PAL = { t: '#7d8394', u: '#6c7182', s: '#454956', d: '#383b46', k: '#4d515e', c: '#22242c', e: '#9aa0b0', b: '#5d6270', l: '#c9b49c' };
  var GROUND_PAL = { a: '#5a3d28', b: '#80583a', z: '#4a3222', y: '#3d2a1c', g: '#6b4a30' };
  function blank(ch) { var g = []; for (var i = 0; i < 16; i++) { g.push([]); for (var j = 0; j < 16; j++) g[i].push(ch || '.'); } return g; }
  function rows(g) { return g.map(function (r) { return r.join(''); }); }
  function rockRows(seed, light) {
    var r = Core.rngFrom(seed * 9973 + 11), g = blank('b'), i;
    function ri(a, b) { return a + Math.floor(r() * (b - a + 1)); }
    for (i = 0; i < 16; i++) { g[0][i] = 't'; g[1][i] = i < 15 ? 'u' : 's'; g[i][0] = 't'; g[15][i] = 'd'; if (i > 0) g[14][i] = 's'; g[i][15] = 'd'; if (i > 0 && i < 15) g[i][14] = 's'; }
    g[0][0] = 'e'; g[0][1] = 'e'; g[1][0] = 'e';
    for (i = 0; i < 7; i++) { var x = ri(3, 12), y = ri(3, 12); g[y][x] = 'k'; if (r() < 0.5 && x < 12) g[y][x + 1] = 'k'; }
    for (i = 0; i < 3; i++) { g[ri(3, 11)][ri(3, 12)] = 'u'; }
    if (light) [[4, 5], [5, 6], [6, 7], [7, 7], [8, 8], [9, 9], [10, 10], [7, 8], [8, 9], [5, 5]].forEach(function (p) { g[p[1]][p[0]] = 'l'; });
    return rows(g);
  }
  function groundRows(seed) {
    var r = Core.rngFrom(seed * 7919 + 100), g = blank('g'), i;
    function ri(a, b) { return a + Math.floor(r() * (b - a + 1)); }
    for (i = 0; i < 9; i++) { var x = ri(1, 14), y = ri(1, 14); g[y][x] = 'a'; if (r() < 0.4 && x < 14) g[y][x + 1] = 'a'; }
    for (i = 0; i < 5; i++) g[ri(1, 14)][ri(1, 14)] = 'b';
    return rows(g);
  }
  SPR.rock = []; SPR.ground = [];
  for (var s = 0; s < 4; s++) { SPR.rock.push(mkSprite(rockRows(s), ROCK_PAL)); SPR.ground.push(mkSprite(groundRows(s), GROUND_PAL)); }
  SPR.stairRock = mkSprite(rockRows(2, true), ROCK_PAL);
  var top = blank(), left = blank();
  for (var i = 0; i < 16; i++) { top[0][i] = 'y'; top[1][i] = 'z'; left[i][0] = 'y'; left[i][1] = 'z'; }
  SPR.shTop = mkSprite(rows(top), GROUND_PAL); SPR.shLeft = mkSprite(rows(left), GROUND_PAL);

  var MINER = ["......oooo......", "....ooyllyoo....", "...oyyyllyyyo...", "...oyyyyyyyyo...", "..oYYYYYYYYYYo..", "...offffffffo...", "...ofeffffefo...", "...offffffffo...", "....oFFFFFFo....", "..oorrrrrrrroo..", ".orroddddddorro.", ".offoddddddoffo.", "..oooddddddooo..", "....oddo.oddo...", "....oooo.oooo...", "................"];
  var MIP = { o: '#1a1420', y: '#f2c14e', Y: '#b8862a', l: '#fff4c2', f: '#f0c39a', F: '#c9936a', e: '#1a1420', r: '#c4432b', d: '#3e5f8a' };
  SPR.miner = mkSprite(MINER, MIP);
  // 캐릭터마다 모습이 달라요: 광부 헬멧과 곡괭이, 해체공 고글과 집게, 노름꾼 헌팅캡과 카드, 측량사 넓은 모자와 줄자 막대, 폭파공 머리띠와 화약
  var MINER_BY = {
    miner: ["......oooo......", "....ooyllyoo....", "...oyyyllyyyo...", "...oyyyyyyyyo...", "ppoYYYYYYYYYYo..", "pw.offffffffo...", ".w.ofeffffefo...", ".w.offffffffo...", ".w..oFFFFFFo....", ".woorrrrrrrroo..", ".wrroddddddorro.", ".offoddddddoffo.", "..oooddddddooo..", "....oddo.oddo...", "....oooo.oooo...", "................"],
    defuser: ["................", ".....oooooo.....", "....occccccoo...", "...occccccccco..", "k.koooooooooo...", "k.koffffffffo...", "kkooGGooooGGoo..", ".k.offffffffo...", ".k..oFFFFFFo....", ".koorrrrrrrroo..", ".krroddddddorro.", ".offoddddddoffo.", "..oooddddddooo..", "....oddo.oddo...", "....oooo.oooo...", "................"],
    gambler: ["................", "..........oo....", "....oooooowwo...", "...occcccowpwo..", "..occccccccccco.", "...offffffffo...", "...ofeffffefo...", "...offffffffo...", "....oFFFFFFo....", "..oorrrwwrrroo..", ".orrorrwwrrorro.", ".offorrwwrroffo.", "..oooddddddooo..", "....oddo.oddo...", "....oooo.oooo...", "................"],
    surveyor: ["...............w", "......oooo.....s", ".....occcco....w", "....occccccco..s", ".oooooooooooooow", "...offffffffo..s", "...owewffwewo..w", "...offffffffo..s", "....oFFFFFFo...w", "..oorrrrrrrroo.s", ".orroddddddorrow", ".offoddddddoffo.", "..oooddddddooo..", "....oddo.oddo...", "....oooo.oooo...", "................"],
    blaster: ["................", "................", "....oooooooo....", "...ohhhhhhhho...", "...oRRRRRRRRoRR.", "...offffffffoR..", "...ofeffffefo...", ".y.offkfffkfo...", "DD..oFFFFFFo....", "DDoorrrrrrrroo..", "DDrroddddddorro.", ".offoddddddoffo.", "..oooddddddooo..", "....oddo.oddo...", "....oooo.oooo...", "................"],
    jeweler: ["................", "................", "......oooo......", "....occccccoo...", "...oooooooooooo.", "...offffffffo...", "...ofefffoGGo...", "...offffffffo...", "....oFFFFFFo....", "..oorrrrrrrroo..", ".orroddddddorro.", ".offoddddddotto.", "..oooddddddooo..", "....oddo.oddo...", "....oooo.oooo...", "................"],
    veiner: ["......oooo......", "....oocllcoo....", "...occcllccco...", "...occcccccco...", "..oCCCCCCCCCCo..", "...offffffffo...", "...ofeffffefo...", "...offffffffo...", "....oFFFFFFo....", "..oowwrrrrrroo..", ".orrowwdddddrro.", ".offoddddddoffo.", "..oooddddddooo..", "....oddo.oddo...", "....oooo.oooo...", "................"],
    foreman: ["................", "......oooo......", "....owwwwwwo....", "...owRRRRRRwo...", "..owwwwwwwwwwo..", "...offffffffo...", "...ofeffffefo...", "...offffffffo...", "....oFFFFFFo....", "..oorrryrrrroo..", ".orrordyddddrro.", ".offoddddddoffo.", "..oooddddddooo..", "....oddo.oddo...", "....oooo.oooo...", "................"],
    carpenter: ["............bb..", "...........bb...", "....oooooobb....", "...offffffbbo...", "...ohhhhhbhhho..", "...ofefffbfefo..", "...offffbfffo...", "....oFFbFFFo....", "..oorrbrrrrroo..", ".orrobddddddorro", ".orroddddddorro.", ".offoddddddoffo.", "..oooddddddooo..", "....oddo.oddo...", "....oooo.oooo...", "................"],
    powderman: ["................", "................", ".....oooooo.....", "....ohhhhhho....", "..oooooooooooo..", "...offffffffo...", "...ofeffffefo...", "...offffffffo...", "....oFFFFFFo....", "..oorrrrrrrroo..", ".orroddddddorrD.", ".offoddddddoffD.", "..oooddddddoooDy", "....oddo.oddo...", "....oooo.oooo...", "................"],
  };
  var MINER_PAL = {
    miner: { o: '#1a1420', f: '#f0c39a', F: '#c9936a', e: '#1a1420', y: '#f2c14e', Y: '#b8862a', l: '#fff4c2', r: '#c4432b', d: '#3e5f8a', p: '#8a8fa0', w: '#8a5a3a' },
    defuser: { o: '#1a1420', f: '#f0c39a', F: '#c9936a', e: '#1a1420', c: '#2f5a36', G: '#9fd8e0', r: '#4f8a4a', d: '#6a4a2a', k: '#8a8fa0' },
    gambler: { o: '#1a1420', f: '#f0c39a', F: '#c9936a', e: '#1a1420', c: '#5a2f6a', w: '#efe7d6', p: '#c4432b', r: '#8e4fa8', d: '#2a2633' },
    surveyor: { o: '#1a1420', f: '#f0c39a', F: '#c9936a', e: '#1a1420', c: '#2a5a5a', w: '#efe7d6', s: '#c4432b', r: '#3e8a8a', d: '#5a4a3a' },
    blaster: { o: '#1a1420', f: '#f0c39a', F: '#c9936a', e: '#1a1420', h: '#3a2a20', R: '#c4432b', k: '#6a6070', D: '#e5484d', y: '#ffd25a', r: '#e0782b', d: '#4a3a2a' },
    jeweler: { o: '#1a1420', f: '#f0c39a', F: '#c9936a', e: '#1a1420', d: '#5a4a3a', c: '#c9a227', r: '#c9a227', G: '#9fd8e0', t: '#5fe0e8' },
    veiner: { o: '#1a1420', f: '#f0c39a', F: '#c9936a', e: '#1a1420', d: '#3e5f8a', c: '#b84f7a', C: '#8a3358', l: '#fff4c2', r: '#b84f7a', w: '#c9a46a' },
    foreman: { o: '#1a1420', f: '#f0c39a', F: '#c9936a', e: '#1a1420', d: '#2a2633', w: '#efe7d6', R: '#c4432b', r: '#3d6fb8', y: '#ffd25a' },
    carpenter: { o: '#1a1420', f: '#f0c39a', F: '#c9936a', e: '#1a1420', d: '#4a3a2a', h: '#6b4a2a', b: '#c9894a', r: '#9a6532' },
    powderman: { o: '#1a1420', f: '#f0c39a', F: '#c9936a', e: '#1a1420', d: '#3a3542', h: '#5d6270', r: '#6a7080', D: '#e5484d', y: '#ffd25a' },
  };
  SPR.minerBy = {}; CHARACTERS.forEach(function (c) { SPR.minerBy[c.id] = MINER_BY[c.id] ? mkSprite(MINER_BY[c.id], MINER_PAL[c.id]) : mkSprite(MINER, Object.assign({}, MIP, { r: c.color })); });
  var CHALK = ["................", "................", "................", "...ww......ww...", "....ww....ww....", ".....ww..ww.....", "......wwww......", ".......ww.......", "......wwww......", ".....ww..ww.....", "....ww....ww....", "...ww......ww...", "..ww........ww..", "................", "................", "................"];
  SPR.chalkX = mkSprite(CHALK, { w: '#e6e1d6' });
  var O = blank();
  for (var a = 0; a < 64; a++) { var t = a / 64 * Math.PI * 2; var ox = Math.round(7.5 + Math.cos(t) * 4.6), oy = Math.round(7.5 + Math.sin(t) * 4.6); O[oy][ox] = 'w'; if (ox + 1 < 16) O[oy][ox + 1] = 'w'; }
  SPR.chalkO = mkSprite(rows(O), { w: '#e6e1d6' });
  // 바랜 분필 자국: 같은 꼴을 흐린 색으로, 군데군데 지워지게
  function faded(r) { return r.map(function (line, y) { return line.split('').map(function (ch, x) { if (ch !== 'w') return ch; var h = (x * 7 + y * 13) % 9; return h === 0 || h === 4 ? '.' : (x + y) % 3 === 0 ? 'v' : 'u'; }).join(''); }); }
  var FADE_PAL = { u: '#a39b8a', v: '#7c7568' };
  SPR.chalkXFaded = mkSprite(faded(CHALK), FADE_PAL); SPR.chalkOFaded = mkSprite(faded(rows(O)), FADE_PAL);
  var ST2 = ["oooooooooookdhhh", "oxxxxxxxxxxkdppp", "oxxxxxxxxxxkdPPP", "oxxxxxxkkkkkdPPP", "oxxxxxxkdhhhdPPP", "oxxxxxxkdpppPPPP", "oxxxxxxkdPPPPPPP", "oxxkkkkkdPPPPPPP", "oxxkdhhhdPPPPPPP", "oxxkdpppPPPPPPPP", "oxxkdPPPPPPPPPPP", "kkkkdPPPPPPPPPPP", "hhhhdPPPPPPPPPPP", "ppppPPPPPPPPPPPP", "PPPPPPPPPPPPPPPP", "PPPPPPPPPPPPPPPP"];
  SPR.stair = mkSprite(ST2, { x: '#14100c', o: '#2a2018', k: '#0b0806', h: '#c9b49c', p: '#a8927a', P: '#7d6a55', d: '#5a4a3a' });
  SPR.scorch = mkSprite(["................", "................", "................", "......y..y......", "....yyyyyy.y....", "...yyxxxxyyy....", "..yyxxrxxxxy....", "..yxxrorxxxyy...", "..yxxxrxxrxxy...", "..yyxxxxxxxy....", "...yyxxxxyyy....", "....yyyyyy......", "......y.........", "................", "................", "................"], { y: '#3b2a1e', x: '#22242c', r: '#c4432b', o: '#ffb347' });
  SPR.scorchDust = mkSprite(["................", "................", "................", "......y..y......", "....yyyyyy.y....", "...yyxxxxyyy....", "..yyxxxxxxxy....", "..yxxxxxxxxyy...", "..yxxxxxxxxxy...", "..yyxxxxxxxy....", "...yyxxxxyyy....", "....yyyyyy......", "......y.........", "................", "................", "................"], { y: '#4a3222', x: '#22242c' });
  // 보물 1단계 금 알갱이(R24), 2단계 청록 보석, 3단계 금잔
  SPR.nugget = mkSprite(["................", "................", "................", "................", "................", ".......oo.......", ".....oohhoo.....", "....ohhyyyyo....", "....ohyyyyyoo...", "...oyyyyyyyyo...", "...oyyyyyyddo...", "....oyyyyddo....", ".....oooooo.....", "................", "................", "................"], { o: '#7a5212', y: '#f2c14e', h: '#fff1b8', d: '#b8862a' });
  SPR.gem = mkSprite(["................", "................", "................", "................", ".......oo.......", "......ohco......", ".....ohhcco.....", "....ohhcccco....", "....occcccdo....", ".....occcdo.....", "......ocdo......", ".......oo.......", "................", "................", "................", "................"], { o: '#0f4a52', h: '#c8fdff', c: '#5fe0e8', d: '#2a8f99' });
  SPR.relic = mkSprite(["................", "................", "...oooooooooo...", "...oyhhyyyyyo...", "...oyhyyryyyo...", "....oyyyyyyo....", ".....oyyyyo.....", "......oyyo......", ".......oo.......", ".......yo.......", "......oyyo......", ".....oyyyyo.....", ".....oooooo.....", "................", "................", "................"], { o: '#7a5212', y: '#f2c14e', h: '#fff1b8', r: '#e5484d' });
  SPR.tier = { 1: SPR.nugget, 2: SPR.gem, 3: SPR.relic };
  SPR.mine = mkSprite(["................", "................", ".......k........", "...k...k...k....", "....k.ooo.k.....", ".....orrrro.....", "....orrhrrro....", "..kkorrrrrrokk..", "....orrrrrro....", ".....orrrro.....", "....k.ooo.k.....", "...k...k...k....", ".......k........", "................", "................", "................"], { k: '#3a3542', o: '#3a0f14', r: '#c4432b', h: '#ff9a4d' });
  // 큰 덩이 단면
  SPR.chunk = mkSprite(["bbbbbbbbbbbbbbbb", "bggggggggggggggb", "bgyyyyyyhyyyyygb", "bgyhhyyyyyyyyygb", "bgyyyydyyyyyyygb", "bgyyyyddyyyhyygb", "bgyyyyydyyyyyygb", "bgyhyyyyyyyyyygb", "bgyyyyyyydyyyygb", "bgyyyyyyyddyyygb", "bgyyydyyyyyyyygb", "bgyyyddyyyyhyygb", "bgyyyyyyyyyyyygb", "bgyyyyyhyyyyyygb", "bggggggggggggggb", "bbbbbbbbbbbbbbbb"], { b: '#7a5212', g: '#b8862a', y: '#f2c14e', h: '#fff1b8', d: '#b8862a' });
  var HEART = ["..........", ".oo...oo..", "oRRo.oRRo.", "oRhRoRRRRo", "oRRRRRRRRo", ".oRRRRRRo.", "..oRRRRo..", "...oRRo...", "....oo....", ".........."];
  SPR.heart = mkSprite(HEART, { o: '#3a0f14', R: '#e5484d', h: '#ffb3b5' });
  SPR.heartE = mkSprite(HEART.map(function (r) { return r.replace(/[Rh]/g, 'e'); }), { o: '#3a3542', e: '#25212d' });
  var PEB = ["................", "................", "................", "................", "................", "......oo........", ".....ohho.oo....", "....ohccco.co...", "....occccooco...", ".....oooo..oo...", "................", "................", "................", "................", "................", "................"];
  SPR.pebble = mkSprite(PEB, { o: '#383b46', h: '#9aa0b0', c: '#6c7182' });
  // 돈 세 그림(R24): 금고 = 동전 꾸러미(구리·은), 오늘 주머니 = 가죽 주머니
  SPR.coins = mkSprite(["..........", "...oooo...", "..osssso..", "...oooo...", ".oooooo...", "occccccoo.", ".oooooosso", "occccccoo.", ".oooooo...", ".........."], { o: '#5a3a1e', c: '#b87333', s: '#d9d2c3' });
  SPR.pouch = mkSprite(["...oooo...", "....oo....", "...obbo...", "..obbbbo..", ".obbBbbbo.", ".obbbbBbo.", ".obbbbbbo.", "..obbbbo..", "...oooo...", ".........."], { o: '#3d2a1c', b: '#9a6532', B: '#6b4a30' });
  SPR.deed = mkSprite(["oooooooo..", "oppppppo..", "oplllppo..", "oppppppo..", "opllllpo..", "oppppppo..", "opplrrpo..", "opprrrpo..", "oppprppo..", "oooooooo.."], { o: '#3a3542', p: '#e9dfc8', l: '#a59fb3', r: '#b8322a' });
  SPR.emberOn = mkSprite(["..........", "....r.....", "...rhr....", "..rhyhr...", "..ryyyr...", "..rhyhr...", "...rrr....", "..........", "..........", ".........."], { r: '#7a2f28', h: '#e8743a', y: '#ffb347' });
  SPR.emberOff = mkSprite(["..........", "..........", "....k.....", "...kkk....", "...kkk....", "....k.....", "..........", "..........", "..........", ".........."], { k: '#3a3542' });
  SPR.candleIc = mkSprite(["....y.....", "...yhy....", "....y.....", "....k.....", "...owwo...", "...owWo...", "...owWo...", "...owWo...", "..oppppo..", "..oooooo.."], { y: '#ffd25a', h: '#fff4c2', k: '#1a120b', o: '#3a3542', w: '#efe7d6', W: '#c9c0ad', p: '#9aa0b0' });
  SPR.pin = mkSprite(["...rr.....", "..rRRr....", "..rRRr....", "...rr.....", "....k.....", "....k.....", "..........", "..........", "..........", ".........."], { r: '#7a2f28', R: '#c4432b', k: '#a59fb3' });
  // 광맥 규칙 표지판 기호(10×10)
  var RP = { o: '#3a3542', w: '#e6e1d6', y: '#f2c14e', r: '#c4432b', g: '#a59fb3' };
  SPR.rules = {
    plain: mkSprite(["oooooooooo", "o........o", "o.g....g.o", "o........o", "o...g....o", "o.......go", "o.g......o", "o....g...o", "o........o", "oooooooooo"], RP),
    pair: mkSprite(["oooooooooo", "o........o", "o........o", "o.yy.yy..o", "o.yy.yy..o", "o........o", "o........o", "o........o", "o........o", "oooooooooo"], RP),
    lonely: mkSprite(["oooooooooo", "o........o", "o.gggggg.o", "o.g....g.o", "o.g.yy.g.o", "o.g.yy.g.o", "o.g....g.o", "o.gggggg.o", "o........o", "oooooooooo"], RP),
    rows: mkSprite(["oooooooooo", "o........o", "oyyyyyyyyo", "o........o", "o........o", "oyyyyyyyyo", "o........o", "oyyyyyyyyo", "o........o", "oooooooooo"], RP),
    tally: mkSprite(["oooooooooo", "ow.......o", "ow.w.....o", "o........o", "ow.w.w...o", "o........o", "o........o", "ow.......o", "o........o", "oooooooooo"], RP),
    minepair: mkSprite(["oooooooooo", "o........o", "o........o", "o.rr.rr..o", "o.rr.rr..o", "o........o", "o......y.o", "o........o", "o........o", "oooooooooo"], RP),
    border: mkSprite(["oooooooooo", "oyyyyyyyyo", "oy......yo", "oy.gggg.yo", "oy.g..g.yo", "oy.g..g.yo", "oy.gggg.yo", "oy......yo", "oyyyyyyyyo", "oooooooooo"], RP),
    // 새 광맥 넷: 세로 세 줄, 대각선으로 닿은 두 보물, ㄱ자로 이어진 셋, 지뢰 없는 띠를 두른 보물
    cols: mkSprite(["oooooooooo", "o.y..y.y.o", "o.y..y.y.o", "o.y..y.y.o", "o.y..y.y.o", "o.y..y.y.o", "o.y..y.y.o", "o.y..y.y.o", "o.y..y.y.o", "oooooooooo"], RP),
    diag: mkSprite(["oooooooooo", "o........o", "o.yy.....o", "o.yy.....o", "o...yy...o", "o...yy...o", "o........o", "o........o", "o........o", "oooooooooo"], RP),
    trio: mkSprite(["oooooooooo", "o........o", "o.yy.yy..o", "o.yy.yy..o", "o........o", "o....yy..o", "o....yy..o", "o........o", "o........o", "oooooooooo"], RP),
    band: mkSprite(["oooooooooo", "or......ro", "o..wwww..o", "o.w....w.o", "o.w.yy.w.o", "o.w.yy.w.o", "o.w....w.o", "o..wwww..o", "or......ro", "oooooooooo"], RP)
  };
  // 광산 변덕 기호
  SPR.muts = {
    blur: mkSprite(["..........", ".w..w.....", ".w..w.....", ".wwww..w..", "....w.www.", "....w..w..", "..........", "..........", "..........", ".........."], { w: '#ff9a4d' }),
    twin: mkSprite(["..........", "..........", ".rrr.rrr..", ".rhr.rhr..", ".rrr.rrr..", "..........", "..........", "..........", "..........", ".........."], { r: '#c4432b', h: '#ff9a4d' }),
    sleepy: mkSprite(["......www.", ".......w..", "......www.", "...hhh....", "...ppp....", "hhhPPP....", "pppPPP....", "PPPPPP....", "..........", ".........."], { w: '#c9c3d6', h: '#c9b49c', p: '#a8927a', P: '#7d6a55' }),
    noprobe: mkSprite(["..........", "..ww......", ".wwww.....", "..ww.r...r", "......r.r.", ".......r..", "......r.r.", ".....r...r", "..........", ".........."], { w: '#c9b49c', r: '#c4432b' }),
    nap: mkSprite(["......www.", ".......w..", "......www.", "..........", "..yyyy....", ".yhhhhy...", ".yhhhhy...", "..yyyy....", "..........", ".........."], { w: '#c9c3d6', y: '#a8781c', h: '#ffd25a' }),
    quake: mkSprite(["..........", "..r.......", ".r.r...r..", "r...r.r.r.", ".....r...r", "..........", "..r....r..", ".rrr..rrr.", "..r....r..", ".........."], { r: '#c4432b' })
  };
  // 도구·유물 아이콘(10×10). 비슷한 것끼리 모양이 겹치지 않게: 명함(가로, 겹친 두 장)과 마지막 패(세로, 스페이드), 무쇠 투구(단단)와 금 간 투구(쪼개짐), 굵은 초(뭉툭, 촛농)와 화면의 초
  SPR.icons = {
    // 유물 아이콘
    kCandle: mkSprite(["....y.....", "...yhy....", "...yhy....", "....k.....", ".LLLLLLLL.", "LLLlLLlLwL", "LlLllLllw.", ".lLlllllw.", ".lllllllw.", "oooooooooo"], { y: '#ffd25a', h: '#fff4c2', k: '#1a120b', L: '#fbf4e4', l: '#d9ccb2', w: '#a8927a', o: '#3d2a1c' }),
    kHelm: mkSprite(["...oooo...", "..oGGggo..", ".oGGgggdo.", ".oGggggdo.", ".oGggggdo.", ".odrddrdo.", "oggggggggo", "oddddddddo", ".oooooooo.", ".........."], { o: '#454956', g: '#9aa0b0', G: '#d9dde6', d: '#6c7182', r: '#2a2633' }),
    kCrack: mkSprite(["...oo...gg", "..oGGk...g", ".oGGgk....", ".oGgggkoo.", ".oGggkgdo.", ".odrdkddo.", "ogggggkggo", "oddddddkdo", ".oooooooo.", ".........."], { o: '#454956', g: '#7a7680', G: '#a09ca6', d: '#4d4a56', r: '#a0603a', k: '#e5484d' }),
    kWick: mkSprite(["....y.....", "...yhy....", "...yhy....", "....y.....", "....k.....", "..wwwwww..", "..wllllw..", ".oooooooo.", "..........", ".........."], { y: '#ffd25a', h: '#fff4c2', k: '#3d2a1c', w: '#c9b49c', l: '#efe7d6', o: '#3d2a1c' }),
    kBoots: mkSprite(["..........", "..oooo....", "..obbo....", "w.obbo....", "..obbo....", "w.obbboo..", "..obbbbbo.", "w.obBbbbbo", "..kkkkkkkk", ".........."], { o: '#3d2a1c', b: '#9a6532', B: '#c9894a', k: '#2a1c12', w: '#c9c3d6' }),
    kBook: mkSprite([".oooooooo.", ".okbbbbbo.", ".okxbbxbo.", ".okbxxbbo.", ".okbxxbbo.", ".okxbbxbo.", ".okbbbbbo.", ".okbbbbbo.", ".owwwwwwo.", ".oooooooo."], { o: '#2a1c12', k: '#4a3222', b: '#80583a', x: '#e6e1d6', w: '#e9dfc8' }),
    kLamp: mkSprite(["....y.....", "...yhy....", "....y.....", "...oko....", "..oggggo..", ".oggggggo.", ".oggggggo.", "..oggggo..", "...oooo...", ".........."], { y: '#ffd25a', h: '#fff4c2', o: '#3d2a1c', k: '#3d2a1c', g: '#a8781c' }),
    kNet: mkSprite(["..o....o..", "..o....o..", "oooooooooo", "o.w.w.w.wo", ".ow.w.w.o.", ".ochcwhco.", "..ocwcho..", "..ohcwco..", "...oooo...", ".........."], { o: '#5a4a3a', w: '#c9b49c', c: '#6c7182', h: '#9aa0b0' }),
    kPurse: mkSprite(["....rr....", "...r..r...", "..oooooo..", ".obbbbbbo.", "obbbbbbbbo", "obbbybbbbo", "obbbbbbbbo", ".obbbbbbo.", "..oooooo..", ".........."], { r: '#c4432b', o: '#3d2a1c', b: '#8a5a3a', y: '#ffd25a' }),
    kCard: mkSprite(["..........", "..oooooooo", "..oDDDDDDo", "ooooooooDo", "oyywkkwoDo", "oyywwwwoDo", "owwlllwooo", "owwwwwwo..", "oooooooo..", ".........."], { o: '#3a3542', w: '#efe7d6', D: '#b8b0a0', y: '#c4432b', k: '#3a3542', l: '#a59fb3' }),
    kKey: mkSprite(["..........", ".ooo......", "o...o.....", "o...ooooo.", "o...o.o.o.", ".ooo..o...", "..........", "..........", "..........", ".........."], { o: '#b0703a' }),
    kPrayer: mkSprite(["...yYyY...", "..Y....y..", ".y......Y.", ".Y......y.", ".y......Y.", "..Y....y..", "...yY.Yy..", "....hh....", "....rr....", "...rrrr..."], { y: '#c9a35a', Y: '#8a5a3a', h: '#ffd25a', r: '#c4432b' }),
    ledger: mkSprite(["..........", "oooo..oooo", "owwwoowwwo", "owllkkllwo", "owwwkkwwwo", "owllkkllwo", "owwwkkwrwo", "owllkkrrwo", "oooooooooo", ".........."], { o: '#3d2a1c', w: '#efe7d6', l: '#a59fb3', k: '#c9c0ad', r: '#c4432b' }),
    sheet: mkSprite(["...kkkk...", ".bbkkkkbb.", ".bjjjjjjb.", ".bjxjlljb.", ".bjjjjjjb.", ".bjxjlljb.", ".bjjjjjjb.", ".bjxjlljb.", ".bjjjjjjb.", ".bbbbbbbb."], { b: '#8a5a3a', j: '#efe7d6', k: '#9aa0b0', x: '#c4432b', l: '#a59fb3' }),
    powder: mkSprite(["....y.....", "...k......", "...k......", "..oooo....", ".obbbbo...", "obbbbbbo..", "obbbbbbo..", "obbbbbbo..", ".obbbbo...", "..oooo...."], { o: '#1a1420', b: '#5d6270', k: '#9a6532', y: '#ffd25a' }),
    match: mkSprite(["r.r.r.....", "w.w.w.....", "w.w.w.....", "w.w.w.....", "w.w.w.....", "w.w.w.....", "w.w.w.....", "oooooo....", "obbbbo....", "oooooo...."], { r: '#c4432b', w: '#c9894a', o: '#3d2a1c', b: '#80583a' }),
    lens: mkSprite(["..oooo....", ".o....o...", "o.hh...o..", "o.h....o..", "o......o..", "o......o..", ".o....o...", "..oooooww.", "........ww", ".........w"], { o: '#b8c1d6', h: '#e8f4ff', w: '#9a6532' }),
    gloves: mkSprite(["..........", "..g.g.g...", ".ggggggg..", ".gGgGgGg..", ".gggggggg.", ".ggggggggg", ".gggggggg.", "..gggggg..", "..cccccc..", "..cccccc.."], { g: '#9a6532', G: '#c9894a', c: '#6b4a30' }),
    card: mkSprite([".ooooooooo", ".orwwwwwwo", ".owwwkwwwo", ".owwkkkwwo", ".owkkkkkwo", ".owkkkkkwo", ".owwwkwwwo", ".owwkkkwwo", ".owwwwwwro", ".ooooooooo"], { o: '#3a3542', w: '#efe7d6', k: '#1a1420', r: '#c4432b' }),
    fuse: mkSprite(["........y.", ".......yhy", "..ccccccy.", ".cddddc...", "cdccccdc..", "cdcddcdc..", "cdcddcdc..", "cdccccdc..", ".cddddc...", "..cccc...."], { c: '#c9894a', d: '#6b4a2a', y: '#ffd25a', h: '#fff4c2' }),
    refiner: mkSprite(["oooooooooo", ".occcccco.", "..occcco..", "...occo...", "....oo....", "....oo....", "...yyyy...", "..yhyyyy..", "..yyyyyy..", "...yyyy..."], { o: '#454956', c: '#9aa0b0', y: '#f2c14e', h: '#fff1b8' }),
    sieve: mkSprite(["..........", ".oooooooo.", "o.w.w.w.wo", "ow.w.w.w.o", "o.w.w.w.wo", "ow.w.w.w.o", ".oooooooo.", "....kk....", "....kk....", ".........."], { o: '#6b4a30', w: '#454956', k: '#22242c' }),
    moonsieve: mkSprite(["......ww..", ".......ww.", "........w.", ".......ww.", ".oooooooo.", "o.s.s.s.so", "os.s.s.s.o", "o.s.s.s.so", ".oooooooo.", ".........."], { o: '#6b4a30', s: '#c9c3d6', w: '#f1ece2' }),
    wedge: mkSprite([".oooooooo.", ".oGGgggdo.", "..oGggdo..", "y.oGggdo.y", "y..oGdo..y", ".y.oGdo.y.", "ssssoossss", "sSssSSssSs", "ssSssssSss", "ssssssssss"], { o: '#454956', G: '#d9dde6', g: '#9aa0b0', d: '#6c7182', y: '#ffd25a', s: '#5d6270', S: '#2a2633' }),
    betchalk: mkSprite(["..wwww....", ".w....w...", ".w....w...", ".w....w...", "..wwww....", "......ccc.", ".....cccc.", "....cccc..", "...cccc...", "...ccc...."], { w: '#e6e1d6', c: '#c9c3d6' }),
    tongs: mkSprite(["....gg....", "...gGGg...", "...gG.g...", "....kk....", "...gkkg...", "..gg..gg..", "..rr..rr..", ".rr....rr.", ".rr....rr.", "rr......rr"], { g: '#9aa0b0', G: '#c3c7d2', k: '#454956', r: '#c4432b' }),
    probe: mkSprite([".i..i..i..", ".i..i..i..", ".i..i..i..", ".i..i..i..", ".i..i..i..", ".i..i..i..", "wwwwwwwwww", ".i..i..i..", ".h..h..h..", ".........."], { i: '#c3c7d2', w: '#c4432b', h: '#9aa0b0' }),
    stairs: mkSprite(["......oooo", "......ohhh", "......oppp", "...oooopPP", "...ohhhPPP", "...opppPPP", "ooooPPPPPP", "ohhhPPPPPP", "opppPPPPPP", "oPPPPPPPPP"], { o: '#2a2018', h: '#c9b49c', p: '#a8927a', P: '#7d6a55' }),
    stairsDim: mkSprite(["......oooo", "......ohhh", "......oppp", "...oooopPP", "...ohhhPPP", "...opppPPP", "ooooPPPPPP", "ohhhPPPPPP", "opppPPPPPP", "oPPPPPPPPP"], { o: '#25212d', h: '#3a3542', p: '#34303f', P: '#2a2633' }),
    spring: mkSprite(["..........", "....b.....", "...bwb....", "...bwb....", "..bwwwb...", "..bwbwb...", "..bwwwb...", "...bbb....", "oooooooooo", "..........".replace(/\./g, '.')], { b: '#4f7590', w: '#c8e6f0', o: '#2f4a60' }),
    merchant: mkSprite(["....oo....", "...o..o...", "..oooooo..", ".offfffo..", ".ofyyyfo..", ".ofyhyfo..", ".ofyyyfo..", ".offfffo..", "..oooooo..", ".........."], { o: '#6b5a3f', f: '#c9a35a', y: '#ffd25a', h: '#fff4c2' })
  };
  // 소모품 넷(reviews/24): 성냥 한 개비, 감은 붕대, 접시에 선 몽당초, 찢긴 지도
  SPR.icons.cMatch = mkSprite(["......rr..", ".....rRRr.", ".....rRRr.", "......rw..", ".....ww...", "....ww....", "...ww.....", "..ww......", ".ww.......", "ww........"], { r: '#7a2f28', R: '#e0603a', w: '#c9894a' });
  SPR.icons.cBandage = mkSprite(["..oooooo..", ".owwwwwwo.", "owwllllwwo", "owlkkkklwo", "owlk..klwo", "owlkkkklwo", "owwllllwwo", ".owwwwwwww", "..oooooowW", "........WW"], { o: '#6c6476', w: '#efe7d6', l: '#c9c0ad', k: '#8a8296', W: '#d9ccb2' });
  SPR.icons.cStub = mkSprite(["....y.....", "...yhy....", "...yhy....", "....k.....", "...LLL....", "...LlL....", "..lllll...", "oooooooo..", ".oggggoooo", "..oooo...."], { y: '#ffd25a', h: '#fff4c2', k: '#1a120b', L: '#fbf4e4', l: '#d9ccb2', o: '#5a4a3a', g: '#b0703a' });
  SPR.icons.cMap = mkSprite(["pppppp.pp.", "pkpppppppp", "pppkpppppp", "pppppppppp", "ppppkppppp", "pppppkpppp", "pppppprprp", "ppppppprpp", "pppppprprp", ".pp.ppp.p."], { p: '#e9dfc8', k: '#8a5a3a', r: '#c4432b' });
  // 재미 보고서 도구 셋(늙은 광부 모자, 곽 씨 부적, 청진 망치)
  SPR.icons.crown = mkSprite(["..........", "...yyyy...", "..yhhhhy..", ".yhkllkhy.", ".yhkllkhy.", "oooooooooo", ".o......o.", "..........", "..........", ".........."], { o: '#6b4a2a', y: '#b8862e', h: '#ffd25a', k: '#3a3542', l: '#fff4c2' });
  SPR.icons.amulet = mkSprite(["....oo....", "...o..o...", "..o....o..", ".wwwwwwww.", ".wrrrrrrw.", ".wwwrrwww.", ".wwrwwrww.", ".wwwrrwww.", ".wwwwwwww.", ".........."], { o: '#9a6532', w: '#efe7d6', r: '#c4432b' });
  SPR.icons.tapper = mkSprite(["..gggggg..", "..gGGGGg..", "..gggggg..", "....ww....", "....ww....", "....ww....", "....ww....", "....ww....", "...wwww...", ".........."], { g: '#7c8292', G: '#b8c1d6', w: '#9a6532' });
  SPR.icons.nugget = SPR.nugget; SPR.icons.gem = SPR.gem;
  // 도구 경험 정리: 옛 연장함, 넓은 연장 띠, 심 씨 단골 장부, 합친 도구 셋
  SPR.icons.box = mkSprite(["..........", "...oooo...", "..o....o..", "oooooooooo", "obbbbbbbbo", "obBBByBBbo", "obbbyybbbo", "obbbbbbbbo", "oooooooooo", ".........."], { o: '#3d2a1c', b: '#80583a', B: '#9a6532', y: '#ffd25a' });
  SPR.icons.belt = mkSprite(["..........", "..........", "kkkkkkkkkk", "bbbobbobbb", "bbobyobbbb", "bbbobbobbb", "kkkkkkkkkk", "..o..o..o.", "..o..o..o.", ".........."], { k: '#3d2a1c', b: '#9a6532', o: '#454956', y: '#f2c14e' });
  SPR.icons.regular = mkSprite([".ooooooo..", ".oBbbbbo..", ".oBwwwbo..", ".oBbbbbo..", ".oBbbbbo..", ".oBbbbbcc.", ".oBbbbcyhc", ".oBbbbcyyc", ".oooooocc.", ".........."], { o: '#2a1c12', B: '#2f5a36', b: '#4f8a4a', w: '#efe7d6', c: '#7a5212', y: '#f2c14e', h: '#fff1b8' });
  SPR.icons.toughcharm = mkSprite(["...oooo...", "..o....o..", ".o.oooo.o.", "yyyyyyyyyy", "ywrrrrrrwy", "ywwrrrrwwy", "ywrwrrwrwy", "ywwrrrrwwy", "ywwwwwwwwy", "yyyyyyyyyy"], { o: '#9a6532', w: '#efe7d6', r: '#c4432b', y: '#9b6fd6' });   // 질긴 부적(R135)
  SPR.icons.bigblast = mkSprite(["y...y...y.", ".k..k..k..", "..k.k.k...", "...kkk....", "rrrrrrrrr.", "rRRRRRRRr.", "rRyyRRRRr.", "rRRRRyyRr.", "rrrrrrrrr.", ".........."], { r: '#7a2f28', R: '#c4432b', k: '#3a3542', y: '#ffd25a' });
  SPR.icons.moontongs = mkSprite(["....yy....", "..wyhhyw..", "..wwyyww..", "...wwww...", "....kk....", "...wkkw...", "..ww..ww..", "..mm..mm..", ".mm....mm.", "mm......mm"], { w: '#c9c3d6', k: '#6f6880', y: '#5fe0e8', h: '#e8f4ff', m: '#8e7fb0' });
  // 처음 풀에 새로 넣은 넷(reviews/23)
  SPR.icons.firstdig = mkSprite(["........bb", ".......bb.", "......bb..", ".....bb...", "....bb....", "..gGg.....", ".gGGGg....", ".gGGGg....", "..ggg.....", "...g......"], { b: '#9a6532', g: '#7c8292', G: '#c3c7d2' });
  SPR.icons.lonelamp = mkSprite(["....k.....", "....k.....", "...kkk....", "..kyyyk...", "..kyhyk...", "..kyyyk...", "...kkk....", "....y.....", "...y.y....", ".........."], { k: '#454956', y: '#ffd25a', h: '#fff4c2' });
  SPR.icons.nuggetbag = mkSprite(["...o..o...", "....oo....", "...bbbb...", "..bbbbbb..", ".bbbyybbb.", ".bbyhyybb.", ".bbbyybbb.", "..bbbbbb..", "..........", ".........."], { o: '#3d2a1c', b: '#9a6532', y: '#f2c14e', h: '#fff1b8' });
  SPR.icons.dripdish = mkSprite(["....y.....", "...yhy....", "....k.....", "...www....", "...www....", "..wwwww...", "bbwbbbwbbb", ".bbbbbbbb.", "..........", ".........."], { y: '#ffd25a', h: '#fff4c2', k: '#3a3542', w: '#efe7d6', b: '#b8862e' });
  SPR.icons.deadcrown = mkSprite(["y..y..y...", "yy.yy.yy..", "yhyyhyyhy.", "yyyyyyyyy.", "oooooooooo", ".orrrrrro.", ".orwrrwro.", ".orrrrrro.", "..oooooo..", ".........."], { o: '#6b4a2a', y: '#b8862e', h: '#ffd25a', r: '#c4432b', w: '#efe7d6' });
  // 소모품 도구 그림(reviews/23 3.10)
  SPR.icons.csHerb = mkSprite(["...o..o...", "....oo....", "...bbbb...", "..bbbbbb..", ".bbbyybbb.", ".bbyhyybb.", ".bbbyybbb.", "..bbbbbb..", "..........", ".........."], {b: '#7a6a3a', h: '#a8e07a', o: '#3d2a1c', y: '#5fa04a'});
  SPR.icons.csAtlas = mkSprite(["..........", ".wwwwwwww.", ".wkkwwwww.", ".wkkkwwrw.", ".wwkwwrwr.", ".wwwwwwrw.", ".wwkkwwww.", ".wwwkkkww.", ".wwwwwwww.", ".........."], {k: '#3a3542', r: '#c4432b', w: '#c9b49c'});
  SPR.icons.csSack = mkSprite(["..o..o....", "...oo.....", "..bbbb....", ".bbbbbb...", ".bbbbbb...", ".bbBbbb...", ".bbbbbb...", ".bbbbbby..", "..bbbbyyy.", "......y.y."], {B: '#80583a', b: '#5a3d28', o: '#3d2a1c', y: '#f2c14e'});
  SPR.icons.csHand = mkSprite(["..........", "...c.c.c..", "...c.c.c..", "...c.c.c.c", "...ccccccc", ".c.ccccccc", ".ccccccccc", "..cccccc..", "...ccccc..", ".........."], {c: '#d9a070'});
  SPR.icons.csKnot = mkSprite(["..........", ".oooooo...", "..rrrr....", "..rRrr....", "..rrRr....", "..rrrr....", ".oooooo...", ".....r....", "......r..y", ".......ryy"], {R: '#e06a52', o: '#6b4a30', r: '#c4432b', y: '#f2c14e'});
  SPR.icons.csJar = mkSprite(["...oooo...", "..wwwwww..", ".w......w.", ".w.y..t.w.", ".w..p...w.", ".w.t..y.w.", ".w..y.p.w.", ".wwwwwwww.", "..........", ".........."], {o: '#6b4a30', p: '#efe7d6', t: '#efe7d6', w: '#a8c4d0', y: '#ffd25a'});
  SPR.icons.csJunk = mkSprite(["g.......g.", "gg.....gg.", ".gg...gg..", "..gg.gg...", "...ggg....", "...ggg....", "..bb.bb...", ".bb...bb..", "bb.....bb.", "b.......b."], {b: '#9a6532', g: '#9aa0b0'});
  SPR.icons.csLantern = mkSprite(["...oooo...", "...o..o...", "..oooooo..", "..oyyyyo..", "..oyhhyo..", "..oyhhyo..", "..oyyyyo..", "..oooooo..", "...oooo...", ".........."], {h: '#fff4c2', o: '#454956', y: '#ffd25a'});
  SPR.icons.csMatchbox = mkSprite(["..y..y....", "..r..r....", "..w..w....", "..w..w....", ".bbbbbbbb.", ".bkkkkkkb.", ".bkrrrrkb.", ".bkkkkkkb.", ".bbbbbbbb.", ".........."], {b: '#9a6532', k: '#6b4a30', r: '#c4432b', w: '#efe7d6', y: '#f2c14e'});
  SPR.icons.csFadedFuse = mkSprite(["........y.", ".......yhy", "..ccccccy.", ".cddddc...", "cdccccdc..", "cdcddcdc..", "cdcddcdc..", "cdccccdc..", ".cddddc...", "..cccc...."], {c: '#bdb5a6', d: '#7a7468', h: '#fff4c2', y: '#ffd25a'});
  SPR.icons.csShears = mkSprite(["g.......g.", ".g.....g..", "..g...g...", "...g.g....", "....G.....", "...g.g....", ".rr...rr..", "r..r.r..r.", "r..r.r..r.", ".rr...rr.."], {G: '#c3c7d2', g: '#9aa0b0', r: '#c4432b'});
  SPR.icons.csBundle = mkSprite([".rr.rr.rr.", ".RR.RR.RR.", "..w..w..w.", "..w..w..w.", ".bbbbbbbb.", "..w..w..w.", "..w..w..w.", "..w..w..w.", "..w..w..w.", ".........."], {R: '#e0603a', b: '#c4432b', r: '#7a2f28', w: '#c9894a'});
  SPR.icons.csSleeve = mkSprite(["..........", ".cccccc...", ".cCcccCc..", ".cccccccc.", ".cCcccccCc", "..cccccccc", "...cc.cc.c", "....c..c..", "..........", ".........."], {C: '#8fa8c8', c: '#5f7fa8'});
  SPR.icons.csGoblin = mkSprite(["...o..o...", "....oo....", "...pppp...", "..pppppp..", ".ppyppypp.", ".pppppppp.", ".pppkkppp.", "..pppppp..", "...pppp...", ".........."], {k: '#3a2a4a', o: '#3d2a1c', p: '#7a4fa8', y: '#ffd25a'});
  SPR.icons.csWaist = mkSprite(["..........", "kkkkkkkkkk", "bbobbbbbbb", "bboybbbbbb", "kkkkkkkkkk", ".....cccc.", ".....cCCc.", ".....cccc.", ".....cccc.", ".........."], {C: '#e0b070', b: '#5a3d28', c: '#c9894a', k: '#3d2a1c', o: '#454956', y: '#f2c14e'});
  // 콤보·발파·열림 도구 그림(reviews/23 3.1~3.3, 도감 그림 그대로). 다른 갈래가 같은 그림을 먼저 넣었으면 그대로 둬요
  (function () {
    var B = { o: '#3d2a1c', w: '#efe7d6', y: '#f2c14e', h: '#fff1b8', r: '#c4432b', g: '#9aa0b0', G: '#c3c7d2', k: '#3a3542', b: '#9a6532', c: '#c9894a', s: '#5d6270', t: '#5fe0e8' };
    var A = {
      whet: [["..........", ".......y..", "......yhy.", ".......y..", "..........", ".gggggggg.", "gGGGGGGGgs", "gggggggggs", ".ssssssss.", ".........."], { G: '#c3c7d2', s: '#5d6270', y: '#ffd25a', h: '#fff4c2' }],
      tag5: [["...oo.....", "..o..o....", ".wwwwwwww.", ".wwkkkkww.", ".wwkwwwww.", ".wwkkkkww.", ".wwwwwkww.", ".wwkkkkww.", ".wwwwwwww.", ".........."], { o: '#9a6532', k: '#c4432b' }],
      dusk: [["....y...m.", "...yhy.mm.", "....y...m.", "...www....", "..wwwww...", "..wwwww...", ".bbbbbbb..", ".bcccccb..", "..bbbbb...", ".........."], { m: '#c9c3d6', b: '#6b4a2a', c: '#9a6532' }],
      pick7: [["..gggggg..", ".g..bb..g.", "g...bb...g", "....bb....", "....bb..yy", "....bb...y", "....bb...y", "....bb..y.", "....bb..y.", ".........."], {}],
      pickgold: [["..yyyyyy..", ".y..bb..y.", "y...bb...y", "....bb....", "....bb..e.", "....bb.eee", "....bb..e.", "....bb....", "....bb....", ".........."], { e: '#7fd17f' }],
      apron: [["..b....b..", "...b..b...", "..wwwwww..", "..wwwwww..", ".wwwwwwww.", ".wwccccww.", ".wwcwwcww.", ".wwccccww.", ".wwwwwwww.", "..wwwwww.."], { w: '#c9b49c', b: '#6b4a30', c: '#8a5a3a' }],
      shoe: [["..........", ".gg....gg.", ".gG....Gg.", ".gG....Gg.", ".gG....Gg.", ".gG....Gg.", ".ggG..Ggg.", "..ggGGgg..", "...gggg...", ".........."], { g: '#7c8292', G: '#d9dde6' }],
      flint: [["......y...", ".....yhy..", "......y.y.", "...ss...y.", "..sSSs....", ".sSSSSs...", ".sSSSSs...", "..ssss....", "bbbbbbbb..", "bggggggb.."], { s: '#454956', S: '#6c7182', b: '#6b4a30' }],
      fireglove: [[".......y.y", "..g.g.g...", ".ggggggg..", ".gGgGgGg..", ".gggggggg.", ".ggggggggg", ".gggggggg.", "..gggggg..", "..cccccc..", "..cccccc.."], { g: '#7a2f28', G: '#c4432b', c: '#3a3542' }],
      bundle: [[".y..y..y..", ".c..c..c..", ".c..c..c..", "..c.c.c...", "...ccc....", "..rrrrr...", "...ccc....", "..c.c.c...", ".c..c..c..", ".........."], {}],
      twofire: [["..........", ".y......y.", ".yy....yy.", "yhy....yhy", "yrhy..yhry", "yrry..yrry", ".yry..yry.", "..yy..yy..", "...k..k...", ".........."], {}],
      firebook: [["....y.....", "...yry....", "...yry....", "oooooooooo", "owwwwowwwo", "owkkwowkko", "owwwwowwwo", "owkkwowkko", "oooooooooo", ".........."], { o: '#7a2f28', k: '#a59fb3' }],
      hand: [["..........", "...c.c.c..", "...c.c.c..", "...c.c.c.c", "...ccccccc", ".c.ccccccc", ".ccccccccc", "..cccccc..", "...ccccc..", ".........."], { c: '#d9a070' }],
      xbook: [["..........", "oooooooooo", "owwwwwwwwo", "owrwwwrwwo", "owwrwrwwwo", "owwwrwwwwo", "owwrwrwwwo", "owrwwwrwwo", "oooooooooo", ".........."], { o: '#2f5a36' }],
      spool: [["..........", ".oooooo...", "..rrrr....", "..rRrr....", "..rrRr....", "..rrrr....", ".oooooo...", ".....r....", "......r..y", ".......ryy"], { o: '#6b4a30', R: '#e06a52' }],
      fan: [["g.g.g.g.g.", ".gGgGgGg..", "..gGGGg...", "...gGg....", "....b.....", "....b.....", "....b.....", "....b.....", "...bbb....", ".........."], { g: '#7c8292' }],
      matchbox: [["..y..y....", "..r..r....", "..w..w....", "..w..w....", ".bbbbbbbb.", ".bkkkkkkb.", ".bkrrrrkb.", ".bkkkkkkb.", ".bbbbbbbb.", ".........."], { b: '#9a6532', k: '#6b4a30' }],
      quick: [["..........", "....c.c.c.", "....c.c.c.", "w...ccccc.", "...cccccc.", "ww.cccccc.", "...ccccc..", "w...cccc..", "..........", ".........."], { c: '#d9a070' }],
      tumble: [["s.........", ".s..ss....", "...sSSs...", "..sSSSSs..", ".sSSssSSs.", "sSSs..sSSs", "sSs.yy.sSs", ".s..yy..s.", "..........", ".........."], { s: '#454956', S: '#7d8394' }],
      crate: [["..s.S.s...", ".sSsSsSs..", "oooooooooo", "obbbbbbbbo", "oooooooooo", "obbbbbbbbo", "obbbbbbbbo", "oooooooooo", "..........", ".........."], { S: '#9aa0b0' }]
    };
    Object.keys(A).forEach(function (k) { if (!SPR.icons[k]) SPR.icons[k] = mkSprite(A[k][0], Object.assign({}, B, A[k][1])); });
  })();
})();

// 오른쪽 패널 단추 그림(12×12): 달력, 설정. 화면 위 표시(10×10): 남은 보물, 콤보
SPR.ui = {
  cal: mkSprite(["..k.....k...", ".rkrrrrrkrr.", ".rrrrrrrrrr.", ".wwwwwwwwww.", ".wdwwdwwdww.", ".wwwwwwwwww.", ".wdwwdwwyyw.", ".wwwwwwwyyw.", ".wdwwdwwwww.", ".wwwwwwwwww.", ".ssssssssss.", "............"],
    { k: '#c9c3d6', r: '#c4432b', w: '#e9dfc8', d: '#8a8496', y: '#e0a526', s: '#8a8496' }),
  gear: mkSprite([".....gg.....", "..g.gggg.g..", ".gggggggggg.", "..gggddggg..", ".gggd..dggg.", "gggd....dggg", "gggd....dggg", ".gggd..dggg.", "..gggddggg..", ".gggggggggg.", "..g.gggg.g..", ".....gg....."],
    { g: '#c9c3d6', d: '#6f6880' }),
  // 남은 보물(등급 없이): 흙 더미 위 반짝임. 금 알갱이·보석·금잔 어느 하나로 보이지 않게(10×10)
  treasure: mkSprite(["...w......", "...w....w.", "..wyw..www", "wwyhyww.w.", "..wyw.....", "...w......", "...w......", "..dddddd..", ".ddgdddcd.", "dddddgdddd"],
    { w: '#fff4c2', y: '#ffd25a', h: '#ffffff', d: '#80583a', g: '#f2c14e', c: '#5fe0e8' }),
  // 콤보: 맞물린 사슬 고리 둘(보물을 잇달아 캔다는 뜻). 불꽃·초와 헷갈리지 않게(10×10)
  combo: mkSprite(["..........", "......YY..", ".....Y..Y.", "....Y...Y.", "...Yyy.Y..", "...Y..y...", "..y.YYy...", ".y...y....", ".y..y.....", "..yy......"],
    { y: '#f2c14e', Y: '#b8862a' })
};

export { SPR, mkSprite, sprUrl, iconHtml };
