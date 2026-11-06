'use strict';
exports.handler=async event=>{const http=require('./src/http');if(event.httpMethod!=='GET')return http.response(405,{error:'METHOD'});try{const r=require('./src/runtime')('catalog'),c=await r.catalog.read();return http.response(200,r.catalog.public(c),{'Access-Control-Allow-Origin':'*','Cache-Control':'public,max-age=30'})}catch{return http.response(503,{error:'TEMPORARY'})}};
