'use strict';
const $=id=>document.getElementById(id);
const KEY='gpro-debt-freedom-v1';
const rub=cents=>(cents/100).toLocaleString('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:2});
const toCents=value=>{
  if(value===''||!Number.isFinite(Number(value))||Number(value)<0||Number(value)>1e12)return null;
  const n=Math.round(Number(value)*100);
  return Number.isSafeInteger(n)?n:null;
};
function valid(item){return item&&typeof item.id==='string'&&item.id.length>0&&item.id.length<=120&&typeof item.name==='string'&&item.name.trim().length>0&&item.name.length<=80&&Number.isSafeInteger(item.amount)&&item.amount>=0&&item.amount<=1e14&&Number.isSafeInteger(item.payment)&&item.payment>=0&&item.payment<=1e14&&(item.target===undefined||(Number.isSafeInteger(item.target)&&item.target>=0&&item.target<=1e14))&&(item.rate===undefined||(typeof item.rate==='number'&&Number.isFinite(item.rate)&&item.rate>=0&&item.rate<=100))&&(item.due===undefined||item.due===''||validDate(item.due))&&(item.history===undefined||(Array.isArray(item.history)&&item.history.length<=5000&&item.history.every(p=>p&&typeof p.id==='string'&&p.id.length>0&&Number.isSafeInteger(p.cents)&&p.cents>0&&p.cents<=1e14&&validDate(p.date))));}
function validDate(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T12:00:00');return !Number.isNaN(+d)&&d.toISOString().slice(0,10)===s;}
function estimate(amount,payment,rate){if(payment<=0)return null;let remaining=amount;const interest=rate/1200;for(let months=1;months<=600;months++){remaining=Math.ceil(remaining*(1+interest)-payment);if(remaining<=0)return months;}return null;}
const monthsLabel=n=>n===1?'1 месяц':n+' мес.';
let debts=[];
let storageProblem=false;
try{
  const raw=localStorage.getItem(KEY);
  if(raw!==null){const data=JSON.parse(raw);if(!Array.isArray(data)||data.length>2000||!data.every(valid)||new Set(data.map(d=>d.id)).size!==data.length)throw new Error('invalid');debts=data;}
}catch{storageProblem=true;}
const el=(tag,content,className='')=>{const node=document.createElement(tag);node.textContent=content;if(className)node.className=className;return node;};
function render(){
  $('totalDebt').textContent=rub(debts.reduce((sum,d)=>sum+d.amount,0));
  $('totalPayment').textContent=rub(debts.reduce((sum,d)=>sum+d.payment,0));
  $('debtCount').textContent=String(debts.filter(d=>d.amount>0).length);
  $('listCount').textContent=debts.length+' шт.';
  renderPayments();
  const tips=$('guidance');tips.replaceChildren();
  if(!debts.length){tips.append(el('p','Добавь первый долг — здесь появятся рекомендации по его погашению.','muted'));}
  for(const d of debts){
    const tip=el('article','','advice-item');tip.append(el('strong',d.name));
    if(d.amount===0){tip.append(el('p','Долг полностью погашен по введённым данным.','muted'));tips.append(tip);continue;}
    const planned=d.payment>0?d.payment:(d.target||0);
    if(!planned){tip.append(el('p','Нет фиксированного платежа и добровольного плана. Определи посильную сумму на месяц, обсуди порядок возврата с кредитором или человеком, которому должен.','muted'));}
    else {const n=estimate(d.amount,planned,d.rate||0);tip.append(el('p',n?'При '+rub(planned)+'/мес. ориентировочный срок: '+monthsLabel(n)+'.':'При текущей сумме платежа долг не закроется за 50 лет или платёж не покрывает проценты.','muted'));}
    if(d.due){const date=new Date(d.due+'T12:00:00');tip.append(el('p','Оговоренный срок: '+date.toLocaleDateString('ru-RU')+'. Сверь план с этой датой; если не успеваешь, лучше договориться об условиях заранее.','muted'));}
    else if(!d.payment)tip.append(el('p','Срок не указан: это не означает, что долг можно откладывать бесконечно. Лучше согласовать понятные условия возврата.','muted'));
    tips.append(tip);
  }
  const list=$('debtList');list.replaceChildren();
  if(storageProblem){list.append(el('div','Не удалось прочитать сохранённые данные. Добавление и удаление приостановлены, чтобы не перезаписать их. Проверь настройки браузера.','empty'));return;}
  if(!debts.length){list.append(el('div','Здесь появятся твои долги после добавления первого обязательства.','empty'));return;}
  for(const debt of debts){
    const item=el('article','','debt-item');const header=el('div','','debt-item-top');
    const name=el('strong',debt.name);const edit=el('button','Изменить','button secondary');edit.type='button';edit.addEventListener('click',()=>startEdit(debt.id));const remove=el('button','Удалить','button danger');remove.type='button';remove.setAttribute('aria-label','Удалить '+debt.name);
    remove.addEventListener('click',()=>{
      if(!confirm('Удалить обязательство «'+debt.name+'»?'))return;
      const next=debts.filter(d=>d.id!==debt.id);
      if(!persist(next))return;debts=next;render();
    });
    const controls=el('div','','item-actions');controls.append(edit,remove);header.append(name,controls);
    const figures=el('div','','debt-figures');const amount=el('span','Остаток: ');amount.append(el('b',rub(debt.amount)));
    const pay=el('span',debt.payment>0?'Обязательный платёж/мес.: ':'Без обязательного платежа');if(debt.payment>0)pay.append(el('b',rub(debt.payment)));figures.append(amount,pay);
    if(debt.target>0&&!debt.payment){const voluntary=el('span','Добровольный план: ');voluntary.append(el('b',rub(debt.target)+'/мес.'));figures.append(voluntary);}
    if(typeof debt.rate==='number'){figures.append(el('span','Ставка: '+debt.rate.toLocaleString('ru-RU')+'% годовых'));}
    if(debt.due){figures.append(el('span','Вернуть к: '+new Date(debt.due+'T12:00:00').toLocaleDateString('ru-RU')));}
    if(debt.amount===0)item.classList.add('paid-off');
    item.append(header,figures);list.append(item);
  }
}
function persist(next,errorId='formError'){
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
  const debt={id:original?.id||(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2)),name,amount,payment,target,...(rate===undefined?{}:{rate}),...(due?{due}:{}),...(original?.history?{history:original.history}:{})};
  const next=editingId?debts.map(d=>d.id===editingId?debt:d):[...debts,debt];if(!persist(next))return;debts=next;resetEditor();render();$('debtName').focus();
});
render();
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
  const root=$('paymentHistory');root.replaceChildren();
  const all=debts.flatMap(d=>(d.history||[]).map(p=>({...p,debtId:d.id,name:d.name})))
    .sort((a,b)=>b.date.localeCompare(a.date));
  if(!all.length){root.append(el('p','Пока нет записанных выплат.','muted'));return;}
  for(const p of all.slice(0,50)){
    const item=el('div','','payment-row'),info=el('span',p.date+' · '+p.name+' · '+rub(p.cents));
    const undo=el('button','Отменить','button secondary');undo.type='button';
    undo.addEventListener('click',()=>{
      if(!confirm('Отменить выплату '+rub(p.cents)+' по долгу «'+p.name+'»? Остаток долга увеличится.'))return;
      const next=debts.map(d=>d.id===p.debtId?{...d,amount:d.amount+p.cents,history:(d.history||[]).filter(x=>x.id!==p.id)}:d);
      if(!persist(next,'paymentError'))return;debts=next;render();
    });
    item.append(info,undo);root.append(item);
  }
  if(all.length>50)root.append(el('p','Показаны последние 50 выплат. Остальные сохранены в истории данных.','muted'));
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
  if(!persist(next,'paymentError'))return;debts=next;$('paymentAmount').value='';render();
});
