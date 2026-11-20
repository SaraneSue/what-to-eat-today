import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,validateProfile,saveProfile,validateState,splitItems,checkMeal} from '../core.js';
import {recommendations} from '../recommendations.js';
import {SEED_MEALS} from '../data.js';
const userProfile=()=>({...initialState().profile,avoid:splitItems('羊肉\n海带\n苦瓜'),allergyStatus:'some',allergies:splitItems('羊肉\n海带'),conditionStatus:'some',conditions:[{name:'桥本甲状腺炎',source:'用户自述',state:''},{name:'银屑病',source:'用户自述',state:''}],labStatus:'some',labs:[{name:'TgAb',value:'偏高',unit:'',range:'',date:''}]});
test('reported v0.4 profile produces candidates before and after health removal and persistence',()=>{
 for(const scene of ['自己做','外卖','食堂','便利店']){
  let s=initialState();saveProfile(s,validateProfile({...userProfile(),scene}));
  assert.ok(recommendations(s,[]).length>0,scene);
  s=validateState(JSON.parse(JSON.stringify(s)));assert.ok(recommendations(s,[]).length>0);
  saveProfile(s,validateProfile({...s.profile,labStatus:'none',conditionStatus:'none'}));
  assert.deepEqual(s.profile.allergies,['羊肉','海带']);assert.ok(recommendations(s,[]).length>0);
 }
});
test('mutton, kelp and bitter melon names and aliases remain excluded',()=>{
 const profile=userProfile();
 for(const ingredient of ['羊肉','羊排 200克','羊腿','昆布','海带结','海带丝','凉瓜']){
  const meal={...SEED_MEALS[0],ingredients:[ingredient]};
  assert.ok(checkMeal(meal,profile).length>0,ingredient);
 }
 assert.deepEqual(checkMeal({...SEED_MEALS[0],name:'羊肚菌鸡汤',ingredients:['羊肚菌','鸡肉','食盐']},profile),[]);
});
test('a custom food name is matched literally and never rejects every unrelated food',()=>{
 const s=initialState();s.profile.allergyStatus='some';s.profile.allergies=['茴香'];
 assert.ok(recommendations(s,[]).length>0);
 assert.ok(checkMeal({...SEED_MEALS[0],ingredients:['茴香苗 50克']},s.profile).length);
 assert.deepEqual(checkMeal(SEED_MEALS[0],s.profile),[]);
});
