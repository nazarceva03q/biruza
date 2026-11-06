const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const out = path.join(root,'dist');
// Clean only this verified generated directory; stale public files must not survive a build.
if(path.relative(root,out)!=='dist'||!path.isAbsolute(out))throw Error('Unsafe build target');
if(fs.existsSync(out)&&fs.lstatSync(out).isSymbolicLink())throw Error('Build directory must not be a symlink');
fs.rmSync(out,{recursive:true,force:true});
fs.mkdirSync(out,{recursive:true});
for(const name of ['index.html','privacy.html','styles.css','social.css','config.js','data.js','app.js','request-client.js','catalog-data.js','favicon.svg','robots.txt','sitemap.xml']) fs.copyFileSync(path.join(root,name),path.join(out,name));
fs.cpSync(path.join(root,'assets'),path.join(out,'assets'),{recursive:true});
console.log('Static site built in dist/. Only public files included.');
