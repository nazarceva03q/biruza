'use strict';
const {hash}=require('./storage');
const randomId=s=>parseInt(hash(s).slice(0,8),16)%2147483646+1;
class VK{
 constructor(token){if(!token)throw Error('VK_CONFIG');this.token=token}
 async call(method,params){const r=await fetch('https://api.vk.com/method/'+method,{method:'POST',body:new URLSearchParams({...params,access_token:this.token,v:'5.199'}),signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('VK_HTTP');const j=await r.json();if(j.error)throw Error('VK_'+Number(j.error.error_code));return j.response}
 async send(peer,text,id,rows){const chars=[...String(text)],parts=[];while(chars.length)parts.push(chars.splice(0,3500).join(''));for(let i=0;i<parts.length;i++)await this.call('messages.send',{peer_id:peer,message:parts[i],random_id:randomId(id+':'+i),disable_mentions:1,dont_parse_links:1,...(rows&&i===parts.length-1?{keyboard:JSON.stringify({inline:true,buttons:rows.map(row=>row.map(([label,command])=>({action:{type:'callback',label,payload:JSON.stringify({command})},color:'secondary'})))})}:{})})}
 async sendPart(peer,text,id){const result=await this.call('messages.send',{peer_ids:String(peer),message:text,random_id:randomId(id),disable_mentions:1,dont_parse_links:1});const item=Array.isArray(result)?result.find(x=>x.peer_id===peer):null;if(!item||item.error||!Number.isInteger(item.conversation_message_id)||item.conversation_message_id<=0)throw Error('VK_SEND_UNKNOWN');return item.conversation_message_id}
 async remove(peer,cmid){const r=await this.call('messages.delete',{peer_id:peer,cmids:String(cmid),delete_for_all:1});return Array.isArray(r)&&r.some(x=>x.peer_id===peer&&x.conversation_message_id===cmid&&x.response===1&&!x.error)}
}
module.exports={VK,randomId};
