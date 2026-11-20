import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRecipe,recipePaths,fetchChineseMeals} from '../online.js';
const md='# 番茄炒蛋的做法\n\n## 必备原料和工具\n\n- 番茄\n- 鸡蛋\n- 食盐\n\n## 计算\n- 鸡蛋 2个\n\n## 操作\n- 炒熟';
const path='dishes/vegetable_dish/番茄炒蛋.md';
test('Chinese recipe parsing uses the ingredient section, not nutritional or medical prose',()=>{
 const meal=parseRecipe(md,path);assert.equal(meal.name,'番茄炒蛋');assert.deepEqual(meal.ingredients,['番茄','鸡蛋','食盐']);
 assert.equal(meal.complete,false);assert.equal(meal.crossContact,true);assert.ok(meal.source.startsWith('https://github.com/Anduin2017/HowToCook/'));
 assert.equal(parseRecipe('# 没有配料',path),null);
});
test('directory restricts recipes to known Chinese meal categories',()=>{
 const tree={tree:[{type:'blob',path},{type:'blob',path:'README.md'},{type:'blob',path:'dishes/drink/酒.md'},{type:'blob',path:'dishes/staple/../oops.md'}]};
 assert.deepEqual(recipePaths(tree),[path]);assert.throws(()=>recipePaths({}));
});
test('background fetch needs no query/profile and pins raw files to the catalog SHA',async()=>{
 const calls=[],sha='a'.repeat(40);
 const meals=await fetchChineseMeals(undefined,async(url,options)=>{
  calls.push({url,options});
  if(url.includes('api.github.com'))return {ok:true,json:async()=>({sha,tree:[{type:'blob',path}]})};
  return {ok:true,text:async()=>md};
 },'2026-11-20');
 assert.equal(meals.length,1);assert.equal(calls.length,2);assert.ok(calls[1].url.includes('/'+sha+'/'));
 for(const call of calls){assert.equal(call.options.credentials,'omit');assert.equal(call.options.referrerPolicy,'no-referrer');assert.ok(!call.url.includes('profile'));}
});
test('failed services and aborts reject for local fallback',async()=>{
 await assert.rejects(fetchChineseMeals(undefined,async()=>({ok:false})));
 const ac=new AbortController();ac.abort();await assert.rejects(fetchChineseMeals(ac.signal,async(url,options)=>{options.signal.throwIfAborted();}),{name:'AbortError'});
});
