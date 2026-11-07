'use strict';
const crypto=require('node:crypto');
const {mutate}=require('./storage');
const flow=require('./adminFlow');
const {back}=flow;
class Admin{
 constructor(db,catalog,vk,now=Date.now){Object.assign(this,{db,catalog,vk,now})}
 async handle(event){
  const {user,id}=event,key='sessions/'+user+'.json',token=crypto.randomUUID(),now=this.now();let acquired=false;
  let session=await mutate(this.db,key,s=>{
   s=s&&s.expiresAt>now?s:{step:'menu',revision:0};
   // The transition and its dedup receipt share one CAS write. A delayed retry
   // must not replay an old Start/menu after newer buttons changed the draft.
   if(s.lastEvent===id||s.handledEvents?.[id])return;
   if(Number.isSafeInteger(event.sequence)&&event.sequence<=(s.lastMessageSequence||0))return;
   if(s.lock?.until>now)throw Error('ADMIN_BUSY');
   acquired=true;return{...s,lock:{token,until:now+120000}};
  });
  if(!acquired){
   if(session.lastEvent===id&&session.reply&&!session.handledEvents?.[id]?.replySent){
    await this.reply(user,session.reply,id,session.revision);
    await this.markReplySent(key,id);
   }
   return;
  }
  try{
   let s=structuredClone(session),reply;
   if(event.command&&event.command!=='menu'&&event.nonce!==String(s.revision))reply={text:'Эта кнопка устарела. Используйте последнее сообщение.',rows:back};
   else ({session:s,reply}=await this.reduce(s,event));
   s.handledEvents=Object.fromEntries(Object.entries(session.handledEvents||{}).filter(([,r])=>r.at>now-2*86400000));
   if(session.lastEvent&&!s.handledEvents[session.lastEvent])s.handledEvents[session.lastEvent]={at:now,replySent:true};
   s.handledEvents[id]={at:now,replySent:false};
   s.lastMessageSequence=Number.isSafeInteger(event.sequence)?event.sequence:session.lastMessageSequence||0;
   s.revision=crypto.randomUUID();s.lastEvent=id;s.reply=reply;s.expiresAt=this.now()+86400000;s.lock=null;
   session=await mutate(this.db,key,current=>{if(current?.lock?.token!==token)throw Error('ADMIN_LEASE');return s});
   await this.reply(user,reply,id,session.revision);
   await this.markReplySent(key,id);
  }catch(e){await mutate(this.db,key,s=>s?.lock?.token===token?{...s,lock:null}:undefined);const errors={PRODUCT_CONFLICT:'Карточку уже изменили. Вернитесь в меню и откройте её заново: чужие изменения сохранены.',PHOTO_FETCH:'Фото не загрузилось. Черновик не опубликован. Пришлите фото ещё раз.',PHOTO_HOST:'Адрес фото не поддерживается. Пришлите его как фотографию VK.',PHOTO_MIME:'Нужен JPEG, PNG или WebP.',PHOTO_CONTENT:'Файл не распознан как фотография.',PHOTO_SIZE:'Фото больше 10 МБ. Пришлите уменьшенное изображение.',PRODUCT:'Проверьте поля: название, состав, описание и цена не должны превышать допустимый размер.'};if(errors[e.message]){await this.vk.send(user,errors[e.message],id+':error',back);return}throw e}
 }
 async markReplySent(key,id){await mutate(this.db,key,s=>{if(!s?.handledEvents?.[id]||s.handledEvents[id].replySent)return;s.handledEvents[id].replySent=true;return s})}
 async reply(user,reply,id,revision){
  const rows=(reply.rows||back).map(row=>row.map(([label,command])=>[label,command==='menu'?'menu':command+'|'+(revision??'')]));
  // VK inline keyboards: max 6 rows / 10 buttons. Menus are split consistently.
  const pages=[];let page=[],count=0;
  for(const row of rows){if(page.length===6||count+row.length>10){pages.push(page);page=[];count=0}page.push(row);count+=row.length}if(page.length)pages.push(page);
  for(let i=0;i<pages.length;i++){
   if(i===0&&reply.photo&&this.vk.sendPhoto)await this.vk.sendPhoto(user,reply.text,id+':reply:'+i,pages[i],reply.photo);
   else await this.vk.send(user,i?'Продолжение меню:':reply.text,id+':reply:'+i,pages[i]);
  }
 }
 async reduce(s,e){return flow.reduce(s,e,this.catalog)}
 previewRows(){return flow.previewRows()}
}
module.exports={Admin,preview:flow.preview};
