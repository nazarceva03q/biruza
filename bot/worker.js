'use strict';
// Private function. Cloud IAM authorization + dedicated timer invoker are mandatory.
exports.handler=async()=>{const r=require('./src/runtime')('worker');return r.requests.run({apply:r.config.apply,deliverEnabled:r.config.deliveryEnabled})};
