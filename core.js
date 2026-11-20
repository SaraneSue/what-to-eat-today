import {QUESTIONS, SEED_MEALS, ALLERGEN_GROUPS, SCENES} from './data.js';
export const STORAGE_KEY = 'meal-v0:data:1';
export const splitItems = value => [...new Set(String(value || '').split(/[\n,，、;；]/).map(s=>s.trim()).filter(Boolean))].slice(0,50);
export const emptyProfile = () => ({avoid:[],dislikes:[],allergyStatus:'unknown',allergies:[],labStatus:'unknown',labs:[],conditionStatus:'unknown',conditions:[],reminders:'',goal:'规律吃饭',budget:35,scene:'自己做',prefs:{},updatedAt:null});
export const initialState = () => ({schema:1,catalogVersion:2,onboarded:false,profile:emptyProfile(),meals:[],adoptions:[],history:[],plan:null,context:{scene:'自己做',budget:35,time:45,meal:'午餐'},generalAccepted:false,draft:null,revision:0});
export const hasUncoveredHealth = p => p.labStatus!=='none' || p.conditionStatus!=='none' || Boolean(p.reminders.trim());
export function healthSummary(p){
  const rows=[];
  if(p.labStatus==='some') rows.push('异常体检项已记录，尚无经专业审核的对应筛选规则');
  if(p.conditionStatus==='some') rows.push('已知疾病已记录，尚无经专业审核的对应筛选规则');
  if(p.labStatus==='unknown'||p.conditionStatus==='unknown') rows.push('部分健康信息未提供，本次不能完成健康适宜性判断');
  if(p.reminders.trim()) rows.push('专业提醒原文已保存，程序不会自动解释；明确要排除的食物请另外加入“必须避开”');
  if(!rows.length) rows.push('按你已填信息筛选；没有进行医疗安全判断');
  return rows;
}
export function allergenGroups(item){
 const value=item.trim().toLowerCase();
 const found=Object.entries(ALLERGEN_GROUPS).filter(([,aliases])=>aliases.some(a=>a===value)).map(([key])=>key);
 if(found.includes('海鲜')) return ['鱼','甲壳类','贝类'];
 return found;
}
function mentions(meal,word){return [meal.name,...meal.ingredients,...meal.allergens,meal.recipeText||''].some(v=>v.toLowerCase().includes(word.toLowerCase()));}
export function checkMeal(meal,profile){
 const reasons=[];
 if((!meal.ingredients.length || ((profile.avoid.length||profile.allergyStatus==='some') && /其他配料|其他食材|复合调料|调味料|调味酱|调料包|酱料/.test(meal.ingredients.join(' ')))))reasons.push('食谱资料不足以完成当前限制筛选');
 const declared = new Set(meal.allergens.flatMap(a=>allergenGroups(a).length?allergenGroups(a):[a]));
 for(const ingredient of meal.ingredients)for(const group of allergenGroups(ingredient))declared.add(group);
 const ingredientText=[...meal.ingredients,meal.recipeText||''].join(' ');
 if(/生抽|老抽|酱油|豆瓣酱/.test(ingredientText)){declared.add('大豆');declared.add('小麦');}
 if(/蚝油/.test(ingredientText))declared.add('贝类');
 for(const avoid of profile.avoid) if(mentions(meal,avoid)||allergenGroups(avoid).some(g=>declared.has(g)||ALLERGEN_GROUPS[g]?.some(alias=>mentions(meal,alias)))) reasons.push(`包含必须避开的“${avoid}”`);
 if(profile.allergyStatus==='some'){
   for(const allergy of profile.allergies){
     const groups=allergenGroups(allergy);
     if(!groups.length) reasons.push(`暂不支持自动核对“${allergy}”过敏原`);
     else if(groups.some(g=>declared.has(g)||ALLERGEN_GROUPS[g]?.some(alias=>mentions(meal,alias)))||mentions(meal,allergy)) reasons.push(`可能包含过敏原“${allergy}”`);
   }
 }
 return [...new Set(reasons)];
}
export function rankMeals(state,{exclude=[],wish=''}={}){
 const {profile,context}=state, seen=new Set(state.history.map(h=>h.mealId));
 const rejected=[];
 const candidates=state.meals.filter(m=>{
  const reasons=checkMeal(m,profile);
  if(!m.template && m.scene!==context.scene) reasons.push('就餐方式不同');
  if(exclude.includes(m.id)) reasons.push('本次已跳过');
  if(reasons.length){rejected.push({meal:m,reasons});return false;}return true;
 }).map(m=>{
   let score=0;const reasons=[];
   for(const q of QUESTIONS){const pref=profile.prefs[q.key];if(!pref)continue;
    if(q.key==='explore'){if((pref==='familiar'&&seen.has(m.id))||(pref==='new'&&!seen.has(m.id))){score++;reasons.push(pref==='new'?'给口味一点新鲜感':'你以前选过');}}
    else if(m.tags.includes(pref)){score++;reasons.push(q.values.indexOf(pref)===0?q.a:q.b);}
   }
   const goals=goalReasons(m,profile.goal);score+=goals.length*2;reasons.unshift(...goals);
   if(!reasons.length)reasons.push(m.source?'来自中文家常食谱':'来自你的常吃与餐食灵感');
   if(profile.dislikes.some(d=>mentions(m,d)))score-=4;
   if(state.history.slice(0,3).some(h=>h.mealId===m.id))score-=1;
   if(wish && mentions(m,wish)){score+=10;reasons.unshift('与你现在想吃的相符');}
   return {meal:m,score,reasons:reasons.slice(0,3)};
 }).sort((a,b)=>b.score-a.score||a.meal.id.localeCompare(b.meal.id));
 return {candidates,rejected};
}
export function saveProfile(state,profile){
 state.profile=structuredClone(profile);state.profile.updatedAt=new Date().toISOString();state.onboarded=true;state.revision++;
 state.context.scene=profile.scene;state.context.budget=profile.budget;state.generalAccepted=false;state.draft=null;
 if(state.plan)state.plan.needsReview=true;
 return state;
}
export function planMeal(state,meal,{recordAdoption=true}={}){
 if(checkMeal(meal,state.profile).length)throw new Error('这份餐食没有通过当前配料约束检查');
 const stored=state.meals.findIndex(m=>m.id===meal.id);if(stored<0)state.meals.push(structuredClone(meal));else state.meals[stored]=structuredClone(meal);
 if(recordAdoption){state.adoptions??=[];state.adoptions.unshift({id:globalThis.crypto.randomUUID(),mealId:meal.id,name:meal.name,at:new Date().toISOString()});state.adoptions=state.adoptions.slice(0,1000);}
 state.plan={mealId:meal.id,name:meal.name,createdAt:new Date().toISOString(),mealSlot:state.context.meal,revision:state.revision,needsReview:false};
}
export function confirmEaten(state){
 if(!state.plan)throw new Error('还没有选择餐食');
 const meal=state.meals.find(m=>m.id===state.plan.mealId);
 if(state.plan.needsReview||state.plan.revision!==state.revision||!meal||checkMeal(meal,state.profile).length)throw new Error('档案或餐食已改变，请先按最新条件重新选择');
 state.history.unshift({id:globalThis.crypto.randomUUID(),mealId:meal.id,name:meal.name,at:new Date().toISOString(),mealSlot:state.plan.mealSlot,feedback:'',note:''});
 state.history=state.history.slice(0,1000);state.plan=null;
}
// Validate all imported data and reconstruct known fields (no arbitrary HTML or keys).
const str=(v,max=500)=>{if(typeof v!=='string'||v.length>max)throw new Error('文本字段格式不正确或过长');return v;};
const num=(v,min,max)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw new Error('数字字段超出范围');return v;};
const bool=v=>{if(typeof v!=='boolean')throw new Error('布尔字段无效');return v;};
const choice=(v,values)=>{if(!values.includes(v))throw new Error('选项字段无效');return v;};
const arr=(v,max=100)=>{if(!Array.isArray(v)||v.length>max)throw new Error('列表格式不正确或过长');return v;};
const textArray=(v,max=50)=>arr(v,max).map(s=>str(s,100));
const date=v=>{if(v===null||v==='')return v;str(v,50);if(!Number.isFinite(Date.parse(v)))throw new Error('日期格式无效');return v;};
export function validateProfile(p){
 if(!p||typeof p!=='object')throw new Error('缺少档案');
 const out=emptyProfile();out.avoid=textArray(p.avoid);out.dislikes=textArray(p.dislikes);out.allergies=textArray(p.allergies);
 for(const k of ['allergyStatus','labStatus','conditionStatus'])out[k]=choice(p[k],['none','some','unknown']);
 out.labs=arr(p.labs,30).map(l=>({name:str(l.name,100),value:str(l.value,50),unit:str(l.unit,50),range:str(l.range,100),date:date(l.date)}));
 out.conditions=arr(p.conditions,30).map(c=>({name:str(c.name,100),source:str(c.source,100),state:str(c.state,200)}));
 if(out.allergyStatus==='some'&&!out.allergies.length)throw new Error('请填写过敏食物，或修改填写状态');
 if(out.labStatus==='some'&&!out.labs.some(l=>l.name.trim()))throw new Error('请填写异常体检项名称');
 if(out.conditionStatus==='some'&&!out.conditions.some(c=>c.name.trim()))throw new Error('请填写已知疾病名称');
 if(out.allergyStatus!=='some')out.allergies=[];
 if(out.labStatus!=='some')out.labs=[];
 if(out.conditionStatus!=='some')out.conditions=[];
 out.reminders=str(p.reminders,2000);out.goal=str(p.goal,100);out.budget=num(p.budget,1,10000);out.scene=choice(p.scene,SCENES);out.updatedAt=date(p.updatedAt);
 for(const q of QUESTIONS)if(p.prefs?.[q.key])out.prefs[q.key]=choice(p.prefs[q.key],q.values);
 return out;
}
export function validateMeal(m){
 return {kind:m.kind==='recipe'?'recipe':'meal',recipeText:typeof m.recipeText==='string'?str(m.recipeText,20000):'',source:typeof m.source==='string'&&/^https:\/\/github\.com\/Anduin2017\/HowToCook\/blob\/master\/dishes\/[A-Za-z0-9%_.~\/-]+\.md$/.test(m.source)?m.source:'',id:str(m.id,100),name:str(m.name,100),ingredients:textArray(m.ingredients),allergens:textArray(m.allergens),tags:textArray(m.tags),minutes:num(m.minutes,1,600),cost:num(m.cost,0,10000),method:str(m.method,1000),emoji:str(m.emoji||'🍽️',16),scene:choice(m.scene,SCENES),complete:bool(m.complete),crossContact:bool(m.crossContact),template:bool(m.template)};
}
export function validateState(input){
 if(!input||input.schema!==1)throw new Error('不是支持的 v0 备份格式');
 const result=initialState();result.catalogVersion=input.catalogVersion===2?2:1;result.profile=validateProfile(input.profile);result.onboarded=bool(input.onboarded);result.meals=arr(input.meals,500).map(validateMeal);
 if(new Set(result.meals.map(m=>m.id)).size!==result.meals.length)throw new Error('餐食编号重复');
 result.history=arr(input.history,1000).map(h=>({id:str(h.id,100),mealId:str(h.mealId,100),name:str(h.name,100),at:date(h.at),mealSlot:str(h.mealSlot,20),feedback:str(h.feedback,100),note:str(h.note,500)}));
 result.adoptions=input.adoptions===undefined?null:arr(input.adoptions,1000).map(a=>({id:str(a.id,150),mealId:str(a.mealId,100),name:str(a.name,100),at:date(a.at)}));
 const c=input.context;result.context={scene:choice(c.scene,SCENES),budget:num(c.budget,1,10000),time:num(c.time,1,600),meal:choice(c.meal,['早餐','午餐','晚餐','加餐'])};
 result.revision=num(input.revision,0,Number.MAX_SAFE_INTEGER);result.generalAccepted=false;
 if(input.plan)result.plan={mealId:str(input.plan.mealId,100),name:str(input.plan.name,100),createdAt:date(input.plan.createdAt),mealSlot:str(input.plan.mealSlot,20),revision:num(input.plan.revision,0,Number.MAX_SAFE_INTEGER),needsReview:true};
 return migratePersonalMeals(result);
}
export function createBackup(state,includeHealth){
 const copy=structuredClone(state);copy.draft=null;copy.generalAccepted=false;
 if(!includeHealth){copy.profile=emptyProfile();copy.onboarded=false;copy.plan=null;copy.history=[];copy.adoptions=[];copy.revision=0;}
 return {...copy,exportedAt:new Date().toISOString(),backupType:includeHealth?'full-private':'meal-library-only'};
}

