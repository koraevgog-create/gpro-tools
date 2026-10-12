'use strict';
const $=id=>document.getElementById(id);
const KEY='gpro-debt-freedom-v1';
const rub=cents=>(cents/100).toLocaleString('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:2});
const toCents=value=>{
  if(value===''||!Number.isFinite(Number(value))||Number(value)<0||Number(value)>1e12)return null;
  const n=Math.round(Number(value)*100);
  return Number.isSafeInteger(n)&&n<=1e14?n:null;
};
function valid(item){return item&&typeof item.id==='string'&&item.id.length>0&&item.id.length<=120&&typeof item.name==='string'&&item.name.trim().length>0&&item.name.length<=80&&Number.isSafeInteger(item.amount)&&item.amount>=0&&item.amount<=1e14&&(item.initialAmount===undefined||(Number.isSafeInteger(item.initialAmount)&&item.initialAmount>=0&&item.initialAmount<=1e14))&&(item.adjustments===undefined||(Array.isArray(item.adjustments)&&item.adjustments.length<=5000&&item.adjustments.every(a=>a&&Number.isSafeInteger(a.delta)&&Math.abs(a.delta)<=1e14&&validDate(a.date))))&&Number.isSafeInteger(item.payment)&&item.payment>=0&&item.payment<=1e14&&(item.target===undefined||(Number.isSafeInteger(item.target)&&item.target>=0&&item.target<=1e14))&&(item.rate===undefined||(typeof item.rate==='number'&&Number.isFinite(item.rate)&&item.rate>=0&&item.rate<=100))&&(item.due===undefined||item.due===''||validDate(item.due))&&(item.history===undefined||(Array.isArray(item.history)&&item.history.length<=5000&&item.history.every(p=>p&&typeof p.id==='string'&&p.id.length>0&&Number.isSafeInteger(p.cents)&&p.cents>0&&p.cents<=1e14&&validDate(p.date))));}
function validDate(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T12:00:00');return !Number.isNaN(+d)&&d.toISOString().slice(0,10)===s;}
function estimate(amount,payment,rate){if(payment<=0)return null;let remaining=amount;const interest=rate/1200;for(let months=1;months<=600;months++){remaining=Math.ceil(remaining*(1+interest)-payment);if(!Number.isSafeInteger(remaining))return null;if(remaining<=0)return months;}return null;}
const monthsLabel=n=>n===1?'1 месяц':n+' мес.';
const paid=d=>(d.history||[]).reduce((sum,p)=>sum+p.cents,0);
const starting=d=>d.initialAmount===undefined?d.amount+paid(d):d.initialAmount;
const planned=d=>Math.max(d.payment,d.target||0);
const uid=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2);
let visiblePayments=50;
let debts=[];
let storageProblem=false;
try{
  const raw=localStorage.getItem(KEY);
  if(raw!==null){const data=JSON.parse(raw);if(!Array.isArray(data)||data.length>2000||!data.every(valid)||new Set(data.map(d=>d.id)).size!==data.length||!Number.isSafeInteger(data.reduce((sum,d)=>sum+d.amount,0)))throw new Error('invalid');debts=data;}
}catch{storageProblem=true;}
const el=(tag,content,className='')=>{const node=document.createElement(tag);node.textContent=content;if(className)node.className=className;return node;};
function render(){
  $('totalDebt').textContent=rub(debts.reduce((sum,d)=>sum+d.amount,0));
  $('totalPayment').textContent=rub(debts.reduce((sum,d)=>sum+(d.amount>0?d.payment:0),0));
  $('debtCount').textContent=String(debts.filter(d=>d.amount>0).length);
  $('listCount').textContent=debts.length+' шт.';
  renderPayments();
  renderProgress();
  renderStrategies();
  const tips=$('guidance');tips.replaceChildren();
  if(!debts.length){tips.append(el('p','Добавь первый долг — здесь появятся рекомендации по его погашению.','muted'));}
  for(const d of debts){
    const tip=el('article','','advice-item');tip.append(el('strong',d.name));
    if(d.amount===0){tip.append(el('p','Долг полностью погашен по введённым данным.','muted'));tips.append(tip);continue;}
    const payment=planned(d);
    if(!payment){tip.append(el('p','Нет фиксированного платежа и добровольного плана. Определи посильную сумму на месяц, обсуди порядок возврата с кредитором или человеком, которому должен.','muted'));}
    else {const n=estimate(d.amount,payment,d.rate||0);tip.append(el('p',n?'При '+rub(payment)+'/мес. ориентировочный срок: '+monthsLabel(n)+'.':'При текущей сумме платежа долг не закроется за 50 лет или платёж не покрывает проценты.','muted'));if(d.rate===undefined)tip.append(el('p','Ставка не указана: срок условно рассчитан без процентов и может быть значительно больше.','muted'));}
    if(d.due){const date=new Date(d.due+'T12:00:00');tip.append(el('p','Оговоренный срок: '+date.toLocaleDateString('ru-RU')+'.','muted'));const deadlineMonths=Math.max(0,Math.ceil((date-new Date(localToday()+'T12:00:00'))/(86400000*30.4375)));const n=estimate(d.amount,payment,d.rate||0);if(!n||n>deadlineMonths){tip.append(el('p','При текущем плане есть риск не успеть к сроку: согласуй новую сумму или дату возврата заранее.','warning'));if(deadlineMonths>0)tip.append(el('p','Для возврата без процентов до срока ориентир: '+rub(Math.ceil(d.amount/deadlineMonths))+'/мес. При начислении процентов потребуется больше.','muted'));}}
    else if(!d.payment)tip.append(el('p','Срок не указан: это не означает, что долг можно откладывать бесконечно. Лучше согласовать понятные условия возврата.','muted'));
    tips.append(tip);
  }
  const list=$('debtList');list.replaceChildren();
  if(storageProblem){list.append(el('div','Не удалось прочитать сохранённые данные. Добавление и удаление приостановлены, чтобы не перезаписать их. Проверь настройки браузера.','empty'));return;}
  if(!debts.length){list.append(el('div','Здесь появятся твои долги после добавления первого обязательства.','empty'));return;}
  const query=$('debtSearch').value.trim().toLocaleLowerCase('ru-RU'),filter=$('debtFilter').value,sort=$('debtSort').value;
  const visible=debts.filter(d=>(filter==='all'||(filter==='active'?d.amount>0:d.amount===0))&&d.name.toLocaleLowerCase('ru-RU').includes(query))
    .sort(sort==='name'?(a,b)=>a.name.localeCompare(b.name,'ru'):(a,b)=>sort==='payment'?b.payment-a.payment||b.amount-a.amount:b.amount-a.amount||b.payment-a.payment);
  $('listCount').textContent=visible.length+' из '+debts.length;
  if(!visible.length){list.append(el('div','По выбранным фильтрам обязательств нет.','empty'));return;}
  for(const debt of visible){
    const item=el('article','','debt-item');const header=el('div','','debt-item-top');
    const name=el('strong',debt.name);const edit=el('button','Изменить','button secondary');edit.type='button';edit.addEventListener('click',()=>startEdit(debt.id));const remove=el('button','Удалить','button danger');remove.type='button';remove.setAttribute('aria-label','Удалить '+debt.name);
    remove.addEventListener('click',()=>{
      if(!confirm('Удалить обязательство «'+debt.name+'» вместе со всей историей выплат и корректировок? Восстановить его без резервной копии нельзя.'))return;
      const next=debts.filter(d=>d.id!==debt.id);
      if(!persist(next))return;debts=next;render();
    });
    const controls=el('div','','item-actions');
    if(debt.amount>0){
      const payNow=el('button','Внести выплату','button pay-now');
      payNow.type='button';payNow.addEventListener('click',()=>{
        $('paymentPanel').open=true;
        $('paymentDebt').value=debt.id;$('paymentMessage').textContent='Выбран долг «'+debt.name+'».';
        $('paymentPanel').scrollIntoView({behavior:'smooth',block:'start'});$('paymentAmount').focus({preventScroll:true});
      });controls.append(payNow);
    }
    controls.append(edit,remove);header.append(name,controls);
    const figures=el('div','','debt-figures');const amount=el('span','Остаток: ');amount.append(el('b',rub(debt.amount)));
    const pay=el('span',debt.payment>0?'Обязательный платёж/мес.: ':'Без обязательного платежа');if(debt.payment>0)pay.append(el('b',rub(debt.payment)));figures.append(amount,pay);
    if(debt.target>0){const voluntary=el('span','Добровольный план: ');voluntary.append(el('b',rub(debt.target)+'/мес.'));figures.append(voluntary);}
    if(typeof debt.rate==='number'){figures.append(el('span','Ставка: '+debt.rate.toLocaleString('ru-RU')+'% годовых'));}
    if(debt.due){figures.append(el('span','Вернуть к: '+new Date(debt.due+'T12:00:00').toLocaleDateString('ru-RU')));}
    if(debt.amount===0){item.classList.add('paid-off');figures.append(el('span','Погашен','positive'));}
    if((debt.adjustments||[]).length){const changes=el('details','','adjustment-log');changes.append(el('summary','Корректировки остатка: '+debt.adjustments.length));for(const change of debt.adjustments){changes.append(el('div',change.date+' · '+(change.delta>0?'+':'−')+rub(Math.abs(change.delta)),'muted'));}item.append(changes);}
    item.append(header,figures);list.append(item);
  }
}
function persist(next,errorId='formError'){
  const status=checkStorage();
  if(!status.ok){showStorageStatus(status);$(errorId).textContent='Сохранение заблокировано: проблема с сохранёнными данными. Скачай аварийную копию.';return false;}
  if(!Array.isArray(next)||next.length>2000||!next.every(valid)||new Set(next.map(d=>d.id)).size!==next.length||!Number.isSafeInteger(next.reduce((sum,d)=>sum+d.amount,0))){$(errorId).textContent='Изменения не прошли проверку данных.';return false;}
  try{if(storageProblem)throw new Error('blocked');localStorage.setItem(KEY,JSON.stringify(next));$(errorId).textContent='';return true;}
  catch{$(errorId).textContent='Не удалось сохранить данные. Проверь хранилище браузера.';return false;}
}
$('debtForm').addEventListener('submit',event=>{
  event.preventDefault();
  const editingId=$('editingId').value;
  const name=$('debtName').value.trim(),amount=toCents($('debtAmount').value),payment=$('debtPayment').value===''?0:toCents($('debtPayment').value);
  const target=$('debtTarget').value===''?0:toCents($('debtTarget').value);
  const due=$('debtDue').value;
  const rateText=$('debtRate').value,rate=rateText===''?undefined:Number(rateText);
  if(!name||name.length>80||amount===null||(!editingId&&amount===0)||payment===null||target===null||(rate!==undefined&&(!Number.isFinite(rate)||rate<0||rate>100))||(due&&!validDate(due))){$('formError').textContent='Проверь название, сумму долга и платёж.';return;}
  if(!editingId&&debts.length>=2000){$('formError').textContent='Достигнут лимит обязательств.';return;}
  const original=editingId?debts.find(d=>d.id===editingId):null;
  if(editingId&&!original){$('formError').textContent='Долг для изменения не найден.';return;}
  const delta=original?amount-original.amount:0;
  if(original && starting(original)+delta<0){$('formError').textContent='Остаток нельзя уменьшить ниже общей суммы записанных выплат. Исправь выплаты через историю.';return;}
  if(original && (original.adjustments||[]).length>=5000 && delta!==0){$('formError').textContent='Достигнут лимит ручных корректировок.';return;}
  if(original&&delta!==0&&!confirm('Изменить остаток на '+rub(Math.abs(delta))+' ('+(delta>0?'увеличение':'уменьшение')+')? Это ручная корректировка, она НЕ будет записана как выплата.'))return;
  const debt={id:original?.id||uid(),name,amount,payment,target,...(rate===undefined?{}:{rate}),...(due?{due}:{}),history:original?.history||[],initialAmount:original?starting(original)+delta:amount,adjustments:original?[...(original.adjustments||[]),...(delta?[{date:localToday(),delta}]:[])]:[]};
  const next=editingId?debts.map(d=>d.id===editingId?debt:d):[...debts,debt];if(!persist(next))return;debts=next;resetEditor();render();$('debtName').focus();
});
function startEdit(id){
  const d=debts.find(x=>x.id===id);if(!d)return;
  $('editingId').value=id;$('debtName').value=d.name;$('debtAmount').value=(d.amount/100).toFixed(2);
  $('debtPayment').value=d.payment?(d.payment/100).toFixed(2):'';
  $('debtTarget').value=d.target?(d.target/100).toFixed(2):'';
  $('debtRate').value=d.rate===undefined?'':d.rate;
  $('debtDue').value=d.due||'';
  $('formHeading').textContent='Изменить долг';$('saveDebt').textContent='Сохранить изменения';
  $('cancelEdit').hidden=false;$('formError').textContent='';
  $('debtForm').scrollIntoView({behavior:'smooth',block:'start'});$('debtName').focus({preventScroll:true});
}
function resetEditor(){
  $('debtForm').reset();$('editingId').value='';
  $('formHeading').textContent='Добавить долг';$('saveDebt').textContent='Добавить обязательство';
  $('cancelEdit').hidden=true;$('formError').textContent='';
}
$('cancelEdit').addEventListener('click',resetEditor);
const localToday=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);};
$('paymentDate').value=localToday();
function renderPayments(){
  const select=$('paymentDebt'),previous=select.value;select.replaceChildren();
  const live=debts.filter(d=>d.amount>0);
  for(const d of live){const o=document.createElement('option');o.value=d.id;o.textContent=d.name+' — '+rub(d.amount);select.append(o);}
  if(live.some(d=>d.id===previous))select.value=previous;
  $('paymentAmount').disabled=!live.length;$('paymentDebt').disabled=!live.length;
  $('paymentForm').querySelector('button[type="submit"]').disabled=!live.length;
  const historyFilter=$('historyDebt'),oldHistoryFilter=historyFilter.value;
  historyFilter.replaceChildren();
  const every=document.createElement('option');every.value='all';every.textContent='Все обязательства';historyFilter.append(every);
  for(const d of debts){const o=document.createElement('option');o.value=d.id;o.textContent=d.name;historyFilter.append(o);}
  historyFilter.value=debts.some(d=>d.id===oldHistoryFilter)?oldHistoryFilter:'all';
  const root=$('paymentHistory');root.replaceChildren();
  const all=debts.filter(d=>historyFilter.value==='all'||d.id===historyFilter.value)
    .flatMap(d=>(d.history||[]).map(p=>({...p,debtId:d.id,name:d.name})))
    .sort((a,b)=>b.date.localeCompare(a.date));
  if(!all.length){$('showMorePayments').hidden=true;$('showAllPayments').hidden=true;root.append(el('p','Пока нет записанных выплат.','muted'));return;}
  $('showMorePayments').hidden=all.length<=visiblePayments;
  $('showAllPayments').hidden=all.length<=visiblePayments;
  for(const p of all.slice(0,visiblePayments)){
    const item=el('div','','payment-row'),info=el('span',p.date+' · '+p.name+' · '+rub(p.cents));
    const undo=el('button','Отменить','button secondary');undo.type='button';
    undo.addEventListener('click',()=>{
      if(!confirm('Отменить выплату '+rub(p.cents)+' по долгу «'+p.name+'»? Остаток долга увеличится.'))return;
      const next=debts.map(d=>d.id===p.debtId?{...d,amount:d.amount+p.cents,history:(d.history||[]).filter(x=>x.id!==p.id)}:d);
    if(next.some(d=>d.amount>1e14)){$('paymentError').textContent='Невозможно отменить выплату: сумма превысит допустимый предел.';return;}
      if(!persist(next,'paymentError'))return;debts=next;render();
    });
    item.append(info,undo);root.append(item);
  }
  if(all.length>visiblePayments)root.append(el('p','Показаны '+visiblePayments+' из '+all.length+' выплат.','muted'));
  if(!all.length){$('showMorePayments').hidden=true;$('showAllPayments').hidden=true;}
}
$('paymentForm').addEventListener('submit',event=>{
  event.preventDefault();const id=$('paymentDebt').value,debt=debts.find(d=>d.id===id);
  const cents=toCents($('paymentAmount').value),date=$('paymentDate').value;
  if(!debt||cents===null||cents<=0||cents>debt.amount||!validDate(date)){
    $('paymentError').textContent='Проверь долг, сумму и дату. Выплата не должна превышать остаток.';return;
  }
  if((debt.history||[]).length>=5000){$('paymentError').textContent='Для этого долга достигнут лимит истории выплат.';return;}
  const idPayment=globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2);
  const next=debts.map(d=>d.id===id?{...d,amount:d.amount-cents,history:[...(d.history||[]),{id:idPayment,cents,date}]}:d);
  if(!persist(next,'paymentError'))return;debts=next;$('paymentAmount').value='';render();$('paymentMessage').textContent='Выплата '+rub(cents)+' записана. Остаток уменьшен.';
  $('paymentDate').value=localToday();
});

