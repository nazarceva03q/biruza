'use strict';
const {hash}=require('./storage');
const {randomBytes}=require('node:crypto');
function multipartPhoto(bytes,mime){const boundary='BiruzaPhoto'+randomBytes(16).toString('hex'),extension=mime==='image/png'?'png':mime==='image/webp'?'webp':'jpg';const body=Buffer.concat([Buffer.from('--'+boundary+'\r\nContent-Disposition: form-data; name="photo"; filename="photo.'+extension+'"\r\nContent-Type: '+mime+'\r\n\r\n'),bytes,Buffer.from('\r\n--'+boundary+'--\r\n')]);return {body,headers:{'Content-Type':'multipart/form-data; boundary='+boundary,'Content-Length':String(body.length)}}}

const randomId=s=>parseInt(hash(s).slice(0,8),16)%2147483646+1;
class VK{
 constructor(token,options={}){if(!token)throw Error('VK_CONFIG');this.token=token;this.mediaBase=options.mediaBase;this.photoPreviewEnabled=options.photoPreviewEnabled??true}
 async call(method,params,attempt=0,signal){const r=await fetch('https://api.vk.com/method/'+method,{method:'POST',body:new URLSearchParams({...params,access_token:this.token,v:'5.199'}),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(12000)]):AbortSignal.timeout(12000)});if(!r.ok)throw Error('VK_HTTP');const j=await r.json();if(j.error){if(Number(j.error.error_code)===6&&attempt<2){await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)));return this.call(method,params,attempt+1,signal)}const error=Error('VK_'+Number(j.error.error_code));error.vkMethod=method;const detail=String(j.error.error_msg||'');error.vkField=['photo_id','buttons','action','payload','keyboard','peer_id','hash','photo','server','template'].find(field=>new RegExp('(?:^|[^a-z_])'+field+'(?:$|[^a-z_])','i').test(detail))||'parameters';throw error}return j.response}
 async send(peer,text,id,rows,attachment){const chars=[...String(text)],parts=[];while(chars.length)parts.push(chars.splice(0,3500).join(''));for(let i=0;i<parts.length;i++)await this.call('messages.send',{peer_id:peer,message:parts[i],random_id:randomId(id+':'+i),disable_mentions:1,dont_parse_links:1,...(attachment&&i===parts.length-1?{attachment}:{}),...(rows&&i===parts.length-1?{keyboard:JSON.stringify({inline:true,buttons:rows.map(row=>row.map(([label,command])=>({action:{type:'callback',label,payload:JSON.stringify({command})},color:'secondary'})))})}:{})})}
 async uploadPhoto(peer,url,deadline){
  const signal=deadline||AbortSignal.timeout(45000);
  if(!this.photoPreviewEnabled||!this.mediaBase)throw Error('PREVIEW_DISABLED');
   const base=this.mediaBase.replace(/\/$/,'')+'/media/',u=new URL(/^assets\/[a-z0-9-]+\.(png|jpg|webp)$/i.test(url)?'https://biruza33.ru/'+url:url);
   if(u.protocol!=='https:'||!(u.href.startsWith(base)||u.origin==='https://biruza33.ru'&&/^\/assets\/[a-z0-9-]+\.(png|jpg|webp)$/i.test(u.pathname)))throw Error('PREVIEW_URL');
   const r=await fetch(u,{redirect:'error',signal:AbortSignal.any([signal,AbortSignal.timeout(12000)])});if(!r.ok)throw Error('PREVIEW_FETCH');
   const mime=(r.headers.get('content-type')||'').split(';')[0];if(!['image/jpeg','image/png','image/webp'].includes(mime))throw Error('PREVIEW_MIME');
   const parts=[];let size=0;for await(const part of r.body){size+=part.length;if(size>10*1024*1024)throw Error('PREVIEW_SIZE');parts.push(Buffer.from(part))}
   const bytes=Buffer.concat(parts);
   // Upload one photo at a time. A fresh server is required after an upload 5xx.
   let lastError;
   for(let attempt=0;attempt<3;attempt++){
    try{
     const upload=await this.call('photos.getMessagesUploadServer',{peer_id:peer},0,signal),endpoint=new URL(upload.upload_url);
     // The URL comes only from the authenticated VK API, never from a user.
     if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.port&&endpoint.port!=='443'||!endpoint.hostname.includes('.')||/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(endpoint.hostname)||endpoint.hostname.includes(':'))throw Error('PREVIEW_UPLOAD_URL');
     const form=multipartPhoto(bytes,mime);
     const saved=await fetch(endpoint,{method:'POST',body:form.body,headers:form.headers,redirect:'error',signal:AbortSignal.any([signal,AbortSignal.timeout(25000)])});
     if(!saved.ok){const error=Error('PREVIEW_UPLOAD_HTTP_'+saved.status);const allow=(saved.headers.get('allow')||'').split(',').map(x=>x.trim()).filter(x=>['GET','POST','HEAD','OPTIONS','PUT','DELETE','PATCH'].includes(x)).join(',');error.uploadDiagnostic={host:endpoint.hostname,status:saved.status,allow:allow||'unspecified',responseType:(saved.headers.get('content-type')||'').split(';')[0].replace(/[^a-z0-9/+.-]/gi,'').slice(0,60)};throw error;}
     let data;try{data=await saved.json()}catch{throw Error('PREVIEW_UPLOAD_RESPONSE')}
     if(!data?.server||typeof data.photo!=='string'||!data.hash||data.photo==='[]')throw Error('PREVIEW_UPLOAD_EMPTY');
     const photos=await this.call('photos.saveMessagesPhoto',{server:data.server,photo:data.photo,hash:data.hash},0,signal),photo=photos?.[0];
     if(!Number.isInteger(photo?.owner_id)||!Number.isInteger(photo?.id))throw Error('PREVIEW_SAVE_EMPTY');
     return 'photo'+photo.owner_id+'_'+photo.id+(photo.access_key?'_'+photo.access_key:'');
    }catch(error){
     lastError=error;
     if(signal.aborted||!/^PREVIEW_UPLOAD_HTTP_5\d\d$/.test(error.message)||attempt===2)throw error;
     await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)));
    }
   }
   throw lastError;
 }
 async sendPhoto(peer,text,id,rows,url){
  let attachment;try{attachment=await this.uploadPhoto(peer,url)}catch(error){text+='\n\nФото не удалось загрузить в VK. Код: '+(/^[A-Z0-9_]+$/.test(error.message)?error.message:error.name)+'. Повторите просмотр.'}
  return this.send(peer,text,id,rows,attachment);
 }
 async sendCarousel(peer,text,id,rows,cards,messageId){
  if(!cards.length||cards.length>10)throw Error('CAROUSEL_SIZE');
  const elements=[],deadline=AbortSignal.timeout(80000);
  for(const card of cards){
   const photo=card.photo?await this.uploadPhoto(peer,card.photo,deadline):null;
   elements.push({title:[...card.title].slice(0,80).join(''),description:[...(card.description||'Выберите эту карточку')].slice(0,80).join(''),...(photo?{photo_id:photo.replace(/^photo/,'').split('_').slice(0,2).join('_'),action:{type:'open_photo'}}:{}),buttons:[{action:{type:'callback',label:card.label||'Выбрать',payload:JSON.stringify({command:card.command})},color:'primary'}]});
  }
  const params={peer_id:peer,message:text,template:JSON.stringify({type:'carousel',elements}),disable_mentions:1,dont_parse_links:1,keyboard:JSON.stringify({inline:true,buttons:rows.map(row=>row.map(([label,command])=>({action:{type:'callback',label,payload:JSON.stringify({command})},color:'secondary'})))})};
  if(messageId){await this.call('messages.edit',{...params,message_id:messageId});return messageId}
  const result=await this.call('messages.send',{...params,random_id:randomId(id)});if(!Number.isInteger(result)||result<=0)throw Error('VK_SEND_UNKNOWN');return result;
 }
 async sendPart(peer,text,id){const result=await this.call('messages.send',{peer_ids:String(peer),message:text,random_id:randomId(id),disable_mentions:1,dont_parse_links:1});const item=Array.isArray(result)?result.find(x=>x.peer_id===peer):null;if(!item||item.error||!Number.isInteger(item.conversation_message_id)||item.conversation_message_id<=0)throw Error('VK_SEND_UNKNOWN');return item.conversation_message_id}
 async remove(peer,cmid){const r=await this.call('messages.delete',{peer_id:peer,cmids:String(cmid),delete_for_all:1});return Array.isArray(r)&&r.some(x=>x.peer_id===peer&&x.conversation_message_id===cmid&&x.response===1&&!x.error)}
}
module.exports={VK,randomId,multipartPhoto};
