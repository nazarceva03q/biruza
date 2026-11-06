'use strict';
const types=require('./types');
class Invalid extends Error{constructor(code='INVALID',status=400){super(code);this.status=status}}
const keys=(o,a)=>{if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).some(k=>!a.includes(k)))throw new Invalid()};
function text(v,max,required=false){if(v===undefined)return required?(()=>{throw new Invalid()})():'';if(typeof v!=='string'||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))throw new Invalid();v=v.trim();if(required&&!v)throw new Invalid();return v}
function normalize(p,version,now){
 keys(p,['requestType','subject','name','phone','date','channel','delivery','time','address','postcard','comment','items','consent','consentVersion','website']);
 if(text(p.website,200))throw new Invalid('REJECTED');
 if(!Object.hasOwn(types,p.requestType))throw new Invalid('TYPE');
 if(p.consent!==true||!version||p.consentVersion!==version)throw new Invalid('CONSENT');
 const phone=text(p.phone,24,true).replace(/\D/g,'').replace(/^8/,'7');if(!/^7\d{10}$/.test(phone))throw new Invalid('PHONE');
 const date=text(p.date,10),today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Moscow'}).format(new Date(now));
 if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date<today||date>String(Number(today.slice(0,4))+3)+today.slice(4)))throw new Invalid('DATE');
 const channel=text(p.channel,30,true);if(!['MAX','ВКонтакте','WhatsApp','Telegram','Телефон'].includes(channel))throw new Invalid('CHANNEL');
 const delivery=text(p.delivery,20);if(delivery&&!['Доставка','Самовывоз'].includes(delivery))throw new Invalid('DELIVERY');
 const time=text(p.time,30);if(time&&!['9:00–12:00','12:00–15:00','15:00–18:00','18:00–20:00'].includes(time))throw new Invalid('TIME');
 const address=text(p.address,250,delivery==='Доставка');
 const items=p.items??[];if(!Array.isArray(items)||items.length>50||p.requestType==='cart'&&!items.length||p.requestType!=='cart'&&items.length)throw new Invalid('ITEMS');
 const seen=new Set();for(const item of items){keys(item,['id','quantity']);if(!/^[a-z0-9-]{1,80}$/.test(item.id)||seen.has(item.id)||!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>99)throw new Invalid('ITEMS');seen.add(item.id)}
 return {requestType:p.requestType,subject:text(p.subject,150),name:text(p.name,80,true),phone:'+'+phone,date,channel,delivery,time,address,postcard:text(p.postcard,500),comment:text(p.comment,2000),items:items.map(x=>({id:x.id,quantity:x.quantity})).sort((a,b)=>a.id.localeCompare(b.id)),consent:true,consentVersion:version};
}
module.exports={normalize,Invalid,text};