$('showMorePayments').addEventListener('click',()=>{visiblePayments+=50;renderPayments();});
$('showAllPayments').addEventListener('click',()=>{visiblePayments=Number.MAX_SAFE_INTEGER;renderPayments();});
function renderProgress(){
  const initial=debts.reduce((sum,d)=>sum+starting(d),0),payments=debts.reduce((sum,d)=>sum+paid(d),0);
  const remaining=debts.reduce((sum,d)=>sum+d.amount,0);
  const pct=initial>0?Math.min(100,Math.max(0,100*(initial-remaining)/initial)):0;
  $('startingTotal').textContent=rub(initial);$('alreadyPaid').textContent=rub(payments);
  $('paidPercent').textContent=pct.toFixed(1).replace('.',',')+'%';
  $('paidBar').style.width=pct+'%';
}
function simulate(strategy,extra){
  const active=debts.filter(d=>d.amount>0).map(d=>({
    id:d.id,name:d.name,remaining:d.amount,rate:d.rate??0,minimum:d.payment||0,
    monthly:Math.max(d.payment||0,d.target||0)
  }));
  if(!active.length)return {months:0,interest:0,unknown:false,order:[]};
  const unknown=debts.some(d=>d.amount>0&&d.rate===undefined);
  // Planned monthly transfers form ONE shared budget: do not duplicate
  // liberated installments as debts close.
  const totalMonthly=active.reduce((sum,d)=>sum+d.monthly,0)+extra;
  if(!Number.isSafeInteger(totalMonthly)||totalMonthly>Number.MAX_SAFE_INTEGER)
    return {months:null,interest:0,unknown,order:[],invalid:true};
  let interestTotal=0;
  const order=[];
  for(let month=1;month<=600;month++){
    for(const d of active){
      if(d.remaining<=0)continue;
      const interest=Math.ceil(d.remaining*d.rate/1200);
      if(!Number.isSafeInteger(interest)||interestTotal+interest>Number.MAX_SAFE_INTEGER)
        return {months:null,interest:interestTotal,unknown,order,invalid:true};
      interestTotal+=interest;d.remaining+=interest;
      if(!Number.isSafeInteger(d.remaining))return {months:null,interest:interestTotal,unknown,order,invalid:true};
    }
    let pool=totalMonthly;
    // First meet contractual minimums for every open debt.
    for(const d of active){
      if(d.remaining<=0)continue;
      const amount=Math.min(d.remaining,d.minimum);
      pool-=amount;d.remaining-=amount;
      if(d.remaining===0)order.push({name:d.name,month});
    }
    // Then distribute all free capacity in selected priority order.
    const candidates=active.filter(d=>d.remaining>0).sort(strategy==='avalanche'
      ?(a,b)=>b.rate-a.rate||a.remaining-b.remaining||a.name.localeCompare(b.name,'ru')
      :(a,b)=>a.remaining-b.remaining||b.rate-a.rate||a.name.localeCompare(b.name,'ru'));
    for(const d of candidates){
      if(pool<=0)break;
      const amount=Math.min(d.remaining,pool);
      d.remaining-=amount;pool-=amount;
      if(d.remaining===0)order.push({name:d.name,month});
    }
    if(active.every(d=>d.remaining===0))return {months:month,interest:interestTotal,unknown,order};
  }
  return {months:null,interest:interestTotal,unknown,order};
}
function renderStrategies(){
  const root=$('strategyResults');root.replaceChildren();
  const extra=toCents($('extraPayment').value);
  if(extra===null){root.append(el('p','Введите корректную дополнительную сумму.','warning'));return;}
  if(!debts.some(d=>d.amount>0)){root.append(el('p','Добавь действующие долги для сравнения стратегий.','muted'));return;}
  const scenarios=[];
  for(const [key,label] of [['avalanche','Лавина — высокая ставка'],['snowball','Снежный ком — маленький долг']]){
    const result=simulate(key,extra);scenarios.push(result);
    const card=el('article','','advice-item');
    card.append(el('strong',label));
    if(result.invalid)card.append(el('p','Слишком большие суммы для надёжного расчёта. Уменьши значения.','warning'));
    else card.append(el('p',result.months===null?'По этой модели за 50 лет все долги не закрываются.':'Ориентировочный срок: '+monthsLabel(result.months),'muted'));
    if(!result.invalid)card.append(el('p','Условная сумма процентов: '+rub(result.interest),'muted'));
    const plan=result.order.length?result.order.map((d,i)=>(i+1)+'. '+d.name+' — месяц '+d.month).join(' → '):'Нет долгов, закрытых при выбранном бюджете.';
    card.append(el('p','Порядок закрытия: '+plan,'muted'));
    if(result.unknown)card.append(el('p','Есть неизвестные ставки: они условно приняты за 0%, поэтому сравнение может быть неточным.','warning'));
    root.append(card);
  }
  if(extra===0)root.append(el('p','Доплата равна нулю. Если обязательные платежи сами закрывают долги, обе стратегии могут дать одинаковый срок.','muted'));
  if(scenarios.every(x=>x.months!==null)&&scenarios[0].months===scenarios[1].months&&scenarios[0].interest===scenarios[1].interest)
    root.append(el('p','Для этих данных обе стратегии дают одинаковый срок и проценты. Сравни порядок закрытия долгов или увеличь дополнительный платёж.','muted'));
}
$('extraPayment').addEventListener('input',renderStrategies);
for(const btn of document.querySelectorAll('[data-extra]'))btn.addEventListener('click',()=>{$('extraPayment').value=btn.dataset.extra;renderStrategies();});

