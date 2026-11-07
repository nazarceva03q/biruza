'use strict';
// Store-specific adaptation of the reference admin conversation. No stock or REG relay.
const{hash}=require('./storage');
const{categories,galleries}=require('./catalog');
const pricing=require('./price');
const names={wedding:'Свадебные композиции',store_opening:'Открытия магазинов',event:'Праздники и мероприятия'};
const fields=['photos','name','composition','description','price','hit'];
const back=[[['⬅️ В меню','menu']]];
const menu=[['▶️ Старт','menu'],['➕ Добавить товар','add'],['✏️ Изменить товар','edit'],['🗑 Удалить товар','delete'],['📷 Фотографии оформления','galleries']].map(x=>[x]);
const prompts={photos:'Загрузите одно или несколько фото товара. Когда закончите – нажмите «✅ Готово».',name:'Напишите название товара',composition:'Напишите состав товара по пунктам (каждый пункт с новой строки), например:\n• Эустома\n• Эвкалипт\nЕсли состав не нужно описывать, поставьте прочерк -.',description:'Напишите описание / доп. информацию (например, высота цветка или другое). Если ничего писать не нужно, поставьте прочерк -.',price:pricing.prompt,hit:'Пометить товар Хитом? Хиты показываются в самом начале галереи на сайте.'};
const photoRows=()=>[[['✅ Готово','photos_done']],...back];
const hitRows=(remove=false)=>[[['Да',remove?'hit:0':'hit:1'],['Нет',remove?'hit:1':'hit:0']],...back];
function previewRows(){return[[['✏️ Категория','field:category']],[['✏️ Фото','field:photos']],[['✏️ Название','field:name']],[['✏️ Состав','field:composition']],[['✏️ Описание/доп. информация','field:description']],[['✏️ Цена','field:price']],[['🔥 Хит','field:hit']],[['💾 Сохранить','save']],[['❌ Отмена','cancel']]]}
function preview(p){return['Предпросмотр товара',`Название: ${p.name}`,`Категория: ${p.category}`,'',`Состав:\n${p.composition||'Не указан'}`,`Описание: ${p.description||'Не указано'}`,`Цена: ${pricing.format(p.price,p.priceLabel)}`,`Хит: ${p.hit?'да':'нет'}`,`Фотографии: ${p.images.length}`,p.images[0]?`Первое фото: ${p.images[0]}`:''].filter(x=>x!=='').join('\n')}
const norm=s=>String(s).toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/[^a-zа-я0-9]+/g,' ').trim();
function search(products,text){const q=norm(text),words=q.split(' ').filter(Boolean);if(!words.length)return[];return products.map(p=>{const n=norm(p.name),nw=n.split(' ');return{p,score:n===q?100:n.includes(q)?80:words.every(w=>nw.some(v=>w===v||Math.min(w.length,v.length)>=4&&(w.startsWith(v)||v.startsWith(w))))?60:0}}).filter(x=>x.score).sort((a,b)=>b.score-a.score||a.p.name.localeCompare(b.p.name,'ru')).slice(0,5).map(x=>x.p)}
function photoManageRows(images){return images.map((_,i)=>[[`🗑 Удалить фото ${i+1}`,'photo_remove:'+i]]).concat([[['➕ Добавить фото','photos_add']],[['⬅️ К предпросмотру','photos_back']],[['❌ Отмена','cancel']]])}
async function reduce(s,e,catalog){
 const cmd=e.command,text=(e.text||'').trim();
 const result=(text,rows=back,photo)=>({session:s,reply:{text,rows,...(photo?{photo}:{})}});
 const showPreview=()=>{s.step='preview';s.fromPreview=false;return result(preview(s.draft),previewRows(),s.draft.images[0])};
 const showField=field=>{s.step='field';s.field=field;return result(prompts[field],field==='photos'?photoRows():field==='hit'?hitRows():back)};
 const advance=()=>s.fromPreview||s.field==='hit'?showPreview():showField(fields[fields.indexOf(s.field)+1]);
 const reset=(message='Здравствуйте! Это бот управления магазином «Бирюза». Выберите действие:')=>{s={step:'menu'};return result(message,menu)};
 if(cmd==='menu'||['начать','старт','меню','/start'].includes(text.toLowerCase()))return reset();
 if(cmd==='cancel')return reset('Действие отменено. Изменения не опубликованы.');
 if(s.step==='menu'&&!cmd)return result('Пожалуйста, выберите действие кнопками ниже.',menu);
 const c=await catalog.read();
 if(cmd==='add'){s={step:'category',draft:null};return result('Выберите категорию товара на сайте:',categories.map((c,i)=>[[c.category,'category:'+i]]).concat(back))}
 if(cmd?.startsWith('category:')&&['category','preview_category'].includes(s.step)){
  const category=categories[Number(cmd.slice(9))];if(!category)return result('Не поняла выбор категории, попробуйте ещё раз.',back);
  if(s.step==='preview_category'&&s.draft){Object.assign(s.draft,category);return showPreview()}
  s.draft={...category,id:'p-'+hash(e.id).slice(0,24),name:'',description:'',composition:'',price:null,priceLabel:'',hit:false,images:[],icon:category.domain==='balloons'?'balloon':category.domain==='gifts'?'gift':'flower',version:0};s.expected=0;return showField('photos');
 }
 if(cmd==='edit'||cmd==='delete'){s={step:'search',action:cmd};return result('Напишите название товара, который нужно '+(cmd==='delete'?'удалить.':'изменить.'))}
 const showMatch=index=>{
  const id=s.matches?.[index],p=c.products.find(p=>p.id===id);if(!p)return result('Этот товар уже удалён. Напишите название для нового поиска.');s.matchIndex=index;
  const navigation=[];if(index>0)navigation.push(['← Предыдущий','match:'+(index-1)]);if(index+1<s.matches.length)navigation.push(['Следующий →','match:'+(index+1)]);
  return result(`Товар ${index+1} из ${s.matches.length}\n\n${p.name}\n${pricing.format(p.price,p.priceLabel)}\n\n${p.composition||''}\n${p.description||''}\n\nКатегория: ${p.category}`,[[['Этот товар','pick:'+p.id]],...(navigation.length?[navigation]:[]),...back],p.images[0]);
 };
 if(s.step==='search'&&!cmd){const matches=search(c.products,text);if(!matches.length)return result('Ничего не найдено похожего на «'+text+'». Попробуйте написать по-другому.');s.matches=matches.map(p=>p.id);return showMatch(0)}
 if(s.step==='search'&&cmd?.startsWith('match:')){const index=Number(cmd.slice(6));if(Number.isInteger(index)&&index>=0&&index<(s.matches||[]).length)return showMatch(index);return result('Выберите товар из последнего результата поиска.')}
 if(cmd?.startsWith('pick:')&&s.step==='search'){
  const id=cmd.slice(5);if(!s.matches?.includes(id))return result('Этот результат поиска устарел. Напишите название ещё раз.');const p=c.products.find(p=>p.id===id);if(!p)return result('Этот товар уже удалён. Напишите название для нового поиска.');s.draft=structuredClone(p);s.expected=p.version;
  if(s.action==='delete'){s.step='delete_confirm';return result('Удалить товар «'+p.name+'»?',[[['Да','delete_confirm'],['Нет','cancel']],...back])}return showPreview();
 }
 if(cmd==='delete_confirm'&&s.step==='delete_confirm'){const name=s.draft.name;await catalog.remove(s.draft.id,'delete:'+e.id,s.expected);return reset('🗑 Товар «'+name+'» удалён.')}
 if(cmd?.startsWith('field:')&&s.step==='preview'){
  const field=cmd.slice(6);s.fromPreview=true;
  if(field==='category'){s.step='preview_category';return result('Выберите новую категорию товара:',categories.map((c,i)=>[[c.category,'category:'+i]]).concat(back))}
  if(field==='photos'){s.step='photo_manage';return result('Фотографии товара: '+s.draft.images.length+'. Можно добавить фото или удалить выбранное.',photoManageRows(s.draft.images),s.draft.images[0])}
  if(!fields.includes(field))return result('Выберите поле в предпросмотре.');if(field==='hit'){s.step='field';s.field='hit';return result(s.draft.hit?'Убрать товар из Хитов?':prompts.hit,hitRows(s.draft.hit))}return showField(field);
 }
 if(s.step==='photo_manage'){
  if(cmd==='photos_add'){s.fromPreview=true;return showField('photos')}
  if(cmd==='photos_back')return showPreview();
  if(cmd?.startsWith('photo_remove:')){const index=Number(cmd.slice(13));if(Number.isInteger(index)&&index>=0&&index<s.draft.images.length)s.draft.images.splice(index,1);return result('Фото удалено из черновика. Нажмите «💾 Сохранить» в предпросмотре, чтобы применить изменение.',photoManageRows(s.draft.images),s.draft.images[0])}
 }
 if(cmd==='galleries'){s={step:'gallery'};return result('Выберите галерею оформления на сайте:',galleries.map(id=>[[names[id],'gallery:'+id]]).concat(back))}
 if(cmd?.startsWith('gallery:')&&s.step==='gallery'){const gallery=cmd.slice(8);if(!galleries.includes(gallery))throw Error('GALLERY');s={step:'gallery_photos',gallery,photos:[]};return result(names[gallery]+'.\nЗагрузите одно или несколько фото. Существующие останутся на месте; новые добавятся в конец.',back)}
 if(s.step==='gallery_photos'||s.step==='field'&&s.field==='photos'){
  const isGallery=s.step==='gallery_photos',target=isGallery?s.photos:s.draft.images;
  if(cmd==='photos_done'){
   if(isGallery){if(!target.length)return result('Нужно хотя бы одно фото. Пришлите фото оформления.');s.step='gallery_preview';return result('Предпросмотр галереи\n'+names[s.gallery]+'\nБудет добавлено в конец: '+target.length+' фото.\n'+target.map((p,i)=>`Фото ${i+1}: ${p.url}`).join('\n'),[[['💾 Сохранить','gallery_save']],[['➕ Добавить фото','gallery_more']],[['❌ Отмена','cancel']]],target[0].url)}
   return advance();
  }
  if(e.photos?.length){
   if(target.length+e.photos.length>20)return result('Не больше 20 фото за одно сохранение.',photoRows());
   for(let i=0;i<e.photos.length;i++){const photo=await catalog.upload(e.photos[i],e.id,i);if(isGallery){if(!target.some(p=>p.id===photo.id))target.push(photo)}else if(!target.includes(photo.url))target.push(photo.url)}
   return result((isGallery?'Фото сохранены в черновик: '+target.length+'. ':'Фото добавлено ('+target.length+' шт.). ')+'Пришлите ещё или нажмите «✅ Готово».',photoRows());
  }
  return result(target.length?'Пришлите ещё фото или нажмите «✅ Готово».':'Пришлите фото товара или оформления.',photoRows());
 }
 if(s.step==='gallery_preview'&&cmd==='gallery_more'){s.step='gallery_photos';return result('Загрузите ещё фото. Когда закончите – нажмите «✅ Готово».',photoRows())}
 if(cmd==='gallery_save'&&s.step==='gallery_preview'){await catalog.append(s.gallery,s.photos,'gallery:'+e.id);return reset('✅ Фото добавлены в конец галереи «'+names[s.gallery]+'». Обновите страницу сайта.')}
 if(cmd==='save'&&s.step==='preview'){
  await catalog.save(s.draft,'product:'+e.id,s.expected??0);
  const saved=(await catalog.read()).products.find(p=>p.id===s.draft.id);if(!saved||saved.name!==s.draft.name)throw Error('PRODUCT_SAVE_UNCONFIRMED');
  return reset('✅ Товар «'+saved.name+'» сохранён для сайта ('+saved.category+'). Обновите страницу каталога.');
 }
 if(s.step==='field'&&s.field==='hit'&&cmd?.startsWith('hit:')){if(!['hit:0','hit:1'].includes(cmd))return result(prompts.hit,hitRows());s.draft.hit=cmd==='hit:1';return showPreview()}
 if(s.step==='field'&&!cmd){
  const field=s.field;if(field==='hit'){if(!/^(да|нет)$/i.test(text))return result(prompts.hit,hitRows());s.draft.hit=/^да$/i.test(text)}
  else if(field==='price'){if(!text||text.length>120)return result(prompts.price);Object.assign(s.draft,pricing.parse(text))}
  else{if(!text||text.length>(field==='name'?150:2000))return result('Напишите текст, пожалуйста (название до 150, остальные поля до 2000 символов).\n'+prompts[field]);s.draft[field]=/^[-–]+$/.test(text)?'':field==='composition'?text.split('\n').map(x=>x.replace(/^[\s•*-]+/,'').trim()).filter(Boolean).map(x=>'• '+x).join('\n'):text}
  return advance();
 }
 return result('Пожалуйста, воспользуйтесь кнопками выше (или «⬅️ В меню»).');
}
module.exports={reduce,preview,previewRows,back,menu,search};
