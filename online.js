// Public prototype API: only a user-entered food keyword is sent, never profile data.
const BASE='https://www.themealdb.com/api/json/v1/1/';
export const SEARCH_IDEAS=['鸡肉','牛肉','意面','海鲜','素食','甜点'];
const queries={'鸡肉':['s','chicken'],'鸡':['s','chicken'],'牛肉':['s','beef'],'猪肉':['s','pork'],'鱼':['s','fish'],'意面':['s','pasta'],'面':['s','noodle'],'米饭':['s','rice'],'番茄':['s','tomato'],'土豆':['s','potato'],'豆腐':['s','tofu'],'虾':['s','prawn'],'海鲜':['c','Seafood'],'素食':['c','Vegetarian'],'甜点':['c','Dessert'],'早餐':['c','Breakfast']};
export function searchURL(term){
 const value=String(term).trim().slice(0,60);
 if(!value)throw Error('请输入想找的餐食');
 const [key,query]=queries[value]||['s',value];
 if(/[\u3400-\u9fff]/u.test(query))throw Error('此食谱源暂不支持这个中文词，请试试分类按钮或英文菜名。');
 return BASE+(key==='c'?'filter.php?':'search.php?')+key+'='+encodeURIComponent(query);
}
export function normalizeRecipe(m){
 if(!m || !/^\d{1,12}$/.test(String(m.idMeal)) || typeof m.strMeal!=='string')return null;
 const ingredients=[];
 for(let i=1;i<=20;i++){const item=String(m['strIngredient'+i]||'').trim();if(item)ingredients.push(item.slice(0,100));}
 return {id:'online-'+m.idMeal,name:m.strMeal.slice(0,100),ingredients,allergens:[],tags:[],method:String(m.strInstructions||'').slice(0,900),source:'https://www.themealdb.com/meal/'+m.idMeal,scene:'自己做',emoji:'🍽️',cost:0,minutes:1,complete:false,crossContact:true,template:false};
}
async function request(url,signal,fetcher){
 const response=await fetcher(url,{signal,credentials:'omit',referrerPolicy:'no-referrer'});
 if(!response.ok)throw Error('食谱服务暂时不可用，请稍后重试');
 const json=await response.json();if(json.meals!==null&&!Array.isArray(json.meals))throw Error('食谱服务返回了无法识别的数据');
 return (json.meals||[]).map(normalizeRecipe).filter(Boolean).slice(0,30);
}
export const searchRecipes=(term,signal,fetcher=fetch)=>request(searchURL(term),signal,fetcher);
export function lookupRecipe(id,signal,fetcher=fetch){
 if(!/^online-\d{1,12}$/.test(id))throw Error('食谱编号无效');
 return request(BASE+'lookup.php?i='+id.slice(7),signal,fetcher).then(rows=>{if(!rows[0])throw Error('未找到食谱详情');return rows[0];});
}
