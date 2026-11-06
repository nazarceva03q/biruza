'use strict';
const crypto=require('node:crypto');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const hmac=(k,x)=>crypto.createHmac('sha256',k).update(x).digest();
const encode=x=>encodeURIComponent(x).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
class Conflict extends Error {constructor(){super('CONFLICT');this.code='CONFLICT'}}
class Storage {
 constructor({bucket,accessKey,secretKey}){if(!bucket||!accessKey||!secretKey)throw Error('STORAGE_CONFIG');Object.assign(this,{bucket,accessKey,secretKey})}
 async request(method,key='',body=Buffer.alloc(0),extra={},query={}){
  const host='storage.yandexcloud.net',date=new Date().toISOString().replace(/[:-]|\.\d{3}/g,''),day=date.slice(0,8),scope=day+'/ru-central1/s3/aws4_request';
  const uri='/'+encode(this.bucket)+'/'+key.split('/').map(encode).join('/'),qs=Object.entries(query).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>encode(k)+'='+encode(v)).join('&');
  const headers={host,'x-amz-content-sha256':hash(body),'x-amz-date':date,...extra};
  const names=Object.keys(headers).sort(),canonical=names.map(k=>k+':'+String(headers[k]).trim()+'\n').join('');
  const signed=names.join(';'),req=[method,uri,qs,canonical,signed,hash(body)].join('\n');
  const signing=hmac(hmac(hmac(hmac('AWS4'+this.secretKey,day),'ru-central1'),'s3'),'aws4_request');
  headers.authorization='AWS4-HMAC-SHA256 Credential='+this.accessKey+'/'+scope+', SignedHeaders='+signed+', Signature='+hmac(signing,'AWS4-HMAC-SHA256\n'+date+'\n'+scope+'\n'+hash(req)).toString('hex');
  const r=await fetch('https://'+host+uri+(qs?'?'+qs:''),{method,headers,body:['GET','HEAD'].includes(method)?undefined:body,signal:AbortSignal.timeout(10000)});
  const data=Buffer.from(await r.arrayBuffer());
  if([409,412].includes(r.status))throw new Conflict();
  if(!r.ok&&r.status!==404)throw Error('STORAGE_HTTP_'+r.status);
  return {status:r.status,data,etag:r.headers.get('etag')};
 }
 async get(key){const r=await this.request('GET',key);return r.status===404?{data:null,etag:null}:{data:JSON.parse(r.data.toString()),etag:r.etag}}
 async put(key,data,etag){const headers={'content-type':'application/json',...(etag?{'if-match':etag}:{'if-none-match':'*'})};await this.request('PUT',key,Buffer.from(JSON.stringify(data)),headers)}
 async binary(key,data,mime){await this.request('PUT',key,data,{'content-type':mime,'if-none-match':'*','cache-control':'public,max-age=31536000,immutable'})}
 async remove(key){await this.request('DELETE',key)}
 async list(prefix,after=''){
  const r=await this.request('GET','',undefined,{}, {'list-type':'2',prefix,'max-keys':'100',...(after?{'start-after':after}:{})});
  const xml=r.data.toString(),unescape=s=>s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
  return {keys:[...xml.matchAll(/<Key>([\s\S]*?)<\/Key>/g)].map(m=>unescape(m[1])),more:xml.includes('<IsTruncated>true</IsTruncated>')};
 }
}
async function mutate(db,key,fn,retries=12){for(let i=0;i<retries;i++){const s=await db.get(key),value=await fn(s.data);if(value===undefined)return s.data;try{await db.put(key,value,s.etag);return value}catch(e){if(e.code!=='CONFLICT')throw e}}throw Error('CONTENTION')}
module.exports={Storage,mutate,hash,Conflict};
