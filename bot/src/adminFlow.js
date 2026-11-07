'use strict';
// Store-specific adaptation of the reference admin conversation. No stock or REG relay.
const{hash}=require('./storage');
const{categories,galleries}=require('./catalog');
const pricing=require('./price');
const names={wedding:'Свадебные композиции',store_opening:'Открытия магазинов',event:'Праздники и мероприятия'};
const fields=['photos','name','composition','description','price','hit'];
const back=[[['⬅️ В меню','menu']]];
const menu=[['▶️ Старт','menu'],['➕ Добавить товар','add'],['✏️ Изменить товар','edit'],['🗑 Удалить товар','delete'],['📷 Фотографии оформления','galleries']].map(x=>[x]);
const prompts={photos:'Загрузите одно или несколько фото товара.',name:'Напишите название товара',composition:'Напишите состав товара по пунктам (каждый пункт с новой строки), например:\n• Эустома\n• Эвкалипт\nЕсли состав не нужно описывать, поставьте прочерк -.',description:'Напишите описание / доп. информацию (например, высота цветка или другое). Если ничего писать не нужно, поставьте прочерк -.',price:pricing.prompt,hit:'Пометить товар Хитом? Хиты показываются в самом начале галереи на сайте.'};
const photoRows=(hasPhotos=false)=>[...(hasPhotos?[[['✅ Готово','photos_done']]]:[]),...back];
const hitRows=(remove=false)=>[[['Да',remove?'hit:0':'hit:1'],['Нет',remove?'hit:1':'hit:0']],...back];
function previewRows(){return[[['✏️ Категория','field:category']],[['✏️ Фото','field:photos']],[['✏️ Название','field:name']],[['✏️ Состав','field:composition']],[['✏️ Описание/доп. информация','field:description']],[['✏️ Цена','field:price']],[['🔥 Хит','field:hit']],[['💾 Сохранить','save']],[['❌ Отмена','cancel']]]}
function preview(p){
 const lines=['Проверьте товар перед публикацией:','','Категория: '+p.category,'Название: '+p.name];
 if(p.composition){lines.push('Состав:');lines.push(...p.composition.split('\n'))}else lines.push('Состав: не указан');
 lines.push('Описание/доп. информация: '+(p.description||'не указано'));
 lines.push('Цена: '+pricing.format(p.price,p.priceLabel));
 lines.push('Фото: '+p.images.length+' шт.');lines.push('Хит: '+(p.hit?'да':'нет'));
 return lines.join('\n');
}
const {score}=require('./search');
function search(products,text){return products.map(p=>({p,score:score(p.name,text)})).filter(x=>x.score).sort((a,b)=>b.score-a.score||a.p.name.localeCompare(b.p.name,'ru')).map(x=>x.p)}
const galleryAliases={wedding:'Свадебные композиции Свадьбы Оформление свадеб',store_opening:'Открытия магазинов Оформление магазина',event:'Праздники и мероприятия Оформление праздников событий'};
function photoManageRows(images){return images.map((_,i)=>[[`🗑 Удалить фото ${i+1}`,'photo_remove:'+i]]).concat([[['➕ Добавить фото','photos_add']],[['⬅️ Назад к предпросмотру','photos_back']]])}
async function reduce(s,e,catalog){
 const cmd=e.command,text=(e.text||'').trim();
 const result=(text,rows=back,photo)=>({session:s,reply:{text,rows,...(photo?{photo}:{}),...(s.step==='delete_gallery_confirm'?{selection:true}:{})}});
 const showPreview=()=>{s.step='preview';s.fromPreview=false;return result(preview(s.draft),previewRows(),s.draft.images[0])};
 const showField=field=>{s.step='field';s.field=field;const hasPhotos=(s.draft?.images||[]).length>0;return result(field==='photos'&&hasPhotos?'Загрузите ещё фото товара. Когда закончите — нажмите «Готово».':prompts[field],field==='photos'?photoRows(hasPhotos):field==='hit'?hitRows():back)};
 const advance=()=>s.fromPreview||s.field==='hit'?showPreview():showField(fields[fields.indexOf(s.field)+1]);
 const reset=(message='Здравствуйте! Это бот управления магазином «Бирюза». Выберите действие:')=>{s={step:'menu'};return result(message,menu)};
 if(cmd==='menu'||['начать','старт','меню','/start'].includes(text.toLowerCase()))return reset();
 if(cmd==='cancel')return reset('Действие отменено.');
 if(s.step==='menu'&&!cmd)return result('Пожалуйста, выберите действие кнопками ниже.',menu);
 const c=await catalog.read();
 if(cmd==='add'){s={step:'category',draft:null};return result('Выберите категорию товара на сайте:',categories.map((c,i)=>[[c.category,'category:'+i]]).concat(back))}
 if(cmd?.startsWith('category:')&&['category','preview_category'].includes(s.step)){
  const category=categories[Number(cmd.slice(9))];if(!category)return result('Не поняла выбор категории, попробуйте ещё раз.',back);
  if(s.step==='preview_category'&&s.draft){Object.assign(s.draft,category);return showPreview()}
  s.draft={...category,id:'p-'+hash(e.id).slice(0,24),name:'',description:'',composition:'',price:null,priceLabel:'',hit:false,images:[],icon:category.domain==='balloons'?'balloon':category.domain==='gifts'?'gift':'flower',version:0};s.expected=0;return showField('photos');
 }
 if(cmd==='edit'||cmd==='delete'){s={step:'search',action:cmd};return result('Напишите название товара, который нужно '+(cmd==='delete'?'удалить, или название раздела оформления.':'изменить.'))}
 const searchPage=index=>{const list=s.matches.map(id=>c.products.find(p=>p.id===id)).filter(Boolean);if(!list.length)return reset('Подходящих товаров больше нет. Выполните поиск заново.');index=Math.max(0,Math.min(index,list.length-1));const p=list[index],navigation=[];if(index>0)navigation.push(['← Назад','search_page:'+(index-1)]);if(index+1<list.length)navigation.push(['Далее →','search_page:'+(index+1)]);s.searchPage=index;return {session:s,reply:{text:'Товар '+(index+1)+' из '+list.length+'\n\n'+p.name+'\n'+pricing.format(p.price,p.priceLabel)+'\nКатегория: '+p.category+(p.composition?'\n\n'+p.composition:''),rows:[...(navigation.length?[navigation]:[]),[['Этот товар','pick:'+p.id]],...back],selection:true,photo:p.images[0]}}};
 if(s.step==='search'&&cmd?.startsWith('search_page:'))return searchPage(Number(cmd.slice(12))||0);
 if(s.step==='search'&&!cmd){const matches=search(c.products,text);if(s.action==='delete'){const found=galleries.map(id=>({id,score:score(galleryAliases[id],text)})).filter(x=>x.score).sort((a,b)=>b.score-a.score);if(found.length){s.step='delete_gallery_select';s.galleryMatches=found.map(x=>x.id);return result('Выберите раздел оформления:',found.map(x=>[[names[x.id],'delete_gallery:'+x.id]]).concat(matches.map(p=>[[p.name,'delete_product:'+p.id]]),back))}}if(!matches.length)return result('Ничего не найдено похожего на «'+text+'». Попробуйте написать по-другому.');s.matches=matches.map(p=>p.id);return searchPage(0)}

 const galleryPage=index=>{const list=c.galleries[s.gallery]||[];if(!list.length)return reset('В разделе «'+names[s.gallery]+'» больше нет фотографий.');index=Math.max(0,Math.min(index,list.length-1));const photo=list[index];s.step='delete_gallery_photo';s.galleryPage=index;s.visiblePhotos=[photo.id];const navigation=[];if(index>0)navigation.push(['← Назад','gallery_page:'+(index-1)]);if(index+1<list.length)navigation.push(['Далее →','gallery_page:'+(index+1)]);return {session:s,reply:{text:names[s.gallery]+'\nФото '+(index+1)+' из '+list.length+'\n\nВыберите снимок кнопками ниже. Удаление — только после подтверждения.',rows:[...(navigation.length?[navigation]:[]),[['🗑 Удалить это фото','delete_photo_pick:'+photo.id]],...back],selection:true,photo:photo.url}}};
 if(s.step==='delete_gallery_select'&&cmd?.startsWith('delete_product:')){const p=c.products.find(p=>p.id===cmd.slice(15));if(!p)return reset('Товар уже удалён.');s.draft=structuredClone(p);s.expected=p.version;s.step='delete_confirm';return result('Удалить товар «'+p.name+'»?',[[['Да','delete_confirm'],['Нет','cancel']],...back])}
 if(s.step==='delete_gallery_select'&&cmd?.startsWith('delete_gallery:')){const id=cmd.slice(15);if(!s.galleryMatches.includes(id))return reset();s.gallery=id;return galleryPage(0)}
 if(s.step==='delete_gallery_photo'){
  if(cmd?.startsWith('gallery_page:'))return galleryPage(Number(cmd.slice(13))||0);
  if(cmd?.startsWith('delete_photo_pick:')){const id=cmd.slice(18);if(!s.visiblePhotos?.includes(id)||!c.galleries[s.gallery].some(p=>p.id===id))return galleryPage(s.galleryPage||0);s.photoId=id;s.step='delete_gallery_confirm';return result('Удалить это фото из раздела «'+names[s.gallery]+'»?',[[['Да, удалить','delete_photo_confirm'],['Нет','delete_photo_back']],...back],c.galleries[s.gallery].find(p=>p.id===id).url)}
 }
 if(s.step==='delete_gallery_done'&&cmd==='delete_photo_more')return galleryPage(s.galleryPage||0);
 if(s.step==='delete_gallery_confirm'){
  if(cmd==='delete_photo_back')return galleryPage(s.galleryPage||0);
  if(cmd==='delete_photo_confirm'){await catalog.removePhoto(s.gallery,s.photoId,'gallery-delete:'+e.id);s.step='delete_gallery_done';delete s.photoId;return result('🗑 Фото удалено из раздела «'+names[s.gallery]+'».',[[['🗑 Удалить ещё фото','delete_photo_more']],...back])}
 }
 if(cmd?.startsWith('pick:')&&s.step==='search'){
  const id=cmd.slice(5);if(!s.matches?.includes(id))return result('Этот результат поиска устарел. Напишите название ещё раз.');const p=c.products.find(p=>p.id===id);if(!p)return result('Этот товар уже удалён. Напишите название для нового поиска.');s.draft=structuredClone(p);s.expected=p.version;
  if(s.action==='delete'){s.step='delete_confirm';return result('Удалить товар «'+p.name+'»?',[[['Да','delete_confirm'],['Нет','cancel']],...back])}return showPreview();
 }
 if(cmd==='delete_confirm'&&s.step==='delete_confirm'){const name=s.draft.name;await catalog.remove(s.draft.id,'delete:'+e.id,s.expected);return reset('🗑 Товар «'+name+'» удалён.')}
 if(cmd?.startsWith('field:')&&s.step==='preview'){
  const field=cmd.slice(6);s.fromPreview=true;
  if(field==='category'){s.step='preview_category';return result('Выберите новую категорию товара:',categories.map((c,i)=>[[c.category,'category:'+i]]).concat(back))}
  if(field==='photos'){s.step='photo_manage';return result('Фото товара ('+s.draft.images.length+' шт.). Что сделать?',photoManageRows(s.draft.images),s.draft.images[0])}
  if(!fields.includes(field))return result('Выберите поле в предпросмотре.');if(field==='hit'){s.step='field';s.field='hit';return result(s.draft.hit?'Убрать товар из Хитов?':prompts.hit,hitRows(s.draft.hit))}return showField(field);
 }
 if(s.step==='photo_manage'){
  if(cmd==='photos_add'){s.fromPreview=true;return showField('photos')}
  if(cmd==='photos_back')return showPreview();
  if(cmd?.startsWith('photo_remove:')){const index=Number(cmd.slice(13));if(Number.isInteger(index)&&index>=0&&index<s.draft.images.length)s.draft.images.splice(index,1);return result('Фото удалено.',photoManageRows(s.draft.images),s.draft.images[0])}
 }
 if(cmd==='galleries'){s={step:'gallery'};return result('Выберите галерею оформления на сайте:',galleries.map(id=>[[names[id],'gallery:'+id]]).concat(back))}
 if(cmd?.startsWith('gallery:')&&s.step==='gallery'){const gallery=cmd.slice(8);if(!galleries.includes(gallery))throw Error('GALLERY');s={step:'gallery_photos',gallery,photos:[]};return result(names[gallery]+'.\nЗагрузите одно или несколько фото. Существующие останутся на месте; новые добавятся в конец.',back)}
 if(s.step==='gallery_photos'||s.step==='field'&&s.field==='photos'){
  const isGallery=s.step==='gallery_photos',target=isGallery?s.photos:s.draft.images;
  if(cmd==='photos_done'){
   if(isGallery){if(!target.length)return result('Нужно хотя бы одно фото. Пришлите фото оформления.');s.step='gallery_preview';return result('Проверьте фото перед публикацией:\n\nГалерея: '+names[s.gallery]+'\nФото: '+target.length+' шт.\nНовые фотографии будут добавлены в конец галереи.',[[['💾 Сохранить','gallery_save']],[['➕ Добавить фото','gallery_more']],[['❌ Отмена','cancel']]],target[0].url)}
   if(!target.length)return result('Нужно хотя бы одно фото. Пришлите фото товара.',photoRows(false));
   return advance();
  }
  if(e.photos?.length){
   if(target.length+e.photos.length>20)return result('Не больше 20 фото за одно сохранение.',photoRows(target.length>0));
   for(let i=0;i<e.photos.length;i++){const photo=await catalog.upload(e.photos[i],e.id,i);if(isGallery){if(!target.some(p=>p.id===photo.id))target.push(photo)}else if(!target.includes(photo.url))target.push(photo.url)}
   return result('Фото добавлено ('+target.length+' шт.). Пришлите ещё или нажмите «Готово».',photoRows(true));
  }
  return result(target.length?'Пришлите фото товара (одно или несколько) или нажмите «Готово».':'Пришлите фото товара (одно или несколько).',photoRows(target.length>0));
 }
 if(s.step==='gallery_preview'&&cmd==='gallery_more'){s.step='gallery_photos';return result('Загрузите ещё фото. Когда закончите — нажмите «Готово».',photoRows(s.photos.length>0))}
 if(cmd==='gallery_save'&&s.step==='gallery_preview'){await catalog.append(s.gallery,s.photos,'gallery:'+e.id);return reset('✅ Фото добавлены в конец галереи «'+names[s.gallery]+'». Обновите страницу сайта.')}
 if(cmd==='save'&&s.step==='preview'){
  if(!s.draft.images.length){s.fromPreview=true;return showField('photos')}
  await catalog.save(s.draft,'product:'+e.id,s.expected??0);
  const saved=(await catalog.read()).products.find(p=>p.id===s.draft.id);if(!saved||saved.name!==s.draft.name)throw Error('PRODUCT_SAVE_UNCONFIRMED');
  return reset('✅ Товар «'+saved.name+'» опубликован на сайте ('+saved.category+').' );
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
