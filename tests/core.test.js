import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,emptyProfile,checkMeal,rankMeals,saveProfile,planMeal,confirmEaten,validateState,validateMeal,createBackup,hasUncoveredHealth,goalReasons,mergeNewTemplates} from '../core.js';
const verifiedMeal = state => ({...state.meals[0],crossContact:false});
test('allergy matches ingredient aliases and cannot be overridden by preference',()=>{
 const s=initialState();s.profile.allergyStatus='some';s.profile.allergies=['鸡蛋'];s.profile.prefs={staple:'rice'};
 assert.ok(checkMeal(verifiedMeal(s),s.profile).some(s=>s.includes('过敏原')));
 assert.ok(!rankMeals(s).candidates.some(r=>r.meal.id==='tomato-rice'));
});
test('unmapped allergens and unverified cross contact do not pass',()=>{
 const s=initialState();s.profile.allergyStatus='some';s.profile.allergies=['芹菜'];
 assert.ok(checkMeal(verifiedMeal(s),s.profile).some(s=>s.includes('暂不支持')));
 s.profile.allergies=['花生'];assert.ok(checkMeal(s.meals[0],s.profile).some(s=>s.includes('交叉')));
});
test('compound ingredient declarations cover soy and wheat',()=>{
 const s=initialState();s.profile.allergyStatus='some';s.profile.allergies=['豆腐'];
 const m={...s.meals.find(m=>m.id==='chicken-rice'),crossContact:false};
 assert.ok(checkMeal(m,s.profile).some(s=>s.includes('过敏原')));
});
test('broad seafood labels and ingredient aliases are resolved before filtering',()=>{
 const s=initialState();s.profile.allergyStatus='some';s.profile.allergies=['虾'];
 assert.ok(checkMeal({...verifiedMeal(s),ingredients:['海鲜'],allergens:['海鲜']},s.profile).length);
 s.profile.allergies=['乳蛋白'];assert.ok(checkMeal({...verifiedMeal(s),ingredients:['奶酪'],allergens:[]},s.profile).length);
});
test('explicit exclusions stay excluded while dislikes only rank lower',()=>{
 const s=initialState();s.profile.avoid=['番茄'];s.profile.dislikes=['豆腐'];
 const r=rankMeals(s);assert.ok(r.candidates.every(x=>!x.meal.ingredients.includes('番茄')));
 assert.ok(r.candidates.some(x=>x.meal.name.includes('豆腐')));
});
test('unknown ingredient information cannot pass explicit exclusions',()=>{
 const s=initialState();s.profile.avoid=['花生'];assert.ok(checkMeal({...verifiedMeal(s),complete:false},s.profile).length);
});
test('health data stays uncovered rather than generating disease bans',()=>{
 const s=initialState();s.profile.conditionStatus='some';s.profile.conditions=[{name:'桥本甲状腺炎',source:'用户自述',state:'仅TgAb异常'}];
 assert.equal(hasUncoveredHealth(s.profile),true);assert.equal(checkMeal(verifiedMeal(s),s.profile).length,0);
 assert.ok(rankMeals(s).candidates.length>0);
});
test('planning is not eating, profile changes invalidate plans, history remains',()=>{
 const s=initialState();planMeal(s,s.meals[0]);assert.equal(s.history.length,0);confirmEaten(s);assert.equal(s.history.length,1);
 planMeal(s,s.meals[1]);saveProfile(s,{...s.profile,avoid:['小麦']});assert.equal(s.plan.needsReview,true);
 assert.throws(()=>confirmEaten(s));assert.equal(s.history.length,1);
});
test('changing ingredients causes old plans to fail fresh checks',()=>{
 const s=initialState();s.profile.avoid=['花生'];planMeal(s,s.meals[0]);s.meals[0].ingredients.push('花生');assert.throws(()=>confirmEaten(s));
});
test('budget and time no longer filter; inspiration spans scenes but custom meals retain scene',()=>{
 const s=initialState(), count=rankMeals(s).candidates.length;
 s.context.budget=1;s.context.time=1;s.context.scene='外卖';assert.equal(rankMeals(s).candidates.length,count);
 s.meals=[{...s.meals[0],template:false}];assert.equal(rankMeals(s).candidates.length,0);
});
test('backup validates, private-free export removes health, plan and historical notes',()=>{
 const s=initialState();s.profile.reminders='private';s.profile.allergyStatus='some';s.profile.allergies=['蛋'];
 const full=createBackup(s,true);assert.equal(validateState(full).profile.reminders,'private');
 const light=createBackup(s,false);assert.equal(light.profile.reminders,'');assert.deepEqual(light.profile.allergies,[]);assert.deepEqual(light.history,[]);assert.equal(light.onboarded,false);
});
test('malformed imports cannot silently erase safety constraints',()=>{
 for(const mutate of [s=>s.profile.allergyStatus='bad',s=>{s.profile.allergyStatus='some';s.profile.allergies=[];},s=>s.meals[0].complete='yes',s=>s.context.time=Infinity,s=>s.meals.push(s.meals[0]),s=>s.profile.budget=-1]){
 const s=initialState();mutate(s);assert.throws(()=>validateState(s));}
});
test('imported plans require review and acknowledgement is never imported',()=>{
 const s=initialState();s.generalAccepted=true;planMeal(s,s.meals[0]);const imported=validateState(s);
 assert.equal(imported.generalAccepted,false);assert.equal(imported.plan.needsReview,true);
});
test('matching a craving never includes a blocked meal',()=>{
 const s=initialState();s.profile.avoid=['番茄'];assert.ok(rankMeals(s,{wish:'番茄'}).candidates.every(x=>!x.meal.name.includes('番茄')));
});

test('goals influence actual ranking with composition-specific reasons',()=>{
 const s=initialState();s.profile.goal='减脂与健身';
 const top=rankMeals(s).candidates[0];assert.ok(top.reasons.some(r=>r.includes('减脂')));assert.ok(top.reasons.some(r=>r.includes('健身')));
 assert.deepEqual(goalReasons({...s.meals[0],tags:['rich'],ingredients:['土豆']},s.profile.goal),[]);
 s.profile.avoid=['鸡蛋'];assert.ok(rankMeals(s).candidates.every(r=>!r.meal.ingredients.includes('鸡蛋')));
});
test('catalog migration retains profile, edits and deletions across reloads',()=>{
 const s=initialState();s.catalogVersion=1;s.meals=s.meals.slice(0,12);s.meals[0].name='my edit';s.profile.avoid=['花生'];
 mergeNewTemplates(s);assert.equal(s.meals.length,42);assert.equal(s.meals[0].name,'my edit');assert.deepEqual(s.profile.avoid,['花生']);
 s.meals.pop();const restored=validateState(s);mergeNewTemplates(restored);assert.equal(restored.meals.length,41);
});
