const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const out = path.join(root,'dist');
fs.mkdirSync(out,{recursive:true});
for(const name of ['index.html','privacy.html','styles.css','social.css','config.js','data.js','app.js','favicon.svg']) fs.copyFileSync(path.join(root,name),path.join(out,name));
fs.cpSync(path.join(root,'assets'),path.join(out,'assets'),{recursive:true});
console.log('Static site built in dist/. Only public files included.');
