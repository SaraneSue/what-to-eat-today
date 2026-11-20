// App-owned menu ideas, not live merchant inventory or branded product labels.
export const SCENE_GUIDANCE={
 '自己做':{reason:'自己做：按食谱准备主食与菜肴',hint:'以可制作的食谱搭配为主。'},
 '外卖':{reason:'外卖：优先常见单店套餐组合',hint:'以常见点单组合为主，尽量在同一家店选齐；未查询门店库存。'},
 '便利店':{reason:'便利店：即食或微波食品组合',hint:'以即食、冷藏或可微波食品为主，无需现场烹饪；具体商品因店而异。'},
 '食堂':{reason:'食堂：常见窗口菜搭配主食',hint:'以常见窗口菜和主食组合为主，按当天供应选择。'}
};
const make=(scene,key,name,items,allergens,tags,method)=>({id:`scene-${key}`,name,ingredients:items.split('、'),allergens:allergens?allergens.split('、'):[],tags:tags.split(','),method,scene,kind:'recipe',template:false,complete:true,crossContact:true,cost:0,minutes:1,emoji:scene==='便利店'?'🏪':'🍱'});
const rows={
 '外卖':[
 ['tomato','番茄鸡蛋盖饭 + 青菜','米饭、鸡蛋、番茄、青菜、食盐、菜籽油','蛋','rice,soupy,light,hot'],
 ['chicken','香菇鸡肉饭 + 时蔬','米饭、鸡肉、香菇、青菜、生抽、菜籽油','大豆、小麦','rice,rich,hot'],
 ['beef','土豆牛肉饭 + 青菜','米饭、牛肉、土豆、青菜、生抽、食盐、菜籽油','大豆、小麦','rice,rich,hot'],
 ['tofu','家常豆腐饭 + 时蔬','米饭、豆腐、青椒、青菜、生抽、菜籽油','大豆、小麦','rice,rich,hot'],
 ['noodle','番茄牛肉汤面','小麦面条、番茄、牛肉、青菜、食盐、菜籽油','小麦','noodle,soupy,hot'],
 ['dumpling','白菜猪肉水饺 + 青菜','小麦面粉、猪肉、白菜、青菜、食盐、菜籽油','小麦','noodle,hot'],
 ['rice','鸡肉蔬菜饭碗','米饭、鸡肉、生菜、玉米、胡萝卜、食盐、菜籽油','','rice,dry,light'],
 ['veg','菌菇蔬菜盖饭 + 水煮蛋','米饭、香菇、胡萝卜、青菜、鸡蛋、食盐、菜籽油','蛋','rice,light,hot']
 ],
 '便利店':[
 ['egg','饭团 + 水煮蛋 + 袋装沙拉','米饭、鸡蛋、生菜、黄瓜、食盐','蛋','rice,dry,light'],
 ['sandwich','鸡蛋三明治 + 原味酸奶','小麦面包、鸡蛋、黄瓜、蛋黄酱、原味酸奶','小麦、蛋、奶、大豆','dry,cold'],
 ['chicken','即食鸡胸肉 + 即食玉米 + 袋装沙拉','鸡胸肉、玉米、生菜、黄瓜、食盐','','dry,light,cold'],
 ['bento','微波鸡肉便当 + 原切水果','米饭、鸡肉、胡萝卜、西兰花、生抽、苹果','大豆、小麦','rice,hot'],
 ['potato','即食红薯 + 牛奶 + 水煮蛋','红薯、牛奶、鸡蛋','奶、蛋','dry,light'],
 ['yogurt','原味酸奶 + 燕麦杯 + 香蕉','原味酸奶、燕麦片、香蕉','奶、小麦','cold,light'],
 ['tofu','即食豆腐 + 饭团 + 袋装沙拉','豆腐、大米、生菜、黄瓜、生抽','大豆、小麦','rice,cold'],
 ['milk','全麦面包 + 牛奶 + 原切水果','小麦面包、牛奶、苹果','小麦、奶、蛋、大豆','dry,cold']
 ],
 '食堂':[
 ['egg','番茄炒蛋 + 清炒白菜 + 米饭','鸡蛋、番茄、白菜、大米、食盐、菜籽油','蛋','rice,light,hot'],
 ['chicken','香菇鸡肉 + 炒青菜 + 米饭','鸡肉、香菇、青菜、大米、生抽、菜籽油','大豆、小麦','rice,rich,hot'],
 ['beef','土豆炖牛肉 + 青菜 + 米饭','牛肉、土豆、青菜、大米、生抽、菜籽油','大豆、小麦','rice,rich,hot'],
 ['tofu','家常豆腐 + 西兰花 + 米饭','豆腐、青椒、西兰花、大米、生抽、菜籽油','大豆、小麦','rice,hot'],
 ['pork','肉末蒸蛋 + 炒白菜 + 米饭','猪肉、鸡蛋、白菜、大米、食盐、菜籽油','蛋','rice,light,hot'],
 ['noodle','青菜鸡蛋汤面','小麦面条、青菜、鸡蛋、食盐、菜籽油','小麦、蛋','noodle,soupy,light,hot'],
 ['veg','香菇青菜 + 蒸南瓜 + 米饭','香菇、青菜、南瓜、大米、食盐、菜籽油','','rice,light,hot'],
 ['fish','清蒸鱼 + 炒青菜 + 米饭','鳕鱼、姜、青菜、大米、食盐、菜籽油','鱼','rice,light,hot']
 ]
};
export const SCENE_MEALS=Object.entries(rows).flatMap(([scene,list])=>list.map(([key,name,items,allergens,tags])=>make(scene,`${scene==='外卖'?'takeout':scene==='食堂'?'canteen':'store'}-${key}`,name,items,allergens,tags,scene==='外卖'?'在同一家店选主餐和配菜，优先现有套餐；无需按烹饪步骤操作。':scene==='便利店'?'选择即食商品；需要加热的便当按包装说明微波，无需煎炒。':'从当天窗口中选主菜、蔬菜和主食；单碗面食可直接作为一餐。')));
const commonDish=/番茄.*蛋|西红柿.*蛋|香菇.*鸡|土豆.*牛肉|家常豆腐|麻婆豆腐|宫保鸡丁|鱼香肉丝|红烧肉|回锅肉|清蒸.*鱼|肉末.*蛋|青椒.*肉|白菜.*猪肉.*饺|牛肉.*面/;
export function isCommonMenuDish(meal){return commonDish.test(meal.name);}
export function adaptMenuMeal(meal,scene){
 const prefix=scene==='外卖'?'takeout':'canteen';
 return {...meal,id:`${prefix}-${meal.id}`.slice(0,100),scene,template:false,method:scene==='外卖'?'按这套搭配寻找同店套餐或单店加配；食谱仅作菜品参考，不代表门店实际供应。':'按这套搭配在当天窗口选菜和主食；食谱仅作菜品参考，不代表食堂当天供应。'};
}
