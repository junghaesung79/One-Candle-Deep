import asyncio
from playwright.async_api import async_playwright
OUT = '/home/claude/proto2/shots/'

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 1280, 'height': 720})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file:///home/claude/proto2/index.html')
        await pg.evaluate("try{localStorage.setItem('ocd2_settings', JSON.stringify({tutorialDone:true}))}catch(e){}")
        await pg.reload(); await pg.wait_for_timeout(1400)
        async def ev(js): return await pg.evaluate(js)
        async def shot(name, wait=0):
            if wait: await pg.wait_for_timeout(wait)
            await pg.screenshot(path=OUT + 'x_%s.png' % name)
        await shot('deed_notutorial')
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(900)
        await shot('board_day1')
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(1800)
        # 도구 넣고 줄 ×2에서 X 묶음 점화(계산 연출)
        await ev("['fuse','refiner','ledger','moonsieve'].forEach(function(id){run.owned.push(id)}); run.d.streak=2; ui.hudDirty=true;")
        found = await ev("""(function(){var f=run.d.floor;
          var ms=f.cells.filter(function(c){return c.haz==='mine'&&c.cover!=='open'&&Core.neighbors(f,c.x,c.y).some(function(n){return n.cover==='open'})});
          for(var i=0;i<ms.length;i++){var nb=Core.neighbors(f,ms[i].x,ms[i].y).filter(function(n){return n.haz==='mine'&&n.cover!=='open'});
            if(nb.length){ms[i].mark=1;nb[0].mark=1;Core.approach(run,ms[i].x,ms[i].y);afterAction();return [ms[i].x,ms[i].y];}}
          if(ms.length){ms[0].mark=1;Core.approach(run,ms[0].x,ms[0].y);afterAction();return [ms[0].x,ms[0].y];}return null;})()""")
        await shot('combo_ready', 300)
        if found:
            await ev("Core.hit(run,%d,%d);afterAction()" % (found[0], found[1]))
            await shot('combo_t300', 300)
            await shot('combo_t700', 400)
            await shot('combo_t1200', 500)
        # 보물 줄 ×2.5 팝업
        t = await ev("""(function(){var f=run.d.floor;var t=f.cells.filter(function(c){return c.haz==='treasure'&&c.cover!=='open'&&Core.neighbors(f,c.x,c.y).some(function(n){return n.cover==='open'})})[0];
          if(!t)return null;run.d.streak=3;Core.approach(run,t.x,t.y);afterAction();Core.hit(run,t.x,t.y);afterAction();return [t.x,t.y];})()""")
        await shot('gain_popup_t300', 300)
        await shot('gain_popup_t500', 200)
        await pg.keyboard.press('Tab'); await shot('bag', 200); await pg.keyboard.press('Tab')
        await pg.keyboard.press('Escape'); await shot('pause', 200); await pg.keyboard.press('Escape')
        await pg.keyboard.press('F2'); await shot('debug_reveal', 200); await pg.keyboard.press('F2')
        # 샘 방, 상인 방 갈림길 강제
        await ev("""(function(){var f=run.d.floor;f.stair.found=true;var s=Core.cellAt(f,f.stair.x,f.stair.y);s.cover='open';
          run.d.roomForks={};run.d.roomForks[run.d.forkCount+1]='spring';f.forkOptions=null;
          f.forkOptions=[{kind:'floor',rule:'tally',depth:f.depth+1},{kind:'spring',rule:'plain',depth:f.depth+1}];
          run.d.px=f.stair.x;run.d.py=f.stair.y;afterAction();openFork();})()""")
        await shot('fork_spring', 300)
        await pg.keyboard.press('Digit2'); await shot('spring', 400)
        await pg.keyboard.press('Digit2'); await shot('after_spring', 1600)
        await ev("""(function(){var f=run.d.floor;f.stair.found=true;var s=Core.cellAt(f,f.stair.x,f.stair.y);s.cover='open';
          f.forkOptions=[{kind:'floor',rule:'tally',depth:f.depth+1},{kind:'merchant',rule:'plain',depth:f.depth+1}];
          run.cash+=900;run.d.px=f.stair.x;run.d.py=f.stair.y;afterAction();openFork();})()""")
        await pg.keyboard.press('Digit2'); await shot('merchant', 400)
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(900)
        await ev("""(function(){var f=run.d.floor;f.stair.found=true;var s=Core.cellAt(f,f.stair.x,f.stair.y);s.cover='open';
          f.forkOptions=[{kind:'floor',rule:'tally',depth:f.depth+1},{kind:'floor',rule:'rows',depth:f.depth+1}];
          run.d.px=f.stair.x;run.d.py=f.stair.y;afterAction();openFork();})()""")
        await pg.keyboard.press('Digit1'); await shot('tally_floor', 1800)
        # 하루 끝 → 상점(되팔기) → 납부까지 건너뛰어 잔금 성공 화면
        await pg.keyboard.press('F8'); await shot('settle_anim', 900); await shot('settle_done', 1800)
        await pg.keyboard.press('Enter'); await shot('shop_owned', 400)
        await ev("run.cash += 20000; renderOverlay();")
        for k in range(30):
            ph = await ev("Core.debugSkipDay(run)")
            if ph == 'final': break
            await ev("run.cash += 3000")
        await ev("ui.finalAt=0;renderOverlay();ui.hudDirty=true")
        await shot('final_success', 400)
        print('errors', errs)
        await b.close()
asyncio.run(main())
