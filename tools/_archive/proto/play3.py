# 2차 프로토타입 마무리 검증: 첫 화면 → Day 3 납부 → Day 8 → 잔금. 스크린샷은 proto2/shots2/
# Google Fonts 요청은 로컬 Press Start 2P 파일로 대신 응답한다(배포 페이지에서는 실제로 불러온다). FALLBACK=1이면 폰트 요청을 막아 대체 글꼴을 본다.
import asyncio, os, sys
from playwright.async_api import async_playwright
OUT = '/home/claude/proto2/shots2/'
WOFF = '/home/claude/proto2_tools/ps2p-latin.woff2'
FALLBACK = os.environ.get('FALLBACK') == '1'
PREFIX = 'fb_' if FALLBACK else ''
ONLY = sys.argv[1] if len(sys.argv) > 1 else 'all'

CSS = """@font-face { font-family: 'Press Start 2P'; font-style: normal; font-weight: 400; font-display: swap;
  src: url(https://fonts.gstatic.com/s/pressstart2p/v15/local.woff2) format('woff2'); }"""

HELP = r"""
window.T_ = {
  near: function (x, y) { Core.approach(run, x, y); afterAction(); },
  hit: function (x, y) { Core.approach(run, x, y); afterAction(); var r = Core.hit(run, x, y); afterAction(); return r; },
  reveal: function () { var f = run.d.floor; return f.cells.map(function (c) { return c; }); },
  stairOpen: function () {   // 계단을 찾아 위에 선다(검증용 치트: 계단 옆까지 길을 연다)
    var f = run.d.floor, s = f.stair, sc = Core.cellAt(f, s.x, s.y);
    if (!s.found) {
      var nb = Core.neighbors(f, s.x, s.y).filter(function (n) { return !n.haz; })[0];
      if (Core.approach(run, s.x, s.y).ok === false || Core.cheb(run.d.px, run.d.py, s.x, s.y) !== 1) { nb.cover = 'open'; run.d.px = nb.x; run.d.py = nb.y; }
      var c0 = run.d.candle; Core.hit(run, s.x, s.y); afterAction();
    }
    Core.travelTo(run, s.x, s.y); afterAction();
    return [s.x, s.y];
  },
  firstOf: function (pred) { var f = run.d.floor; for (var i = 0; i < f.cells.length; i++) if (pred(f.cells[i], f)) return [f.cells[i].x, f.cells[i].y]; return null; },
  frontier: function (kind) { var f = run.d.floor; return T_.firstOf(function (c) { return c.cover !== 'open' && c.haz === kind && Core.neighbors(f, c.x, c.y).some(function (n) { return n.cover === 'open'; }); }); },
  info: function () { var d = run.d; return { phase: run.phase, day: run.day, depth: d && d.floor && d.floor.depth, rule: d && d.floor && d.floor.rule, candle: d && d.candle, cash: run.cash, embers: d && d.embers, on: d && d.embersOn }; }
};
"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 1280, 'height': 720})
        errs = []
        pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
        pg.on('console', lambda m: errs.append('console.' + m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
        async def fonts_css(route):
            await route.fulfill(status=200, content_type='text/css', body=CSS, headers={'Access-Control-Allow-Origin': '*'})
        async def fonts_file(route):
            await route.fulfill(status=200, content_type='font/woff2', body=open(WOFF, 'rb').read(), headers={'Access-Control-Allow-Origin': '*'})
        if FALLBACK:
            await pg.route('https://fonts.googleapis.com/**', lambda r: r.fulfill(status=200, content_type='text/css', body='/* blocked */'))
        else:
            await pg.route('https://fonts.googleapis.com/**', fonts_css)
            await pg.route('https://fonts.gstatic.com/**', fonts_file)
        await pg.goto('file:///home/claude/proto2/index.html')
        await pg.evaluate("localStorage.clear()")
        await pg.reload(); await pg.wait_for_timeout(1500)
        await pg.evaluate(HELP)
        async def ev(js): return await pg.evaluate(js)
        async def shot(name, wait=0):
            if wait: await pg.wait_for_timeout(wait)
            await pg.screenshot(path=OUT + PREFIX + name + '.png')
        async def key(k, wait=0):
            await pg.keyboard.press(k)
            if wait: await pg.wait_for_timeout(wait)

        await shot('01_deed')
        await key('Enter', 2200); await shot('02_d1b1_start')
        # 반짝이는 금 알갱이(5,3)
        await ev("T_.near(5,3)"); await shot('03_d1b1_aim', 200)
        await ev("T_.hit(5,3)"); await shot('04_gain_t300', 300); await shot('05_gain_t1200', 900)
        # 지뢰(10,6)를 밟는다
        await ev("T_.hit(10,6)"); await shot('06_mine', 700); await pg.wait_for_timeout(1200)
        await ev("T_.stairOpen(); openFork()"); await shot('07_fork_b1', 400)
        await key('Digit2', 2200); await shot('08_d1b2_pair')
        t = await ev("T_.frontier('treasure')")
        if t: await ev("T_.hit(%d,%d)" % tuple(t)); await shot('09_d1b2_treasure', 1500)
        await ev("T_.stairOpen(); openFork()"); await shot('10_fork_b2', 400)
        await key('Digit1', 2200); await shot('11_d1b3_border')
        x = await ev("T_.firstOf(function(c){return c.mark===1&&c.cover!=='open'})")
        await ev("T_.near(%d,%d)" % tuple(x)); await shot('12_d1b3_x_adjacent', 400)
        await key('Space'); await shot('13_blast_t150', 150); await shot('14_blast_t450', 300); await shot('15_blast_t900', 450); await shot('16_blast_t1500', 600)
        await ev("T_.stairOpen(); clearBubbles()"); await shot("17_blocked_stair", 600)
        await ev("run.d.candle = 16; ui.hudDirty = true")
        sc = await ev("T_.firstOf(function(c,f){return c.cover!=='open'&&!c.haz&&!c.stair&&Core.neighbors(f,c.x,c.y).some(function(n){return n.cover==='open'})})")
        await ev("T_.hit(%d,%d)" % tuple(sc)); await shot('18_lowlight', 600)
        await ev("run.d.candle = 1; ui.hudDirty = true")
        sc = await ev("T_.firstOf(function(c,f){return c.cover!=='open'&&!c.haz&&!c.stair&&Core.neighbors(f,c.x,c.y).some(function(n){return n.cover==='open'})})")
        await ev("T_.hit(%d,%d)" % tuple(sc)); await shot('19_embers', 1800)
        # 불씨를 다 쓴다
        for k in range(8):
            ph = await ev("run.phase")
            if ph != 'mine': break
            sc = await ev("T_.firstOf(function(c,f){return c.cover!=='open'&&!c.haz&&!c.stair&&Core.neighbors(f,c.x,c.y).some(function(n){return n.cover==='open'})})")
            await ev("T_.hit(%d,%d)" % tuple(sc)); await pg.wait_for_timeout(150)
        await shot('20_settle_d1_t600', 600); await shot('21_settle_d1_done', 2200)
        await key('Enter', 600); await shot('22_shop_d1')
        await ev("var e=document.querySelector('[data-buy=\"1\"]'); if(e) e.dispatchEvent(new MouseEvent('mouseenter'))"); await shot('23_shop_d1_hover', 200)
        await key('Enter', 900); await shot('24_board_d2')
        await key('Enter', 2200); await shot('25_d2b1_border')
        cl = await ev("run.d.floor.cluster")
        print('cluster', cl, await ev("JSON.stringify(run.d.floor.graffiti)"))
        await key('F2', 100); await shot('26_d2b1_reveal'); await key('F2', 100)
        # 두드려 보기: 지뢰 칸이면 X가 저절로
        m = await ev("T_.frontier('mine')")
        if m:
            await ev("Core.approach(run,%d,%d); afterAction(); run.d.face={dx:%d-run.d.px,dy:%d-run.d.py}; doProbe()" % (m[0], m[1], m[0], m[1])); await shot('27_probe_mine', 500)
        await ev("T_.stairOpen(); openFork()"); await shot('28_fork_d2', 400)
        await key('Digit2', 2200); await shot('29_d2b2_lonely')
        await key('F2', 100); await shot('30_d2b2_reveal'); await key('F2', 100)
        await key('F8', 600); await key('Enter', 600); await key('Enter', 600); await key('Enter', 900)
        await shot('31_board_d3')
        await key('Enter', 2200); await shot('32_d3b1')
        await ev("T_.stairOpen(); openFork()"); await key('Digit1', 2200)
        await ev("T_.stairOpen(); openFork()"); await shot('33_fork_d3_chunk', 400)
        await key('Digit1', 2400); await shot('34_d3b3_chunk')
        ch = await ev("var C=run.d.floor.chunk; [C.x,C.y,C.w,C.h]")
        await ev("T_.hit(%d,%d)" % (ch[0], ch[1])); await shot('35_awake', 900)
        await ev("T_.hit(%d,%d)" % (ch[0] + 1, ch[1])); await ev("T_.hit(%d,%d)" % (ch[0], ch[1] + 1)); await pg.wait_for_timeout(500)
        await ev("T_.hit(%d,%d)" % (ch[0] + 1, ch[1] + 1)); await shot('36_chunk_t400', 400); await shot('37_chunk_t1300', 900)
        await ev("run.cash += 400; ui.hudDirty=true")
        await key('F8', 300); await shot('38_settle_d3', 2600)
        await key('Enter', 400); await shot('39_payment_d3_t400'); await shot('40_payment_d3_done', 2800)
        await key('Enter', 600); await shot('41_shop_d3')
        # Day 8
        for k in range(10):
            d = await ev("run.day")
            if d >= 8 and await ev("run.phase") == 'board': break
            await ev("run.cash += 600; Core.debugSkipDay(run); ui.sub=null; renderOverlay(); ui.hudDirty=true")
        await pg.wait_for_timeout(900); await shot('42_board_d8')
        await key('Enter', 2200); await shot('43_d8b1_blur')
        await ev("T_.stairOpen(); openFork()"); await shot('44_fork_d8', 400)
        await key('Escape', 300)
        await ev("run.cash += 2000; ui.hudDirty=true")
        await key('F8', 300); await key('Enter', 2600); await key('Enter', 400); await shot('45_payment_d8', 2800)
        await key('Enter', 600)
        for k in range(10):
            d = await ev("run.day")
            if d >= 15 and await ev("run.phase") == 'board': break
            await ev("run.cash += 1500; Core.debugSkipDay(run); ui.sub=null; renderOverlay(); ui.hudDirty=true")
        await pg.wait_for_timeout(900); await shot('46_board_d15')
        await key('Enter', 2200); await shot('47_d15b1')
        await key('Tab', 300); await shot('48_bag'); await key('Tab', 200)
        await key('Escape', 300); await shot('49_pause'); await key('Escape', 200)
        await ev("run.cash += 3000; ui.hudDirty=true")
        await key('F8', 300); await key('Enter', 2600); await key('Enter', 400); await shot('50_payment_d15', 2800)
        await key('Enter', 900); await shot('51_final')
        print('ERRORS', len(errs)); [print(' ', e) for e in errs]
        await b.close()
asyncio.run(main())
