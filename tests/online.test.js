import test from 'node:test';
import assert from 'node:assert/strict';
import {searchURL,searchRecipes,normalizeRecipe,lookupRecipe} from '../online.js';
test('only food keywords are encoded in API requests, Chinese shortcut categories supported',()=>{
 assert.ok(searchURL('鸡肉').endsWith('search.php?s=chicken'));
 assert.ok(searchURL('素食').endsWith('filter.php?c=Vegetarian'));
 assert.ok(searchURL('fish & chips').endsWith('s=fish%20%26%20chips'));
 assert.throws(()=>searchURL('未知中文'));assert.throws(()=>searchURL(''));
});
test('online recipes remain unverified and source URLs cannot inject schemes',()=>{
 const m=normalizeRecipe({idMeal:'52772',strMeal:'Dish',strIngredient1:'Eggs',strInstructions:'Cook',strSource:'javascript:evil()'});
 assert.equal(m.complete,false);assert.equal(m.crossContact,true);assert.equal(m.template,false);
 assert.deepEqual(m.ingredients,['Eggs']);assert.equal(m.source,'https://www.themealdb.com/meal/52772');
 assert.equal(normalizeRecipe({idMeal:'../bad',strMeal:'Bad'}),null);
});
test('search supports empty, failing and cancelled requests with no credentials',async()=>{
 let options;
 assert.deepEqual(await searchRecipes('鸡肉',undefined,async(url,o)=>{options=o;return {ok:true,json:async()=>({meals:null})};}),[]);
 assert.equal(options.credentials,'omit');assert.equal(options.referrerPolicy,'no-referrer');
 await assert.rejects(searchRecipes('鸡肉',undefined,async()=>({ok:false})));
 await assert.rejects(searchRecipes('鸡肉',undefined,async()=>({ok:true,json:async()=>({meals:{bad:1}})})));
 const ac=new AbortController();ac.abort();
 await assert.rejects(searchRecipes('鸡肉',ac.signal,async(url,o)=>{o.signal.throwIfAborted();}),{name:'AbortError'});
 assert.throws(()=>lookupRecipe('unsafe'));
});
