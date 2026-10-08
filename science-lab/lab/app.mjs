import {Lab,SPECS} from './engine.mjs';
import {icon} from './icons.mjs?v=workbench-3';
import {operationInfo} from './operation-info.mjs';
const $=id=>document.getElementById(id),esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const devices={robot:'液体处理机器人',qc:'检测站',thermal:'温控仪',magnet:'磁分离位',reader:'读板仪'};
const stages={holding:'等待检测 / 配液',mixing:'配液中',mixed:'反应液就绪',ligating:'连接中',done:'已完成',raw:'尚未处理',binding:'结合孵育',bound:'结合完成',separating:'磁分离中',separated:'分离完成',washing:'可洗涤',wash_wait:'洗涤等待',drying:'干燥中',eluting:'洗脱分离',eluate_ready:'可以回收',recovering:'回收中',incubating:'显色孵育',developed:'可以读板',reading:'读板中',measured:'可以推算浓度',normalizing:'配制交付中'};
const actions={start:'开始实验',thaw:'酶置于冰上',assay:'输入量检测',mix:'配制连接液',ligate:'开始连接',bind:'磁珠结合',magnet:'磁分离',discard:'弃上清',wash:'洗涤',dry:'开始干燥',elute:'洗脱',recover:'回收产物',scout:'蛋白浓度预估',incubate:'开始显色',read:'读板',normalize:'按推算浓度配制',submit:'提交',feedback:'反馈到达',window_missed:'连接窗口失去',dry_window_missed:'干燥窗口失去'};
let current=null,worlds={},catalog=[],replays={},history=[],actionFlow='ngs';
const uiState=Object.fromEntries(Object.keys(SPECS).map(k=>[k,{flow:k==='joint'?'ngs':k,operations:{ngs:'thaw',beads:'bind',bca:'scout'},fields:{},view:'operate',rate:'0.5'}]));
const scenarioIcons={ngs:'dna',beads:'magnet',bca:'flask-conical',joint:'workflow',catalog:'database'};
try{history=JSON.parse(localStorage.getItem('protocol-world-history')||'[]');const active=sessionStorage.getItem('protocol-world-active');if(active){for(const kind of active.split(',').map(x=>x.trim()).filter(x=>SPECS[x]))history.push({kind,interrupted:true,date:new Date().toLocaleString('zh-CN')});localStorage.setItem('protocol-world-history',JSON.stringify(history));sessionStorage.removeItem('protocol-world-active');$('error').hidden=false;$('error').textContent='页面曾在实验中重新加载：旧实验已登记为中断，不能作为完成记录。';}}catch{}
for(const k of Object.keys(SPECS))worlds[k]=new Lab(k);
for(const el of document.querySelectorAll('[data-icon]'))el.innerHTML=icon(el.dataset.icon);
$('submit').innerHTML=icon('send')+'提交实验';$('export').innerHTML=icon('download')+'导出 JSON';
$('scenario-switch').innerHTML=Object.entries(SPECS).map(([k,s])=>`<option value="${k}">${s.name}</option>`).join('');
const views=[['operate','操作台','pipette'],['schedule','设备与排程','workflow'],['reports','检测报告','scan-line'],['records','行动记录','timer'],['results','交付结果','check'],['protocol','操作规程','database'],['replay','参考回放','play']];
let currentView='operate';
function closeMenu(){ $('sidebar').classList.remove('open');$('menu-toggle').setAttribute('aria-expanded','false'); }
$('menu-toggle').addEventListener('click',()=>{$('sidebar').classList.toggle('open');$('menu-toggle').setAttribute('aria-expanded',String($('sidebar').classList.contains('open')));});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});
document.addEventListener('click',e=>{if(!e.target.closest('#sidebar,#menu-toggle'))closeMenu();});
const world=()=>{if(!SPECS[current])throw Error('请先选择一个实验');return worlds[current];};
function saveFields(){if(!SPECS[current])return;const u=uiState[current];u.fields=Object.fromEntries([...$('actions').querySelectorAll('input[id],select[id]')].map(e=>[e.id,e.value]));u.rate=$('speed').value;}
function showView(view){navigate(current,view);}
function navigate(kind,view='operate'){
  select(kind,view);
  const route=SPECS[kind]?`${kind}/${currentView}`:kind;
  if(location.hash!==`#${route}`)location.hash=route;
}
function readRoute(){
  const [kind,view]=location.hash.slice(1).split('/');
  if(kind==='main'&&current)return;
  select(SPECS[kind]||['catalog','experiments'].includes(kind)?kind:'experiments',view||'operate');
}
function select(kind,view='operate'){
  if(!SPECS[kind]&&!['catalog','experiments'].includes(kind))throw Error('未知实验');
  const changed=kind!==current;
  const pageChanged=changed||view!==currentView;
  if(changed)saveFields();
  current=kind;closeMenu();
  if(pageChanged)window.scrollTo({top:0,behavior:'instant'});
  document.querySelector('.app-shell').dataset.page=SPECS[kind]?'lab':kind;
  $('lab-view').hidden=!SPECS[kind];$('catalog-view').hidden=kind!=='catalog';$('experiment-view').hidden=kind!=='experiments';
  for(const link of document.querySelectorAll('[data-global]')){const active=link.dataset.global===kind;link.classList.toggle('active',active);if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}
  if(!SPECS[kind]){document.title=`Protocol Worlds · ${kind==='catalog'?'协议目录':'实验选择'}`;if(kind==='catalog')renderCatalog();else renderExperiments();render();return;}
  const spec=SPECS[kind];currentView=views.some(x=>x[0]===view)?view:'operate';uiState[kind].view=currentView;
  $('scenario-switch').value=kind;$('breadcrumb-name').textContent=spec.name;$('page-name').textContent=views.find(x=>x[0]===currentView)[1];
  $('title').textContent=spec.name;$('subtitle').textContent=spec.subtitle;$('goal').textContent=spec.target;
  document.title=`${spec.name} · ${$('page-name').textContent} · Protocol Worlds`;
  if(changed){
    actionFlow=uiState[kind].flow;
    $('nav').innerHTML=views.map(([key,name,i],index)=>`${index===0?'<div class="nav-section">进行实验</div>':index===4?'<div class="nav-section">复盘与参考</div>':''}<a href="#${kind}/${key}" data-view="${key}">${icon(i)}<span>${name}</span>${key==='reports'?'<span class="nav-count" data-nav-badge></span>':''}</a>`).join('');
    renderActions();
    for(const [id,value]of Object.entries(uiState[kind].fields)){const input=$(id);if(input)input.value=value;}
    $('speed').value=String(worlds[kind].started&&!worlds[kind].ended?worlds[kind].rate:uiState[kind].rate);
    renderContract();renderReplayChoices();
  }
  for(const el of document.querySelectorAll('[data-view-panel]'))el.hidden=el.dataset.viewPanel!==currentView;
  for(const el of document.querySelectorAll('[data-view]')){const active=el.dataset.view===currentView;el.classList.toggle('selected',active);if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');}
  $('result-records-link').href=`#${kind}/records`;render();
}
$('scenario-switch').addEventListener('change',event=>navigate(event.target.value,'operate'));
for(const el of document.querySelectorAll('[data-open-view]'))el.addEventListener('click',()=>showView(el.dataset.openView));
const experimentDescriptions={ngs:'在检测、酶冷却和连接窗口之间安排两份 DNA 样本。',beads:'完成分离、洗涤和干燥，观察不可逆操作的后果。',bca:'先决定稀释，再用到达的报告完成蛋白定量。',joint:'让三个流程共享设备，协调每次操作与等待。'};
const experimentTags={ngs:['2 份样本','检测延迟','连接窗口'],beads:['1 份材料','不可逆操作','干燥时限'],bca:['一次性显色','延迟读数','浓度推算'],joint:['3 个流程','5 类设备','85 min 交付']};
function renderExperiments(){
  $('experiment-list').innerHTML=['joint','ngs','beads','bca'].map(k=>`<a data-scenario="${k}" class="experiment-card ${k==='joint'?'featured':''}" href="#${k}/operate"><span class="experiment-icon">${icon(scenarioIcons[k])}</span><div class="experiment-copy"><h2>${SPECS[k].name}</h2><p>${experimentDescriptions[k]}</p><div class="experiment-meta">${experimentTags[k].map(x=>`<span>${x}</span>`).join('')}</div></div><div class="experiment-card-end"><span class="experiment-status" data-world-status="${k}"></span>${icon('arrow-right')}</div></a>`).join('');
}
function renderExperimentStatuses(){for(const el of document.querySelectorAll('[data-world-status]')){const key=el.dataset.worldStatus,w=worlds[key];el.textContent=w.ended?'查看本次结果':w.started?`继续实验 · ${w.t.toFixed(1)} min`:'进入实验';el.classList.toggle('running',w.started&&!w.ended);el.closest('a').href=`#${key}/${w.ended?'results':'operate'}`;}}
const operationIcons={thaw:'snowflake',assay:'scan-line',mix:'pipette',ligate:'dna',bind:'droplets',magnet:'magnet',discard:'circle-alert',wash:'droplets',dry:'timer',elute:'test-tubes',recover:'pipette',scout:'scan-line',incubate:'thermometer',read:'scan-line',normalize:'pipette'};
const button=(n,label,extra='')=>`<button data-action="${n}" ${extra}>${icon(operationIcons[n])}${label}</button>`;
const opCard=(title,duration,action,body,label,extra='')=>`<article class="operation-card" data-operation="${action}"><div class="operation-head">${icon(operationIcons[action])}<h3>${title}</h3><small>${duration}</small></div>${body}<div class="operation-impact"><div>${icon('workflow')}<span><small>使用设备</small><strong>${esc(operationInfo[action].device)}</strong></span></div><div>${icon('arrow-right')}<span><small>执行后</small><strong>${esc(operationInfo[action].effect)}</strong></span></div></div><p class="operation-hint">${icon('circle-alert')}${esc(operationInfo[action].caution)}</p>${button(action,label,extra)}</article>`;
function renderActions(){const w=world();let h='';
 if(w.ngs)h+=`<div class="action-group"><div class="action-description"><strong>两份独立样本</strong>冷却、检测与连接共用实验资源。</div><div class="sample-selector"><label>当前操作样本<select id="ngs-sample"><option>A</option><option>B</option></select></label><span>检测、配液和连接均作用于所选样本</span></div><div class="operation-list">${opCard('酶冷却','≥ 10 min','thaw','<p>冰上静置，实验时钟持续计时。</p>','置于冰上')}${opCard('输入量检测','1 / 2 点','assay','<div class="operation-fields"><label>报告类型<select id="assay-mode"><option value="fast">快速 · 4 min / 1 点</option><option value="extended">扩展 · 25 min / 2 点</option></select></label></div>','安排检测')}${opCard('配制连接液','2 min','mix','<div class="operation-fields"><label>L3 稀释倍数<select id="ngs-factor"><option value="1">1 ×（不稀释）</option><option value="10">10 ×</option><option value="20">20 ×</option></select></label></div>','执行配液')}${opCard('DNA 连接','15 min','ligate','<p>20°C · 温控仪单通道运行。</p>','开始连接')}</div></div>`;
 if(w.beads)h+=`<div class="action-group"><div class="action-description"><strong>一份 DNA 纯化</strong>分离和干燥都需要等待。</div><div class="operation-list">${opCard('磁珠结合','2 min','bind','<p>使用本次实验的磁珠耗材。</p>','开始结合')}${opCard('磁分离','5 min','magnet','<p>占用磁分离位，等待材料分离。</p>','开始分离')}${opCard('弃去上清','不可逆','discard','<p>执行后不能恢复已丢弃的材料。</p>','确认弃上清','class="danger"')}${opCard('洗涤','1.5 min','wash','<p>1 min 操作 + 0.5 min 等待。</p>','执行一次洗涤')}${opCard('干燥','10 min','dry','<p>作者契约：干燥窗口 10–17 min。</p>','开始干燥')}${opCard('洗脱与分离','7 min','elute','<p>加入洗脱液，完成分离后回收。</p>','开始洗脱')}${opCard('产物回收','1 min','recover','<p>将产物转移至交付状态。</p>','回收产物')}</div></div>`;
 if(w.bca)h+=`<div class="action-group"><div class="action-description"><strong>未知蛋白样品</strong>显色板只可使用一次。</div><div class="operation-list">${opCard('浓度预估','2 min · 1 点','scout','<p>返回浓度区间，用于选择稀释。</p>','安排预估')}${opCard('配板与显色','32 min','incubate','<div class="operation-fields"><label>稀释倍数<select id="bca-factor">'+[1,2,4,8].map(x=>`<option value="${x}">${x} ×</option>`).join('')+'</select></label></div>','开始显色')}${opCard('读取吸光值','2 min · 1 点','read','<p>562 nm · 返回标准点与重复值。</p>','安排读板')}${opCard('配制交付样品','2 min','normalize','<div class="operation-fields"><label>推算原浓度 / mg·mL⁻¹<input id="concentration" type="number" min="0.001" step="0.001" placeholder="根据报告计算"></label></div>','配至 0.5 mg/mL')}</div></div>`;
 $('actions').innerHTML=h+'<p id="operation-feedback" class="operation-feedback" role="status" aria-live="polite"></p>';
 const flows=current==='joint'?['ngs','beads','bca']:[current];
 $('workflow-switcher').innerHTML=current==='joint'?'<div class="flow-tabs" role="group" aria-label="选择操作工作流">'+flows.map(k=>`<button data-flow="${k}" aria-pressed="${k===actionFlow}" class="${k===actionFlow?'selected':''}">${icon(scenarioIcons[k])}${k==='ngs'?'NGS 连接':k==='beads'?'磁珠纯化':'BCA 显色'}</button>`).join('')+'</div>':'';
 $('actions').querySelectorAll('.action-group').forEach((group,i)=>{
   group.dataset.flowGroup=flows[i];
   const list=group.querySelector('.operation-list'),workspace=document.createElement('div'),steps=document.createElement('nav');
   workspace.className='operation-workspace';steps.className='operation-steps';steps.setAttribute('aria-label','选择实验操作');
   steps.innerHTML=[...list.querySelectorAll('[data-operation]')].map(card=>`<button data-select-operation="${card.dataset.operation}" data-operation-flow="${flows[i]}" aria-pressed="false">${icon(operationIcons[card.dataset.operation])}<span class="step-copy"><strong>${card.querySelector('h3').textContent}</strong><small>${card.querySelector('.operation-head small').textContent}</small></span><span class="step-state">未执行</span></button>`).join('');
   list.before(workspace);workspace.append(steps,list);
 });
 showOperationSelection();
}
function showOperationSelection(){
 for(const group of $('actions').querySelectorAll('[data-flow-group]')){
   const flow=group.dataset.flowGroup,selected=uiState[current].operations[flow];group.hidden=flow!==actionFlow;
   for(const card of group.querySelectorAll('[data-operation]'))card.hidden=card.dataset.operation!==selected;
   for(const step of group.querySelectorAll('[data-select-operation]')){const active=step.dataset.selectOperation===selected;step.classList.toggle('selected',active);step.setAttribute('aria-pressed',String(active));}
 }
}
$('workflow-switcher').addEventListener('click',event=>{const button=event.target.closest('[data-flow]');if(!button)return;actionFlow=button.dataset.flow;uiState[current].flow=actionFlow;for(const el of $('workflow-switcher').querySelectorAll('[data-flow]')){el.classList.toggle('selected',el.dataset.flow===actionFlow);el.setAttribute('aria-pressed',String(el.dataset.flow===actionFlow));}showOperationSelection();render();});

function parameters(n){const sample=$('ngs-sample')?.value;if(n==='assay')return {sample,mode:$('assay-mode').value};if(n==='mix')return {sample,factor:Number($('ngs-factor').value)};if(n==='ligate')return {sample};if(n==='incubate')return {factor:Number($('bca-factor').value)};if(n==='normalize')return {concentration:Number($('concentration').value)};return {};}
function persistActive(){try{const a=Object.keys(worlds).filter(k=>worlds[k].started&&!worlds[k].ended);if(a.length)sessionStorage.setItem('protocol-world-active',a.join(', '));else sessionStorage.removeItem('protocol-world-active');}catch{}}
function start(){const w=world();if(w.started&&!w.ended)throw Error('当前实验正在进行，不能重启');const rate=Number($('speed').value);if(![0.2,0.5,1].includes(rate))throw Error('时间比例不合法');const epoch=performance.now(),choose=a=>a[Math.floor(Math.random()*a.length)];worlds[current]=new Lab(current,()=>Math.max(0,(performance.now()-epoch)/1000)*rate,{A:choose([1,10,100]),B:choose([1,10,100]),protein:choose([0.6,1.2,1.6,2.4])});worlds[current].rate=rate;worlds[current].start();persistActive();render();return state();}
function perform(n,p){world().action(n,p);if(n==='submit'){const w=world();history.push({kind:current,date:new Date().toLocaleString('zh-CN'),result:w.result,events:w.events,reports:w.reports,rate:w.rate});history=history.slice(-20);try{localStorage.setItem('protocol-world-history',JSON.stringify(history));}catch{}persistActive();}render();if(n==='submit')showView('results');else $('operation-feedback').textContent=`${actions[n]}已执行 · ${world().t.toFixed(1)} min。状态与反馈将继续更新。`;return state();}
function handle(fn){try{$('error').hidden=true;return fn();}catch(e){$('error').textContent=e.message;$('error').hidden=false;}}
$('actions').addEventListener('click',e=>{const step=e.target.closest('[data-select-operation]');if(step){uiState[current].operations[step.dataset.operationFlow]=step.dataset.selectOperation;showOperationSelection();return;}const b=e.target.closest('[data-action]');if(b)handle(()=>perform(b.dataset.action,parameters(b.dataset.action)));});
$('actions').addEventListener('change',event=>{saveFields();if(event.target.id==='ngs-sample')render();});
$('start').addEventListener('click',()=>handle(()=>{start();$('operation-feedback').textContent='实验已开始，选择操作并设置参数。';}));$('submit').addEventListener('click',()=>handle(()=>perform('submit',{})));

function download(data,name){const u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
$('export').addEventListener('click',()=>handle(()=>download({kind:'author_browser_demo',model_evaluation:false,scenario:current,minutes_per_second:world().rate,state:state()},`protocol-world-${current}.json`)));
function card(name,x,body,full=false){const key=name.startsWith('样本')?'ngs':name==='磁珠纯化'?'beads':'bca';return `<article data-sample-flow="${key}" class="sample ${key} ${full?'full':''}"><div class="sample-top"><span class="sample-icon">${icon(scenarioIcons[key])}</span><h3>${name}</h3></div><span class="stage ${x.missed||x.lost||x.overdry?'bad':''}">${stages[x.stage]||x.stage}</span>${body}</article>`;}
function render(){const active=Object.values(worlds).filter(w=>w.started&&!w.ended).length;$('active-count').textContent=active+' 个实验正在运行';renderExperimentStatuses();if(!SPECS[current])return;const s=world().snapshot();$('clock').textContent=s.t.toFixed(1);$('clock-note').innerHTML='<strong>'+(s.started&&!s.ended?'<span class="live-dot"></span>':'')+(s.ended?'实验已结束':s.started?'实时运行中':'准备就绪')+'</strong>'+(s.ended?'原始行动记录已保留':s.started?'等待与思考都消耗实验时间':'开始后时间持续推进');$('run-status').textContent=s.ended?'已结束':s.started?'实验进行中':'尚未开始';$('run-status').className='status-badge '+(s.ended?'finished':s.started?'running':'');$('speed').disabled=s.started&&!s.ended;$('start').disabled=s.started&&!s.ended;$('start').innerHTML=icon('play')+(s.ended?'新建实验':'开始实验');$('submit').disabled=!s.started||s.ended;for(const b of $('actions').querySelectorAll('[data-action]'))b.disabled=!s.started||s.ended;
 let h='';if(s.ngs)for(const [name,x]of Object.entries(s.ngs)){const r=Math.max(0,x.deadline-s.t);h+=card(`样本 ${name}`,x,x.ligationAt===undefined?`<div class="value">${r.toFixed(1)} <small>min 剩余</small></div><div class="bar"><i class="${x.missed?'bad':''}" style="width:${100*r/x.deadline}%"></i></div><small>最迟 ${x.deadline} min 开始连接</small>`:`<div class="value">${x.ligationAt.toFixed(1)} <small>min 已启动</small></div><small>15 min 后完成；窗口 ${x.missed?'已错过':'满足'}</small>`);}
 if(s.beads)h+=card('磁珠纯化',s.beads,`<div class="value">${s.beads.washes} / 2 <small>次洗涤</small></div><small>${s.beads.stage==='drying'?`已干燥 ${(s.t-s.beads.dryAt).toFixed(1)} min · 可洗脱 10–17 min`:'提前弃上清无法恢复材料；不模拟产率'}</small>`,current!=='joint');
 if(s.bca)h+=card('蛋白定量',s.bca,`<div class="value">${s.bca.factor??'—'} × <small>已选择稀释</small></div><small>一次性显色板 · 报告到达后再推算浓度</small>`,current!=='joint');$('samples').innerHTML=h;for(const sample of $('samples').children)sample.hidden=sample.dataset.sampleFlow!==actionFlow;$('samples').dataset.count=String([...$('samples').children].filter(x=>!x.hidden).length);
 const visibleDevices=Object.keys(s.busy).filter(k=>current==='joint'||(current==='ngs'?['robot','qc','thermal']:current==='beads'?['robot','magnet']:['robot','qc','thermal','reader']).includes(k));
 $('resources').innerHTML=visibleDevices.map(k=>{const v=s.busy[k],i={robot:'pipette',qc:'scan-line',thermal:'thermometer',magnet:'magnet',reader:'test-tubes'}[k];return `<div class="resource ${v>s.t?'busy':''}"><span>${icon(i)}${devices[k]}</span><span>${v===Infinity?'持续占用':v>s.t?`余 ${(v-s.t).toFixed(1)} min`:'空闲'}</span></div>`;}).join('');$('budget').innerHTML=`<span>${icon('scan-line')}检测成本 <b>${s.credits} / 6</b></span>${s.thaw!==null?`<span>${icon('snowflake')}酶冷却 <b>${Math.max(0,s.t-s.thaw).toFixed(1)} / 10 min</b></span>`:''}`;
 renderTimeline(s,visibleDevices);$('report-count').textContent=String(s.reports.length);
 $('reports').innerHTML=s.reports.length?s.reports.map(r=>r.type==='ngs'?`<article class="report"><strong>${r.sample} / DNA 输入量：${r.input_ng} ng</strong>采样 ${r.sampled_at.toFixed(1)} min；到达 ${r.released_at.toFixed(1)} min。<small>${esc(r.origin)}</small></article>`:r.type==='scout'?`<article class="report"><strong>蛋白浓度预估：${r.interval.join('–')} mg/mL</strong>此区间用于选择稀释，不代替最终定量。<small>${esc(r.origin)} · ${r.released_at.toFixed(1)} min</small></article>`:`<article class="report"><strong>562 nm 定量报告 / ${r.factor} × 稀释</strong>重复吸光值：${r.duplicate.map(x=>x.toFixed(4)).join('，')}<br>校准判定：<span class="${r.in_range?'pass':'fail'}">${r.in_range?'在范围内':'超出范围，本次定量不合格'}</span><table><tr><th>标准 / mg·mL⁻¹</th><th>吸光值</th></tr>${r.standards.map(([x,y])=>`<tr><td>${x}</td><td>${y}</td></tr>`).join('')}</table><small>${esc(r.origin)} · 根据标准点与重复均值反算</small></article>`).join(''):`<div class="empty">${icon(current==='beads'?'magnet':'scan-line')}<strong>${current==='beads'?'观察材料与设备状态':'等待第一份检测报告'}</strong><small>${current==='beads'?'本流程没有检测报告。分离与干燥进展显示在样本状态中。':'安排检测后，报告会在延迟结束时出现在这里。'}</small></div>`;
 $('events').innerHTML=s.events.slice().reverse().map(e=>`<li><time>${e.t.toFixed(2)} min</time><div>${esc(actions[e.action]||e.action)}${e.sample?' · '+esc(e.sample):''}${e.message?'<br>'+esc(e.message):''}${e.premature?'<br><span class="fail">分离完成前弃去材料</span>':''}</div></li>`).join('')||`<li class="empty">${icon('workflow')}<strong>尚无行动记录</strong><small>开始实验后的每次操作都会记录时间与结果。</small></li>`;
 $('result').hidden=!s.result;if(s.result)$('result').innerHTML=`<h2 class="${s.result.reward?'pass':'fail'}">${s.result.reward?'PASS':'FAIL'} / 本模拟交付结果</h2><ul class="checks">${s.result.checks.map(x=>`<li><span class="${x.pass?'pass':'fail'}">${x.pass?'✓':'×'}</span><div>${esc(x.name)}<small>${esc(x.detail)}</small></div></li>`).join('')}</ul><p>这是作者侧规则评分，不是模型能力或真实实验产率结论。</p>`;
 const ownHistory=history.filter(x=>x.kind===current);$('history').innerHTML=ownHistory.length?ownHistory.slice().reverse().map(x=>`<div class="history-row"><span>${esc(SPECS[x.kind]?.name||x.kind)} · ${esc(x.date)}</span><strong class="${x.result?.reward?'pass':'fail'}">${x.interrupted?'中断':x.result?.reward?'PASS':'FAIL'}${x.result?' · '+x.result.t.toFixed(1)+' min':''}</strong></div>`).join(''):'<p>结束的实验会保留在此浏览器，可另行导出当前轨迹。</p>';
 renderWorkbenchSummary(s);
 $('result-empty').hidden=!!s.result;
 for(const el of document.querySelectorAll('[data-nav-badge]'))el.textContent=s.reports.length||'';

}
function renderWorkbenchSummary(s){
 const lost=[];
 if(s.ngs)for(const [name,x]of Object.entries(s.ngs))if(x.missed)lost.push(`样本 ${name} 已错过连接窗口`);
 if(s.beads?.lost)lost.push('提前弃上清：材料已损失');if(s.beads?.overdry)lost.push('已超过干燥窗口');
 const commits=s.events.filter(e=>!['start','feedback','window_missed','dry_window_missed','submit'].includes(e.action));
 $('run-summary').innerHTML=`<div class="summary-row"><span>已执行操作</span><strong>${commits.length} 次</strong></div><div class="summary-row"><span>检测预算</span><strong>${s.credits} / 6 点</strong></div>${lost.map(x=>`<p class="persistent-warning">${icon('circle-alert')}${esc(x)}</p>`).join('')}`;
 const pending=s.ended?[]:world().jobs.map(j=>({at:j.at,message:j.message.replace(/已(返回|回收|交付)/g,'$1')})).sort((a,b)=>a.at-b.at);
 $('pending-count').textContent=pending.length;
 $('pending-feedback').innerHTML=pending.length?pending.map(j=>`<div class="pending-item"><span>${esc(j.message)}</span><strong>${Math.max(0,j.at-s.t).toFixed(1)} min 后</strong><small>预计 ${j.at.toFixed(1)} min</small></div>`).join(''):'<p class="empty-note">没有等待中的反馈</p>';
 const relevant=Object.keys(s.busy).filter(k=>current==='joint'||(current==='ngs'?['robot','qc','thermal']:current==='beads'?['robot','magnet']:['robot','qc','thermal','reader']).includes(k));
 const deviceIcons={robot:'pipette',qc:'scan-line',thermal:'thermometer',magnet:'magnet',reader:'test-tubes'};
 $('device-preview').innerHTML=relevant.map(k=>`<div class="device-tile ${s.busy[k]>s.t?'busy':''}">${icon(deviceIcons[k])}<span>${devices[k]}<small>${s.busy[k]===Infinity?'持续占用':s.busy[k]>s.t?`${(s.busy[k]-s.t).toFixed(1)} min 后释放`:'空闲'}</small></span></div>`).join('');
 const latest=s.events.filter(e=>e.action==='feedback').at(-1);
 $('latest-feedback').innerHTML=latest?`<p class="feedback-message">${esc(latest.message)}</p><small>${latest.t.toFixed(1)} min 到达</small>`:'<p class="empty-note">反馈到达后会显示在这里</p>';
 for(const step of $('actions').querySelectorAll('[data-select-operation]')){
  const action=step.dataset.selectOperation,sample=$('ngs-sample')?.value,count=s.events.filter(e=>e.action===action&&(!['assay','mix','ligate'].includes(action)||e.sample===sample)).length;
  step.querySelector('.step-state').textContent=count?`已执行${count>1?' × '+count:''}`:'未执行';
 }
}

function renderTimeline(s,rows){const end=Math.max(85,Math.ceil(s.t/10)*10),x=t=>130+Math.min(end,Math.max(0,t))/end*640,height=rows.length*31+35;let svg=`<svg viewBox="0 0 790 ${height}" role="img" aria-label="设备占用时间轴：当前 ${s.t.toFixed(1)} 分钟">`;
 for(let t=0;t<=end;t+=10)svg+=`<line x1="${x(t)}" y1="8" x2="${x(t)}" y2="${height-25}" stroke="#e3eaf0"/><text x="${x(t)}" y="${height-6}" text-anchor="middle" fill="#64748b" font-size="12">${t}</text>`;
 rows.forEach((d,i)=>{const y=i*31+10;svg+=`<text x="0" y="${y+15}" font-size="13" fill="#4b6075">${devices[d]}</text><rect x="130" y="${y}" width="640" height="21" rx="4" fill="#f0f4f8"/>`;for(const r of s.occupancy.filter(r=>r.device===d)){const col=r.action==='incubate'?'#d5a66c':r.sample?'#8c7bd4':'#65aa9b';svg+=`<rect x="${x(r.start)}" y="${y+2}" width="${Math.max(2,x(r.end??s.t)-x(r.start))}" height="17" rx="3" fill="${col}"><title>${esc(actions[r.action])} ${esc(r.sample||'')}：${r.start.toFixed(1)}–${r.end===null?'持续占用':r.end.toFixed(1)} min</title></rect>`;}});
 if(s.ngs)svg+=`<line x1="${x(20)}" y1="3" x2="${x(20)}" y2="${height-24}" stroke="#bd7c51" stroke-dasharray="4 4"/><text x="${x(20)+5}" y="12" fill="#9b623f" font-size="11">A 最迟连接</text>`;
 svg+=`<line x1="${x(s.t)}" y1="0" x2="${x(s.t)}" y2="${height-24}" stroke="#6458d7" stroke-width="2"/></svg>`;$('timeline').innerHTML=svg;
}
const links={ngs:'https://sfvideo.blob.core.windows.net/sitefinity/docs/default-source/protocol/xgen-dna-library-prep-mc-kit-and-xgen-dna-library-prep-mc-uni-kit-protocol.pdf?sfvrsn=eba7e007_10',beads:'https://library.opentrons.com/p/macherey-nagel-nucleomag-clean-up',bca:'https://library.opentrons.com/p/bca_protein_assay'};
function renderContract(){let h='<h3>计时与独立实例</h3><ul><li>开始后按选定比例连续计时，切换情景不暂停。刷新或关闭页面使活跃实验中断。</li><li>检测预算 6 点。活跃实例不允许重置；开始新实例不删除已结束记录。</li><li>资源忙时拒绝操作。材料丢弃、配液和一次性显色不能撤回。提交结束实验，未完成仍判 FAIL。</li></ul>';
 if(world().ngs)h+='<h3>NGS <span class="source-tag">来源事实</span></h3><ul><li>IDT v2：酶冰上至少 10 min；末端修复后 4°C 保持，1 h 内连接；连接 20°C / 15 min，不加热盖。</li><li>MC 输入 1 ng → L3 稀释 20 ×；10 ng → 10 ×；100 ng → 不稀释。反应体积 60 + 18 + 6 + 5 = 89 µL。</li></ul><p><span class="assumption-tag">演示设置</span> A 已等待 40 min、B 为 0 min；检测 4 / 25 min、成本 1 / 2 点；配液 2 min；温控单通道。输入从 {1,10,100} ng 抽取。失去窗口表示 SOP 不合规，不推断真实产率为零。</p>';
 if(world().beads)h+='<h3>磁珠纯化 <span class="source-tag">来源事实</span></h3><ul><li>NucleoMag Clean Up：结合等待 2 min；磁分离参数 sep_time 默认 5 min；两次洗涤；dry_time 默认干燥 10 min；随后洗脱分离。</li></ul><p><span class="assumption-tag">演示设置</span> 洗涤抽象为 1 min 操作 + 0.5 min 等待；洗脱分离合并 7 min；一份耗材。干燥上限 17 min 是展示搁置后果的作者契约，不是来源中的生物阈值。提前弃去未分离上清被抽象为材料损失，不量化产率。</p>';
 if(world().bca)h+='<h3>BCA <span class="source-tag">来源事实</span></h3><ul><li>公开程序提供 1、1/2、1/4、1/8 稀释；默认孵育 30 min、37°C；重复测量，562 nm 读板。</li></ul><p><span class="assumption-tag">演示设置</span> 配板 2 min，预估与读板各 2 min / 1 点；原浓度从 {0.6,1.2,1.6,2.4} mg/mL 抽取；一块显色板。校准范围 0.1–0.5 mg/mL；标准与重复值由作者线性模型生成，非实测。按报告反算原浓度并配至 0.5 ± 0.005 mg/mL。</p>';
 if(current==='joint')h+='<h3>联合资源 <span class="assumption-tag">配置假设</span></h3><p>共用一台液体处理机器人、一台可执行 20°C / 37°C 程序的温控仪及一个检测站；另有磁分离位、读板仪。BCA 配板开始即预留温控仪 32 min；联合交付时限 85 min。各子任务不能以总分互相抵消。</p>';
 h+='<div class="source-links">'+Object.entries(links).filter(([k])=>current==='joint'||k===current).map(([k,v])=>`<a href="${v}" target="_blank" rel="noreferrer">${k.toUpperCase()} 来源规程 ↗</a>`).join('')+'</div><p>本前端可读取作者逻辑与开发回放。正式 Solver 须使用独立可信后端、隐藏评分和公开文件白名单。</p>';$('contract').innerHTML=h;
}
const replayNames={ngs_reference:'NGS / 可完成参考 · 42 min',beads_reference:'磁珠 / 可完成参考 · 29 min',bca_reference:'BCA / 可完成参考 · 38 min',joint_reference:'联合 / 先保连接窗口 · 78 min',beads_premature_discard:'磁珠 / 提前弃上清 · 相同工作量',joint_bca_first:'联合 / 显色优先 · 相同工作量与总时间',idle_before_commit:'NGS / 承诺前多等 9 min',idle_after_commit:'NGS / 承诺后多等 9 min'};
function renderReplayChoices(){if(!SPECS[current])return;const keys=current==='ngs'?['ngs_reference','idle_before_commit','idle_after_commit']:current==='beads'?['beads_reference','beads_premature_discard']:current==='bca'?['bca_reference']:['joint_reference','joint_bca_first'];$('replay-select').innerHTML=keys.map(k=>`<option value="${k}">${replayNames[k]}</option>`).join('');renderReplay();}
function renderReplay(){const r=replays[$('replay-select').value];if(!r){$('replay-output').innerHTML='<p>加载回放证据…</p>';return;}$('replay-output').innerHTML=`<div class="replay-stats"><strong class="${r.result.reward?'pass':'fail'}">${r.result.reward?'PASS':'FAIL'}</strong><span>终点 ${r.result.t} min</span></div><ul class="checks">${r.result.checks.filter(x=>!x.pass).map(x=>`<li class="fail">${esc(x.name)}：${esc(x.detail)}</li>`).join('')}</ul><details><summary>查看逐步开发轨迹</summary><ol>${r.events.map(e=>`<li>${e.t.toFixed(1)} min · ${esc(actions[e.action]||e.action)} ${esc(e.sample||'')} ${esc(e.message||'')}</li>`).join('')}</ol></details>`;}
$('replay-select').addEventListener('change',renderReplay);
function renderCatalog(){const q=$('search').value.toLowerCase(),f=$('filter').value;const rows=catalog.filter(r=>`${r.name} ${r.slug} ${r.robot?.name||''}`.toLowerCase().includes(q)&&(f==='all'||f==='detail'&&r.detail||f==='delay'&&r.detail?.nodes.some(n=>['delay','pause'].includes(n.operation))||f==='verified'&&Object.values(r.verification||{}).some(Boolean)));$('catalog-count').textContent=`${rows.length} 条匹配`;$('catalog').innerHTML=rows.map(r=>`<article class="catalog-card"><h2>${esc(r.name)}</h2><div class="tags"><span>${esc(r.robot?.name||'机器人未注明')}</span>${Object.entries(r.verification||{}).filter(([,v])=>v).map(([k])=>`<span>${esc(k)} 来源标记</span>`).join('')}${r.detail?'<span>已索引代码节点</span>':''}</div><p>${r.detail?`等待 / 人工交接 ${r.detail.nodes.filter(n=>['delay','pause'].includes(n.operation)).length} 处；温控 / 模块 / 参数 ${r.detail.nodes.filter(n=>!['delay','pause'].includes(n.operation)).length} 处。`:'目录种子：尚未提取代码节点或审查机制。'}</p><a href="${esc(r.source_url)}" target="_blank" rel="noreferrer">打开来源协议 ↗</a>${r.detail?`<details><summary>查看代码节点位置</summary>${r.detail.nodes.map(n=>`L${n.line} · ${esc(n.operation)}`).join('<br>')||'未发现登记节点'}</details>`:''}</article>`).join('')||'<div class="empty catalog-empty"><strong>没有匹配的协议</strong><small>尝试其他关键词，或放宽索引范围。</small></div>';}
$('search').addEventListener('input',renderCatalog);$('filter').addEventListener('change',renderCatalog);window.addEventListener('hashchange',()=>handle(readRoute));
function state(){if(!SPECS[current])return {view:current,catalog_count:catalog.length};const s=world().snapshot();for(const k of Object.keys(s.busy))if(!Number.isFinite(s.busy[k]))s.busy[k]='occupied_until_release';if(s.bca&&!s.ended)delete s.bca.normalized;return s;}
// WebMCP is an optional second interface to the same visible state and actions.
const context=document.modelContext,lifecycle=new AbortController();
if(context?.registerTool){const empty={type:'object',properties:{},additionalProperties:false};const tools=[
 {name:'get_lab_state',description:'Read the selected demo and reports that have arrived.',inputSchema:empty,annotations:{readOnlyHint:true},execute:async()=>state()},
 {name:'select_science_scenario',description:'Navigate to a scenario; active experiments continue.',inputSchema:{type:'object',properties:{scenario:{type:'string',enum:['ngs','beads','bca','joint','catalog']}},required:['scenario'],additionalProperties:false},annotations:{readOnlyHint:false},execute:async input=>{navigate(input.scenario);return state();}},
 {name:'start_lab_experiment',description:'Start a new irreversible live author-demo instance at the selected clock ratio. Cannot reset an active run.',inputSchema:empty,annotations:{readOnlyHint:false},execute:async()=>start()},
 {name:'perform_lab_action',description:'Commit one registered operation. discard destroys unseparated material. submit ends this run. Uses the visible UI validation.',inputSchema:{type:'object',properties:{action:{type:'string',enum:Object.keys(actions).filter(x=>!['start','feedback','window_missed','dry_window_missed'].includes(x))},sample:{type:'string',enum:['A','B']},mode:{type:'string',enum:['fast','extended']},factor:{type:'number'},concentration:{type:'number'}},required:['action'],additionalProperties:false},annotations:{readOnlyHint:false},execute:async input=>{if(!input||typeof input!=='object')throw Error('需要操作对象');const {action,...p}=input;return perform(action,p);}}
 ];for(const tool of tools){try{void Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(e=>console.warn('WebMCP registration unavailable',e.message));}catch(e){console.warn('WebMCP registration unavailable',e.message);}}window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});}
readRoute();setInterval(()=>{for(const w of Object.values(worlds))w.refresh();render();},400);
Promise.all([fetch('./catalog.json').then(r=>{if(!r.ok)throw Error('目录加载失败');return r.json();}),fetch('./replays.json').then(r=>{if(!r.ok)throw Error('回放加载失败');return r.json();})]).then(([c,r])=>{catalog=c;replays=r;renderCatalog();renderReplayChoices();}).catch(e=>{$('error').textContent=e.message;$('error').hidden=false;});

// Leaving the workbench interrupts active browser-only experiments.
window.addEventListener("beforeunload", event => {
  if (Object.values(worlds).some(w => w.started && !w.ended)) {
    event.preventDefault();
    event.returnValue = "";
  }
});
