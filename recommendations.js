import {SCENE_MEALS,SCENE_GUIDANCE,isCommonMenuDish,adaptMenuMeal} from './scenes.js';
import {SEED_MEALS} from './data.js';
import {checkMeal,rankMeals,validateMeal} from './core.js';
export const CACHE_KEY='meal-v0:chinese-recipes:2';
export const safeSource=value=>typeof value==='string'&&/^https:\/\/github\.com\/Anduin2017\/HowToCook\/blob\/master\/dishes\/(?:[a-z_]+)\/(?:[A-Za-z0-9%_.~-]+\/)*[A-Za-z0-9%_.~-]+\.md$/.test(value)?value:'';
export function readCatalog(raw){
 try{const value=JSON.parse(raw);if(!Array.isArray(value.meals)||value.meals.length>100||!Number.isFinite(value.at))return null;
 return {at:value.at,meals:value.meals.map(m=>({...validateMeal(m),source:safeSource(m.source),complete:false,crossContact:true,template:true,kind:'recipe'})).filter(m=>m.source&&m.id.startsWith('cn-'))};}catch{return null;}
}
// Complement dishes with simple components, and check the whole set again.
export function makeMealSet(meal,profile){
 if(!meal.source)return meal;
 const all=meal.name+' '+meal.ingredients.join(' '),sides=[];
 if(!/米|面|粉|饺|饼|粥|馒头|土豆|红薯|玉米|燕麦/.test(all))sides.push({name:'米饭',ingredients:['大米','水']});
 if(!/白菜|青菜|生菜|菠菜|西兰花|番茄|西红柿|黄瓜|胡萝卜|茄子|豆角|冬瓜|南瓜|彩椒/.test(all))sides.push({name:'清炒小白菜',ingredients:['小白菜','菜籽油','食盐']});
 if(!/肉|鸡|鸭|鹅|鱼|虾|蛋|豆腐|豆干|牛奶/.test(all))sides.push({name:'煎豆腐',ingredients:['豆腐','菜籽油','食盐']});
 const permitted=sides.filter(side=>!checkMeal({...meal,...side,kind:'recipe',recipeText:'',allergens:[],complete:true,crossContact:true},profile).length);
 return {...meal,name:[meal.name,...permitted.map(s=>s.name)].join(' + ').slice(0,100),ingredients:[...new Set([...meal.ingredients,...permitted.flatMap(s=>s.ingredients)])].slice(0,50),method:permitted.length?'本餐搭配：'+[meal.name,...permitted.map(s=>s.name)].join('、')+'。做法见中文食谱来源。':meal.method};
}
export function recommendations(state,remote,exclude=[],wish=''){
 // Catalog is app data. Personal snapshots enter only through actual adoptions.
 const adoptedIds=new Set((state.adoptions||[]).map(a=>a.mealId));
 const scene=state.context.scene;
 const snapshots=state.meals.filter(m=>adoptedIds.has(m.id)&&m.scene===scene);
 const recipes=new Map([...SEED_MEALS,...remote].map(m=>[m.id,m]));
 const cooked=[...recipes.values()];
 const generated=scene==='自己做'?cooked.map(m=>makeMealSet(m,state.profile)):[...SCENE_MEALS.filter(m=>m.scene===scene),...(scene==='便利店'?[]:cooked.filter(isCommonMenuDish).map(m=>adaptMenuMeal(makeMealSet(m,state.profile),scene)))];
 const combined={...state,meals:[...new Map([...snapshots,...generated].map(m=>[m.id,m])).values()]};
 const rows=rankMeals(combined,{exclude,wish}).candidates;
 // Prefer the best matching eligible online set; local meals remain the fallback and later choices.
 rows.sort((a,b)=>Number(Boolean(b.meal.source))-Number(Boolean(a.meal.source))||b.score-a.score||a.meal.id.localeCompare(b.meal.id));
 for(const row of rows)row.reasons=[SCENE_GUIDANCE[scene].reason,...row.reasons].slice(0,4);
 return rows;
}
