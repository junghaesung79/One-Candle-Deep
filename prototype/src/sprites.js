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
  var CHALK = ["................", "................", "................", "...ww......ww...", "....ww....ww....", ".....ww..ww.....", "......wwww......", ".......ww.......", "......wwww......", ".....ww..ww.....", "....ww....ww....", "...ww......ww...", "..ww........ww..", "................", "................", "................"];
  SPR.chalkX = mkSprite(CHALK, { w: '#e6e1d6' });
  var O = blank();
  for (var a = 0; a < 64; a++) { var t = a / 64 * Math.PI * 2; var ox = Math.round(7.5 + Math.cos(t) * 4.6), oy = Math.round(7.5 + Math.sin(t) * 4.6); O[oy][ox] = 'w'; if (ox + 1 < 16) O[oy][ox + 1] = 'w'; }
  SPR.chalkO = mkSprite(rows(O), { w: '#e6e1d6' });
  var ST2 = ["oooooooooookdhhh", "oxxxxxxxxxxkdppp", "oxxxxxxxxxxkdPPP", "oxxxxxxkkkkkdPPP", "oxxxxxxkdhhhdPPP", "oxxxxxxkdpppPPPP", "oxxxxxxkdPPPPPPP", "oxxkkkkkdPPPPPPP", "oxxkdhhhdPPPPPPP", "oxxkdpppPPPPPPPP", "oxxkdPPPPPPPPPPP", "kkkkdPPPPPPPPPPP", "hhhhdPPPPPPPPPPP", "ppppPPPPPPPPPPPP", "PPPPPPPPPPPPPPPP", "PPPPPPPPPPPPPPPP"];
  SPR.stair = mkSprite(ST2, { x: '#14100c', o: '#2a2018', k: '#0b0806', h: '#c9b49c', p: '#a8927a', P: '#7d6a55', d: '#5a4a3a' });
  SPR.scorch = mkSprite(["................", "................", "................", "......y..y......", "....yyyyyy.y....", "...yyxxxxyyy....", "..yyxxrxxxxy....", "..yxxrorxxxyy...", "..yxxxrxxrxxy...", "..yyxxxxxxxy....", "...yyxxxxyyy....", "....yyyyyy......", "......y.........", "................", "................", "................"], { y: '#3b2a1e', x: '#22242c', r: '#c4432b', o: '#ffb347' });
  SPR.scorchDust = mkSprite(["................", "................", "................", "......y..y......", "....yyyyyy.y....", "...yyxxxxyyy....", "..yyxxxxxxxy....", "..yxxxxxxxxyy...", "..yxxxxxxxxxy...", "..yyxxxxxxxy....", "...yyxxxxyyy....", "....yyyyyy......", "......y.........", "................", "................", "................"], { y: '#4a3222', x: '#22242c' });
  // 보물 1단계 금 알갱이(R24), 2단계 청록 보석, 3단계 유물
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
    border: mkSprite(["oooooooooo", "oyyyyyyyyo", "oy......yo", "oy.gggg.yo", "oy.g..g.yo", "oy.g..g.yo", "oy.gggg.yo", "oy......yo", "oyyyyyyyyo", "oooooooooo"], RP)
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
  // 도구 아이콘(10×10)
  SPR.icons = {
    ledger: mkSprite([".oooooooo.", ".ojjjjjjo.", ".ojllllro.", ".ojjjjjjo.", ".ojllllro.", ".ojjjjjjo.", ".ojllllro.", ".ojjjjjjo.", ".oooooooo.", ".........."], { o: '#3d2a1c', j: '#efe7d6', l: '#a59fb3', r: '#c4432b' }),
    sheet: mkSprite(["..oooooo..", ".ojjjjjjo.", ".ojxjjjjo.", ".ojjxjjjo.", ".ojxjxjjo.", ".ojjjjjjo.", ".ojllljjo.", ".ojjjjjjo.", ".oooooooo.", ".........."], { o: '#3a3542', j: '#efe7d6', x: '#c4432b', l: '#a59fb3' }),
    powder: mkSprite(["....y.....", "...k......", "...k......", "..oooo....", ".obbbbo...", "obbbbbbo..", "obbbbbbo..", "obbbbbbo..", ".obbbbo...", "..oooo...."], { o: '#1a1420', b: '#5d6270', k: '#9a6532', y: '#ffd25a' }),
    match: mkSprite(["r.r.r.....", "w.w.w.....", "w.w.w.....", "w.w.w.....", "w.w.w.....", "w.w.w.....", "w.w.w.....", "oooooo....", "obbbbo....", "oooooo...."], { r: '#c4432b', w: '#c9894a', o: '#3d2a1c', b: '#80583a' }),
    lens: mkSprite(["..oooo....", ".o....o...", "o.hh...o..", "o.h....o..", "o......o..", "o......o..", ".o....o...", "..oooooww.", "........ww", ".........w"], { o: '#b8c1d6', h: '#e8f4ff', w: '#9a6532' }),
    gloves: mkSprite(["..........", "..g.g.g...", ".ggggggg..", ".gGgGgGg..", ".gggggggg.", ".ggggggggg", ".gggggggg.", "..gggggg..", "..cccccc..", "..cccccc.."], { g: '#9a6532', G: '#c9894a', c: '#6b4a30' }),
    card: mkSprite(["..oooooo..", ".owwwwwwo.", ".owrwwwwo.", ".owwwwwwo.", ".owwrrwwo.", ".owwrrwwo.", ".owwwwwwo.", ".owwwwrwo.", ".owwwwwwo.", "..oooooo.."], { o: '#3a3542', w: '#efe7d6', r: '#c4432b' }),
    fuse: mkSprite(["........y.", ".......yhy", "........y.", ".......k..", "......k...", "..rrrrk...", ".rRRRRr...", ".rRRRRr...", ".rRRRRr...", "..rrrr...."], { r: '#7a2f28', R: '#c4432b', k: '#3a3542', y: '#ffd25a', h: '#fff4c2' }),
    refiner: mkSprite(["oooooooooo", ".occcccco.", "..occcco..", "...occo...", "....oo....", "....oo....", "...yyyy...", "..yhyyyy..", "..yyyyyy..", "...yyyy..."], { o: '#454956', c: '#9aa0b0', y: '#f2c14e', h: '#fff1b8' }),
    sieve: mkSprite(["..........", ".oooooooo.", "o.w.w.w.wo", "ow.w.w.w.o", "o.w.w.w.wo", "ow.w.w.w.o", ".oooooooo.", "....kk....", "....kk....", ".........."], { o: '#6b4a30', w: '#454956', k: '#22242c' }),
    moonsieve: mkSprite(["......ww..", ".......ww.", "........w.", ".......ww.", ".oooooooo.", "o.s.s.s.so", "os.s.s.s.o", "o.s.s.s.so", ".oooooooo.", ".........."], { o: '#6b4a30', s: '#c9c3d6', w: '#f1ece2' }),
    wedge: mkSprite(["oooooooooo", "ogggggggo.", ".ogggggo..", ".ogggggo..", "..ogggo...", "..ogggo...", "...ogo....", "...ogo....", "....o.....", "y..y..y..."], { o: '#454956', g: '#9aa0b0', y: '#ffd25a' }),
    betchalk: mkSprite(["..wwww....", ".w....w...", ".w....w...", ".w....w...", "..wwww....", "......ccc.", ".....cccc.", "....cccc..", "...cccc...", "...ccc...."], { w: '#e6e1d6', c: '#c9c3d6' }),
    tongs: mkSprite(["oo......oo", ".oo....oo.", "..oo..oo..", "...oooo...", "....oo....", "...o..o...", "..o....o..", ".o......o.", "o........o", ".........."], { o: '#9aa0b0' }),
    probe: mkSprite([".i..i..i..", ".i..i..i..", ".i..i..i..", ".i..i..i..", ".i..i..i..", ".i..i..i..", "wwwwwwwwww", ".i..i..i..", ".h..h..h..", ".........."], { i: '#c3c7d2', w: '#c4432b', h: '#9aa0b0' }),
    stairs: mkSprite(["......oooo", "......ohhh", "......oppp", "...oooopPP", "...ohhhPPP", "...opppPPP", "ooooPPPPPP", "ohhhPPPPPP", "opppPPPPPP", "oPPPPPPPPP"], { o: '#2a2018', h: '#c9b49c', p: '#a8927a', P: '#7d6a55' }),
    stairsDim: mkSprite(["......oooo", "......ohhh", "......oppp", "...oooopPP", "...ohhhPPP", "...opppPPP", "ooooPPPPPP", "ohhhPPPPPP", "opppPPPPPP", "oPPPPPPPPP"], { o: '#25212d', h: '#3a3542', p: '#34303f', P: '#2a2633' }),
    spring: mkSprite(["..........", "....b.....", "...bwb....", "...bwb....", "..bwwwb...", "..bwbwb...", "..bwwwb...", "...bbb....", "oooooooooo", "..........".replace(/\./g, '.')], { b: '#4f7590', w: '#c8e6f0', o: '#2f4a60' }),
    merchant: mkSprite(["....oo....", "...o..o...", "..oooooo..", ".offfffo..", ".ofyyyfo..", ".ofyhyfo..", ".ofyyyfo..", ".offfffo..", "..oooooo..", ".........."], { o: '#6b5a3f', f: '#c9a35a', y: '#ffd25a', h: '#fff4c2' })
  };
  SPR.icons.nugget = SPR.nugget; SPR.icons.gem = SPR.gem;
})();

// 달: Day 1 보름 → Day 15 그믐(R1)
function moonCanvas(day) {
  var k = Math.min(1, Math.max(0, (day - 1) / (CONFIG.days - 1)));   // 0 보름 ~ 1 그믐
  var cv = document.createElement('canvas'); cv.width = 16; cv.height = 16;
  var g = cv.getContext('2d');
  for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
    var nx = (x - 7.5) / 6.5, ny = (y - 7.5) / 6.5;
    if (nx * nx + ny * ny > 1) continue;
    var w = Math.sqrt(1 - ny * ny);
    var lit = nx < w * (1 - 2 * k) + 0.0001;   // 기우는 달: 오른쪽부터 어두워짐
    if (k >= 0.999) lit = false;
    var edge = (nx * nx + ny * ny) > 0.78;
    g.fillStyle = lit ? (edge ? '#c9c3d6' : '#f1ece2') : (edge ? '#2a2633' : '#34303f');
    g.fillRect(x, y, 1, 1);
  }
  return cv;
}
