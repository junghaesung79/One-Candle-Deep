# 2차 검수 반영 검증: 첫 화면~Day 3은 디버그 없이 실제 입력(마우스 클릭·키)으로, Day 8·15·해지는 디버그 키로. 스크린샷 proto2/shots4/
import asyncio, os, sys, json
from playwright.async_api import async_playwright
OUT = '/home/claude/proto2/shots4/'
WOFF = '/home/claude/proto2_tools/ps2p-latin.woff2'
CSS = "@font-face { font-family: 'Press Start 2P'; font-style: normal; font-weight: 400; src: url(https://fonts.gstatic.com/s/pressstart2p/v15/local.woff2) format('woff2'); }"

# 화면에 보이는 정보(숫자·분필·두드려 보기·표지판)만으로 다음 행동을 고른다. 정답(c.haz)은 읽지 않는다
AI = r"""
window.AI = {
  pref: { border: 6, lonely: 5, pair: 4, tally: 4, rows: 4, minepair: 5, plain: 1 },
  next: function () {
    var d = run.d, f = d.floor, W = Core.W;
    if (run.phase !== 'mine') return { t: 'none', why: run.phase };
    if (ui.sub === 'fork') { var best = 0, bv = -9; f.forkOptions.forEach(function (o, i) { var v = (AI.pref[o.rule] || 0) + ({ value: 1.5, candle: 1.2, streak: 1, more: 0.5, spring: d.hp < 3 ? 3 : 0, merchant: 0 }[o.bonus] || 0); if (v > bv) { bv = v; best = i; } }); return { t: 'key', k: 'Digit' + (best + 1), why: 'fork' }; }
    var D = Core.deduce(f, { sleepy: Core.mut(run, 'sleepy'), blur: Core.mut(run, 'blur') });
    var reach = function (c) { return Core.neighbors(f, c.x, c.y).some(function (n) { return Core.walkable(f, n); }); };
    var dist = function (c) { return Math.max(Math.abs(c.x - d.px), Math.abs(c.y - d.py)); };
    var near = function (list) { list = list.filter(reach); list.sort(function (a, b) { return dist(a) - dist(b); }); return list[0]; };
    var cells = function (ids) { return ids.map(function (i) { return f.cells[i]; }); };
    if (d.embersOn) {
      var o = near(f.cells.filter(function (c) { return c.cover !== 'open' && c.mark === 2; }));
      if (o) return AI.hitAct(o, 'ember-O');
      var sf = near(cells(D.safe));
      if (sf && d.embers > 1) return AI.hitAct(sf, 'ember-safe');
      return { t: 'return', why: 'embers done' };
    }
    // 벽 낙서대로 미리 그어진 X에 불을 붙인다(첫 판 지하 3층)
    var gx = near(f.cells.filter(function (c) { return c.cover !== 'open' && c.mark === 1 && c.givenX && !c.probe; }));
    if (gx && d.candle >= Core.igniteCost(run) + 2) return AI.hitAct(gx, 'ignite');
    var tre = near(cells(D.tre).filter(function (c) { return c.mark !== 1; }));
    if (tre) return AI.hitAct(tre, 'treasure');
    if (f.stair && !f.stair.found) {   // 빛 새는 바위·밑줄로 계단 자리를 알면 먼저 깬다(화면에 보이는 단서)
      var lit = Core.cellAt(f, f.stair.x, f.stair.y), litVis = !Core.mut(run, 'sleepy') && !f.stair.blocked && Core.neighbors(f, lit.x, lit.y).some(function (n) { return n.cover === 'open'; });
      if (litVis) return AI.hitAct(lit, 'lit stair rock');
      var sc0 = near(cells(D.stairCand)); if (sc0) return AI.hitAct(sc0, 'stair cand');
    }
    var safe = near(cells(D.safe).filter(function (c) { return Core.neighbors(f, c.x, c.y).some(function (n) { return n.cover !== 'open'; }); }));
    var stairKnown = f.stair && f.stair.found && !f.stair.blocked;
    var cost = stairKnown ? Core.travelCost(run, f.depth + 1) : 0;
    if (safe && d.candle > cost + 6 && (!stairKnown || AI.safeLeft-- > 0 || (f.stair && f.stair.blocked))) return AI.hitAct(safe, 'safe');
    // 확실한 지뢰: X를 긋고 불을 붙인다(둘레에 덮인 칸이 3칸 이상일 때)
    var mines = cells(D.mine).filter(function (c) { return !f.chunk && Core.neighbors(f, c.x, c.y).filter(function (n) { return n.cover !== 'open'; }).length >= 3; });
    var mn = near(mines);
    if (mn && d.candle >= Core.igniteCost(run) + cost + 4) { if (mn.mark !== 1) return { t: 'mark', x: mn.x, y: mn.y, why: 'X' }; return AI.hitAct(mn, 'ignite'); }
    if (stairKnown && d.candle >= cost) {
      if (d.px !== f.stair.x || d.py !== f.stair.y) return { t: 'click', x: f.stair.x, y: f.stair.y, why: 'to stair' };
      AI.safeLeft = 6; return { t: 'key', k: 'Enter', why: 'open fork' };
    }
    var sc = near(cells(D.stairCand)); if (sc) return AI.hitAct(sc, 'stair cand');
    // 계단 바람 쪽 바위
    if (!stairKnown && f.stair && !f.stair.found && !Core.mut(run, 'sleepy')) {
      var wind = f.cells.filter(function (c) { return c.cover !== 'open' && reach(c) && D.st[c.y * W + c.x] === 1; });
      var w0 = near(wind); if (w0) return AI.hitAct(w0, 'safe2');
    }
    var unk = cells(D.haz.filter(function (i) { return D.tre.indexOf(i) < 0 && D.mine.indexOf(i) < 0; })).filter(function (c) { return c.probe == null && reach(c); });
    if (unk.length && d.probes > 0 && d.candle > 4) { var u = near(unk); return { t: 'probe', x: u.x, y: u.y, why: 'probe' }; }
    var probedSafe = near(f.cells.filter(function (c) { return c.cover !== 'open' && c.probe === 'safe' && !c.fizzle; }));
    if (probedSafe) return AI.hitAct(probedSafe, 'probed treasure');
    if (d.candle > 0 && d.hp >= 2) {
      var front = f.cells.filter(function (c) { return c.cover !== 'open' && reach(c) && c.mark !== 1 && D.st[c.y * W + c.x] !== 2; });
      var g = near(front); if (g) return AI.hitAct(g, 'guess');
    }
    if (d.candle > 0 && d.hp >= 2 && unk.length) return AI.hitAct(near(unk), 'gamble');
    return { t: 'return', why: 'stuck' };
  },
  safeLeft: 6,
  hitAct: function (c, why) {
    var d = run.d;
    if (Math.max(Math.abs(c.x - d.px), Math.abs(c.y - d.py)) === 1) return { t: 'click', x: c.x, y: c.y, why: why };
    return { t: 'click', x: c.x, y: c.y, why: why + '(approach)' };
  }
};
"""


