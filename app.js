import {QUESTIONS, SCENES, SEED_MEALS, ALLERGEN_GROUPS} from './data.js';
import {STORAGE_KEY, initialState, emptyProfile, splitItems, validateState, validateProfile, validateMeal, healthSummary, hasUncoveredHealth, rankMeals, checkMeal, saveProfile, planMeal, confirmEaten, createBackup} from './core.js';

const $=s=>document.querySelector(s), app=$('#app');
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const option=(value,label,current)=>`<option value="${escape(value)}" ${value===current?'selected':''}>${escape(label)}</option>`;
const options=(items,current)=>items.map(i=>option(i,i,current)).join('');
const statusOptions=v=>[['none','无已知项目'],['some','有，需要填写'],['unknown','不确定 / 暂不提供']].map(([x,l])=>option(x,l,v)).join('');
let state=initialState(), storageOK=true, skip=[], editing=false, step=0, question=0, draft=null, wish='', wishResult=false, pendingInstall=null;
try{
 const raw=localStorage.getItem(STORAGE_KEY);
 if(raw){const parsed=JSON.parse(raw);state=validateState(parsed);state.generalAccepted=parsed.generalAccepted===true;
 if(parsed.draft && typeof parsed.draft==='object') { // Draft only restores known fields through a permissive normalization below.
  try {const d=parsed.draft,p=d.profile;
   const restored=validateProfile({...p,allergyStatus:p.allergies?.length?'some':'unknown',labStatus:p.labs?.some(l=>l.name?.trim())?'some':'unknown',conditionStatus:p.conditions?.some(c=>c.name?.trim())?'some':'unknown'});
   for(const key of ['allergyStatus','labStatus','conditionStatus'])if(['some','none','unknown'].includes(p[key]))restored[key]=p[key];
   state.draft={profile:restored,step:Math.min(3,Math.max(0,Number(d.step)||0)),question:Math.min(5,Math.max(0,Number(d.question)||0))};}catch{}
 }
 // A persisted plan must still be reviewed if the profile changed. Loading a local plan alone isn't a change.
 if(state.plan&&parsed.plan?.revision===state.revision&&parsed.plan?.needsReview===false)state.plan.needsReview=false;
 }
}catch{storageOK=false;$('#storage-warning').hidden=false;$('#storage-warning').textContent='本地档案无法读取，已暂时停止自动保存。可到“我的”导出原始数据，或确认清空后重新开始。';}

