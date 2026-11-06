'use strict';
const crypto=require('node:crypto');
const{mutate,hash}=require('./storage');
const secure=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));
class Webhook{
 constructor({config,db,vk,admin,now=Date.now}){Object.assign(this,{config,db,vk,admin,now})}
 async handle(d){
  const c=this.config;if(!c.group||!c.secret) return{status:503,body:'Not configured'};
  if(String(d.group_id)!==String(c.group)||!secure(d.secret,c.secret))return{status:403,body:'Forbidden'};
  if(d.type==='confirmation')return{status:c.confirmation?200:503,body:c.confirmation||'Not configured'};
  if(!['message_new','message_event'].includes(d.type))return{status:200,body:'ok'};
  const m=d.type==='message_new'?d.object?.message:d.object,user=m?.from_id??m?.user_id;
  if(!m||m.out||!c.admins.includes(user))return{status:200,body:'ok'};
  const rawId=d.event_id||m.event_id||(m.peer_id+':'+m.conversation_message_id);if(!rawId)return{status:400,body:'Event ID required'};
  const id=hash(c.group+':'+d.type+':'+rawId),key='events/'+id+'.json',now=this.now();
  // VK retries after a bounded period. Reject old events after technical receipt expiry.
  if(d.type==='message_new'&&(!Number.isInteger(m.date)||Math.abs(now-m.date*1000)>86400000))return{status:200,body:'ok'};
  if(d.type==='message_event')try{await this.vk.call('messages.sendMessageEventAnswer',{event_id:m.event_id,user_id:m.user_id,peer_id:m.peer_id})}catch{}
  const existing=(await this.db.get(key)).data;if(existing?.done)return{status:200,body:'ok'};
  if(m.peer_id!==user){
   if(d.type==='message_new'&&Number.isSafeInteger(m.peer_id)&&m.peer_id>2000000000){
    if(c.discovery&&m.text==='Проверка подключения заявок'){
     await this.db.put(key,{done:false,expiresAt:now+2*86400000},null).catch(e=>{if(e.code!=='CONFLICT')throw e});
     await mutate(this.db,'routing/discovered.json',()=>({peer:m.peer_id,group:c.group,at:now}));
     await this.vk.send(m.peer_id,'Проверка подключения «Бирюза». Номер беседы: '+m.peer_id+'. Приём заявок пока выключен.',id);
     await mutate(this.db,key,x=>({...x,done:true}));
    }else if(c.deleteTest&&m.peer_id===c.peer&&m.text==='Проверить удаление'&&Number.isInteger(m.reply_message?.conversation_message_id)){
     const cmid=m.reply_message.conversation_message_id,r=await this.vk.call('messages.getByConversationMessageId',{peer_id:c.peer,conversation_message_ids:String(cmid)}),target=r?.items?.find(x=>x.conversation_message_id===cmid);
     if(target?.from_id===-c.group&&target.text==='Проверка подключения «Бирюза». Номер беседы: '+c.peer+'. Приём заявок пока выключен.'&&!(target.attachments||[]).length&&!(target.fwd_messages||[]).length){const ok=await this.vk.remove(c.peer,cmid);await this.vk.send(c.peer,ok?'VK подтвердил запрос удаления. Проверьте у второго участника. Проверка возраста 30 суток ещё не выполнена.':'Удаление VK не подтверждено.',id);await mutate(this.db,key,()=>({done:true,expiresAt:now+2*86400000}))}
    }
   }
   return{status:200,body:'ok'};
  }
  let payload=m.payload;if(typeof payload==='string')try{payload=JSON.parse(payload)}catch{payload=null}
  const [command,nonce]=typeof payload?.command==='string'?payload.command.split('|'):[];
  const photos=(m.attachments||[]).filter(x=>x.type==='photo').map(x=>(x.photo?.sizes||[]).filter(x=>x.url&&x.width&&x.height).sort((a,b)=>b.width*b.height-a.width*a.height)[0]?.url).filter(Boolean);
  try{await this.db.put(key,{done:false,expiresAt:now+2*86400000},null)}catch(e){if(e.code!=='CONFLICT')throw e}
  const sequence=d.type==='message_new'&&Number.isSafeInteger(m.conversation_message_id)&&m.conversation_message_id>0?m.conversation_message_id:undefined;
  await this.admin.handle({user,id,text:m.text||'',command,nonce,photos,sequence});
  await mutate(this.db,key,x=>({...x,done:true}));return{status:200,body:'ok'};
 }
}
module.exports={Webhook};
