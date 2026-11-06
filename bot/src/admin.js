'use strict';
const crypto=require('node:crypto');
const {mutate,hash}=require('./storage');
const {categories,galleries}=require('./catalog');
const names={wedding:'Свадебные композиции',store_opening:'Открытия магазинов',event:'Праздники и мероприятия'};
const fields=['photos','name','composition','description','price','hit'];
const prompts={photos:'Пришлите фотографии. Затем «Готово». Можно без фото.',name:'Напишите название.',composition:'Напишите состав. Прочерк – без состава.',description:'Напишите описание. Прочерк – без описания.',price:'Напишите цену цифрами. Прочерк – стоимость согласуется.',hit:'Сделать товар хитом? Напишите Да или Нет.'};
const menu=[['Добавить товар','add'],['Изменить товар','edit'],['Удалить товар','delete'],['Фотографии оформления','galleries']].map(x=>[x]);
const back=[[['Отмена / в меню','menu']]];
function preview(p){return[p.name,p.category,p.composition,p.description,p.price===null?'Стоимость согласуем':p.price+' ₽',p.hit?'Хит':'Без отметки Хит','Фото: '+p.images.length,...p.images].join('\n')}
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
 async reply(user,reply,id,revision){const rows=(reply.rows||back).map(row=>row.map(([label,command])=>[label,command==='menu'?'menu':command+'|'+(revision??'')]));for(let i=0,offset=0;offset<rows.length;i++,offset+=6)await this.vk.send(user,i?'Продолжение:':reply.text,id+':reply:'+i,rows.slice(offset,offset+6));}
 async reduce(s,e){
  let cmd=e.command,text=(e.text||'').trim(),reply;
  const result=(text,rows)=>({session:s,reply:{text,rows}});
  if(cmd==='menu'||text.toLowerCase()==='начать'||s.step==='menu'&&!cmd){s={step:'menu',revision:s.revision};return result('Управление магазином «Бирюза». Выберите действие.',menu)}
  const catalog=await this.catalog.read();
  if(cmd==='add'){s.step='category';s.draft=null;return result('Выберите раздел и категорию:',categories.map((c,i)=>[[c.category,'category:'+i]]).concat(back))}
  if(cmd==='galleries'){s.step='gallery';s.draft=null;return result('В какую галерею добавить фото?',galleries.map(id=>[[names[id],'gallery:'+id]]).concat(back))}
  if(cmd?.startsWith('gallery:')&&s.step==='gallery'){const gallery=cmd.slice(8);if(!galleries.includes(gallery))throw Error('GALLERY');s.step='gallery_photos';s.gallery=gallery;s.photos=[];return result(names[gallery]+'. Пришлите фото. Существующие останутся на месте.',back)}
  if(cmd?.startsWith('category:')&&(s.step==='category'||s.step==='preview_category')){const c=categories[Number(cmd.slice(9))];if(!c)throw Error('CATEGORY');if(s.draft){Object.assign(s.draft,c);s.step='preview';return result(preview(s.draft),this.previewRows())}s.draft={...c,id:'p-'+hash(e.id).slice(0,24),name:'',description:'',composition:'',price:null,hit:false,images:[],icon:'flower',version:0};s.field='photos';s.step='field';return result(prompts.photos,[[['Готово','photos_done']],...back])}
  if(cmd==='edit'||cmd==='delete'){s.step='search';s.action=cmd;return result('Напишите часть названия товара.',back)}
  if(s.step==='search'&&!cmd){const q=text.toLocaleLowerCase('ru').replace(/ё/g,'е'),matches=catalog.products.filter(p=>p.name.toLocaleLowerCase('ru').replace(/ё/g,'е').includes(q)).slice(0,20);return result(matches.length?'Выберите товар:':'Ничего не найдено. Попробуйте другое название.',matches.map(p=>[[p.name.slice(0,40),'pick:'+p.id]]).concat(back))}
  if(cmd?.startsWith('pick:')&&s.step==='search'){const p=catalog.products.find(p=>p.id===cmd.slice(5));if(!p)throw Error('PRODUCT');s.draft=structuredClone(p);s.expected=p.version;s.step=s.action==='delete'?'delete_confirm':'preview';return result(preview(p),s.action==='delete'?[[['Подтвердить удаление','delete_confirm']],...back]:this.previewRows())}
  if(cmd==='delete_confirm'&&s.step==='delete_confirm'){await this.catalog.remove(s.draft.id,'delete:'+e.id,s.expected);s.step='menu';s.draft=null;return result('Товар удалён. Файлы фотографий не удаляются: они могут использоваться другими карточками.',menu)}
  if(cmd?.startsWith('field:')&&s.step==='preview'){s.field=cmd.slice(6);if(s.field==='category'){s.step='preview_category';return result('Выберите категорию:',categories.map((c,i)=>[[c.category,'category:'+i]]).concat(back))}if(!fields.includes(s.field))throw Error('FIELD');s.step='field';s.fromPreview=true;return result(prompts[s.field],s.field==='photos'?[[['Готово','photos_done'],['Убрать последнее фото','photo_remove']],...back]:back)}
  if(s.step==='gallery_photos'||s.step==='field'&&s.field==='photos'){
   const target=s.step==='gallery_photos'?s.photos:s.draft.images;
   if(cmd==='photo_remove'&&s.step==='field'){target.pop();return result('Осталось фото: '+target.length,[[['Готово','photos_done'],['Убрать последнее фото','photo_remove']],...back])}
   if(cmd==='photos_done'){
    if(s.step==='gallery_photos'){if(!s.photos.length)return result('Сначала пришлите хотя бы одно фото.',back);s.step='gallery_preview';return result(names[s.gallery]+'\nБудет добавлено в конец: '+s.photos.length+' фото.\n'+s.photos.map(p=>p.url).join('\n'),[[['Сохранить','gallery_save']],...back])}
    return this.advance(s);
   }
   if(e.photos?.length){if(target.length+e.photos.length>20)return result('Не больше 20 фото за одно сохранение.',[[['Готово','photos_done']],...back]);for(let i=0;i<e.photos.length;i++){const photo=await this.catalog.upload(e.photos[i],e.id,i);if(s.step==='gallery_photos'){if(!target.some(p=>p.id===photo.id))target.push(photo)}else if(!target.includes(photo.url))target.push(photo.url)}return result('Фото сохранены в черновик: '+target.length+'. Пришлите ещё или нажмите «Готово».',[[['Готово','photos_done']],...back])}
   return result(prompts.photos,[[['Готово','photos_done']],...back]);
  }
  if(cmd==='gallery_save'&&s.step==='gallery_preview'){await this.catalog.append(s.gallery,s.photos,'gallery:'+e.id);s={step:'menu',revision:s.revision};return result('Фото добавлены в конец галереи. На сайте обновятся при следующей загрузке каталога.',menu)}
  if(cmd==='save'&&s.step==='preview'){await this.catalog.save(s.draft,'product:'+e.id,s.expected??0);s={step:'menu',revision:s.revision};return result('Карточка сохранена.',menu)}
  if(s.step==='field'&&!cmd){const field=s.field;if(field==='price'){if(text!=='-'&&!/^\d{1,8}(?:[.,]\d{1,2})?$/.test(text))return result(prompts.price,back);s.draft.price=text==='-'?null:Number(text.replace(',','.'))}else if(field==='hit'){if(!/^(да|нет)$/i.test(text))return result(prompts.hit,back);s.draft.hit=/^да$/i.test(text)}else{if(!text||text.length>(field==='name'?150:2000))return result('Текст пустой или слишком длинный. '+prompts[field],back);s.draft[field]=text==='-'?'':text}return this.advance(s)}
  return result('Используйте последнее меню или нажмите «Отмена / в меню».',back);
 }
 advance(s){const index=fields.indexOf(s.field);if(s.fromPreview||index===fields.length-1){s.step='preview';s.fromPreview=false;return{session:s,reply:{text:preview(s.draft),rows:this.previewRows()}}}s.field=fields[index+1];return{session:s,reply:{text:prompts[s.field],rows:back}}}
 previewRows(){return[[['Сохранить','save']],[['Фото','field:photos'],['Название','field:name']],[['Состав','field:composition'],['Описание','field:description']],[['Цена','field:price'],['Хит','field:hit']],[['Категория','field:category']],...back]}
}
module.exports={Admin,preview};
