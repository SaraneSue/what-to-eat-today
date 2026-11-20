// DOM boundary harness verifies routing and rendered state without a browser/server.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import * as core from '../core.js';
import * as data from '../data.js';
import * as online from '../online.js';
import * as updates from '../updates.js';
import * as recs from '../recommendations.js';
function boot(saved,fetcher=async()=>{throw Error("offline test");}){
 const elements=new Map(),events={};
 const element=selector=>{if(!elements.has(selector))elements.set(selector,{innerHTML:'',hidden:false,textContent:'',classList:{add(){},remove(){}},addEventListener(){},showModal(){},close(){}});return elements.get(selector);};
 const context=vm.createContext({...core,...data,...online,...updates,...recs,fetchChineseMeals:fetcher,structuredClone,console,URL,AbortController,MessageChannel,setTimeout,clearTimeout,
 document:{querySelector:element,querySelectorAll:()=>[],addEventListener:(event,fn)=>(events[event]??=[]).push(fn)},
 window:{addEventListener(){},scrollTo(){}},navigator:{onLine:true},location:{hash:''},
 localStorage:{getItem:key=>key===core.STORAGE_KEY&&saved?JSON.stringify(saved):null,setItem(){}}});
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

test('goals stay editable and only one recommendation is rendered without a search entry',()=>{
 const {context}=boot();assert.match(vm.runInContext('step=3;setupView()',context),/减脂与健身/);
 const s=core.initialState();s.onboarded=true;const {element}=boot(s);const html=element('#app').innerHTML;
 assert.equal((html.match(/<article class="meal-card">/g)||[]).length,1);
 assert.doesNotMatch(html,/联网找更多|还有 .* 个选择|online-form/);assert.match(html,/换一套/);
});
test('background Chinese fetch starts automatically and cached results appear in the main card',async()=>{
 const s=core.initialState();s.onboarded=true;let calls=0;
 const m=online.parseRecipe('# 蒸鸡的做法\n## 必备原料和工具\n- 鸡肉\n- 盐\n## 操作\n- 蒸熟','dishes/meat_dish/蒸鸡.md');
 const {element,context}=boot(s,async()=>{calls++;return [m];});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(calls,1);assert.match(element('#app').innerHTML,/蒸鸡/);
 assert.equal((element('#app').innerHTML.match(/<article class="meal-card">/g)||[]).length,1);
 vm.runInContext('render()',context);assert.equal(calls,1);
});
test('swap immediately changes the only set, without opening a reason dialog',()=>{
 const s=core.initialState();s.onboarded=true;const {element,context,events}=boot(s);
 const before=element('#app').innerHTML,id=vm.runInContext('recommendations(state,catalog.meals,skip)[0].meal.id',context);
 for(const callback of events.click)callback({target:{closest:()=>({dataset:{action:'swap',id}})}});
 assert.notEqual(element('#app').innerHTML,before);assert.equal(element('#modal-content').innerHTML,'');
});
test('selected plan does not compete with a second meal suggestion',()=>{
 const s=core.initialState();s.onboarded=true;core.planMeal(s,s.meals[0]);
 const {element}=boot(s);const html=element('#app').innerHTML;
 assert.match(html,/这顿已经选好/);assert.equal((html.match(/<article class="meal-card">/g)||[]).length,0);assert.match(html,/换一套/);
});
