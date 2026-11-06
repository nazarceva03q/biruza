'use strict';
exports.handler=async event=>{try{const r=require('./src/runtime')('intake');return await require('./src/http').intakeHandler(r.requests,r.config)(event)}catch{return require('./src/http').response(503,{error:'CONFIGURATION'})}};
