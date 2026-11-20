// DOM boundary harness verifies routing and rendered state without a browser/server.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import * as core from '../core.js';
import * as data from '../data.js';
import * as online from '../online.js';
import * as updates from '../updates.js';
function boot(saved){
 const elements=new Map(),events={};
 const element=selector=>{if(!elements.has(selector))elements.set(selector,{innerHTML:'',hidden:false,textContent:'',classList:{add(){},remove(){}},addEventListener(){},showModal(){},close(){}});return elements.get(selector);};
 const context=vm.createContext({...core,...data,...online,...updates,structuredClone,console,URL,AbortController,MessageChannel,setTimeout,clearTimeout,
 document:{querySelector:element,querySelectorAll:()=>[],addEventListener:(event,fn)=>(events[event]??=[]).push(fn)},
 window:{addEventListener(){},scrollTo(){}},navigator:{onLine:true},location:{hash:''},
 localStorage:{getItem:()=>saved?JSON.stringify(saved):null,setItem(){}}});
 vm.runInContext(readFileSync(new URL('../app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,''),context);
 return {context,element,events};
}
test('fresh visit opens health onboarding immediately and keeps update banner hidden',()=>{
 const {element}=boot();assert.match(element('#app').innerHTML,/先记住你的饮食限制/);assert.equal(element('#nav').hidden,true);
});
test('existing user sees recipe first, collapsed explanation after and no budget, time or reject lists',()=>{
 const state=core.initialState();state.onboarded=true;state.profile.conditionStatus='some';state.profile.conditions=[{name:'银屑病',source:'用户自述',state:'稳定'}];
 const {element}=boot(state);const html=element('#app').innerHTML;
 assert.ok(html.indexOf('meal-card')<html.indexOf('本次考虑了什么'));
 assert.match(html,/<details class="health-note">/);assert.doesNotMatch(html,/预算|分钟|查看排除原因|进入通用选择/);
});
test('goal options, online discovery and untrusted text render correctly',()=>{
 const {context}=boot();
 const setup=vm.runInContext('step=3;setupView()',context);assert.match(setup,/减脂与健身/);assert.doesNotMatch(setup,/预算/);
 const html=vm.runInContext(`onlineTerm='<img onerror=bad>';onlineRows=[{id:'online-1',name:'<script>evil</script>',ingredients:[]}];discoverView()`,context);
 assert.doesNotMatch(html,/<script>|<img/);assert.match(html,/&lt;script&gt;/);assert.match(html,/待核对/);
});
test('late search response cannot overwrite a more recent keyword result',async()=>{
 const {context}=boot();const pending={};
 context.searchRecipes=term=>new Promise(resolve=>pending[term]=resolve);
 const first=vm.runInContext("runSearch('chicken')",context);
 const second=vm.runInContext("runSearch('beef')",context);
 pending.beef([{id:'online-2',name:'Beef',ingredients:[]}]);await second;
 pending.chicken([{id:'online-1',name:'Chicken',ingredients:[]}]);await first;
 assert.equal(vm.runInContext('onlineTerm',context),'beef');
 assert.equal(vm.runInContext('onlineRows[0].name',context),'Beef');
});
