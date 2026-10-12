'use strict';
const $=id=>document.getElementById(id);
const KEY='gpro-emergency-fund-v1';
const HISTORY_KEY='gpro-emergency-fund-history-v1';
let operations=[];
try{const x=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');if(Array.isArray(x)&&x.length<=5000&&x.every(o=>o&&typeof o.id==='string'&&['deposit','withdrawal'].includes(o.type)&&Number.isSafeInteger(o.amount)&&o.amount>0&&/^\d{4}-\d{2}-\d{2}$/.test(o.date)&&typeof o.note==='string'&&o.note.length<=80))operations=x;}catch{}
const rub=c=>(c/100).toLocaleString('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:2});
const cents=value=>{if(value===''||!Number.isFinite(Number(value))||Number(value)<0||Number(value)>1e12)return null;let x=Math.round(Number(value)*100);return Number.isSafeInteger(x)?x:null;};
function calculate(expenses,saved,months,contribution){
  if(!Number.isSafeInteger(expenses)||expenses<=0||!Number.isSafeInteger(saved)||saved<0||(!Number.isInteger(months)||months<1||months>36)||!Number.isSafeInteger(contribution)||contribution<0)return null;
  const target=expenses*months;if(!Number.isSafeInteger(target))return null;
  const missing=Math.max(0,target-saved),progress=Math.min(100,100*saved/target);
  const eta=missing===0?0:contribution===0?null:Math.ceil(missing/contribution);
  return {target,missing,progress,coverage:saved/expenses,eta,expenses,saved,months,contribution};
}
function milestoneLabel(n){return n===1?'1 месяц':n+' мес.';}
function planRows(result){
  const root=$('milestoneList');root.replaceChildren();
  for(const n of [1,3,6,12].filter(n=>n<=result.months)){
    const goal=result.expenses*n;
    const remaining=Math.max(0,goal-result.saved);
    const time=remaining===0?0:result.contribution===0?null:Math.ceil(remaining/result.contribution);
    const row=document.createElement('div');row.className='plan-row';
    const title=document.createElement('strong');title.textContent=milestoneLabel(n)+' расходов';
    const detail=document.createElement('span');detail.textContent=remaining===0?'Достигнуто':time===null?'Нужно накопить '+rub(remaining):rub(remaining)+' ещё · '+milestoneLabel(time)+' до цели';
    row.append(title,detail);root.append(row);
  }
}
function scenarioRows(result){
  const root=$('scenarioList');root.replaceChildren();
  for(const [label,multiplier] of [['Текущий план',1],['Взнос +25%',1.25],['Взнос +50%',1.5]]){
    const monthly=Math.round(result.contribution*multiplier);
    const time=result.missing===0?0:monthly===0?null:Math.ceil(result.missing/monthly);
    const row=document.createElement('div');row.className='plan-row';
    const title=document.createElement('strong');title.textContent=label;
    const detail=document.createElement('span');detail.textContent=rub(monthly)+'/мес. · '+(time===null?'Без регулярного пополнения цель не достигнуть':time===0?'Цель достигнута':milestoneLabel(time));
    row.append(title,detail);root.append(row);
  }
}
function render(result){
  $('target').textContent=rub(result.target);$('coverage').textContent=result.coverage.toLocaleString('ru-RU',{maximumFractionDigits:1})+' мес.';
  $('missing').textContent=rub(result.missing);$('eta').textContent=result.eta===null?'Нужен взнос':result.eta===0?'Цель достигнута':result.eta+' мес.';
  $('progressBar').style.width=result.progress+'%';$('progressTrack').setAttribute('aria-valuenow',String(Math.round(result.progress)));
  $('progressCaption').textContent='Накоплено '+result.progress.toLocaleString('ru-RU',{maximumFractionDigits:1})+'% от выбранной цели.';
  $('resultStatus').textContent=result.missing===0?'Подушка сформирована':result.coverage>=1?'Есть начальный запас':'Начало пути';
  planRows(result);scenarioRows(result);
  $('guidance').textContent=result.missing===0?'Цель достигнута. Держи резерв доступным и пересматривай его, если обязательные расходы изменятся.':result.eta===null?'Чтобы увидеть срок достижения цели, укажи сумму, которую можешь ежемесячно откладывать.':result.eta>60?'При таком взносе накопление займёт много времени. Попробуй пересмотреть бюджет или увеличить регулярный взнос.':'При регулярном пополнении по выбранному плану ты постепенно достигнешь цели. Резерв лучше держать отдельно от денег на повседневные покупки.';
}
$('calcForm').addEventListener('submit',event=>{
  event.preventDefault();$('formError').textContent='';
  const expenses=cents($('expenses').value),saved=cents($('saved').value),months=$('months').value==='custom'?Number($('customMonths').value):Number($('months').value),contribution=$('contribution').value===''?0:cents($('contribution').value);
  const result=calculate(expenses,saved,months,contribution);
  if(!result){$('formError').textContent='Проверь суммы: расходы должны быть больше нуля, остальные значения — неотрицательные.';return;}
  render(result);
  try{localStorage.setItem(KEY,JSON.stringify({expenses,saved,months,contribution}));}
  catch{$('formError').textContent='Расчёт готов, но браузер не сохранил значения. Проверь настройки хранилища.';}
});
$('resetForm').addEventListener('click',()=>{if(operations.length&&!confirm('Сбросить параметры и удалить всю историю операций? Это действие нельзя отменить.'))return;try{localStorage.removeItem(HISTORY_KEY);}catch{$('formError').textContent='Не удалось очистить историю операций.';return;}operations=[];renderOperations();$('calcForm').reset();$('formError').textContent='';try{localStorage.removeItem(KEY);}catch{}$('target').textContent='—';$('coverage').textContent='—';$('missing').textContent='—';$('eta').textContent='—';$('progressBar').style.width='0';$('progressTrack').setAttribute('aria-valuenow','0');$('progressCaption').textContent='Заполни форму, чтобы увидеть прогресс.';$('resultStatus').textContent='Ожидает расчёта';$('guidance').textContent='Начни с необходимых ежемесячных расходов и текущих накоплений.';$('milestoneList').textContent='Сначала рассчитай финансовую подушку.';$('scenarioList').textContent='После расчёта появятся варианты накопления.';});
try{const x=JSON.parse(localStorage.getItem(KEY)||'null');if(x&&calculate(x.expenses,x.saved,x.months,x.contribution)){for(const id of ['expenses','saved','contribution'])$(id).value=(x[id]/100).toFixed(2);$('months').value=[3,6,9,12].includes(x.months)?String(x.months):'custom';$('customMonthsWrap').hidden=$('months').value!=='custom';$('customMonths').value=x.months;render(calculate(x.expenses,x.saved,x.months,x.contribution));}}catch{}

$('months').addEventListener('change',()=>{$('customMonthsWrap').hidden=$('months').value!=='custom';});
const today=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);};
$('operationDate').value=today();
function renderOperations(){
  const root=$('operationHistory');root.replaceChildren();
  const visible=operations.filter(o=>$('historyFilter').value==='all'||o.type===$('historyFilter').value);
  $('operationsCount').textContent=operations.length+' операций';
  if(!visible.length){const p=document.createElement('p');p.className='muted';p.textContent=operations.length?'Нет операций выбранного типа.':'Операций пока нет.';root.append(p);return;}
  for(const o of [...visible].sort((a,b)=>(preferences.historyOrder==='oldest'?a.date.localeCompare(b.date):b.date.localeCompare(a.date)))){
    const row=document.createElement('div');row.className='operation-row';
    const desc=document.createElement('span');desc.textContent=o.date+' · '+(o.type==='deposit'?'+':'−')+rub(o.amount)+(o.note?' · '+o.note:'');
    const undo=document.createElement('button');undo.className='button secondary';undo.type='button';undo.textContent='Отменить';
    undo.addEventListener('click',()=>{
      const saved=cents($('saved').value),next=saved+(o.type==='deposit'?-o.amount:o.amount);
      if(saved===null||next<0||!Number.isSafeInteger(next)){$('operationError').textContent='Сначала проверь текущий остаток: отмена приведёт к некорректной сумме.';return;}
      if(!confirm('Отменить операцию на '+rub(o.amount)+'?'))return;
      const left=operations.filter(x=>x.id!==o.id);
      try{const previous=localStorage.getItem(KEY);const payload=JSON.parse(previous||'null');if(!payload)throw Error('no saved calculation');payload.saved=next;localStorage.setItem(KEY,JSON.stringify(payload));try{localStorage.setItem(HISTORY_KEY,JSON.stringify(left));}catch(error){if(previous!==null)localStorage.setItem(KEY,previous);throw error;}}
      catch{$('operationError').textContent='Не удалось сохранить изменение. Проверь хранилище.';return;}
      operations=left;$('saved').value=(next/100).toFixed(2);refreshResult();renderOperations();
    });
    row.append(desc,undo);root.append(row);
  }
}
function refreshResult(){
  const expenses=cents($('expenses').value),saved=cents($('saved').value);
  const months=$('months').value==='custom'?Number($('customMonths').value):Number($('months').value);
  const contribution=$('contribution').value===''?0:cents($('contribution').value);
  const result=calculate(expenses,saved,months,contribution);
  if(result)render(result);
}
$('operationForm').addEventListener('submit',event=>{
  event.preventDefault();$('operationError').textContent='';if(storageCheck()){$('operationError').textContent='Сначала восстанови данные из копии.';return;}
  const saved=cents($('saved').value),amount=cents($('operationAmount').value),type=$('operationType').value,date=$('operationDate').value,note=$('operationNote').value.trim();
  if(saved===null||amount===null||amount<=0||!['deposit','withdrawal'].includes(type)||!/^\d{4}-\d{2}-\d{2}$/.test(date)||operations.length>=5000){$('operationError').textContent='Проверь сумму, остаток, дату и заполнение калькулятора.';return;}
  const next=type==='deposit'?saved+amount:saved-amount;
  if(next<0||!Number.isSafeInteger(next)||next>1e14){$('operationError').textContent='Нельзя снять больше остатка или превысить допустимую сумму.';return;}
  const expenses=cents($('expenses').value),months=$('months').value==='custom'?Number($('customMonths').value):Number($('months').value),contribution=$('contribution').value===''?0:cents($('contribution').value);
  const result=calculate(expenses,next,months,contribution);
  if(!result){$('operationError').textContent='Сначала заполни корректные параметры расчёта.';return;}
  const entry={id:globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2),type,amount,date,note};
  const nextHistory=[...operations,entry];
  try{const previous=localStorage.getItem(KEY);localStorage.setItem(KEY,JSON.stringify({expenses,saved:next,months,contribution}));try{localStorage.setItem(HISTORY_KEY,JSON.stringify(nextHistory));}catch(error){if(previous===null)localStorage.removeItem(KEY);else localStorage.setItem(KEY,previous);throw error;}}
  catch{$('operationError').textContent='Не удалось сохранить операцию. Проверь хранилище.';return;}
  operations=nextHistory;$('saved').value=(next/100).toFixed(2);$('operationAmount').value='';$('operationNote').value='';$('operationDate').value=today();render(result);renderOperations();$('operationAmount').focus();
});
$('historyFilter').addEventListener('change',renderOperations);
for(const button of document.querySelectorAll('[data-quick]')){
  button.addEventListener('click',()=>{
    $('operationType').value='deposit';
    $('operationAmount').value=button.dataset.quick;
    $('operationAmount').focus();
    $('transactionsPanel').scrollIntoView({behavior:'smooth',block:'start'});
  });
}
const PREF_KEY='gpro-emergency-fund-preferences-v1';
const defaultPreferences=()=>({accent:'forest',hideAmounts:false,historyOrder:'newest'});
let preferences=defaultPreferences();
try{
  const stored=JSON.parse(localStorage.getItem(PREF_KEY)||'null');
  if(stored&&typeof stored==='object'){
    if(['forest','gold'].includes(stored.accent))preferences.accent=stored.accent;
    if(typeof stored.hideAmounts==='boolean')preferences.hideAmounts=stored.hideAmounts;
    if(['newest','oldest'].includes(stored.historyOrder))preferences.historyOrder=stored.historyOrder;
  }
}catch{}
function applyPreferences(){
  document.body.dataset.accent=preferences.accent;
  document.body.classList.toggle('mask-amounts',preferences.hideAmounts);
  $('accentChoice').value=preferences.accent;
  $('historyOrder').value=preferences.historyOrder;
  $('hideAmounts').checked=preferences.hideAmounts;
  renderOperations();
}
function savePreferences(){
  try{localStorage.setItem(PREF_KEY,JSON.stringify(preferences));$('settingsStatus').textContent='Настройки сохранены.';}
  catch{$('settingsStatus').textContent='Настройки применены, но браузер не смог их сохранить.';}
  applyPreferences();
}
$('accentChoice').addEventListener('change',()=>{preferences.accent=$('accentChoice').value;savePreferences();});
$('historyOrder').addEventListener('change',()=>{preferences.historyOrder=$('historyOrder').value;savePreferences();});
$('hideAmounts').addEventListener('change',()=>{preferences.hideAmounts=$('hideAmounts').checked;savePreferences();});
$('resetPreferences').addEventListener('click',()=>{preferences=defaultPreferences();savePreferences();});
applyPreferences();