async def main():
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT): os.remove(OUT + f)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 1280, 'height': 720})
        errs = []; dialogs = []
        pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
        pg.on('console', lambda m: errs.append('console.' + m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
        pg.on('dialog', lambda d: (dialogs.append(d.message), asyncio.ensure_future(d.dismiss())))
        async def fonts_css(route): await route.fulfill(status=200, content_type='text/css', body=CSS)
        async def fonts_file(route): await route.fulfill(status=200, content_type='font/woff2', body=open(WOFF, 'rb').read(), headers={'Access-Control-Allow-Origin': '*'})
        if not os.environ.get('FALLBACK'):
            await pg.route('https://fonts.googleapis.com/**', fonts_css)
            await pg.route('https://fonts.gstatic.com/**', fonts_file)
        else:
            await pg.route('https://fonts.googleapis.com/**', lambda r: r.abort()); await pg.route('https://fonts.gstatic.com/**', lambda r: r.abort())
        await pg.goto('file:///home/claude/proto2/index.html')
        await pg.evaluate("localStorage.clear()"); await pg.reload(); await pg.wait_for_timeout(1500)
        await pg.evaluate(AI)
        ev = pg.evaluate
        n = [0]
        keys_used = [0]
        async def shot(name, wait=0):
            if wait: await pg.wait_for_timeout(wait)
            n[0] += 1
            await pg.screenshot(path=OUT + '%02d_%s.png' % (n[0], name))
        def cxy(x, y): return (44 + x * 48 + 24, 64 + y * 48 + 24)
        async def click(x, y, button='left', wait=200):
            X, Y = cxy(x, y)
            await pg.mouse.click(X, Y, button=button)
            await pg.wait_for_timeout(wait)
        async def btn(sel, wait=300):
            await pg.click(sel); await pg.wait_for_timeout(wait)
        async def confirm_if_open(wait=400):
            if await ev("confirmOpen()"): await btn('#cmodalOk', wait)
        async def dig(x, y, wait=200):   # 바위: 첫 클릭은 옆으로 가서 조준, 같은 바위 두 번째 클릭에 캔다(R54)
            if await ev("Core.cellAt(run.d.floor,%d,%d).mark===1" % (x, y)): LOG.append(('X-dig-refused', x, y)); return   # X 칸은 캐지 않는다(R57)
            for _ in range(3):
                if await ev("run.phase!=='mine'||Core.cellAt(run.d.floor,%d,%d).cover==='open'" % (x, y)): return
                await click(x, y, wait=wait)
        async def use_mode(kind, x, y, wait=300):   # 버튼 → 고르기 상태 → 칸 클릭(R53)
            await btn('#useSlots [data-use="%s"]' % kind, 150)
            if not await ev("!!ui.mode"): return False
            await click(x, y, wait=wait)
            if await ev("!!ui.mode"): await click(x, y, 'right', 100)
            return True
        async def go_up(name=None):
            await btn('#bReturn', 300)
            if name: await shot(name)
            await btn('#cmodalOk', 500)
        SEEN = set([(1, 1)]); LOG = []
        async def autoplay(limit=400):
            for i in range(limit):
                await confirm_if_open()
                ph = await ev("run.phase")
                if ph == 'room':
                    await shot('room_d%d' % await ev("run.day"), 600)
                    await btn('#oCd' if await ev("run.room.kind==='spring'") else '#oLeave', 1800); continue
                a = await ev("AI.next()")
                if ph != 'mine' or a['t'] == 'none': return ph
                fl = await ev("run.d.floor.depth"); dy = await ev("run.day")
                key_ = (dy, fl)
                if key_ not in SEEN:
                    SEEN.add(key_); await pg.wait_for_timeout(1500); await shot('arrive_d%d_b%d' % key_)
                    if key_ == (1, 3):   # X 칸 클릭: 캐지지 않고 안내만(R57)
                        xc = await ev("(function(){var f=run.d.floor;var c=f.cells.find(function(c){return c.cover!=='open'&&c.mark===1;});return c?[c.x,c.y]:null;})()")
                        if xc:
                            before = await ev("run.d.candle"); await click(xc[0], xc[1], wait=300); await shot('d1b3_xcell_click')
                            print('xcell click: cover=', await ev("Core.cellAt(run.d.floor,%d,%d).cover" % tuple(xc)), 'candle', before, '->', await ev("run.d.candle"))
                    continue
                if await ev("run.d.embersOn") and 'emb%d' % dy not in SEEN:
                    SEEN.add('emb%d' % dy); await shot('embers_d%d' % dy, 1700)
                LOG.append((dy, fl, a['t'], a.get('why'), a.get('x'), a.get('y'), await ev("run.d.hp"), await ev("run.d.candle")))
                if a['t'] == 'click':
                    if a['why'] == 'ignite' or await ev("Core.cellAt(run.d.floor,%d,%d).mark===1&&Core.cellAt(run.d.floor,%d,%d).cover!=='open'" % (a['x'], a['y'], a['x'], a['y'])):
                        await btn('#useSlots [data-use="blast"]', 150)
                        if 'ignmode%d' % dy not in SEEN: SEEN.add('ignmode%d' % dy); await shot('blast_mode_d%d' % dy)
                        if await ev("!!ui.mode"):
                            await click(a['x'], a['y'], wait=220)
                            if 'ign%d' % dy not in SEEN: SEEN.add('ign%d' % dy); await shot('blast_d%d' % dy, 300)
                        else: await shot('blast_refused_d%d' % dy)
                    elif a['why'] == 'to stair':
                        await click(a['x'], a['y'], wait=250)
                    else:
                        await dig(a['x'], a['y'], 180)
                elif a['t'] == 'mark': await click(a['x'], a['y'], 'right', 150)
                elif a['t'] == 'probe':
                    await use_mode('probe', a['x'], a['y'])
                elif a['t'] == 'key':
                    if a['why'] == 'open fork':
                        await click(a['x'] if 'x' in a else await ev("run.d.px"), await ev("run.d.py"), wait=400)
                        if await ev("ui.sub==='fork'"): await shot('fork_d%d_b%d' % (dy, fl))
                    elif a['why'] == 'fork':
                        await btn('[data-fork="%d"]' % (int(a['k'][-1]) - 1), 400); await confirm_if_open(1200); await pg.wait_for_timeout(1000)
                elif a['t'] == 'return':
                    await go_up('return_confirm_d%d' % dy if 'ret%d' % dy not in SEEN else None); SEEN.add('ret%d' % dy); return await ev("run.phase")
            return await ev("run.phase")
        async def end_of_day():
            await shot('settle', 2600)
            for _ in range(3):
                if await ev("run.phase") != 'settle': break
                await btn('#oNext', 700)
            ph = await ev("run.phase")
            if ph == 'payment':
                await shot('payment', 2900)
                for _ in range(3):
                    if await ev("run.phase") != 'payment': break
                    await btn('#oPay', 800)
                ph = await ev("run.phase")
            if ph == 'shop': await shot('shop'); await btn('#oDay', 900)
            elif ph == 'final': await shot('final', 800)
            return await ev("run.phase")

        # ---- 오프닝 3컷(첫 판 자동) ----
        await shot('opening_1', 300)
        await btn('#oOpNext', 500); await shot('opening_2')
        await btn('#oOpNext', 500); await shot('opening_3')
        await btn('#oOpNext', 600); await shot('deed', 300)
        await pg.wait_for_timeout(1300)
        await btn('#oGoDeed', 700); await shot('gift')
        await btn('[data-gift="1"]', 200); await btn('#oGift', 2200); await shot('d1b1_start_light')
        await shot('d1b1_bubbles', 1500)
        # 조준: 떨어진 바위 클릭 → 옆으로 가서 조준 표시
        await click(5, 3, wait=400); await shot('d1b1_aim_after_click')
        await click(5, 3, wait=300); await shot('d1b1_first_treasure', 300)
        await pg.wait_for_timeout(1500)
        await dig(11, 5); await shot('d1b1_mine', 900)
        await pg.wait_for_timeout(1200)
        # 마우스를 올린 칸(얇은 테두리) + 아래 안내 줄
        X, Y = cxy(await ev("run.d.px") + 1, await ev("run.d.py")); await pg.mouse.move(X, Y); await shot('d1b1_hover', 200)
        # 설정 화면(⚙ 버튼)
        await btn('#bGear', 300); await shot('settings')
        await btn('#oClose', 300)
        st = await autoplay(400)
        print('day1 after B1..', st, await ev("JSON.stringify({d:run.d&&run.d.floor.depth,c:run.d&&run.d.candle,hp:run.d&&run.d.hp,ph:run.phase})"))
        if await ev("run.phase==='mine'&&run.d.floor.depth===3"):
            await shot('d1b3_arrive', 400)
            # X 칸 클릭: 캐지지 않고 안내만(R57)
            xc = await ev("(function(){var f=run.d.floor;var c=f.cells.find(function(c){return c.cover!=='open'&&c.mark===1;});return c?[c.x,c.y]:null;})()")
            if xc:
                before = await ev("run.d.candle")
                await click(xc[0], xc[1], wait=300); await shot('d1b3_xcell_click')
                print('xcell click: open=', await ev("Core.cellAt(run.d.floor,%d,%d).cover" % tuple(xc)), 'candle', before, '->', await ev("run.d.candle"))
            st = await autoplay(200)
        print('day1 end', st); [print('  ', l) for l in LOG[-12:]]
        if await ev("run.phase") == 'mine': await go_up()
        await end_of_day()
        for day in (2, 3):
            if await ev("run.phase") != 'board': break
            await shot('board_d%d' % day, 900)
            await btn('[data-order="1"]', 200); await btn('#oGoBoard', 2300); await shot('d%d_b1' % day)
            st = await autoplay(300)
            if await ev("run.phase") == 'mine': await go_up()
            await end_of_day()
        print('after day3', await ev("JSON.stringify({ph:run.phase,day:run.day,cash:run.cash,stamps:run.stamps})"))
        # ---- 디버그 구간: Day 8 · 15 ----
        for k in range(12):
            if await ev("run.day>=8&&run.phase==='board'") or await ev("run.phase==='final'"): break
            await ev("run.cash += 900; Core.debugSkipDay(run); ui.sub=null; renderOverlay(); ui.hudDirty=true")
        if await ev("run.phase==='board'"):
            await shot('board_d8', 900); await btn('#oGoBoard', 2300); await shot('d8_b1')
            await ev("run.cash += 2500; ui.hudDirty=true; Core.debugEndDay(run); afterAction()"); await pg.wait_for_timeout(300)
            await end_of_day()
            for k in range(10):
                if await ev("run.day>=15&&run.phase==='board'"): break
                await ev("run.cash += 1500; Core.debugSkipDay(run); ui.sub=null; renderOverlay(); ui.hudDirty=true")
            await shot('board_d15', 900); await btn('#oGoBoard', 2300); await shot('d15_b1')
            for k in range(4):
                await ev("(function(){var f=run.d.floor,s=f.stair; if(!s.found){var nb=Core.neighbors(f,s.x,s.y).filter(function(n){return !n.haz})[0]; nb.cover='open'; run.d.px=nb.x; run.d.py=nb.y; Core.hit(run,s.x,s.y);} run.d.candle=80; Core.travelTo(run,s.x,s.y); afterAction(); openFork();})()")
                await pg.wait_for_timeout(300)
                if k == 3: await shot('fork_d15_chunk')
                await btn('[data-fork="0"]', 400); await confirm_if_open(); await pg.wait_for_timeout(1400)
                if await ev("run.phase==='room'"):
                    await btn('#oCd' if await ev("run.room.kind==='spring'") else '#oLeave', 1800)
            await shot('d15_b5_chunk')
            await ev("(function(){var f=run.d.floor,C=f.chunk; for(var y=C.y-1;y<=C.y+C.h;y++)for(var x=C.x-1;x<=C.x+C.w;x++){var c=Core.cellAt(f,x,y); if(c&&!c.haz&&!c.stair&&c.cover!=='open'){c.cover='open'; ui.hudDirty=true; return;}}})()")
            await shot('d15_b5_gold_dot', 600)
            await ev("run.cash += 7000; ui.hudDirty=true; Core.debugEndDay(run); afterAction()"); await pg.wait_for_timeout(300)
            await end_of_day()
        # ---- 잠든 계단 날: 빛 번짐 없음(디버그로 변덕 지정) ----
        await ev("startNewRun(false); run.mutationPlan[1]=['sleepy']; ui.shownAt=0; deedGo();")
        await pg.wait_for_timeout(300)
        await ev("ui.shownAt=0; giftGo(0)"); await pg.wait_for_timeout(300)
        await ev("if(run.phase==='board'){ui.shownAt=0; boardGo();}"); await pg.wait_for_timeout(2300); await shot('sleepy_day_no_light')
        print('sleepy light drawn?', await ev("Core.mut(run,'sleepy')"))
        # ---- 계약 해지 화면 ----
        await ev("run.cash=0; for(var i=0;i<4&&run.phase!=='final';i++){Core.debugSkipDay(run); run.cash=Math.min(run.cash,50);} ui.sub=null; renderOverlay();")
        await pg.wait_for_timeout(300)
        if await ev("run.phase==='final'"): await shot('void_screen', 1200)
        print('DIALOGS', len(dialogs))
        print('ERRORS', len(errs)); [print(' ', e) for e in errs[:20]]
        await b.close()
asyncio.run(main())
