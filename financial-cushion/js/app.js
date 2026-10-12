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
  if(!operations.length){const p=document.createElement('p');p.className='muted';p.textContent='Операций пока нет.';root.append(p);return;}
  for(const o of [...operations].sort((a,b)=>b.date.localeCompare(a.date))){
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
  event.preventDefault();$('operationError').textContent='';
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
  operations=nextHistory;$('saved').value=(next/100).toFixed(2);$('operationAmount').value='';$('operationNote').value='';render(result);renderOperations();
});
renderOperations();