function persist(){
 if(!storageOK)return false;
 try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));return true;}catch{storageOK=false;$('#storage-warning').hidden=false;$('#storage-warning').textContent='无法保存到本机。当前操作仅在本次打开期间有效，请及时导出备份。';return false;}
}
let toastTimer;
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3500);}
function modal(content){$('#modal-content').innerHTML=content;$('#modal').showModal();}
function closeModal(){$('#modal').close();}
$('#close-modal').onclick=closeModal;
$('#modal').addEventListener('click',e=>{if(e.target===$('#modal'))closeModal();});
function go(route){if(location.hash==='#'+route)render();else location.hash=route;}
function heading(kicker,title,sub=''){return `<div class="page-head"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1>${sub?`<p>${sub}</p>`:''}</div></div>`;}
function back(){return '<button class="ghost back" data-action="back">← 返回</button>';}
function error(message){let el=$('#form-error');if(!el){toast(message);return;}el.textContent=message;el.scrollIntoView({block:'nearest'});}
function beginSetup(edit=false){editing=edit;draft=structuredClone(state.draft?.profile||state.profile);step=state.draft?.step||0;question=state.draft?.question||0;go('setup');}
function stashDraft(){state.draft={profile:structuredClone(draft),step,question};persist();}
function defaultLab(){return {name:'',value:'',unit:'',range:'',date:''};}
function defaultCondition(){return {name:'',source:'用户自述',state:''};}
function field(label,name,value='',type='text',extra=''){return `<label class="field">${label}<input name="${name}" type="${type}" value="${escape(value)}" ${extra}></label>`;}
function labRows(){return (draft.labs.length?draft.labs:[defaultLab()]).map((l,i)=>`<div class="record-fields" data-lab-row><div class="record-top"><strong class="small">体检项 ${i+1}</strong><button type="button" class="text-button" data-action="remove-lab" data-index="${i}">移除</button></div>${field('项目名','lab-name',l.name,'text','placeholder="如：甲状腺球蛋白抗体（TgAb）" maxlength="100"')}<div class="form-grid">${field('数值 / 报告标记','lab-value',l.value,'text','placeholder="可填偏高，未知可留空" maxlength="50"')}${field('单位','lab-unit',l.unit,'text','maxlength="50"')}</div><div class="form-grid">${field('报告参考范围','lab-range',l.range,'text','maxlength="100"')}${field('报告日期','lab-date',l.date,'date')}</div></div>`).join('');}
function conditionRows(){return (draft.conditions.length?draft.conditions:[defaultCondition()]).map((c,i)=>`<div class="record-fields" data-condition-row><div class="record-top"><strong class="small">已知情况 ${i+1}</strong><button type="button" class="text-button" data-action="remove-condition" data-index="${i}">移除</button></div>${field('名称','condition-name',c.name,'text','placeholder="如：桥本甲状腺炎、银屑病" maxlength="100"')}<label class="field">信息来源<select name="condition-source">${options(['用户自述','专业确诊','历史记录','不确定'],c.source)}</select></label>${field('当前情况 / 原描述','condition-state',c.state,'text','placeholder="如：皮肤表现较稳定" maxlength="200"')}</div>`).join('');}
function readDraft(){
 const form=$('#setup-form');if(!form)return;
 const f=new FormData(form), get=k=>String(f.get(k)||'');
 if(step===0){draft.avoid=splitItems(get('avoid'));draft.dislikes=splitItems(get('dislikes'));draft.allergyStatus=get('allergyStatus');draft.allergies=splitItems(get('allergies'));}
 if(step===1){draft.labStatus=get('labStatus');draft.conditionStatus=get('conditionStatus');
 draft.labs=[...form.querySelectorAll('[data-lab-row]')].map(row=>Object.fromEntries(['name','value','unit','range','date'].map(k=>[k,row.querySelector(`[name="lab-${k}"]`).value.trim()]))).filter(l=>l.name);
 draft.conditions=[...form.querySelectorAll('[data-condition-row]')].map(row=>Object.fromEntries(['name','source','state'].map(k=>[k,row.querySelector(`[name="condition-${k}"]`).value.trim()]))).filter(c=>c.name);
 draft.reminders=get('reminders');}
 if(step===3){draft.scene=get('scene');draft.budget=Number(get('budget'));draft.goal=get('goal');}
}
function setupView(){
 if(!draft){draft=structuredClone(state.draft?.profile||state.profile);step=state.draft?.step||0;question=state.draft?.question||0;}
 const titles=['先记住你的饮食限制','补充你的健康背景','认识一下你的口味','准备好，开始选一餐'];
 const subtitles=['偏好、必须避开和过敏，分开处理。','仅在本机保存。不自行诊断，也不上传报告。','都符合饮食限制时，你更想选哪边？','看看信息有没有遗漏，之后随时可以修改。'];
 let content='';
 if(step===0)content=`<div class="notice">这些信息只保存在当前浏览器，不发送到 GitHub 或其他服务。共用设备上的其他使用者可能看到它们。</div><label class="field">必须避开的食物<textarea name="avoid" placeholder="每行一种，如：香菜">${escape(draft.avoid.join('\n'))}</textarea><small>明确的个人限制；不会被口味偏好覆盖。</small></label><label class="field">不太喜欢，但可以接受<textarea name="dislikes" placeholder="每行一种，可留空">${escape(draft.dislikes.join('\n'))}</textarea></label><label class="field">过敏食物<select name="allergyStatus">${statusOptions(draft.allergyStatus)}</select></label><div id="allergy-fields" ${draft.allergyStatus==='some'?'':'hidden'}><label class="field">有哪些过敏食物？<textarea name="allergies" placeholder="每行一种，如：花生、虾">${escape(draft.allergies.join('\n'))}</textarea><small>不认识的过敏原不会自动放行；不耐受请写入必须避开并注明。</small></label></div>`;
 if(step===1)content=`<div class="notice warm">桥本、银屑病等疾病筛选规则尚未经专业审核。目前可以记录和查看覆盖情况，但不会宣称餐食适合治疗或改善疾病。</div><label class="field">异常体检项<select name="labStatus">${statusOptions(draft.labStatus)}</select></label><div id="lab-fields" ${draft.labStatus==='some'?'':'hidden'}>${labRows()}<button type="button" class="secondary full" data-action="add-lab">＋ 添加一项</button></div><label class="field">已知疾病<select name="conditionStatus">${statusOptions(draft.conditionStatus)}</select></label><div id="condition-fields" ${draft.conditionStatus==='some'?'':'hidden'}>${conditionRows()}<button type="button" class="secondary full" data-action="add-condition">＋ 添加一种</button></div><label class="field">已有专业饮食提醒 · 可选<textarea name="reminders" maxlength="2000" placeholder="记录原文，程序不会自动解释；明确要避开的食物也请填入上一页">${escape(draft.reminders)}</textarea></label>`;
 if(step===2){const q=QUESTIONS[question];content=`<div class="question-stage"><span class="pill">口味偏好 ${question+1} / ${QUESTIONS.length}</span><h2>${q.title}</h2><div class="choices">${[q.a,q.b].map((label,i)=>`<button type="button" class="choice" data-action="preference" data-value="${q.values[i]}" aria-pressed="${draft.prefs[q.key]===q.values[i]}"><span class="choice-icon" aria-hidden="true">${q.symbols[i]}</span>${label}</button>`).join('')}</div><div class="question-progress" aria-hidden="true">${QUESTIONS.map((_,i)=>`<span class="${i<=question?'on':''}"></span>`).join('')}</div><button type="button" class="ghost full" data-action="skip-question">都可以，跳过这题</button><p class="small muted">答案只影响排序，不会新增忌口，也不代表健康程度。</p></div>`;}
 if(step===3)content=`<div class="summary-grid"><div class="summary-block"><small>必须避开</small><p>${escape(draft.avoid.join('、')||'未设置')}</p></div><div class="summary-block"><small>过敏信息</small><p>${escape(draft.allergyStatus==='some'?draft.allergies.join('、'):draft.allergyStatus==='none'?'无已知项目':'尚未提供')}</p></div><div class="summary-block"><small>异常体检项</small><p>${draft.labStatus==='some'?draft.labs.length+' 项 · 未覆盖':draft.labStatus==='none'?'无已知项目':'尚未提供'}</p></div><div class="summary-block"><small>已知疾病</small><p>${draft.conditionStatus==='some'?draft.conditions.length+' 项 · 未覆盖':draft.conditionStatus==='none'?'无已知项目':'尚未提供'}</p></div></div><div class="chips">${QUESTIONS.filter(q=>draft.prefs[q.key]).map(q=>`<span class="pill">${q.values.indexOf(draft.prefs[q.key])===0?q.a:q.b}</span>`).join('')||'<span class="small muted">尚未设置口味偏好</span>'}</div><label class="field">近期主目标<select name="goal">${options(['规律吃饭','减少选择困难','减脂意向','健身意向','维持现状'],draft.goal)}</select><small>用于记录意图，不自动计算摄入量或健康方案。</small></label><div class="form-grid"><label class="field">常用就餐方式<select name="scene">${options(SCENES,draft.scene)}</select></label>${field('每餐预算上限 / 元','budget',draft.budget,'number','min="1" max="10000" required')}</div><div class="notice">已附 12 份自制餐食模板，价格和用时为粗略估计。外卖、食堂与便利店请先添加自己的常吃餐食。模板不是对实物配料和供应商的保证。</div><label class="check"><input type="checkbox" name="consent" required><span>我了解本地存储和覆盖限制，同意在本机保存这些信息以用于餐食筛选。随时可清空或导出。</span></label>`;
 return `<div class="wizard-top"><span>${editing?'编辑档案':'初次见面'} · ${step+1}/4</span><button class="text-button" data-action="leave-setup">${editing?'取消编辑':'稍后继续'}</button></div><div class="steps" aria-hidden="true">${[0,1,2,3].map(i=>`<span class="${i<=step?'on':''}"></span>`).join('')}</div>${heading('A LITTLE ABOUT YOU',titles[step],subtitles[step])}<form id="setup-form">${content}<p id="form-error" class="error" role="alert"></p><div class="actions">${step>0?'<button type="button" class="secondary" data-action="setup-back">上一步</button>':''}<button type="submit" class="primary">${step===3?'保存并更新推荐':step===2?'下一题':'下一步'}</button></div></form>`;
}
function healthNotice(){return `<div class="notice ${hasUncoveredHealth(state.profile)?'warm':''}"><strong>本次考虑了什么</strong><p>${state.profile.avoid.length?'已核对明确排除项；':''}${state.profile.allergyStatus==='some'?'已按已知配料检查过敏原。':state.profile.allergyStatus==='unknown'?'过敏情况尚未提供。':'无已知过敏项目。'}</p><p>${healthSummary(state.profile).join('；')}。</p><button class="text-button" data-action="coverage">查看范围与依据</button></div>`;}
function card(result,compact=false){const m=result.meal;return `<article class="meal-card">${compact?'':`<div class="meal-art"><span class="art-label">A LITTLE LESS DECIDING</span><span class="food-emoji" aria-hidden="true">${escape(m.emoji)}</span><span class="index">${m.template?'自制模板':'我的常吃清单'}</span></div>`}<div class="meal-body"><span class="eyebrow">${compact?'ANOTHER IDEA':'这一餐，先看看这个'}</span><h2>${escape(m.name)}</h2><p>${escape(m.method)}</p><div class="facts"><span>约 <strong>¥${m.cost}</strong></span><span><strong>${m.minutes}</strong> 分钟</span><span>${escape(m.scene)}</span></div><div class="chips">${result.reasons.map(r=>`<span class="pill">${escape(r)}</span>`).join('')}</div><details><summary>配料与选择理由</summary><p>登记配料：${escape(m.ingredients.join('、')||'未填写')}。</p><p>过敏原标记：${escape(m.allergens.join('、')||'未登记已知项')}。${m.complete?'已登记完整配料':'配料待核实'}；${m.crossContact?'交叉接触信息待核对':'已由录入者确认交叉接触信息'}。</p><p>依据：当前就餐方式、预算、时间、可核对的排除项及你的口味偏好。没有进行疾病适宜性判断。</p>${m.template?'<p>此为做法模板，实际品牌配料及厨房条件仍需核对。</p>':''}</details><div class="actions"><button class="primary" data-action="pick" data-id="${escape(m.id)}">就吃这个</button>${compact?'':`<button class="secondary" data-action="swap" data-id="${escape(m.id)}">换一个</button>`}</div></div></article>`;}
function todayView(){
 const date=new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'});
 if(!state.onboarded)return `<div class="date">${date}</div>${heading('MAKE ROOM FOR A GOOD MEAL','少一点纠结，<br>好好吃这一餐。','从你的口味、习惯和明确限制开始。')}<div class="meal-art welcome-art"><span class="food-emoji" aria-hidden="true">🍚</span></div><div class="notice">不需要账号，不上传健康资料。餐食选择与反馈只留在这台设备。</div><button class="primary full" data-action="setup">${state.draft?'继续填写':'花一点时间，认识你的口味'}</button><button class="ghost full" data-action="library">先看看餐食模板</button><p class="footer-note">私人餐桌 · 无广告 · 无追踪</p>`;
 const {candidates,rejected}=rankMeals(state,{exclude:skip});
 const gate=hasUncoveredHealth(state.profile)&&!state.generalAccepted;
 const plan=state.plan?`<div class="notice"><strong>${state.plan.needsReview?'这顿需要重新确认':'这顿已经选好'}</strong><p>${escape(state.plan.name)} · ${escape(state.plan.mealSlot)}</p><div class="actions"><button class="secondary" data-action="${state.plan.needsReview?'review-plan':'ate'}">${state.plan.needsReview?'按新档案重新检查':'我吃过了'}</button><button class="ghost" data-action="cancel-plan">取消计划</button></div></div>`:'';
 return `<div class="date">${date}</div>${heading('WHAT SOUNDS GOOD TODAY?','今天吃什么','照顾你的口味，也给生活留一点余地。')}<form id="context-form"><div class="context"><label>这一餐<select name="meal">${options(['早餐','午餐','晚餐','加餐'],state.context.meal)}</select></label><label>怎么吃<select name="scene">${options(SCENES,state.context.scene)}</select></label></div><details class="context-details"><summary>预算 ¥${state.context.budget} 以内 · ${state.context.time} 分钟内准备好</summary><div class="form-grid">${field('预算上限 / 元','budget',state.context.budget,'number','min="1" max="10000" required')}${field('时间上限 / 分钟','time',state.context.time,'number','min="1" max="600" required')}</div><button class="secondary full" type="submit">更新条件</button></details></form>${healthNotice()}${gate?`<div class="empty"><h3>健康条件尚未全部覆盖</h3><p>你仍可按口味、预算和已核对的配料浏览。这里的候选不代表适合你的疾病情况。</p><button class="primary" data-action="accept-general">了解，进入通用选择</button></div>`:`${plan}${candidates.length?card(candidates[0]):`<div class="empty"><div class="symbol">🥣</div><h3>暂时没有符合条件的候选</h3><p>不自动放宽你的限制。可以添加常吃餐食，或调整预算、时间。</p><button class="primary" data-action="add-meal">添加我的餐食</button>${skip.length?'<button class="ghost" data-action="reset-skip">重新看本轮选项</button>':''}<details><summary>查看排除原因</summary>${rejected.slice(0,8).map(r=>`<p>${escape(r.meal.name)}：${escape(r.reasons.join('；'))}</p>`).join('')}</details></div>`}<button class="craving-entry" data-action="craving"><span><strong>我现在很想吃……</strong><small>把想吃的，也认真考虑进去</small></span><span class="arrow" aria-hidden="true">↗</span></button>${candidates.length>1?`<details class="alternatives"><summary>还有 ${Math.min(2,candidates.length-1)} 个选择</summary>${candidates.slice(1,3).map(r=>card(r,true)).join('')}</details>`:''}`}<p class="footer-note">一餐一餐来，不必每次都完美。</p>`;
}
function cravingView(){
 const term=wish.trim(), matches=rankMeals(state,{wish:term}).candidates.filter(r=>[r.meal.name,...r.meal.ingredients].some(s=>s.includes(term)));
 const blocked=state.meals.filter(m=>m.name.includes(term)&&checkMeal(m,state.profile).length);
 return `${back()}${heading('LEAVE ROOM FOR WHAT YOU LOVE','现在很想吃什么？','先保留你想要的体验，再看看实际选择。')}<form id="wish-form"><label class="field">想吃的东西<input name="wish" value="${escape(wish)}" placeholder="如：面、番茄、饺子" maxlength="60" required></label><label class="field">最想保留什么<select name="keep"><option>就是想吃它</option><option>口味和口感</option><option>方便、熟悉</option><option>和朋友一起吃</option></select></label><button class="primary full">看看我的清单里有没有</button></form>${wishResult?`<div class="section-head"><h2>给这份想吃留个位置</h2></div>${matches.length?matches.slice(0,2).map(r=>card(r,true)).join(''):`<div class="notice">常吃清单里暂时没有通过当前约束检查的匹配选项。v0不联网猜测配料或生成医疗搭配。</div>${blocked.map(m=>`<div class="notice danger">${escape(m.name)}：${escape(checkMeal(m,state.profile).join('；'))}。搭配不能绕过这些限制。</div>`).join('')}<div class="result-option"><strong>保留想吃的东西</strong><p>把具体菜品、配料和购买方式加入清单，再用同样的条件检查。</p><button class="text-button" data-action="add-meal">添加这份餐食</button></div><div class="result-option"><strong>换一种做法或相近体验</strong><p>从已经确认配料的餐食中找替代，并重新核对调整后的整份餐食。</p><button class="text-button" data-action="library">查看常吃清单</button></div>`}<p class="small muted">此入口使用本地清单匹配，不提供“搭配抵消风险”的建议。</p>`:''}`;
}
function historyView(){return `${heading('YOUR RECENT TABLE','最近吃过','选了和吃了，分开记。不需要精确打卡。')}${state.plan?`<div class="notice"><strong>尚未确认：${escape(state.plan.name)}</strong><p>${state.plan.needsReview?'档案已变化，请重新检查':'已经选好，还没记为实际吃过'}</p><button class="text-button" data-action="${state.plan.needsReview?'review-plan':'ate'}">${state.plan.needsReview?'重新检查':'确认吃过'}</button></div>`:''}${state.history.length?state.history.map(h=>`<article class="list-row"><div class="grow"><small>${escape(new Date(h.at).toLocaleDateString('zh-CN'))} · ${escape(h.mealSlot)}</small><h3>${escape(h.name)}</h3><div class="feedback">${['合口味','一般','下次不选'].map(x=>`<button class="${h.feedback===x?'active':''}" data-action="feedback" data-id="${escape(h.id)}" data-value="${x}">${x}</button>`).join('')}</div>${h.note?`<p class="small muted">${escape(h.note)}</p>`:''}<div class="actions"><button class="text-button" data-action="repeat" data-id="${escape(h.mealId)}">再吃一次</button><button class="text-button" data-action="note" data-id="${escape(h.id)}">备注</button><button class="text-button" data-action="delete-history" data-id="${escape(h.id)}">删记录</button></div></div></article>`).join(''):`<div class="empty"><div class="symbol">🌱</div><h3>从下一餐开始就好</h3><p>确认吃过的餐食会出现在这里。</p><button class="primary" data-action="today">去选一餐</button></div>`}`;}
function profileView(){return `${heading('MAKE IT YOURS','我的餐桌','偏好会变化，你随时可以重新选择。')}<div class="stats"><div><strong>${state.meals.length}</strong><small>常吃与模板</small></div><div><strong>${state.history.length}</strong><small>已确认餐次</small></div></div><button class="settings-link" data-action="edit-profile"><span>饮食与健康档案<small>忌口、过敏、体检项和已知疾病</small></span><span>↗</span></button><button class="settings-link" data-action="edit-prefs"><span>饮食偏好<small>${QUESTIONS.filter(q=>state.profile.prefs[q.key]).length} / 6 个偏好已填写</small></span><span>↗</span></button><button class="settings-link" data-action="library"><span>常吃清单<small>自己买得到、会做、愿意吃的选择</small></span><span>↗</span></button><button class="settings-link" data-action="coverage"><span>规则范围与依据<small>查看实际支持和仍未覆盖的部分</small></span><span>↗</span></button><button class="settings-link" data-action="install"><span>放到手机主屏幕<small>安装方式与离线使用</small></span><span>↗</span></button><button class="settings-link" data-action="backup"><span>备份与恢复<small>完整私人备份 / 只导出餐食库</small></span><span>↗</span></button><button class="settings-link danger-button" data-action="clear"><span>清空本机数据<small>包括档案、草稿、计划和吃过记录</small></span><span>↗</span></button><p class="privacy">不使用分析追踪、云端账号或第三方模型。健康信息只留在当前浏览器；本地存储没有额外加密，清理浏览器可能丢失数据。GitHub Pages仍会收到常规页面访问请求，但不会收到表单内容。</p><p class="footer-note">吃点什么 · v0.1 · 本地优先</p>`;}
function libraryView(){return `${back()}${heading('YOUR LITTLE MENU','常吃清单','让候选来自你真实的生活。')}<button class="primary full" data-action="add-meal">＋ 添加一份餐食</button><div class="notice">内置项是自制模板，不是餐馆菜单。价格、用时是估计；配料和交叉接触需要按实际品牌、厨房条件确认。系统不提供“无过敏风险”的保证。</div>${state.meals.map(m=>`<div class="list-row"><span class="emoji" aria-hidden="true">${escape(m.emoji)}</span><div class="grow"><strong>${escape(m.name)}</strong><br><small>${escape(m.scene)} · 约 ¥${m.cost} · ${m.minutes} 分钟</small><br><small>${m.template?'模板 · ':''}${!m.complete||m.crossContact?'信息待确认':'配料已登记'}</small></div><button class="text-button" data-action="edit-meal" data-id="${escape(m.id)}">编辑</button></div>`).join('')}`;}
function mealForm(meal){
 const m=meal||{name:wishResult?wish:'',scene:state.context.scene,ingredients:[],allergens:[],tags:[],cost:20,minutes:20,method:'',complete:false,crossContact:true};
 modal(`<h2>${meal?'编辑餐食':'加入常吃清单'}</h2><form id="meal-form" data-id="${meal?escape(meal.id):''}">${field('餐食名称','name',m.name,'text','maxlength="100" required')}<label class="field">就餐方式<select name="scene">${options(SCENES,m.scene)}</select></label><label class="field">配料，包含酱料和调味品<textarea name="ingredients" required>${escape(m.ingredients.join('、'))}</textarea></label><label class="field">已知过敏原<textarea name="allergens" placeholder="如：小麦、大豆、蛋；没有已知项可留空">${escape(m.allergens.join('、'))}</textarea><small>如使用复合调料，按包装标签填写。</small></label><div class="form-grid">${field('估计价格 / 元','cost',m.cost,'number','min="0" max="10000" required')}${field('准备或购买 / 分钟','minutes',m.minutes,'number','min="1" max="600" required')}</div><label class="field">做法 / 购买备注<textarea name="method" maxlength="1000">${escape(m.method)}</textarea></label><div class="field">餐食属性（用于口味排序）</div><div class="tag-picker">${QUESTIONS.filter(q=>q.key!=='explore').map(q=>q.values.map((v,i)=>`<label><input type="checkbox" name="tags" value="${v}" ${m.tags.includes(v)?'checked':''}>${i===0?q.a:q.b}</label>`).join('')).join('')}</div><label class="check"><input type="checkbox" name="complete" ${m.complete?'checked':''}><span>已按实际原料核对完整配料和过敏原标记</span></label><label class="check"><input type="checkbox" name="crossContact" ${!m.crossContact?'checked':''}><span>已核对共用厨具等交叉接触信息</span></label><p id="meal-error" class="error" role="alert"></p><button class="primary full">保存并重新检查推荐</button>${meal?`<button type="button" class="ghost full danger-button" data-action="delete-meal" data-id="${escape(meal.id)}">删除这份餐食</button>`:''}</form>`);
}
function coverage(){modal(`<h2>本次能做什么？</h2><div class="notice">当前是通用餐食选择，疾病相关规则未获专业审核，不作健康适宜性判断。</div><p><strong>已支持：</strong>个人明确排除项、已登记配料中的常见过敏原、预算、时间和口味排序。未知过敏原或配料不全不会自动放行。</p><p><strong>尚未覆盖：</strong>桥本与银屑病的个体食物适宜性、药食相互作用、报告自动解读和营养摄入量。专业提醒原文只记录，不自动执行。</p><p>已记录的疾病或抗体异常不会被直接转换为统一禁食表。TgAb、TPOAb与甲功是不同信息，不能相互代填。</p><p>研究入口：<a href="https://www.thyroid.org/hashimotos-thyroiditis/" target="_blank" rel="noopener noreferrer">美国甲状腺协会</a> · <a href="https://www.aad.org/member/clinical-quality/guidelines/psoriasis" target="_blank" rel="noopener noreferrer">AAD银屑病指南</a>。打开外部页面后适用对方隐私政策。</p><p>疾病情况、配料或明确要求变化后，需重新核对候选。没有额外排除某食物不等于医学安全。</p>`);}
function download(value,name){const url=URL.createObjectURL(new Blob([typeof value==='string'?value:JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
function backupModal(){modal(`<h2>让你的记录有个备份</h2><p>完整备份包含敏感个人信息，请放在私人位置，不要提交到公开仓库。</p><button class="secondary full" data-action="export-full">导出完整私人备份</button><button class="secondary full" data-action="export-library">只导出餐食库（不含档案和历史）</button><label class="field">恢复备份<input type="file" id="import-file" accept=".json,application/json"></label><p class="small muted">导入前会校验文件，并请你确认替换。完整档案不会与旧数据自动合并。</p>${!storageOK?'<button class="text-button" data-action="export-raw">导出本机原始数据以便恢复</button>':''}<p id="import-error" class="error" role="alert"></p>`);}
function render(){
 let page=location.hash.slice(1)||'today';if(!['today','history','profile','library','setup','craving'].includes(page))page='today';
 if(page==='craving'&&(!state.onboarded||(hasUncoveredHealth(state.profile)&&!state.generalAccepted)))page='today';
 $('#nav').hidden=page==='setup';
 document.querySelectorAll('[data-nav]').forEach(el=>{const active=el.dataset.nav===page||(['library','setup'].includes(page)&&el.dataset.nav==='profile')||(page==='craving'&&el.dataset.nav==='today');el.classList.toggle('active',active);if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
 app.innerHTML=page==='setup'?setupView():page==='history'?historyView():page==='profile'?profileView():page==='library'?libraryView():page==='craving'?cravingView():todayView();
}
window.addEventListener('hashchange',()=>{render();window.scrollTo(0,0);app.focus({preventScroll:true});});
let draftTimer;
document.addEventListener('input',event=>{
 if(event.target.closest('#setup-form')){clearTimeout(draftTimer);draftTimer=setTimeout(()=>{if(draft&&$('#setup-form')){readDraft();stashDraft();}},300);}
});
document.addEventListener('change',event=>{
 const el=event.target;
 const groups={allergyStatus:'allergy-fields',labStatus:'lab-fields',conditionStatus:'condition-fields'};
 if(groups[el.name]){document.getElementById(groups[el.name]).hidden=el.value!=='some';readDraft();stashDraft();}
 if(el.closest('#context-form')&&['scene','meal'].includes(el.name)){state.context[el.name]=el.value;skip=[];persist();render();}
 if(el.id==='import-file') importFile(el.files?.[0]);
});
document.addEventListener('submit',event=>{
 event.preventDefault();const form=event.target;
 if(form.id==='setup-form'){
  readDraft();
  if(step===0&&draft.allergyStatus==='some'&&!draft.allergies.length)return error('请填写过敏食物，或调整填写状态。');
  if(step===1&&((draft.labStatus==='some'&&!draft.labs.length)||(draft.conditionStatus==='some'&&!draft.conditions.length)))return error('请选择“无已知项目 / 暂不提供”，或填写至少一个项目名称。');
  if(step===2&&question<5){question++;stashDraft();render();return;}
  if(step<3){step++;stashDraft();render();window.scrollTo(0,0);return;}
  try{const p=validateProfile(draft);if(state.onboarded && (state.profile.allergies.some(a=>!p.allergies.includes(a))||state.profile.avoid.some(a=>!p.avoid.includes(a)))){if(!confirm('你移除或更改了过敏/必须避开项。确定按新档案重新筛选吗？'))return;}
   saveProfile(state,p);persist();skip=[];draft=null;go('today');toast('档案已更新；旧计划需要重新检查。');
  }catch(e){error(e.message);}return;
 }
 if(form.id==='context-form'){const f=new FormData(form),b=Number(f.get('budget')),t=Number(f.get('time'));if(!Number.isFinite(b)||b<1||b>10000||!Number.isFinite(t)||t<1||t>600)return toast('请填写有效预算与时间');state.context.budget=b;state.context.time=t;skip=[];persist();render();return;}
 if(form.id==='wish-form'){wish=String(new FormData(form).get('wish')).trim();if(!wish)return toast('先写下你想吃的东西吧');wishResult=true;render();return;}
 if(form.id==='meal-form'){
  const f=new FormData(form);try{
   const allergens=splitItems(f.get('allergens')).flatMap(a=>{const groups=Object.entries(ALLERGEN_GROUPS).filter(([,aliases])=>aliases.includes(a)).map(([key])=>key);return groups.length?groups:[a];});
   const m=validateMeal({id:form.dataset.id||crypto.randomUUID(),name:String(f.get('name')).trim(),scene:f.get('scene'),ingredients:splitItems(f.get('ingredients')),allergens:[...new Set(allergens)],tags:f.getAll('tags'),cost:Number(f.get('cost')),minutes:Number(f.get('minutes')),method:String(f.get('method')).trim(),emoji:state.meals.find(x=>x.id===form.dataset.id)?.emoji||'🍽️',complete:f.has('complete'),crossContact:!f.has('crossContact'),template:false});
   if(!m.name||!m.ingredients.length)throw new Error('请填写餐食名和配料');
   const i=state.meals.findIndex(x=>x.id===m.id);if(i<0)state.meals.push(m);else state.meals[i]=m;
   if(state.plan?.mealId===m.id)state.plan.needsReview=true;skip=[];persist();closeModal();render();toast('已保存，下一次选择会重新检查。');
  }catch(e){$('#meal-error').textContent=e.message;}return;
 }
});
async function importFile(file){
 if(!file)return;if(file.size>2_000_000){$('#import-error').textContent='文件过大，最多支持 2 MB。';return;}
 try{const raw=JSON.parse(await file.text()),next=validateState(raw);if(!confirm(`将用此备份替换本机数据：${next.meals.length} 份餐食、${next.history.length} 条记录。建议先导出当前备份。继续吗？`))return;
 state=next;storageOK=true;$('#storage-warning').hidden=true;persist();draft=null;skip=[];closeModal();go('profile');toast('备份已恢复，计划与健康覆盖需要重新确认。');
 }catch(e){$('#import-error').textContent='无法导入：'+e.message;}
}
document.addEventListener('click',async event=>{
 const button=event.target.closest('[data-action]');if(!button)return;
 const action=button.dataset.action,id=button.dataset.id;
 if(action==='today'){go('today');return;}if(action==='back'){go(state.onboarded?'today':'profile');return;}
 if(action==='setup'){beginSetup();return;}if(action==='edit-profile'){state.draft=null;draft=null;beginSetup(true);return;}
 if(action==='edit-prefs'){editing=true;draft=structuredClone(state.profile);step=2;question=0;go('setup');return;}
 if(action==='leave-setup'){readDraft();if(editing){if(!confirm('放弃本次修改？已保存的档案不会改变。'))return;state.draft=null;persist();draft=null;go('profile');}else{stashDraft();draft=null;go('today');}return;}
 if(action==='setup-back'){readDraft();if(step===2&&question>0)question--;else step=Math.max(0,step-1);stashDraft();render();return;}
 if(action==='preference'){draft.prefs[QUESTIONS[question].key]=button.dataset.value;stashDraft();render();return;}
 if(action==='skip-question'){delete draft.prefs[QUESTIONS[question].key];if(question<5)question++;else step=3;stashDraft();render();return;}
 if(action==='add-lab'||action==='add-condition'){readDraft();const key=action==='add-lab'?'labs':'conditions';if(draft[key].length>=30)return toast('最多支持30条，请先整理现有项目');draft[key].push(key==='labs'?defaultLab():defaultCondition());render();return;}
 if(action==='remove-lab'||action==='remove-condition'){readDraft();draft[action==='remove-lab'?'labs':'conditions'].splice(Number(button.dataset.index),1);render();return;}
 if(action==='coverage'){coverage();return;}
 if(action==='accept-general'){state.generalAccepted=true;persist();render();return;}
 if(action==='library'){go('library');return;}if(action==='craving'){wishResult=false;go('craving');return;}
 if(action==='add-meal'){mealForm();return;}if(action==='edit-meal'){mealForm(state.meals.find(m=>m.id===id));return;}
 if(action==='delete-meal'){if(!confirm('删除这份餐食？已吃过的历史记录会保留。'))return;state.meals=state.meals.filter(m=>m.id!==id);if(state.plan?.mealId===id)state.plan=null;persist();closeModal();render();return;}
 if(action==='pick'||action==='repeat'){
   if(!state.onboarded){toast('请先填写你的档案');beginSetup();return;}
   if(hasUncoveredHealth(state.profile)&&!state.generalAccepted){go('today');toast('请先查看健康覆盖范围。');return;}
   const meal=state.meals.find(m=>m.id===id);if(!meal)return toast('原餐食已删除，可以重新添加。');
   if(state.plan&&!confirm('替换当前尚未确认的餐食计划？'))return;
   try{planMeal(state,meal);persist();go('today');render();toast('已选好，吃过后再确认。');}catch(e){modal(`<h2>暂时不能选这份</h2><p>${escape(e.message)}</p><p>${escape(checkMeal(meal,state.profile).join('；'))}</p>`);}return;
 }
 if(action==='review-plan'){const meal=state.meals.find(m=>m.id===state.plan?.mealId);if(!meal)return toast('原餐食已不存在');if(hasUncoveredHealth(state.profile)&&!state.generalAccepted){go('today');return toast('请先确认覆盖限制');}try{planMeal(state,meal);persist();render();toast('已按最新配料约束重新检查；未作疾病判断。');}catch{modal(`<h2>原计划需要调整</h2><p>${escape(checkMeal(meal,state.profile).join('；'))}</p>`);}return;}
 if(action==='ate'){try{confirmEaten(state);persist();go('history');render();toast('已记为吃过，顺手留个反馈吧。');}catch(e){toast(e.message);}return;}
 if(action==='cancel-plan'){state.plan=null;persist();render();return;}
 if(action==='swap'){modal(`<h2>这次为什么想换？</h2><p>不会改动你的硬性限制。</p>${['今天不想吃','最近吃过','太贵','买不到','太麻烦'].map(x=>`<button class="secondary full" data-action="swap-reason" data-id="${escape(id)}" data-value="${x}">${x}</button>`).join('')}`);return;}
 if(action==='swap-reason'){
   const m=state.meals.find(m=>m.id===id);skip.push(id);
   if(m&&button.dataset.value==='太贵')state.context.budget=Math.max(1,m.cost-1);
   if(m&&button.dataset.value==='太麻烦')state.context.time=Math.max(1,m.minutes-1);
   persist();closeModal();render();toast(button.dataset.value==='太贵'?'已降低本餐预算，可在条件里改回。':button.dataset.value==='太麻烦'?'已缩短本餐准备时间，可在条件里改回。':'本轮先跳过，不改变长期偏好。');return;
 }
 if(action==='reset-skip'){skip=[];render();return;}
 if(action==='feedback'){const h=state.history.find(h=>h.id===id);if(h)h.feedback=button.dataset.value;persist();render();return;}
 if(action==='note'){const h=state.history.find(h=>h.id===id);const note=prompt('记录口味、饱足感或其他观察。单次观察不代表食物与症状存在因果。',h?.note||'');if(note!==null&&h){h.note=note.slice(0,500);persist();render();}return;}
 if(action==='delete-history'){if(confirm('删除这条吃过记录？')){state.history=state.history.filter(h=>h.id!==id);persist();render();}return;}
 if(action==='backup'){backupModal();return;}
 if(action==='export-full'||action==='export-library'){if(action==='export-full'&&!confirm('完整备份含健康信息和私人记录。确认导出到本机下载目录？'))return;download(createBackup(state,action==='export-full'),`meal-v0-${action==='export-full'?'private':'library'}-${new Date().toISOString().slice(0,10)}.backup.json`);return;}
 if(action==='export-raw'){try{download(localStorage.getItem(STORAGE_KEY)||'{}','meal-v0-recovery.backup.json');}catch{toast('无法读取原始存储');}return;}
 if(action==='clear'){if(!confirm('这会删除当前浏览器中的档案、过敏信息、健康记录、草稿和餐食历史。已下载的备份不会删除。确认清空？'))return;try{localStorage.removeItem(STORAGE_KEY);storageOK=true;$('#storage-warning').hidden=true;}catch{}state=initialState();draft=null;skip=[];persist();go('today');render();toast('已清空私人数据，恢复内置模板。');return;}
 if(action==='install'){
  if(pendingInstall){await pendingInstall.prompt();pendingInstall=null;return;}
  modal('<h2>把餐桌放到主屏幕</h2><p><strong>iPhone / iPad：</strong>用 Safari 打开部署后的 HTTPS 地址，点击分享，再选择“添加到主屏幕”。</p><p><strong>Android：</strong>用支持安装的浏览器打开页面，在菜单中选择“安装应用”或“添加到主屏幕”。</p><p>首次联网打开后，静态程序可离线使用。每台设备、每个浏览器各自保存数据；清理网站数据可能丢失记录，请自行备份。</p><p>本地测试需使用 localhost，直接双击文件不会启用离线能力。</p>');return;
 }
});
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();pendingInstall=event;});
function network(){$('#network').textContent=navigator.onLine?'本机保存':'离线 · 本机保存';}
window.addEventListener('online',network);window.addEventListener('offline',network);network();
if('serviceWorker' in navigator){
 navigator.serviceWorker.register('./sw.js').then(reg=>{
  const ready=()=>{if(reg.waiting){$('#update-banner').hidden=false;$('#update-app').onclick=()=>{if(location.hash==='#setup'){readDraft();stashDraft();}reg.waiting.postMessage('SKIP_WAITING');};}};ready();
  reg.addEventListener('updatefound',()=>{reg.installing?.addEventListener('statechange',ready);});
 }).catch(()=>toast('离线功能暂不可用；请确认使用 HTTPS 或 localhost。'));
 const hadController=Boolean(navigator.serviceWorker.controller);let reloading=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(hadController&&!reloading){reloading=true;location.reload();}});
}
render();
