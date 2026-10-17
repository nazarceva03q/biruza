const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
let playwright;
try{playwright=require('playwright');}catch{
  const cache=path.join(os.homedir(),'AppData','Local','npm-cache','_npx');
  for(const folder of fs.existsSync(cache)?fs.readdirSync(cache):[]){try{playwright=require(path.join(cache,folder,'node_modules','playwright'));break;}catch{}}
}
if(!playwright)throw new Error('For browser QA provide Playwright in the development environment.');
const out=path.resolve(__dirname,'../artifacts');fs.mkdirSync(out,{recursive:true});
let qaBrowser;
(async()=>{
  const browser=await playwright.chromium.launch({executablePath:process.env.BROWSER_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  qaBrowser=browser;
  const errors=[];
  const page=await browser.newPage({viewport:{width:1440,height:1050}});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400&&r.url().startsWith('http://127.0.0.1:4177'))errors.push(r.status()+' '+r.url());});
  await page.goto('http://127.0.0.1:4177',{waitUntil:'networkidle'});
  await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.locator('#flower-grid .product-card').count(),6);
  assert.equal(await page.locator('#balloon-grid .product-card').count(),4);
  assert(await page.locator('#store-location').innerText().then(t=>t.includes('Мира, 53')));
  assert.equal(await page.locator('img').count(),1,'Only logo, no photos');
  await page.locator('[data-filter-flower="basket"]').click();
  assert.equal(await page.locator('#flower-grid .product-card').count(),1);
  await page.locator('[data-filter-balloon="sets"]').click();
  assert.equal(await page.locator('#balloon-grid .product-card').count(),1);
  assert.equal(await page.locator('#flower-grid .product-card').count(),1,'Filters independent');
  await page.locator('[data-filter-flower="all"]').click();
  await page.locator('[data-filter-balloon="all"]').click();
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.locator('.hero [data-inquiry="bouquet"]').click();
  await page.locator('input[name=budget]').fill('1000');
  await page.locator('#inquiry-form button[type=submit]').click();
  assert.equal(await page.locator('#prepared-text').count(),0,'Invalid budget rejected');
  await page.locator('input[name=budget]').fill('3500');
  await page.locator('textarea[name=comment]').fill('Нежные оттенки, добавить шары');
  await page.locator('#inquiry-form button[type=submit]').click();
  const prepared=await page.locator('#prepared-text').inputValue();
  assert(prepared.replace(/\s/g,' ').includes('3 500')&&prepared.includes('Нежные оттенки'));
  assert((await page.locator('#dialog').innerText()).includes('ещё не отправлено'));
  await page.keyboard.press('Escape');
  await page.locator('[data-inquiry="event"]').click();
  assert.equal(await page.locator('input[name=location]').count(),1);
  await page.keyboard.press('Escape');
  assert(!(await page.locator('body').innerText()).includes('\u2014'),'No em dash visible');
  // Reveal each section before screenshots; test natural scrolling at all widths.
  async function revealAll(){await page.evaluate(async()=>{for(let y=0;y<document.documentElement.scrollHeight;y+=600){window.scrollTo({top:y,behavior:'instant'});await new Promise(r=>setTimeout(r,55));}window.scrollTo({top:0,behavior:'instant'});});await page.waitForTimeout(900);}
  await revealAll();
  await page.screenshot({path:path.join(out,'desktop.png'),fullPage:true});
  await page.screenshot({path:path.join(out,'desktop-hero.png')});
  const matrix=[];
  for(const width of [320,375,390,768,1024,1440]){
    await page.setViewportSize({width,height:844});
    await page.waitForTimeout(100);
    const size=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
    assert(size.scroll<=size.client+1,`Overflow at ${width}: ${JSON.stringify(size)}`);
    matrix.push({width,...size});
  }
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.scrollTo(0,0));
  await page.locator('.menu-toggle').click();assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'),'true');
  await page.locator('#mobile-menu a[href="#balloons"]').click();assert.equal(await page.locator('#mobile-menu').isVisible(),false);
  await revealAll();await page.screenshot({path:path.join(out,'mobile.png'),fullPage:true});await page.screenshot({path:path.join(out,'mobile-hero.png')});
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('.reveal-pending').count(),0);
  assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior),'auto');
  assert.equal(await page.locator('.review-stars').count(),0);
  const nojs=await browser.newPage({javaScriptEnabled:false});await nojs.goto('http://127.0.0.1:4177');assert(await nojs.locator('h1').isVisible());await nojs.close();
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'qa.json'),JSON.stringify({passed:true,widths:matrix,errors,checks:['independent filters','budget validation','honest prepared message','contextual event form','mobile navigation','reduced motion','no photos except logo','no em dash','no-JS hero']},null,2));
  await browser.close();console.log('Browser checks passed; screenshots and report in artifacts/.');
})().catch(async e=>{console.error(e);await qaBrowser?.close();process.exitCode=1;});
