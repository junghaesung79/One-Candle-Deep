import asyncio, sys
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width':1280,'height':720})
        errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console:'+m.text) if m.type=='error' else None)
        await pg.goto('file:///home/claude/proto2/index.html')
        await pg.wait_for_timeout(800)
        await pg.screenshot(path='/tmp/s1.png')
        print('errors', errs)
        await b.close()
asyncio.run(main())
