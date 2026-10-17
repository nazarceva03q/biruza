const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname,'..');
const files = ['index.html','privacy.html','app.js','data.js','config.js','styles.css','social.css'];
for(const file of files){const text=fs.readFileSync(path.join(root,file),'utf8');assert(!text.includes('\u2014'),`${file}: long dash`);if(file.endsWith('.js'))new vm.Script(text,{filename:file});}
const ctx = {window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'config.js'),'utf8'),ctx);vm.runInNewContext(fs.readFileSync(path.join(root,'data.js'),'utf8'),ctx);
assert.equal(ctx.window.BIRUZA_CONFIG.phone,'+79101783964');
assert.equal(ctx.window.BIRUZA_CONFIG.address,'г. Владимир, ул. Мира, 53');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert.equal((html.match(/<h1\b/g)||[]).length,1);
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size,'duplicate id');
for(const match of html.matchAll(/(?:src|href)="([^"#][^"]*)"/g)){const value=match[1];if(/^(?:https?:|tel:|mailto:)/.test(value))continue;assert(fs.existsSync(path.join(root,value.split('?')[0])),`Missing ${value}`);}
assert(fs.statSync(path.join(root,'assets/logo.png')).size>0);
console.log('Syntax, contacts, local assets, heading hierarchy and dash checks passed.');
