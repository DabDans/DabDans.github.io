// Author-side demonstrator. This is deliberately not a trusted benchmark backend.
export const SPECS = {
  ngs: {name:'NGS 连接窗口', subtitle:'检测、冷却与连接，共用一台温控仪', target:'A、B 均按输入量选择 L3 稀释，并在各自窗口内完成 15 分钟连接。', deadline:null},
  beads: {name:'磁珠纯化', subtitle:'等待分离与及时回收之间的取舍', target:'完成结合、两次洗涤、干燥、洗脱和回收；不能提前丢弃未分离的材料。', deadline:null},
  bca: {name:'BCA 批次显色', subtitle:'先选稀释，再等待定量反馈', target:'选择有效稀释，读取重复测量，推算原浓度，并将 1 mL 样品配至 0.5 mg/mL。', deadline:null},
  joint: {name:'联合实验室', subtitle:'三个实验共同占用机器人、检测站和温控仪', target:'85 分钟内交付两份 NGS、一份纯化 DNA 和一份定量蛋白样品；所有条件分别达标。', deadline:85}
};
const copy = x => JSON.parse(JSON.stringify(x));
export class Lab {
  constructor(kind, now = () => 0, truth = {A:10,B:100,protein:1.6}) {
    if (!SPECS[kind]) throw Error('未知情景');
    this.kind=kind; this.clock=now; this.truth={...truth}; this.started=false;this.ended=false;this.t=0;
    this.events=[];this.jobs=[];this.reports=[];this.occupancy=[];this.busy={robot:0,qc:0,thermal:0,magnet:0,reader:0};this.credits=0;this.result=null;
    this.ngs=['ngs','joint'].includes(kind)?{A:{stage:'holding',deadline:20},B:{stage:'holding',deadline:60}}:null;
    this.beads=['beads','joint'].includes(kind)?{stage:'raw',washes:0,lost:false,overdry:false}:null;
    this.bca=['bca','joint'].includes(kind)?{stage:'raw',scout:false,factor:null,normalized:null}:null;
    this.thaw=null;this.packs=0;
  }
  emit(action, details={}) {this.events.push({t:this.t,action,...copy(details)});}
  start(){if(this.started)throw Error('本次实验已经启动');this.started=true;this.emit('start');return this.snapshot();}
  refresh(){
    if(!this.started||this.ended)return;
    this.t=Math.max(this.t,this.clock());
    for(const j of [...this.jobs].filter(j=>j.at<=this.t).sort((a,b)=>a.at-b.at)){
      const t=this.t;this.t=j.at;j.run();this.emit('feedback',{message:j.message});this.t=t;this.jobs.splice(this.jobs.indexOf(j),1);
    }
    if(this.ngs)for(const [s,x] of Object.entries(this.ngs))if(this.t>x.deadline&&x.ligationAt===undefined&&!x.missed){x.missed=true;this.emit('window_missed',{sample:s,message:'已失去本次规程窗口；不推断实际产率。'});}
    if(this.beads?.stage==='drying'&&this.t>this.beads.dryAt+17&&!this.beads.overdry){this.beads.overdry=true;this.emit('dry_window_missed',{message:'超过本 demo 自定义的 17 分钟干燥上限。'});}
  }
  job(at,message,run){const job={at,message,run};this.jobs.push(job);return job;}
  require(value,message){if(!value)throw Error(message);}
  free(...devices){for(const d of devices)this.require(this.busy[d]<=this.t+1e-9,`${d} 正在占用，至 ${this.busy[d].toFixed(1)} min`);}
  credit(n){this.require(this.credits+n<=6,'检测预算不足（上限 6）');this.credits+=n;}
  action(name,p={}){
    this.refresh();this.require(this.started&&!this.ended,'请先开始实验；提交后不能修改本次记录');
    const t=this.t,previous={...this.busy};
    if(name==='thaw'){
      this.require(this.ngs&&this.thaw===null,'酶冷却已经安排或不适用');this.thaw=t;this.emit(name,{ready_at:t+10});
    }else if(name==='assay'){
      this.require(this.ngs&&this.ngs[p.sample],'请选择 A 或 B');this.free('qc');const extended=p.mode==='extended';
      this.require(['fast','extended'].includes(p.mode),'请选择合法检测模式');
      this.require(!this.ngs[p.sample].assay,'本 demo 每份样本只安排一次输入量检测');this.credit(extended?2:1);
      this.ngs[p.sample].assay=true;this.busy.qc=t+(extended?25:4);
      this.job(this.busy.qc,`${p.sample} 输入量报告已返回`,()=>this.reports.push({type:'ngs',sample:p.sample,input_ng:this.truth[p.sample],sampled_at:t,released_at:this.t,origin:'模拟精确报告'}));this.emit(name,p);
    }else if(name==='mix'){
      const x=this.ngs?.[p.sample];this.require(x&&['holding','assayed'].includes(x.stage),'该样本不能重新配液');
      this.require(this.thaw!==null&&t>=this.thaw+10,'酶必须在冰上至少 10 分钟');this.free('robot');this.require(this.packs<2,'两份配液耗材已耗尽');
      this.require([1,10,20].includes(p.factor),'稀释倍数只允许 1、10、20');this.packs++;x.factor=p.factor;x.stage='mixing';this.busy.robot=t+2;
      this.job(t+2,`${p.sample} 连接反应液配制完成`,()=>{x.stage='mixed';});this.emit(name,p);
    }else if(name==='ligate'){
      const x=this.ngs?.[p.sample];this.require(x?.stage==='mixed','先完成配液');this.free('thermal');x.ligationAt=t;x.stage='ligating';this.busy.thermal=t+15;
      this.job(t+15,`${p.sample} 20°C / 15 min 连接完成`,()=>{x.stage='done';});this.emit(name,p);
    }else if(name==='bind'){
      this.require(this.beads?.stage==='raw','结合只能开始一次');this.free('robot');this.busy.robot=t+1;this.beads.stage='binding';
      this.job(t+2,'磁珠结合孵育完成',()=>{this.beads.stage='bound';});this.emit(name);
    }else if(name==='magnet'){
      this.require(this.beads?.stage==='bound','先完成结合孵育');this.free('magnet');this.busy.magnet=Infinity;this.beads.stage='separating';this.beads.sepAt=t+5;
      this.sepJob=this.job(t+5,'磁分离等待完成',()=>{this.beads.stage='separated';});this.emit(name);
    }else if(name==='discard'){
      this.require(this.beads&&['separating','separated'].includes(this.beads.stage),'当前不能弃去上清');this.free('robot');this.busy.robot=t+1;
      if(this.beads.stage==='separating')this.beads.lost=true;
      this.jobs=this.jobs.filter(j=>j!==this.sepJob);this.beads.stage='washing';this.emit(name,{premature:this.beads.lost});
    }else if(name==='wash'){
      this.require(this.beads?.stage==='washing'&&this.beads.washes<2,'需要弃上清后依次洗涤两次');this.free('robot');this.beads.stage='wash_wait';this.busy.robot=t+1;
      this.job(t+1.5,'本轮洗涤及等待完成',()=>{this.beads.washes++;this.beads.stage='washing';});this.emit(name,{round:this.beads.washes+1});
    }else if(name==='dry'){
      this.require(this.beads?.stage==='washing'&&this.beads.washes===2,'先完成两次洗涤');this.beads.stage='drying';this.beads.dryAt=t;this.busy.magnet=t;this.emit(name);
    }else if(name==='elute'){
      this.require(this.beads?.stage==='drying'&&t>=this.beads.dryAt+10,'本情景沿用协议默认干燥 10 分钟');this.free('robot','magnet');this.busy.robot=t+1;this.busy.magnet=t+7;this.beads.stage='eluting';
      this.job(t+7,'洗脱及再次磁分离完成',()=>{this.beads.stage='eluate_ready';});this.emit(name);
    }else if(name==='recover'){
      this.require(this.beads?.stage==='eluate_ready','洗脱分离尚未完成');this.free('robot');this.busy.robot=t+1;this.beads.stage='recovering';
      this.job(t+1,'纯化产物已回收',()=>{this.beads.stage='done';});this.emit(name);
    }else if(name==='scout'){
      this.require(this.bca?.stage==='raw'&&!this.bca.scout,'预估检测只能安排一次');this.free('qc');this.credit(1);this.bca.scout=true;this.busy.qc=t+2;
      this.job(t+2,'蛋白浓度预估区间已返回',()=>{const c=this.truth.protein;this.reports.push({type:'scout',interval:c<1?[0.5,0.9]:c<2?[1,1.8]:[2,2.8],released_at:this.t,origin:'作者模拟，非实测'});});this.emit(name);
    }else if(name==='incubate'){
      this.require(this.bca?.stage==='raw','一块反应板只能显色一次');this.require([1,2,4,8].includes(p.factor),'请选择 1、2、4、8 倍稀释');this.free('robot','thermal');
      this.bca.factor=p.factor;this.bca.stage='incubating';this.busy.robot=t+2;this.busy.thermal=t+32;
      this.job(t+32,'37°C / 30 min 孵育完成，可以读板',()=>{this.bca.stage='developed';});this.emit(name,p);
    }else if(name==='read'){
      this.require(this.bca?.stage==='developed','完成显色后读板');this.free('reader');this.credit(1);this.busy.reader=t+2;this.bca.stage='reading';
      this.job(t+2,'562 nm 重复测量报告已返回',()=>{const c=this.truth.protein/this.bca.factor;this.bca.stage='measured';this.reports.push({type:'bca',factor:this.bca.factor,standards:[[0,0.1],[0.2,0.26],[0.4,0.42],[0.5,0.5]],duplicate:[0.1+0.8*c-0.002,0.1+0.8*c+0.002],in_range:c>=0.1&&c<=0.5,released_at:this.t,origin:'作者线性校准模型，非实测'});});this.emit(name);
    }else if(name==='normalize'){
      this.require(this.bca?.stage==='measured','先取得定量报告');this.require(Number.isFinite(p.concentration)&&p.concentration>0,'请输入推算的原样浓度');this.free('robot');this.bca.stage='normalizing';this.bca.normalized=0.5*this.truth.protein/p.concentration;this.busy.robot=t+2;
      this.job(t+2,'按推算浓度配制的 1 mL 蛋白样品已交付',()=>{this.bca.stage='done';});this.emit(name,p);
    }else if(name==='submit'){return this.submit();}
    else throw Error('未登记的操作');
    for(const [device,end]of Object.entries(this.busy))if(end!==previous[device]){
      for(const row of this.occupancy)if(row.device===device&&row.end===null)row.end=t;
      if(end>t)this.occupancy.push({device,start:t,end:end===Infinity?null:end,action:name,sample:p.sample??null});
    }
    return this.snapshot();
  }
  submit(){
    const checks=[];const add=(name,pass,detail)=>checks.push({name,pass:!!pass,detail});
    if(this.ngs)for(const [s,x]of Object.entries(this.ngs)){
      const expected=this.truth[s]===1?20:this.truth[s]===10?10:1;
      add(`${s} 完成连接`,x.stage==='done',x.stage);add(`${s} 输入量与 L3 稀释`,x.factor===expected,`采用 ${x.factor??'—'} 倍；报告对应 ${expected} 倍`);add(`${s} 连接开始窗口`,x.ligationAt!==undefined&&x.ligationAt<=x.deadline,`开始 ${x.ligationAt?.toFixed(2)??'—'} / 最迟 ${x.deadline} min`);
    }
    if(this.beads){add('纯化产物交付',this.beads.stage==='done',this.beads.stage);add('先分离再弃上清',!this.beads.lost,this.beads.lost?'提前弃上清造成不可逆材料损失':'操作顺序满足要求');add('干燥窗口',!this.beads.overdry,'默认干燥 10 min；17 min 上限是作者演示契约，无产率预测');}
    if(this.bca){const report=this.reports.find(r=>r.type==='bca');add('有效定量与交付',this.bca.stage==='done'&&report?.in_range,'稀释后校准范围 0.1–0.5 mg/mL');add('蛋白样品浓度',Math.abs((this.bca.normalized??0)-0.5)<=0.005,`${this.bca.normalized?.toFixed(4)??'—'} mg/mL / 目标 0.5 ± 0.005`);}
    if(SPECS[this.kind].deadline)add('联合交付时限',this.t<=85,`${this.t.toFixed(2)} / 85 min`);
    this.result={reward:checks.every(x=>x.pass)?1:0,checks,t:this.t,kind:'author_browser_demo',model_evaluation:false};this.ended=true;this.emit('submit',{reward:this.result.reward});return this.snapshot();
  }
  snapshot(){this.refresh();return {kind:this.kind,started:this.started,ended:this.ended,t:this.t,busy:{...this.busy},occupancy:copy(this.occupancy),credits:this.credits,ngs:copy(this.ngs),beads:copy(this.beads),bca:copy(this.bca),thaw:this.thaw,reports:copy(this.reports),events:copy(this.events),result:copy(this.result)};}
}
