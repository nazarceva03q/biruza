'use strict';
const crypto=require('node:crypto');
const {mutate,hash}=require('./storage');
const {normalize,Invalid}=require('./validation');
const types=require('./types');
const DAY=86400000,RETENTION=30*DAY,TECH=37*DAY;
const digest=(key,text)=>crypto.createHmac('sha256',key).update(text).digest('hex');
function identity(key){const match=/^(\d{13})\.([a-f0-9-]{36})$/.exec(key||'');if(!match)throw new Invalid('KEY');return Number(match[1])}
function chunks(text){return Array.from({length:Math.ceil([...text].length/3000)},(_,i)=>[...text].slice(i*3000,(i+1)*3000).join(''))}
function format(r){const p=r.payload;return chunks([
 `${types[p.requestType]}`,`Получено: ${new Date(r.receivedAt).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'})} МСК`,
 `Имя: ${p.name}`,`Контакт: ${p.phone}`,`Связаться: ${p.channel}`,p.subject&&`Тема: ${p.subject}`,p.date&&`Желаемая дата заказа: ${p.date}`,
 p.delivery&&`Получение: ${p.delivery}`,p.time&&`Желаемое время: ${p.time}`,p.address&&`Адрес: ${p.address}`,
 p.items.length&&'Товары:\n'+p.items.map(x=>`${x.name} × ${x.quantity}`).join('\n'),
 p.postcard&&`Открытка: ${p.postcard}`,p.comment&&`Пожелания: ${p.comment}`
 ].filter(Boolean).join('\n'))}
