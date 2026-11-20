import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join,resolve} from 'node:path';
import {createApi} from './api.mjs';
import {createStore} from './store.mjs';
import {loadKeys} from './security.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const assets=new Map([['/',['public/index.html','text/html; charset=utf-8']],['/app.css',['public/app.css','text/css; charset=utf-8']],['/app.js',['public/app.js','text/javascript; charset=utf-8']]]);
export async function startServer({port=8788,host='127.0.0.1',database=join(root,'data','store.json'),keys=loadKeys(process.env.SMITH_OS_KEYS_JSON||'')}={}){
  if(host!=='127.0.0.1'&&host!=='::1'&&process.env.SMITH_OS_PUBLIC_LISTEN_ACKNOWLEDGED!=='true')throw new Error('Non-loopback bind requires explicit acknowledgement and HTTPS reverse proxy');
  const store=await createStore(database).init();
  const api=createApi({store,keys});
  const server=createServer(async(req,res)=>{
    const path=req.url?.split('?')[0];
    if(req.method==='GET'&&assets.has(path)){
      const [file,type]=assets.get(path);
      try {const contents=await readFile(join(root,file));res.writeHead(200,{'content-type':type,'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY','content-security-policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"});res.end(contents);return;}catch(e){console.error('asset',e);res.writeHead(500);res.end();return;}
    }
    await api(req,res);
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve)});
  return {server,store,address:server.address()};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  startServer({port:Number(process.env.PORT||8788),host:process.env.HOST||'127.0.0.1',database:process.env.SMITH_OS_DATABASE||join(root,'data','store.json')}).then(({address})=>console.log(`SMITH BUSINESS OS pilot listening on ${address.address}:${address.port} (execution disabled)`)).catch(e=>{console.error('SMITH_OS_STARTUP_FAILED:',e.message);process.exitCode=1;});
}
