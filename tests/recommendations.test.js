import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,planMeal,confirmEaten,validateState} from '../core.js';
import {parseRecipe} from '../online.js';
import {readCatalog,makeMealSet,recommendations} from '../recommendations.js';
const remote=()=>parseRecipe('# 清蒸鸡的做法\n\n## 必备原料和工具\n- 鸡肉\n- 生姜\n- 食盐\n\n## 操作\n- 蒸熟','dishes/meat_dish/清蒸鸡.md');
test('online Chinese dish becomes a meal set and is the default eligible recommendation',()=>{
 const s=initialState();s.profile.goal='健身意向';
 const rows=recommendations(s,[remote()]);assert.equal(rows[0].meal.id,remote().id);
 assert.match(rows[0].meal.name,/米饭/);assert.match(rows[0].meal.name,/小白菜/);assert.ok(rows[0].reasons.some(r=>r.includes('健身')));
 assert.ok(!recommendations(s,[remote()],[remote().id]).some(r=>r.meal.id===remote().id));
});
test('recipe ingredients and side dishes are filtered automatically without manual confirmation',()=>{
 const s=initialState();s.profile.avoid=['白菜'];assert.ok(!makeMealSet(remote(),s.profile).name.includes('白菜'));
 assert.ok(recommendations(s,[remote()]).some(r=>r.meal.source));
 s.profile.avoid=['鸡肉'];assert.ok(recommendations(s,[remote()]).every(r=>!r.meal.ingredients.includes('鸡肉')));
 s.profile.avoid=[];s.profile.allergyStatus='some';s.profile.allergies=['鸡蛋'];assert.ok(recommendations(s,[remote()]).some(r=>r.meal.source));
});
test('cached source fields are constrained, unverified flags cannot be smuggled in',()=>{
 const cached=readCatalog(JSON.stringify({at:Date.now(),meals:[{...remote(),complete:true,crossContact:false}]}));
 assert.equal(cached.meals[0].complete,false);assert.equal(cached.meals[0].crossContact,true);
 assert.equal(readCatalog(JSON.stringify({at:1,meals:[{...remote(),source:'javascript:bad()'}]})).meals.length,0);
 assert.equal(readCatalog('bad'),null);
});
test('online selection persists as a full meal and supports eating/history after reload',()=>{
 const s=initialState(),m=recommendations(s,[remote()])[0].meal;s.meals.push(m);planMeal(s,m);
 const restored=validateState(s);restored.plan.needsReview=false;confirmEaten(restored);
 assert.equal(restored.history[0].name,m.name);assert.equal(restored.meals.find(x=>x.id===m.id).source,m.source);
});
