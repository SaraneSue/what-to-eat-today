import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,planMeal,validateState,checkMeal} from '../core.js';
import {recommendations} from '../recommendations.js';
import {parseRecipe} from '../online.js';
import {SCENE_GUIDANCE} from '../scenes.js';
const recipe=(title,ingredients)=>parseRecipe(`# ${title}的做法\n## 必备原料和工具\n${ingredients.map(i=>'- '+i).join('\n')}\n## 操作\n- 炒熟`,'dishes/meat_dish/'+title+'.md');
test('each scene has its own eligible recommendations and explicit reason',()=>{
 const firstIds=new Set();
 for(const scene of Object.keys(SCENE_GUIDANCE)){
  const s=initialState();s.context.scene=scene;
  const rows=recommendations(s,[]);assert.ok(rows.length>=8,scene);firstIds.add(rows[0].meal.id);
  assert.ok(rows.every(r=>r.meal.scene===scene));assert.equal(rows[0].reasons[0],SCENE_GUIDANCE[scene].reason);
 }
 assert.equal(firstIds.size,4);
});
test('convenience store excludes cooking recipes even if cached or previously adopted',()=>{
 const s=initialState(),m=recipe('香菇炖鸡',['香菇','鸡肉','食盐']);
 planMeal(s,m);s.context.scene='便利店';s.plan=null;
 const rows=recommendations(s,[m]);assert.equal(rows.length,8);
 assert.ok(rows.every(r=>r.meal.id.startsWith('scene-store-')));
 assert.ok(rows.every(r=>/即食|微波/.test(r.meal.method)));
 assert.ok(rows.every(r=>!r.meal.source));
});
test('outside cooking, only common menu dishes from online sources are adapted',()=>{
 const uncommon=recipe('自制千层酥',['面粉','黄油']),common=recipe('土豆炖牛肉',['土豆','牛肉','食盐']);
 const s=initialState();
 assert.ok(recommendations(s,[uncommon]).some(r=>r.meal.id===uncommon.id));
 for(const scene of ['外卖','食堂']){
  s.context.scene=scene;const rows=recommendations(s,[uncommon,common]);
  assert.ok(!rows.some(r=>r.meal.source===uncommon.source));
  const adapted=rows.find(r=>r.meal.source===common.source);assert.ok(adapted);assert.equal(adapted.meal.scene,scene);
  assert.match(adapted.meal.method,scene==='外卖'?/同店/:/窗口/);
 }
});
test('food restrictions apply to complete scene combinations without relaxing them',()=>{
 const s=initialState();s.profile.allergyStatus='some';s.profile.allergies=['蛋','奶'];s.profile.avoid=['羊肉','海带','苦瓜'];
 for(const scene of Object.keys(SCENE_GUIDANCE)){
  s.context.scene=scene;const rows=recommendations(s,[]);assert.ok(rows.length>0,scene);
  assert.ok(rows.every(r=>checkMeal(r.meal,s.profile).length===0));
  assert.ok(rows.every(r=>!r.meal.allergens.some(a=>['蛋','奶'].includes(a))));
 }
});
test('adopted plans persist their original dining scene when current selection changes',()=>{
 const s=initialState();s.context.scene='便利店';const m=recommendations(s,[])[0].meal;
 planMeal(s,m);s.context.scene='食堂';const restored=validateState(s);
 assert.equal(restored.plan.scene,'便利店');assert.equal(restored.context.scene,'食堂');
 assert.ok(recommendations(restored,[]).every(r=>r.meal.scene==='食堂'));
});
