// Chinese public recipe collection. Requests never include the personal profile.
const ROOT='https://raw.githubusercontent.com/Anduin2017/HowToCook/';
const TREE='https://api.github.com/repos/Anduin2017/HowToCook/git/trees/master?recursive=1';
const CATEGORIES=['meat_dish','vegetable_dish','aquatic','staple','breakfast','soup'];
const plain=text=>String(text).replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/\[([^\]]*)\]\([^)]*\)/g,'$1').replace(/[*`_]/g,'').trim();
const hash=text=>{let h=2166136261;for(const char of text)h=Math.imul(h^char.charCodeAt(0),16777619);return (h>>>0).toString(36);};
export function recipePaths(tree){
 if(!tree||!Array.isArray(tree.tree))throw Error('中文食谱目录暂不可用');
 return tree.tree.filter(x=>x.type==='blob'&&/^dishes\/(meat_dish|vegetable_dish|aquatic|staple|breakfast|soup)\/.+\.md$/.test(x.path)&&!x.path.includes('..')&&!/README/i.test(x.path)).map(x=>x.path);
}
export function parseRecipe(markdown,path){
 if(typeof markdown!=='string'||markdown.length>80000)return null;
 const title=plain(markdown.match(/^#\s+(.+)$/m)?.[1]||'').replace(/的做法$/,'');
 const section=markdown.match(/^##\s*必备原料[^\n]*\n([\s\S]*?)(?=^##\s|$(?![\s\S]))/m)?.[1];
 if(!title||!section)return null;
 const ingredients=section.split('\n').filter(x=>/^\s*[-*+]\s+/.test(x)).map(x=>plain(x.replace(/^\s*[-*+]\s+/,''))).filter(Boolean).slice(0,50).map(x=>x.slice(0,100));
 if(!ingredients.length)return null;
 const tags=['meal-set'];
 if(/饭|粥/.test(title))tags.push('rice');
 if(/面|粉|饼|饺|包子/.test(title))tags.push('noodle');
 if(/清蒸|白灼|清炒/.test(title))tags.push('light');
 if(/汤|粥|炖/.test(title))tags.push('soupy');
 if(/辣|麻婆|水煮肉/.test(title))tags.push('mild');
 const source='https://github.com/Anduin2017/HowToCook/blob/master/'+path.split('/').map(encodeURIComponent).join('/');
 return {kind:'recipe',recipeText:plain(markdown).slice(0,20000),id:'cn-'+hash(path),name:title.slice(0,75),ingredients,allergens:[],tags,method:'中文家常食谱，应用已提取配料用于推荐。',source,scene:'自己做',emoji:'🍲',cost:0,minutes:1,complete:false,crossContact:true,template:true};
}
async function read(url,signal,fetcher,json=false){
 const response=await fetcher(url,{signal,credentials:'omit',referrerPolicy:'no-referrer'});
 if(!response.ok)throw Error('中文食谱服务暂不可用');
 return json?response.json():response.text();
}
// Diversify the background batch across categories and rotate daily, without health queries.
export async function fetchChineseMeals(signal,fetcher=fetch,day=new Date().toISOString().slice(0,10)){
 const tree=await read(TREE,signal,fetcher,true),paths=recipePaths(tree);
 if(!/^[a-f0-9]{40}$/.test(tree.sha))throw Error('食谱版本无效');
 const selected=CATEGORIES.flatMap(category=>paths.filter(path=>path.startsWith('dishes/'+category+'/')).sort((a,b)=>hash(day+a).localeCompare(hash(day+b))).slice(0,4));
 const results=[];
 // Bounded concurrency; pin every recipe to the same catalog revision.
 for(let start=0;start<selected.length;start+=4){
  signal?.throwIfAborted();
  const batch=await Promise.allSettled(selected.slice(start,start+4).map(async path=>parseRecipe(await read(ROOT+tree.sha+'/'+path.split('/').map(encodeURIComponent).join('/'),signal,fetcher),path)));
  for(const result of batch)if(result.status==='fulfilled'&&result.value)results.push(result.value);
 }
 signal?.throwIfAborted();
 if(!results.length)throw Error('暂时没有可读取的中文食谱');
 return results;
}
