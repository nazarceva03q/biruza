const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const port = Number(process.env.PORT || 4177);
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.ttf':'font/ttf','.woff2':'font/woff2','.json':'application/json'};
const allowed = new Set(['index.html','privacy.html','styles.css','social.css','config.js','data.js','app.js','favicon.svg']);
const server = http.createServer((req,res) => {
  let relative;
  try { relative = decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/, '') || 'index.html'; } catch { res.writeHead(400);res.end();return; }
  const filename = path.resolve(root,relative);
  if (!filename.startsWith(root+path.sep) || (!allowed.has(relative) && !relative.startsWith('assets/')) || !['GET','HEAD'].includes(req.method)) {res.writeHead(404);res.end('Not found');return;}
  fs.readFile(filename,(err,body) => {
    if(err){res.writeHead(404);res.end('Not found');return;}
    res.writeHead(200,{'Content-Type':types[path.extname(filename)] || 'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});
    res.end(req.method==='HEAD' ? undefined : body);
  });
});
server.listen(port,'127.0.0.1',()=>console.log(`Бирюза: http://127.0.0.1:${port}`));
