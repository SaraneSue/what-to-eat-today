import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
test('manifest and all static cache assets resolve under a Pages project subpath',async()=>{
 const manifest=JSON.parse(readFileSync(new URL('manifest.webmanifest',root)));
 const base='https://example.github.io/my-meals/';
 assert.equal(new URL(manifest.start_url,base).href,base);
 assert.equal(new URL(manifest.scope,base).href,base);
 for(const icon of manifest.icons){assert.ok(existsSync(new URL(icon.src,root)));assert.ok(new URL(icon.src,base).href.startsWith(base));}
 const handlers={},requests=[];
 vm.runInNewContext(readFileSync(new URL('sw.js',root),'utf8'),{URL,self:{location:{href:base+'sw.js',origin:'https://example.github.io'},addEventListener:(n,f)=>handlers[n]=f},caches:{open:async()=>({addAll:async urls=>requests.push(...urls)})}});
 await new Promise((resolve,reject)=>handlers.install({waitUntil:p=>p.then(resolve,reject)}));
 assert.ok(requests.length>=10);
 for(const url of requests){assert.ok(url.startsWith(base));const local=url.slice(base.length)||'index.html';assert.ok(existsSync(new URL(local,root)),local);}
});
test('activation only removes outdated caches belonging to this project',async()=>{
 const handlers={},deleted=[];let claimed=false;
 const current='meal-v0-shell-/my-meals/-0.2.0';
 vm.runInNewContext(readFileSync(new URL('sw.js',root),'utf8'),{URL,self:{location:{href:'https://example.github.io/my-meals/sw.js',origin:'https://example.github.io'},addEventListener:(n,f)=>handlers[n]=f,clients:{claim:async()=>{claimed=true;}}},caches:{keys:async()=>[current,'meal-v0-shell-/my-meals/-0','meal-v0-shell-/another/-1','unrelated'],delete:async k=>deleted.push(k)}});
 await new Promise((resolve,reject)=>handlers.activate({waitUntil:p=>p.then(resolve,reject)}));
 assert.deepEqual(deleted,['meal-v0-shell-/my-meals/-0']);assert.ok(claimed);
});
test('navigation serves the cached matching app shell and ignores other origins',async()=>{
 const handlers={};let fetches=0;
 vm.runInNewContext(readFileSync(new URL('sw.js',root),'utf8'),{URL,fetch:()=>{fetches++;throw Error('offline');},self:{location:{href:'https://example.github.io/my-meals/sw.js',origin:'https://example.github.io'},addEventListener:(n,f)=>handlers[n]=f},caches:{open:async()=>({match:async()=>({body:'cached-shell'})})}});
 let result;handlers.fetch({request:{url:'https://example.github.io/my-meals/',method:'GET',mode:'navigate'},respondWith:p=>result=p});assert.equal((await result).body,'cached-shell');assert.equal(fetches,0);
 let intercepted=false;handlers.fetch({request:{url:'https://elsewhere.test/',method:'GET',mode:'navigate'},respondWith:()=>intercepted=true});assert.equal(intercepted,false);
});
test('HTML uses only packaged local JS and CSS, and no inline executable scripts',()=>{
 const html=readFileSync(new URL('index.html',root),'utf8');
 assert.ok(html.includes('Content-Security-Policy'));assert.ok(!/<script(?![^>]*src=)[^>]*>/i.test(html));
 for(const path of ['app.js','core.js','data.js','styles.css','sw.js'])assert.ok(existsSync(new URL(path,root)));
 assert.ok(!/style="/.test(readFileSync(new URL('app.js',root),'utf8')));
});
test('service worker version handshake matches the application version',async()=>{
 const {APP_VERSION}=await import('../updates.js');const handlers={};let response;
 vm.runInNewContext(readFileSync(new URL('sw.js',root),'utf8'),{URL,self:{location:{href:'https://example.github.io/my-meals/sw.js'},addEventListener:(event,fn)=>handlers[event]=fn}});
 handlers.message({data:'GET_VERSION',ports:[{postMessage:value=>response=value}]});
 assert.equal(response.version,APP_VERSION);
});
