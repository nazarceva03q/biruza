// Local source extraction only. Existing media order is deliberately preserved.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'catalog-data.js'),'utf8'),context);
const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),events=html.slice(html.indexOf('id="events"'),html.indexOf('id="events"')+20000);
const articles=[...events.matchAll(/<article>([\s\S]*?)<\/article>/g)].slice(0,3),galleries={};
['wedding','store_opening','event'].forEach((id,i)=>galleries[id]=[...articles[i][1].matchAll(/<img src="([^"]+)"/g)].map((m,n)=>({id:`seed-${id}-${n+1}`,url:m[1]})));
const data={schema:1,revision:1,products:context.window.BIRUZA_CATALOG.map(p=>({...p,composition:'',version:1})),galleries,operations:[]};
fs.mkdirSync(path.join(root,'bot'),{recursive:true});fs.writeFileSync(path.join(root,'bot','seed.json'),JSON.stringify(data,null,2)+'\n');console.log('Seed extracted: '+data.products.length+' products; galleries '+Object.values(galleries).map(x=>x.length).join('/'));
