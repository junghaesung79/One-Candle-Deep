import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width':1280,'height':720})
        pg.on('pageerror', lambda e: print('ERR', e.stack if hasattr(e,'stack') else e))
        await pg.goto('file:///home/claude/proto2/index.html'); await pg.wait_for_timeout(1300)
        for k in ['Enter']: await pg.keyboard.press(k)
        await pg.wait_for_timeout(500)
        for i in range(20):
            await pg.keyboard.press('F9'); await pg.wait_for_timeout(150)
            ph = await pg.evaluate('run.phase+":"+run.day')
            print(ph)
            if ph.startswith('final'): break
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(500)
        await b.close()
asyncio.run(main())
