import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,adoptedMeals,planMeal,confirmEaten,validateState,createBackup,checkMeal} from '../core.js';
import {recommendations} from '../recommendations.js';
import {parseRecipe} from '../online.js';
test('app catalog supplies recommendations while personal library starts empty',()=>{
 const s=initialState();assert.deepEqual(s.meals,[]);assert.deepEqual(adoptedMeals(s),[]);
 assert.ok(recommendations(s,[]).length>=42);assert.deepEqual(adoptedMeals(s),[]);assert.equal(s.meals.length,0);
});
test('adopt, eat, repeat and recheck have distinct durable counts',()=>{
 const s=initialState(),meal=recommendations(s,[])[0].meal;
 planMeal(s,meal);assert.equal(adoptedMeals(s)[0].count,1);assert.equal(adoptedMeals(s)[0].eaten,0);
 planMeal(s,meal,{recordAdoption:false});assert.equal(adoptedMeals(s)[0].count,1);
 confirmEaten(s);assert.equal(adoptedMeals(s)[0].count,1);assert.equal(adoptedMeals(s)[0].eaten,1);
 planMeal(s,meal);assert.equal(adoptedMeals(s)[0].count,2);s.plan=null;
 const restored=validateState(s);assert.equal(adoptedMeals(restored)[0].count,2);assert.equal(adoptedMeals(restored)[0].eaten,1);
});
test('changing cross-contact or manual verification flags cannot change recipe filtering',()=>{
 const s=initialState();s.profile.allergyStatus='some';s.profile.allergies=['鸡蛋'];
 const m=parseRecipe('# 清蒸鸡的做法\n## 必备原料和工具\n- 鸡肉\n- 食盐\n## 操作\n- 蒸熟','dishes/meat_dish/清蒸鸡.md');
 assert.deepEqual(checkMeal({...m,crossContact:true,complete:false},s.profile),[]);
 assert.deepEqual(checkMeal({...m,crossContact:false,complete:true},s.profile),[]);
 m.ingredients.push('鸡蛋 2 个');assert.ok(checkMeal(m,s.profile).some(r=>r.includes('过敏原')));
});
test('app recognizes condiment allergens and refuses ambiguous recipe data without asking user to edit',()=>{
 const s=initialState();s.profile.allergyStatus='some';s.profile.allergies=['大豆'];
 const m={...recommendations(initialState(),[])[0].meal,ingredients:['鸡肉','生抽'],allergens:[],recipeText:''};
 assert.ok(checkMeal(m,s.profile).some(r=>r.includes('过敏原')));
 s.profile.allergies=['花生'];m.ingredients=['鸡肉','调料包'];assert.ok(checkMeal(m,s.profile).length);
});
test('export without private records does not leak adoption events',()=>{
 const s=initialState();planMeal(s,recommendations(s,[])[0].meal);
 assert.equal(createBackup(s,false).adoptions.length,0);assert.equal(validateState(createBackup(s,true)).adoptions.length,1);
});
