import test from 'node:test';
import assert from 'node:assert/strict';
import {APP_VERSION,isNewVersion,watchUpdates} from '../updates.js';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('initial install, no waiting version and same release never announce an update',()=>{
 assert.equal(isNewVersion(false,'0.4.0'),false);
 assert.equal(isNewVersion(true,null),false);
 assert.equal(isNewVersion(true,APP_VERSION),false);
 assert.equal(isNewVersion(true,'0.4.0'),true);
});
test('actual waiting update can be applied once; controller change hides banner and reloads once',async()=>{
 const handlers={},sent=[];let visible,apply,saves=0,reloads=0;
 const reg={waiting:{postMessage:x=>sent.push(x)},addEventListener:()=>{}};
 const sw={controller:{},addEventListener:(event,fn)=>handlers[event]=fn};
 watchUpdates(reg,sw,{show:(v,fn)=>{visible=v;apply=fn;},beforeUpdate:()=>saves++,reload:()=>reloads++},async()=> '0.4.0');
 await flush();assert.equal(visible,true);apply();assert.equal(visible,false);assert.equal(saves,1);assert.deepEqual(sent,['SKIP_WAITING']);
 handlers.controllerchange();handlers.controllerchange();assert.equal(reloads,1);assert.equal(visible,false);
});
test('stale waiting worker response cannot resurrect banner',async()=>{
 let resolve,visible;
 const reg={waiting:{},addEventListener:()=>{}},sw={controller:{},addEventListener:()=>{}};
 watchUpdates(reg,sw,{show:v=>visible=v},()=>new Promise(r=>resolve=r));
 reg.waiting=null;resolve('0.4.0');await flush();assert.equal(visible,false);
});
test('first controller claim does not reload onboarding',()=>{
 const handlers={};let reloads=0;
 watchUpdates({waiting:null,addEventListener:()=>{}},{controller:null,addEventListener:(e,fn)=>handlers[e]=fn},{show:()=>{},reload:()=>reloads++},async()=>null);
 handlers.controllerchange();assert.equal(reloads,0);
});
