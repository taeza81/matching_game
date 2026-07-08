import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1280, "height": 720})
        await page.goto('file:///C:/Users/USER/.gemini/antigravity/scratch/matching_game/index.html')
        await page.click('#start-btn')
        await page.wait_for_timeout(1000)
        await page.screenshot(path='C:/Users/USER/.gemini/antigravity/scratch/matching_game/grid_screenshot.png', full_page=True)
        await browser.close()

asyncio.run(main())