for(const id of ['debtSearch','debtFilter','debtSort'])$(id).addEventListener(id==='debtSearch'?'input':'change',render);
$('historyDebt').addEventListener('change',()=>{visiblePayments=50;renderPayments();});
$('paymentForm').addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();$('paymentForm').requestSubmit();}});

const GUIDE_KEY='gpro-debt-freedom-guide-v1';
let guideVisible=true;
try{
  const savedGuide=localStorage.getItem(GUIDE_KEY);
  if(savedGuide!==null)guideVisible=savedGuide!=='false';
  else {
    const legacy=JSON.parse(localStorage.getItem('gpro-debt-freedom-view-v1')||'null');
    if(legacy&&typeof legacy.guide==='boolean')guideVisible=legacy.guide;
  }
}catch{}
function setGuide(visible){
  guideVisible=visible;
  $('quickGuide').hidden=!visible;
  $('openGuide').hidden=visible;
  try{localStorage.setItem(GUIDE_KEY,String(visible));}catch{}
}
$('hideGuide').addEventListener('click',()=>setGuide(false));
$('openGuide').addEventListener('click',()=>{setGuide(true);$('quickGuide').scrollIntoView({behavior:'smooth',block:'start'});});
setGuide(guideVisible);

/* Level 7 — backup and integrity checks. Older v1 records remain readable. */
function checkStorage(){
  try{
    const raw=localStorage.getItem(KEY);
    if(raw===null)return storageProblem?{ok:false,message:'При загрузке возникла проблема с хранилищем. Сохранение заблокировано.'}:{ok:true,message:'Хранилище доступно. Долгов пока нет.'};
    const data=JSON.parse(raw);
    if(!Array.isArray(data)||data.length>2000||!data.every(valid)||
       new Set(data.map(d=>d.id)).size!==data.length||!Number.isSafeInteger(data.reduce((sum,d)=>sum+d.amount,0)))
      return {ok:false,message:'В хранилище есть повреждённые данные. Автоматическое сохранение заблокировано.'};
    if(storageProblem)return {ok:false,message:'При загрузке обнаружена проблема. Сохрани исходные данные вручную.'};
    return {ok:true,message:'Проверка пройдена: '+data.length+' обязательств. Для защиты от потери данных скачай JSON-копию.'};
  }catch{
    return {ok:false,message:'Не удалось прочитать сохранённые данные. Скачай исходные данные для восстановления вручную.'};
  }
}
function showStorageStatus(status){
  $('storageWarning').hidden=status.ok;
  $('storageWarningText').textContent=status.ok?'':status.message;
  $('backupStatus').textContent=status.message;
}
function downloadObject(data,fileName){
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'}));
  const link=document.createElement('a');
  link.href=url;link.download=fileName;document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function backupSnapshot(){
  return {app:'gpro-debt-freedom',version:1,exportedAt:new Date().toISOString(),debts};
}
function validBackup(data){
  return data&&data.app==='gpro-debt-freedom'&&data.version===1&&
    Array.isArray(data.debts)&&data.debts.length<=2000&&
    data.debts.every(valid)&&new Set(data.debts.map(d=>d.id)).size===data.debts.length&&
    Number.isSafeInteger(data.debts.reduce((sum,d)=>sum+d.amount,0));
}
$('verifyStorage').addEventListener('click',()=>showStorageStatus(checkStorage()));
$('downloadBackup').addEventListener('click',()=>{
  const status=checkStorage();showStorageStatus(status);
  if(!status.ok)return;
  downloadObject(backupSnapshot(),'gpro-debt-freedom-backup-'+localToday()+'.json');
  $('backupStatus').textContent='Резервная копия создана для скачивания.';
});
$('emergencyBackup').addEventListener('click',()=>{
  let raw;
  try{raw=localStorage.getItem(KEY);}catch{raw='[Не удалось прочитать хранилище]';}
  downloadObject({app:'gpro-debt-freedom-emergency',version:1,exportedAt:new Date().toISOString(),raw,warning:'Не загружай аварийный файл через обычный импорт. Предназначен для ручного восстановления.'},
    'gpro-debt-freedom-emergency-'+localToday()+'.json');
});
$('restoreBackup').addEventListener('change',async event=>{
  const file=event.target.files?.[0];event.target.value='';$('backupStatus').textContent='';
  if(!file)return;
  if(file.size>5*1024*1024){$('backupStatus').textContent='Файл слишком большой (максимум 5 МБ).';return;}
  try{
    const restored=JSON.parse(await file.text());
    if(!validBackup(restored)){$('backupStatus').textContent='Некорректная резервная копия. Ничего не изменено.';return;}
    if(!confirm('Заменить все долги и историю выплат данными из этого файла? Сначала сохрани текущие данные отдельной копией.'))return;
    try{localStorage.setItem(KEY,JSON.stringify(restored.debts));}
    catch{
      // A single-key write is atomic in conforming localStorage implementations.
      $('backupStatus').textContent='Не удалось сохранить импорт. Текущие данные не заменены.';
      return;
    }
    debts=restored.debts;storageProblem=false;visiblePayments=50;
    $('debtSearch').value='';$('debtFilter').value='active';$('paymentMessage').textContent='';
    resetEditor();render();
    showStorageStatus(checkStorage());
    $('backupStatus').textContent='Данные восстановлены: '+debts.length+' обязательств.';
  }catch{
    $('backupStatus').textContent='Не удалось прочитать JSON-файл. Данные не изменены.';
  }
});
const initialStorageStatus=checkStorage();
if(!initialStorageStatus.ok)showStorageStatus(initialStorageStatus);

render();
