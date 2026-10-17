const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
let playwright;
try{playwright=require(process.env.PLAYWRIGHT_PATH||'playwright');}catch{
 const cache=path.join(require('node:os').homedir(),'AppData/Local/npm-cache/_npx');
 for(const folder of fs.existsSync(cache)?fs.readdirSync(cache):[]){try{playwright=require(path.join(cache,folder,'node_modules/playwright'));break;}catch{}}
}
if(!playwright)throw new Error('Provide Playwright in the development environment.');
const {chromium}=playwright;
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1000,height:900}});
  const original=fs.readFileSync(path.resolve(__dirname,'../config.js'),'utf8');
  await page.route('**/config.js',r=>r.fulfill({contentType:'application/javascript',body:original.replace("inquiryEndpoint: ''","inquiryEndpoint: '/api/inquiries'").replace("privacyUrl: ''","privacyUrl: 'privacy.html'").replace("consentVersion: ''","consentVersion: 'test-only'")}));
  const calls=[];
  await page.route('**/api/inquiries',async r=>{calls.push(r.request().postDataJSON());await r.fulfill({status:calls.length===1?503:200,contentType:'application/json',body:JSON.stringify(calls.length===1?{accepted:false}:{accepted:true,id:'QA-ONLY'})});});
  await page.goto('http://127.0.0.1:4177');
  await page.locator('.hero [data-inquiry="bouquet"]').click();
  await page.locator('[name=budget]').fill('3500');await page.locator('[name=phone]').fill('8 (910) 178-39-64');await page.locator('[name=comment]').fill('QA: букет');await page.locator('[name=consent]').check();
  await page.locator('button[type=submit]').click();await page.waitForSelector('.form-status.error');
  assert.equal(await page.locator('[name=comment]').inputValue(),'QA: букет');
  assert(!(await page.locator('#dialog-title').innerText()).includes('получена'));
  await page.locator('button[type=submit]').click();await page.getByRole('heading',{name:'Заявка получена',exact:true}).waitFor();
  assert.equal(calls.length,2);assert.equal(calls[0].requestId,calls[1].requestId);assert.equal(calls[1].phone,'+79101783964');assert.equal(calls[1].budget,3500);
  console.log('Mocked server rejection/retry/acceptance, context and normalization passed. No real inquiry sent.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
