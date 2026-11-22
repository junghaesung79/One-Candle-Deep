import asyncio, sys, json
from playwright.async_api import async_playwright

OUT = '/home/claude/proto2/shots/'
AUTO = r"""
window.autoStep = function (mode) {
  var d = run.d, f = d.floor;
  if (run.phase !== 'mine' || ui.sub) return 'phase:' + run.phase + ':' + ui.sub;
  var D = Core.deduce(f, { sleepy: Core.mut(run, 'sleepy') });
  var cell = function (i) { return f.cells[i]; };
  var ok = function (c) { return c.cover !== 'open'; };
  function hitAt(c) {
    if (Core.cheb(d.px, d.py, c.x, c.y) !== 1) { Core.approach(run, c.x, c.y); afterAction(); }
    if (c.mark === 1 && mode !== 'ignite') { Core.mark(run, c.x, c.y, 0); }
    var r = Core.hit(run, c.x, c.y); afterAction(); return r.ok ? 'hit' : 'fail';
  }
  if (d.embersOn) {
    var t0 = D.tre.map(cell).filter(ok).concat(f.cells.filter(function (c) { return ok(c) && c.mark === 2; }));
    if (t0.length) return hitAt(t0[0]);
    Core.returnUp(run); afterAction(); return 'return';
  }
  var tre = D.tre.map(cell).filter(ok);
  if (tre.length) return hitAt(tre[0]);
  if (mode === 'stair' && f.stair.found && d.candle >= Core.travelCost(run, f.depth + 1)) return 'stair';
  var safe = D.safe.map(cell).filter(ok).filter(function (c) { return Core.neighbors(f, c.x, c.y).some(function (n) { return n.cover !== 'open' && D.st[Core.idx(n)] !== 1; }); });
  var sc = safe.filter(function (c) { return D.stairCand.indexOf(Core.idx(c)) >= 0; });
  if (sc.length) return hitAt(sc[0]);
  if (!f.stair.found && D.stairCand.length) return hitAt(cell(D.stairCand[0]));
  var unk = D.haz.map(cell).filter(function (c) { return ok(c) && D.canT[Core.idx(c)] && D.canM[Core.idx(c)]; });
  if (unk.length && d.hp >= 2 && mode !== 'safe') return hitAt(unk[0]);
  if (safe.length) return hitAt(safe[0]);
  if (f.stair.found) return 'stair';
  var front = f.cells.filter(function (c) { return ok(c) && D.st[Core.idx(c)] === 0 && Core.neighbors(f, c.x, c.y).some(function (n) { return n.cover === 'open'; }); });
  if (front.length && d.hp >= 2) return hitAt(front[0]);
  Core.returnUp(run); afterAction(); return 'return';
};
window.goStair = function (pref) {
  var d = run.d, f = d.floor;
  Core.travelTo(run, f.stair.x, f.stair.y); afterAction();
  openFork();
  return f.forkOptions.map(function (o) { return o.kind + ':' + o.rule; }).join(',');
};
window.cellXY = function (x, y) { var r = board.getBoundingClientRect(); return [r.left + (x + 0.5) * r.width / 15, r.top + (y + 0.5) * r.height / 11]; };
"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 1280, 'height': 720})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console:' + m.text) if m.type == 'error' else None)
        await pg.goto('file:///home/claude/proto2/index.html')
        await pg.evaluate("try{localStorage.clear()}catch(e){}")
        await pg.reload()
        await pg.add_script_tag(content=AUTO)
        await pg.wait_for_timeout(1400)
        n = [0]
        async def shot(name, wait=0):
            if wait: await pg.wait_for_timeout(wait)
            n[0] += 1
            await pg.screenshot(path=OUT + '%02d_%s.png' % (n[0], name))
        async def ev(js): return await pg.evaluate(js)
        async def click_cell(x, y, button='left'):
            xy = await ev('cellXY(%d,%d)' % (x, y))
            await pg.mouse.click(xy[0], xy[1], button=button)
        await shot('deed')
        await pg.keyboard.press('Enter')
        await shot('day1_b1_start', 2200)
        # 반짝이는 금 알갱이(5,3): 두 번 클릭(다가가기 → 치기)
        await click_cell(5, 3); await pg.wait_for_timeout(150)
        await click_cell(5, 3)
        await shot('first_treasure_popup', 500)
        await shot('first_treasure_after', 1200)
        # 지뢰 (10,6)
        await click_cell(10, 6); await pg.wait_for_timeout(150); await click_cell(10, 6)
        await shot('first_mine', 700)
        await pg.wait_for_timeout(1500)
        # 계단 (11,9)
        await click_cell(11, 9); await pg.wait_for_timeout(150); await click_cell(11, 9)
        await pg.wait_for_timeout(600)
        await click_cell(11, 9); await pg.wait_for_timeout(200)
        await pg.keyboard.press('Enter')
        await shot('fork_b1', 400)
        await pg.keyboard.press('Digit2')   # 짝 광맥
        await shot('b2_pair_start', 2000)
        for i in range(10):
            r = await ev("autoStep()")
            await pg.wait_for_timeout(250)
        await shot('b2_mid', 900)
        # 지하 2층에서 계단까지
        for i in range(60):
            r = await ev("autoStep('stair')")
            await pg.wait_for_timeout(60)
            if r == 'stair' or r.startswith('phase'): break
        if r == 'stair':
            await ev("goStair()")
            await shot('fork_b2', 300)
            await pg.keyboard.press('Digit1')
            await shot('b3_xfloor', 2000)
        # 지하 3층: X 칸 점화(R26 = X 칸 치기)
        xs = await ev("run.d.floor.cells.filter(c=>c.mark===1&&c.cover!=='open').map(c=>[c.x,c.y])")
        if xs:
            x, y = xs[0]
            await ev("Core.approach(run,%d,%d);afterAction()" % (x, y))
            await shot('b3_x_adjacent', 400)
            await ev("Core.hit(run,%d,%d);afterAction()" % (x, y))
            await shot('b3_blast', 350)
            await shot('b3_blast_after', 1200)
        # 촛불을 15 이하로
        await ev("run.d.candle = Math.min(run.d.candle, 14); ui.hudDirty = true;")
        await shot('lowlight', 300)
        await ev("run.d.candle = 1; ui.hudDirty = true;")
        for i in range(3):
            r = await ev("autoStep('safe')")
            await pg.wait_for_timeout(200)
            if await ev("run.d.embersOn") or await ev("run.phase") != 'mine': break
        await shot('embers', 1700)
        for i in range(8):
            if await ev("run.phase") != 'mine': break
            await ev("autoStep()"); await pg.wait_for_timeout(250)
        if await ev("run.phase") == 'mine':
            await ev("Core.returnUp(run); afterAction()")
        await shot('settle_day1', 600)
        await shot('settle_day1_done', 2200)
        await pg.keyboard.press('Enter')
        await shot('shop_day1', 500)
        await pg.keyboard.press('Digit2')   # 연쇄 장부
        await shot('shop_day1_bought', 300)
        await pg.keyboard.press('Enter')
        await shot('day2_board', 1000)
        await pg.keyboard.press('ArrowRight'); await pg.wait_for_timeout(100)
        await pg.keyboard.press('Enter')
        await shot('day2_b1', 2200)
        # Day 2: 자동으로
        for day in (2, 3):
            for i in range(400):
                ph = await ev("run.phase")
                if ph == 'room':
                    kind = await ev("run.room.kind")
                    await shot('room_' + kind, 300)
                    if kind == 'spring': await pg.keyboard.press('Digit2')
                    else: await pg.keyboard.press('Enter')
                    await pg.wait_for_timeout(300); continue
                if ph != 'mine': break
                r = await ev("autoStep('stair')")
                if r == 'stair':
                    depth = await ev("run.d.floor.depth")
                    await ev("goStair()")
                    if day == 3 and depth == 2:
                        await shot('day3_fork_chunk', 300)
                    await pg.keyboard.press('Enter'); await pg.wait_for_timeout(700)
                    if day == 3 and await ev("run.d.floor.chunk!=null"):
                        await shot('day3_chunk_floor', 1600)
                        # 덩이 칸을 바로 캐서 깨어남 연출을 본다(디버그 정보로 위치를 찾는 촬영용 조작)
                        cc = await ev("(function(){var C=run.d.floor.chunk;return [C.x,C.y,C.w,C.h]})()")
                        await ev("Core.approach(run,%d,%d);afterAction();Core.hit(run,%d,%d);afterAction()" % (cc[0], cc[1], cc[0], cc[1]))
                        await shot('day3_awake', 900)
                        for yy in range(cc[1], cc[1] + cc[3]):
                            for xx in range(cc[0], cc[0] + cc[2]):
                                await ev("(function(){var c=Core.cellAt(run.d.floor,%d,%d);if(c.cover!=='open'&&run.phase==='mine'){Core.approach(run,%d,%d);afterAction();Core.hit(run,%d,%d);afterAction();}})()" % (xx, yy, xx, yy, xx, yy))
                                await pg.wait_for_timeout(120)
                        await shot('day3_chunk_done', 700)
                        await shot('day3_chunk_done2', 900)
                    continue
                await pg.wait_for_timeout(30)
            ph = await ev("run.phase")
            if ph == 'mine': await ev("Core.returnUp(run); afterAction()")
            await pg.wait_for_timeout(2600)
            await shot('settle_day%d' % day)
            if day == 3: await ev("run.cash = Math.max(run.cash, 600 - run.settle.net + run.settle.net)")
            await pg.keyboard.press('Enter'); await pg.wait_for_timeout(400)
            ph = await ev("run.phase")
            if ph == 'payment':
                await shot('payment_day3', 1700)
                await shot('payment_day3_done', 1500)
                await pg.keyboard.press('Enter'); await pg.wait_for_timeout(400)
            await shot('shop_day%d' % day, 200)
            if day == 2:
                await pg.keyboard.press('Enter')
                await shot('day3_board', 1000)
                await pg.keyboard.press('Enter'); await pg.wait_for_timeout(1500)
        # 계약 해지 화면 (디버그: 금고를 비우고 건너뛰기)
        await ev("run.cash = 0;")
        for k in range(6):
            ph = await ev("Core.debugSkipDay(run)")
            if ph == 'final': break
        await ev("ui.finalAt=0;renderOverlay();ui.hudDirty=true")
        await shot('contract_void', 500)
        # 일시정지와 가방
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(600)
        await shot('newrun_deed', 1300)
        print('errors', errs)
        print(await ev("run.phase"), await ev("run.day"))
        await b.close()

asyncio.run(main())