async function rate(db,secret,source,now){
 const window=Math.floor(now/3600000);
 for(const [name,limit] of [[digest(secret,source),20],['global',200]]){
  await mutate(db,`limits/${window}-${name}.json`,old=>{const n=old?.n||0;if(n>=limit)throw new Invalid('RATE',429);return{n:n+1,expiresAt:(window+2)*3600000}});
 }
}
class Requests{
 constructor({db,vk,catalog,secret,consentVersion,peer,now=Date.now}){if(!secret||secret.length<32)throw Error('REQUEST_SECRET_CONFIG');Object.assign(this,{db,vk,catalog,secret,consentVersion,peer,now})}
 async accept(key,input,source){
  const issued=identity(key),now=this.now(),id='BR-'+hash(key).slice(0,32),path='requests/'+id+'.json';
  let record=(await this.db.get(path)).data;
  if(record&&(now>=record.expiresAt||!record.payload))throw new Invalid('EXPIRED',410);
  const payload=normalize(input,record?.payload?.consentVersion||this.consentVersion,record?.receivedAt??now);
  const fingerprint=digest(this.secret,JSON.stringify(payload));
  if(record){if(record.fingerprint!==fingerprint)throw new Invalid('KEY_CONFLICT',409);if(now>=record.expiresAt||!record.payload)throw new Invalid('EXPIRED',410);return{accepted:true,id,delivery:record.delivery}}
  // Old keys cannot resurrect records once their bounded technical receipt is removed.
  if(issued>now+60000||now-issued>DAY)throw new Invalid('KEY_EXPIRED',410);
  await rate(this.db,this.secret,source,now);
  const catalog=await this.catalog();
  payload.items=payload.items.map(item=>{const p=catalog.products.find(p=>p.id===item.id);if(!p)throw new Invalid('PRODUCT');return{...item,name:p.name,photo:(p.images||[])[0]||''}});
  if(!Number.isSafeInteger(this.peer)||this.peer<=2000000000)throw Error('PEER_CONFIG');
  record={id,fingerprint,receivedAt:now,expiresAt:now+RETENTION,technicalUntil:now+TECH,payload,peer:this.peer,delivery:'pending',parts:[],purge:'waiting'};
  const text=format(record);record.parts=text.map((_,i)=>({id:id+':'+i,state:'pending',cmid:null,attempts:0}));const pictures=payload.items.filter(item=>item.photo);for(let i=0;i<pictures.length;i++)record.parts.push({id:id+':photo:'+i,kind:'photo',itemIndex:payload.items.indexOf(pictures[i]),state:'pending',cmid:null,attempts:0});
  try{await this.db.put(path,record,null)}catch(e){if(e.code!=='CONFLICT')throw e;const existing=(await this.db.get(path)).data;if(!existing||existing.fingerprint!==fingerprint)throw new Invalid('KEY_CONFLICT',409);if(now>=existing.expiresAt||!existing.payload)throw new Invalid('EXPIRED',410);record=existing}
  return{accepted:true,id,delivery:record.delivery};
 }
 async deliver(path){
  const token=crypto.randomUUID(),now=this.now();let claimed=false;
  let r=await mutate(this.db,path,r=>{
   if(!r?.payload||r.expiresAt<=now||r.delivery==='delivered'||r.delivery==='review'||r.lease?.until>now)return;
   // A crashed worker can retry with the same random_id for five minutes only.
   if(r.firstAttempt&&now-r.firstAttempt>=300000){return{...r,delivery:'review',lease:null}}
   claimed=true;return{...r,firstAttempt:r.firstAttempt||now,lease:{token,until:now+120000}};
  });
  if(!claimed||r.lease?.token!==token)return;
  const text=format(r);
  for(let i=0;i<r.parts.length;i++){
   const current=(await this.db.get(path)).data;if(!current?.payload||current.expiresAt<=this.now()||current.lease?.token!==token)return;
   const part=current.parts[i];if(part.state==='sent')continue;
   if(part.attempts>=3){await mutate(this.db,path,x=>({...x,delivery:'review',lease:null}));return}
   // Routing intent is durable before every external call; no message text in receipts.
   await mutate(this.db,path,x=>{if(x.lease?.token!==token||!x.payload||x.expiresAt<=this.now())throw Error('LEASE');x.parts[i]={...x.parts[i],state:'unknown',attempts:x.parts[i].attempts+1};return x});
   try{
    const item=part.kind==='photo'?current.payload.items[part.itemIndex]:null;const cmid=item?await this.vk.sendRequestPhoto(current.peer,item.name+' × '+item.quantity,part.id,item.photo):await this.vk.sendPart(current.peer,text[i],part.id);
    await mutate(this.db,path,x=>{if(!x)return; x.parts[i]={...x.parts[i],state:'sent',cmid};return x});
   }catch{
    await mutate(this.db,path,x=>x?{...x,delivery:'uncertain',lease:null}:undefined);return;
   }
  }
  await mutate(this.db,path,x=>x?{...x,delivery:'delivered',lease:null}:undefined);
 }
 async cleanup(path,apply=false){
  let r=(await this.db.get(path)).data,now=this.now();if(!r||now<r.expiresAt)return{due:false};
  if(!apply)return{due:true,payloadPresent:!!r.payload,parts:r.parts.length};
  // Atomic replacement removes content itself. No delete/write gap, no stale payload writer.
  r=await mutate(this.db,path,x=>{if(!x||this.now()<x.expiresAt)return;const{payload,...receipt}=x;return{...receipt,purge:'cloud_purged',lease:null}});
  if(!r)return{due:true};
  // Allow any in-flight VK call (12 s) to finish and save its cmid before external deletion.
  if(now<r.expiresAt+120000)return{due:true,cloudPurged:true};
  for(let i=0;i<r.parts.length;i++){
   const p=r.parts[i];if(p.deleted||!p.cmid||p.deleteAttempts>=5||p.nextDeleteAt>now)continue;
   const token=crypto.randomUUID();let claimed=false;
   const locked=await mutate(this.db,path,x=>{if(!x||x.parts[i].deleted||x.parts[i].deleteLease>now||x.parts[i].deleteAttempts>=5)return;claimed=true;x.parts[i]={...x.parts[i],deleteLease:now+60000,deleteToken:token,deleteAttempts:(x.parts[i].deleteAttempts||0)+1};return x});
   if(!claimed||locked?.parts[i].deleteToken!==token)continue;let ok=false;try{ok=await this.vk.remove(r.peer,p.cmid)}catch{}
   await mutate(this.db,path,x=>{if(!x||x.parts[i].deleteToken!==token)return;x.parts[i]={...x.parts[i],deleted:ok,deleteLease:0,nextDeleteAt:now+DAY,deleteResult:ok?'api_confirmed':'unconfirmed'};return x});
  }
  r=await mutate(this.db,path,x=>{if(!x)return;const missing=x.parts.some(p=>p.state==='unknown'&&!p.cmid),failed=x.parts.some(p=>p.cmid&&!p.deleted&&p.deleteAttempts>=5);return{...x,purge:missing||failed?'review':x.parts.every(p=>p.state==='pending'||p.deleted)?'vk_api_confirmed':'vk_pending'}});
  if(r&&now>=r.technicalUntil)await this.db.remove(path);
  return{due:true,cloudPurged:true,state:r?.purge};
 }
 async run({apply=false,deliverEnabled=false,budgetMs=20000}={}){
  const start=this.now(),summary={visited:0,due:0,cloudPurged:0,review:0,errors:0,deliveryDelivered:0,deliveryUncertain:0,deliveryReview:0};
  // Persistent continuation; scan resumes rather than always revisiting the first page.
  const cursor=(await this.db.get('worker/cursor.json')).data||{after:''};let after=cursor.after,more=true;
  while(more&&this.now()-start<budgetMs){const page=await this.db.list('requests/',after);for(const key of page.keys){if(this.now()-start>budgetMs){more=false;break}try{const r=(await this.db.get(key)).data;if(r){summary.visited++;if(this.now()>=r.expiresAt){const c=await this.cleanup(key,apply);summary.due++;if(c.cloudPurged)summary.cloudPurged++;if(c.state==='review')summary.review++}else{if(deliverEnabled)await this.deliver(key);const state=(await this.db.get(key)).data?.delivery;if(state==='delivered')summary.deliveryDelivered++;if(state==='uncertain')summary.deliveryUncertain++;if(state==='review')summary.deliveryReview++}}}catch{summary.errors++}after=key;await mutate(this.db,'worker/cursor.json',()=>({after,at:this.now()}));}if(!more)break;more=page.more;if(!more)await mutate(this.db,'worker/cursor.json',()=>({after:'',at:this.now()}));}
  await mutate(this.db,'worker/last-result.json',()=>({...summary,at:this.now(),apply}));return summary;
 }
}
module.exports={Requests,RETENTION,TECH,format,identity};
