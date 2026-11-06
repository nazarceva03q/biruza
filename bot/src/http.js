'use strict';
const{Invalid}=require('./validation');
function body(event,limit=20000){if(typeof event.body!=='string')throw new Invalid();const b=Buffer.from(event.body,event.isBase64Encoded?'base64':'utf8');if(b.length>limit)throw new Invalid('SIZE',413);try{return JSON.parse(b.toString())}catch{throw new Invalid('JSON')}}
const response=(status,data,headers={})=>({statusCode:status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers},body:JSON.stringify(data)});
function intakeHandler(service,config){return async event=>{
 const headers=Object.fromEntries(Object.entries(event.headers||{}).map(([k,v])=>[k.toLowerCase(),v])),origin=headers.origin;
 const cors={'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Idempotency-Key','Access-Control-Max-Age':'600'};
 if(!origin||!config.origins.includes(origin))return response(403,{error:'ORIGIN'});
 if(event.httpMethod==='OPTIONS')return response(204,null,cors);
 if(event.httpMethod!=='POST')return response(405,{error:'METHOD'},cors);
 if(!config.intakeEnabled)return response(503,{error:'NOT_ENABLED'},cors);
 if(!(headers['content-type']||'').toLowerCase().startsWith('application/json'))return response(415,{error:'CONTENT_TYPE'},cors);
 try{
  // Only the platform-authenticated source address, never client-supplied forwarding headers.
  const source=event.requestContext?.identity?.sourceIp;if(!source)return response(503,{error:'SOURCE_UNAVAILABLE'},cors);
  const result=await service.accept(headers['idempotency-key'],body(event),source);
  return response(202,result,cors);
 }catch(e){return response(e instanceof Invalid?e.status:503,{error:e instanceof Invalid?e.message:'TEMPORARY'},cors)}
}}
module.exports={body,response,intakeHandler};
