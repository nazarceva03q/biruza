'use strict';
const {hash}=require('./storage');
const randomId=s=>parseInt(hash(s).slice(0,8),16)%2147483646+1;
class VK{
 constructor(token,options={}){if(!token)throw Error('VK_CONFIG');this.token=token;this.mediaBase=options.mediaBase;this.photoPreviewEnabled=options.photoPreviewEnabled??true}
 async call(method,params){const r=await fetch('https://api.vk.com/method/'+method,{method:'POST',body:new URLSearchParams({...params,access_token:this.token,v:'5.199'}),signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('VK_HTTP');const j=await r.json();if(j.error)throw Error('VK_'+Number(j.error.error_code));return j.response}
 async send(peer,text,id,rows,attachment){const chars=[...String(text)],parts=[];while(chars.length)parts.push(chars.splice(0,3500).join(''));for(let i=0;i<parts.length;i++)await this.call('messages.send',{peer_id:peer,message:parts[i],random_id:randomId(id+':'+i),disable_mentions:1,dont_parse_links:1,...(attachment&&i===parts.length-1?{attachment}:{}),...(rows&&i===parts.length-1?{keyboard:JSON.stringify({inline:true,buttons:rows.map(row=>row.map(([label,command])=>({action:{type:'callback',label,payload:JSON.stringify({command})},color:'secondary'})))})}:{})})}
 async sendPhoto(peer,text,id,rows,url){
  if(!this.photoPreviewEnabled||!this.mediaBase)return this.send(peer,text,id,rows);
  let attachment;
  try{
   const base=this.mediaBase.replace(/\/$/,'')+'/media/',u=new URL(/^assets\/[a-z0-9-]+\.(png|jpg|webp)$/i.test(url)?'https://biruza33.ru/'+url:url);
   if(u.protocol!=='https:'||!(u.href.startsWith(base)||u.origin==='https://biruza33.ru'&&/^\/assets\/[a-z0-9-]+\.(png|jpg|webp)$/i.test(u.pathname)))throw Error('PREVIEW_URL');
   const r=await fetch(u,{redirect:'error',signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('PREVIEW_FETCH');
   const mime=(r.headers.get('content-type')||'').split(';')[0];if(!['image/jpeg','image/png','image/webp'].includes(mime))throw Error('PREVIEW_MIME');
   const parts=[];let size=0;for await(const part of r.body){size+=part.length;if(size>10*1024*1024)throw Error('PREVIEW_SIZE');parts.push(Buffer.from(part))}
   const upload=await this.call('photos.getMessagesUploadServer',{peer_id:peer}),endpoint=new URL(upload.upload_url);
   if(endpoint.protocol!=='https:'||!/(^|\.)(vk\.com|vk\.ru|userapi\.com|vkuserphoto\.ru)$/.test(endpoint.hostname))throw Error('PREVIEW_UPLOAD');
   const body=new FormData();body.append('photo',new Blob([Buffer.concat(parts)],{type:mime}),'photo.'+(mime==='image/png'?'png':mime==='image/webp'?'webp':'jpg'));
   const saved=await fetch(endpoint,{method:'POST',body,redirect:'error',signal:AbortSignal.timeout(10000)});if(!saved.ok)throw Error('PREVIEW_UPLOAD');
   const data=await saved.json(),photos=await this.call('photos.saveMessagesPhoto',{server:data.server,photo:data.photo,hash:data.hash}),photo=photos?.[0];
   if(!Number.isInteger(photo?.owner_id)||!Number.isInteger(photo?.id))throw Error('PREVIEW_UPLOAD');
   attachment='photo'+photo.owner_id+'_'+photo.id+(photo.access_key?'_'+photo.access_key:'');
  }catch{/* Missing photos permission or failed thumbnail must never prevent editing/saving. */}
  return this.send(peer,text,id,rows,attachment);
 }
 async sendPart(peer,text,id){const result=await this.call('messages.send',{peer_ids:String(peer),message:text,random_id:randomId(id),disable_mentions:1,dont_parse_links:1});const item=Array.isArray(result)?result.find(x=>x.peer_id===peer):null;if(!item||item.error||!Number.isInteger(item.conversation_message_id)||item.conversation_message_id<=0)throw Error('VK_SEND_UNKNOWN');return item.conversation_message_id}
 async remove(peer,cmid){const r=await this.call('messages.delete',{peer_id:peer,cmids:String(cmid),delete_for_all:1});return Array.isArray(r)&&r.some(x=>x.peer_id===peer&&x.conversation_message_id===cmid&&x.response===1&&!x.error)}
}
module.exports={VK,randomId};
