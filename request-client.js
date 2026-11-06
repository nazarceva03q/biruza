/* No contact data is written to browser storage. Config stays disabled until live checks. */
window.BIRUZA_REQUESTS=(()=>{
 const storageKey='biruza-request-attempt-v1';let fallback=null;
 function read(){try{return JSON.parse(sessionStorage.getItem(storageKey))||fallback}catch{return fallback}}
 function write(value){fallback=value;try{value?sessionStorage.setItem(storageKey,JSON.stringify(value)):sessionStorage.removeItem(storageKey)}catch{}}
 async function send(payload){
  const config=window.BIRUZA_CONFIG;if(!config.inquiryEndpoint||!config.consentVersion)throw Error('NOT_CONNECTED');
  const endpoint=new URL(config.inquiryEndpoint);if(endpoint.protocol!=='https:')throw Error('NOT_CONNECTED');
  const fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(payload))))).map(n=>n.toString(16).padStart(2,'0')).join('');
  let attempt=read();if(attempt&&attempt.fingerprint!==fingerprint)throw Error('CHANGED_WHILE_UNKNOWN');
  if(!attempt){attempt={fingerprint,key:Date.now()+'.'+crypto.randomUUID()};write(attempt)}
  let r;try{r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':attempt.key},body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)})}catch{throw Error('UNKNOWN')}
  let result;try{result=await r.json()}catch{throw Error('UNKNOWN')}
  if(!r.ok||result.accepted!==true||!/^BR-[a-f0-9]{32}$/.test(result.id||''))throw Error(result.error==='RATE'?'RATE':result.error==='EXPIRED'||result.error==='KEY_EXPIRED'?'EXPIRED':'UNKNOWN');
  write(null);return result;
 }
 return{send};
})();