/* Level 7: verified portable backup of all local records */
function validOperation(o){return o&&typeof o.id==='string'&&o.id.length>0&&o.id.length<150&&['deposit','withdrawal'].includes(o.type)&&Number.isSafeInteger(o.amount)&&o.amount>0&&o.amount<=1e14&&typeof o.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(o.date)&&typeof o.note==='string'&&o.note.length<=80;}
function validCalc(x){return x&&calculate(x.expenses,x.saved,x.months,x.contribution)!==null;}
function validPrefs(p){return p&&['forest','gold'].includes(p.accent)&&typeof p.hideAmounts==='boolean'&&['newest','oldest'].includes(p.historyOrder);}
function validSnapshot(o){return o&&o.app==='gpro-emergency-fund'&&o.version===1&&(o.calculation===null||validCalc(o.calculation))&&Array.isArray(o.operations)&&o.operations.length<=5000&&o.operations.every(validOperation)&&new Set(o.operations.map(x=>x.id)).size===o.operations.length&&validPrefs(o.preferences);}
function storageCheck(){
 try{
   const c=localStorage.getItem(KEY),h=localStorage.getItem(HISTORY_KEY),p=localStorage.getItem(PREF_KEY);
   if(c!==null&&!validCalc(JSON.parse(c)))return 'Повреждённые параметры расчёта.';
   if(h!==null){const x=JSON.parse(h);if(!Array.isArray(x)||x.length>5000||!x.every(validOperation)||new Set(x.map(v=>v.id)).size!==x.length)return 'Повреждена история операций.';}
   if(p!==null){const x=JSON.parse(p);if(!validPrefs(x))return 'Повреждены настройки.';}
   return null;
 }catch{return 'Не удалось прочитать данные браузера.';}
}
function downloadBackup(data){
 const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download='gpro-financial-cushion-'+today()+'.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
$('checkData').addEventListener('click',()=>{$('backupMessage').textContent=storageCheck()||'Проверка пройдена. Рекомендуем периодически скачивать резервную копию.';});
$('exportBackup').addEventListener('click',()=>{
 const problem=storageCheck();if(problem){$('backupMessage').textContent='Экспорт остановлен: '+problem+' Не очищай данные браузера.';return;}
 const calculation=JSON.parse(localStorage.getItem(KEY)||'null');
 const snapshot={app:'gpro-emergency-fund',version:1,exportedAt:new Date().toISOString(),calculation,operations:JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]'),preferences};
 downloadBackup(snapshot);$('backupMessage').textContent='Резервная копия подготовлена к скачиванию.';
});
$('importBackup').addEventListener('change',async event=>{
 const file=event.target.files?.[0];event.target.value='';if(!file)return;
 if(file.size>4*1024*1024){$('backupMessage').textContent='Файл слишком большой (не более 4 МБ).';return;}
 let payload;
 try{payload=JSON.parse(await file.text());}catch{$('backupMessage').textContent='Не удалось прочитать JSON-файл.';return;}
 if(!validSnapshot(payload)){$('backupMessage').textContent='Файл не подходит: данные не изменены.';return;}
 if(!confirm('Заменить расчёт, историю операций и настройки данными из файла?'))return;
 try{
   const original=[KEY,HISTORY_KEY,PREF_KEY].map(k=>localStorage.getItem(k));
   const values=[payload.calculation===null?null:JSON.stringify(payload.calculation),JSON.stringify(payload.operations),JSON.stringify(payload.preferences)];
   let changed=0;
   try{for(let i=0;i<3;i++){if(values[i]===null)localStorage.removeItem([KEY,HISTORY_KEY,PREF_KEY][i]);else localStorage.setItem([KEY,HISTORY_KEY,PREF_KEY][i],values[i]);changed++;}}
   catch(e){for(let i=0;i<changed;i++){try{if(original[i]===null)localStorage.removeItem([KEY,HISTORY_KEY,PREF_KEY][i]);else localStorage.setItem([KEY,HISTORY_KEY,PREF_KEY][i],original[i]);}catch{}}throw e;}
   operations=payload.operations;preferences=payload.preferences;
   if(payload.calculation){
     const x=payload.calculation;
     for(const id of ['expenses','saved','contribution'])$(id).value=(x[id]/100).toFixed(2);
     $('months').value=[3,6,9,12].includes(x.months)?String(x.months):'custom';
     $('customMonthsWrap').hidden=$('months').value!=='custom';$('customMonths').value=x.months;
     render(calculate(x.expenses,x.saved,x.months,x.contribution));
   }else{$('calcForm').reset();for(const id of ['target','coverage','missing','eta'])$(id).textContent='—';$('progressBar').style.width='0';$('progressTrack').setAttribute('aria-valuenow','0');$('resultStatus').textContent='Ожидает расчёта';$('milestoneList').textContent='Сначала рассчитай финансовую подушку.';$('scenarioList').textContent='После расчёта появятся варианты накопления.';}
   applyPreferences();renderOperations();$('backupMessage').textContent='Копия восстановлена. Операций: '+operations.length+'.';
 }catch{$('backupMessage').textContent='Не удалось сохранить восстановленные данные. Текущие записи проверь вручную.';}
});
const loadProblem=storageCheck();if(loadProblem)$('backupMessage').textContent='Внимание: '+loadProblem+' Не сбрасывай данные до их восстановления.';
