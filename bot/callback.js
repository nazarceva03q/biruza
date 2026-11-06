'use strict';
exports.handler=async event=>{
 const http=require('./src/http');
 if(event.httpMethod!=='POST')return{statusCode:405,body:'Method'};
 try{
  const result=await require('./src/runtime')('callback').webhook.handle(http.body(event,100000));
  return{statusCode:result.status,headers:{'Content-Type':'text/plain; charset=utf-8'},body:result.body};
 }catch(error){
  // Only fixed operational codes. Never return raw messages, stack, keys or payload.
  const value=String(error?.message||'');
  const allowed=/^(?:STORAGE_HTTP_[0-9]{3}|VK_[0-9]+|VK_HTTP|STORAGE_CONFIG|VK_CONFIG|ADMIN_BUSY|ADMIN_LEASE|CONTENTION|CONFLICT)$/;
  const code=allowed.test(value)?value:'CALLBACK_INTERNAL';
  return{statusCode:503,headers:{'Content-Type':'text/plain; charset=utf-8'},body:'Retry later: '+code};
 }
};
