'use strict';
function config(env=process.env){
 const storage={accessKey:env.YC_S3_ACCESS_KEY,secretKey:env.YC_S3_SECRET_KEY};
 return{privateStorage:{...storage,bucket:env.BIRUZA_PRIVATE_BUCKET},mediaStorage:{...storage,bucket:env.BIRUZA_MEDIA_BUCKET},mediaBase:env.BIRUZA_MEDIA_BASE,
 token:env.VK_GROUP_TOKEN,group:Number(env.VK_GROUP_ID),secret:env.VK_CALLBACK_SECRET,confirmation:env.VK_CONFIRMATION_TOKEN,
 admins:(env.VK_ADMIN_IDS||'').split(',').map(Number).filter(n=>Number.isSafeInteger(n)&&n>0),peer:Number(env.VK_REQUESTS_CHAT_ID),
 requestSecret:env.REQUEST_HMAC_SECRET,consentVersion:env.CONSENT_VERSION,origins:(env.ALLOWED_ORIGINS||'').split(',').filter(Boolean),
 intakeEnabled:env.INTAKE_ENABLED==='true',apply:env.CLEANUP_APPLY==='true',deliveryEnabled:env.DELIVERY_ENABLED==='true',discovery:env.VK_DISCOVERY_ENABLED==='true',deleteTest:env.VK_DELETE_TEST_ENABLED==='true'};
}
module.exports=config;