// Qualitative composition cues only: no nutrient quantities or medical claims.
export function goalReasons(meal,goal){
 const ingredients=meal.ingredients.join(' '), reasons=[];
 if(/减脂|减肥/.test(goal) && meal.tags.includes('light'))reasons.push('减脂意向：优先清淡口味的做法，份量由你决定');
 if(/健身/.test(goal) && /鸡肉|鸡胸|鸡翅|鸡腿|牛肉|鸡蛋|豆腐|鱼|虾|酸奶|牛奶/.test(ingredients))reasons.push('健身意向：配料含肉、蛋、豆或乳类，可自由搭配');
 return reasons;
}
export function migratePersonalMeals(state){
 // Legacy plans and eaten records are evidence of adoption; preloaded recipes are not.
 if(!Array.isArray(state.adoptions)){
  state.adoptions=state.history.map(h=>({id:'legacy-'+h.id,mealId:h.mealId,name:h.name,at:h.at}));
  if(state.plan)state.adoptions.unshift({id:'legacy-plan-'+state.plan.mealId,mealId:state.plan.mealId,name:state.plan.name,at:state.plan.createdAt});
 }
 const used=new Set([...state.adoptions,...state.history].map(x=>x.mealId));if(state.plan)used.add(state.plan.mealId);
 // Preserve user-created or edited legacy records as private snapshots, never as "often eaten".
 state.meals=state.meals.filter(m=>used.has(m.id)||!m.template||!SEED_MEALS.some(seed=>seed.id===m.id&&seed.name===m.name&&JSON.stringify(seed.ingredients)===JSON.stringify(m.ingredients)));
 state.catalogVersion=3;return state;
}
export const mergeNewTemplates=migratePersonalMeals;
export function adoptedMeals(state){
 const groups=new Map();
 for(const event of state.adoptions||[]){
  let group=groups.get(event.mealId);
  if(!group){group={mealId:event.mealId,name:event.name,lastAt:event.at,count:0,eaten:state.history.filter(h=>h.mealId===event.mealId).length};groups.set(event.mealId,group);}
  group.count++;if(event.at>group.lastAt){group.lastAt=event.at;group.name=event.name;}
 }
 return [...groups.values()].sort((a,b)=>b.lastAt.localeCompare(a.lastAt));
}
