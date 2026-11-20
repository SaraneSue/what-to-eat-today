export const QUESTIONS = [
  { key:'staple', title:'一顿正餐，你更常想吃？', a:'米饭类', b:'面食类', values:['rice','noodle'], symbols:['🍚','🍜'] },
  { key:'texture', title:'同样的食材，你更喜欢？', a:'带汤带汁', b:'干爽少汤', values:['soupy','dry'], symbols:['🥣','🍽️'] },
  { key:'flavor', title:'不考虑辣度，你更偏爱？', a:'清淡、本味', b:'浓郁、酱香', values:['light','rich'], symbols:['🌿','🫙'] },
  { key:'spice', title:'辣度可以自己选时，你更想要？', a:'不辣', b:'带点辣', values:['none','mild'], symbols:['🥒','🌶️'] },
  { key:'temperature', title:'天气和购买条件合适时，你更喜欢？', a:'热乎的一餐', b:'凉爽的一餐', values:['hot','cold'], symbols:['☀️','🍃'] },
  { key:'explore', title:'两个都合适的选择，你更愿意？', a:'熟悉、吃过的', b:'没试过、想尝鲜的', values:['familiar','new'], symbols:['🏡','🧭'] }
];
export const SCENES = ['自己做','外卖','食堂','便利店'];
// All included meals are explicitly recipe templates, not verified restaurant meals.
const recipe = (id,name,ingredients,allergens,tags,minutes,cost,method,emoji) => ({id,name,ingredients,allergens,tags,minutes,cost,method,emoji,scene:'自己做',complete:true,crossContact:true,template:true});
export const SEED_MEALS = [
 recipe('tomato-rice','番茄鸡蛋饭',['米饭','番茄','鸡蛋','菜籽油','食盐'],['蛋'],['rice','soupy','light','none','hot'],15,12,'米饭配番茄炒蛋；配料可按你自己的做法编辑。','🍅'),
 recipe('mushroom-noodle','香菇青菜汤面',['小麦面条','香菇','青菜','菜籽油','食盐','水'],['小麦'],['noodle','soupy','light','none','hot'],15,10,'面条煮熟，加入青菜和香菇。','🍜'),
 recipe('chicken-rice','彩椒鸡肉饭',['米饭','鸡肉','彩椒','生抽','菜籽油'],['大豆','小麦'],['rice','dry','rich','none','hot'],25,19,'鸡肉和彩椒炒熟后配米饭；生抽成分需核对实物标签。','🫑'),
 recipe('tofu-rice','家常豆腐饭',['米饭','豆腐','青椒','生抽','菜籽油'],['大豆','小麦'],['rice','soupy','rich','none','hot'],20,13,'豆腐与青椒烧熟，配米饭。','🍲'),
 recipe('potato-rice','土豆胡萝卜焖饭',['大米','土豆','胡萝卜','菜籽油','食盐','水'],[],['rice','dry','light','none','hot'],30,10,'食材切块后与米饭一起焖熟。','🥕'),
 recipe('shrimp-rice','虾仁黄瓜炒饭',['米饭','虾仁','黄瓜','菜籽油','食盐'],['甲壳类'],['rice','dry','light','none','hot'],15,22,'虾仁彻底做熟后与米饭、黄瓜炒匀。','🍤'),
 recipe('sesame-noodle','芝麻拌面',['小麦面条','芝麻酱','黄瓜','生抽'],['小麦','芝麻','大豆'],['noodle','dry','rich','none','cold'],15,13,'熟面配黄瓜和芝麻酱；酱料以实物配料表为准。','🥒'),
 recipe('spicy-rice','微辣蘑菇饭',['米饭','蘑菇','辣椒','菜籽油','食盐'],[],['rice','dry','rich','mild','hot'],20,12,'蘑菇炒熟后配饭，辣度按口味调整。','🍄'),
 recipe('beef-noodle','番茄牛肉汤面',['小麦面条','番茄','牛肉','菜籽油','食盐','水'],['小麦'],['noodle','soupy','rich','none','hot'],30,25,'牛肉与番茄煮熟后加入面条。','🥣'),
 recipe('egg-sandwich','鸡蛋黄瓜三明治',['小麦面包','鸡蛋','黄瓜','食盐'],['小麦','蛋'],['dry','light','none','cold'],10,14,'选配料已确认的面包，夹入熟鸡蛋和黄瓜。','🥪'),
 recipe('corn-bowl','玉米鸡肉饭碗',['米饭','玉米','鸡肉','生菜','菜籽油','食盐'],[],['rice','dry','light','none','hot'],20,18,'鸡肉做熟，与米饭、玉米和洗净生菜组合。','🌽'),
 recipe('tomato-pasta','番茄蘑菇意面',['小麦意面','番茄','蘑菇','橄榄油','食盐'],['小麦'],['noodle','soupy','rich','none','hot'],25,17,'意面煮熟，拌入番茄蘑菇酱。','🍝')
];
export const ALLERGEN_GROUPS = {
 '蛋':['蛋','鸡蛋','鸭蛋','鹅蛋','蛋白','蛋黄','蛋类'],
 '奶':['奶','牛奶','乳制品','奶制品','牛乳','乳蛋白','乳清','酪蛋白','黄油','奶酪'],
 '小麦':['小麦','面粉','麦麸','麸质','面筋'],
 '大豆':['大豆','黄豆','豆腐','豆浆','豆制品'],
 '花生':['花生','花生油','花生酱'],
 '坚果':['坚果','树坚果','核桃','腰果','杏仁','榛子','开心果','碧根果','巴旦木'],
 '芝麻':['芝麻','芝麻酱','香油'],
 '鱼':['鱼','鱼类','鳕鱼','三文鱼','金枪鱼'],
 '甲壳类':['甲壳类','虾','虾仁','蟹','螃蟹','龙虾'],
 '贝类':['贝类','蛤蜊','扇贝','牡蛎','生蚝','贻贝'],
 '海鲜':['海鲜','海产品']
};
