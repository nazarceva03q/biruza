'use strict';
const {mutate,hash}=require('./storage');
const seed=require('../seed.json');
const galleries=['wedding','store_opening','event'];
const categories=seed.products.map(p=>({domain:p.domain,category:p.category}));
class Catalog{
 constructor(db,media,mediaBase){Object.assign(this,{db,media,mediaBase})}
 async read(){return (await this.db.get('catalog/manifest.json')).data||structuredClone(seed)}
 async change(operation,fn){return mutate(this.db,'catalog/manifest.json',current=>{const c=current||structuredClone(seed);if(c.operations.includes(operation))return;c.revision++;fn(c);c.operations.push(operation);return c})}
 async append(gallery,photos,operation){if(!galleries.includes(gallery)||!photos.length)throw Error('GALLERY');return this.change(operation,c=>{for(const p of photos)if(!c.galleries[gallery].some(x=>x.id===p.id))c.galleries[gallery].push(p)})}
 async save(product,operation,expected){
  if(!categories.some(c=>c.domain===product.domain&&c.category===product.category)||!product.name||product.name.length>150||product.description.length>3000||product.composition.length>2000||product.priceLabel!==undefined&&(typeof product.priceLabel!=='string'||product.priceLabel.length>120)||!(product.price===null||Number.isFinite(product.price)&&product.price>=0&&product.price<=10000000)||!Array.isArray(product.images)||product.images.length>20)throw Error('PRODUCT');
  return this.change(operation,c=>{const i=c.products.findIndex(x=>x.id===product.id);if(i>=0&&expected!==c.products[i].version)throw Error('PRODUCT_CONFLICT');const item={...product,version:(expected||0)+1};if(i<0)c.products.push(item);else c.products[i]=item});
 }
 async remove(id,operation,expected){return this.change(operation,c=>{const p=c.products.find(p=>p.id===id);if(p&&p.version!==expected)throw Error('PRODUCT_CONFLICT');c.products=c.products.filter(p=>p.id!==id)})}
 async upload(url,operation,index){
  const u=new URL(url);if(u.protocol!=='https:'||!/(^|\.)(userapi\.com|vkuserphoto\.ru|vk\.com)$/.test(u.hostname))throw Error('PHOTO_HOST');
  const r=await fetch(u,{redirect:'error',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('PHOTO_FETCH');
  const mime=(r.headers.get('content-type')||'').split(';')[0];if(!['image/jpeg','image/png','image/webp'].includes(mime))throw Error('PHOTO_MIME');
  let size=0;const parts=[];for await(const part of r.body){size+=part.length;if(size>10*1024*1024)throw Error('PHOTO_SIZE');parts.push(Buffer.from(part))}const data=Buffer.concat(parts);
  const valid=mime==='image/jpeg'?data[0]===255&&data[1]===216&&data[2]===255:mime==='image/png'?data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):data.toString('ascii',0,4)==='RIFF'&&data.toString('ascii',8,12)==='WEBP';if(!valid)throw Error('PHOTO_CONTENT');
  const id=hash(operation+':'+index),key='media/'+id+'.'+({'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[mime]);
  try{await this.media.binary(key,data,mime)}catch(e){if(e.code!=='CONFLICT')throw e}
  return{id,url:this.mediaBase.replace(/\/$/,'')+'/'+key};
 }
 public(c){const{operations,...manifest}=c;return manifest}
}
module.exports={Catalog,categories,galleries};
