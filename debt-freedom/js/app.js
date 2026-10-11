'use strict';
const $=id=>document.getElementById(id);
const KEY='gpro-debt-freedom-v1';
const rub=cents=>(cents/100).toLocaleString('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:2});
const toCents=value=>{
  if(value===''||!Number.isFinite(Number(value))||Number(value)<0||Number(value)>1e12)return null;
  const n=Math.round(Number(value)*100);
  return Number.isSafeInteger(n)?n:null;
};
function valid(item){return item&&typeof item.id==='string'&&item.id.length>0&&item.id.length<=120&&typeof item.name==='string'&&item.name.trim().length>0&&item.name.length<=80&&Number.isSafeInteger(item.amount)&&item.amount>0&&item.amount<=1e14&&Number.isSafeInteger(item.payment)&&item.payment>=0&&item.payment<=1e14&&(item.target===undefined||(Number.isSafeInteger(item.target)&&item.target>=0&&item.target<=1e14))&&(item.rate===undefined||(typeof item.rate==='number'&&Number.isFinite(item.rate)&&item.rate>=0&&item.rate<=100))&&(item.due===undefined||item.due===''||validDate(item.due));}
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
  $('debtCount').textContent=String(debts.length);
  $('listCount').textContent=debts.length+' шт.';
  const tips=$('guidance');tips.replaceChildren();
  if(!debts.length){tips.append(el('p','Добавь первый долг — здесь появятся рекомендации по его погашению.','muted'));}
  for(const d of debts){
    const tip=el('article','','advice-item');tip.append(el('strong',d.name));
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
    const name=el('strong',debt.name);const remove=el('button','Удалить','button danger');remove.type='button';remove.setAttribute('aria-label','Удалить '+debt.name);
    remove.addEventListener('click',()=>{
      if(!confirm('Удалить обязательство «'+debt.name+'»?'))return;
      const next=debts.filter(d=>d.id!==debt.id);
      if(!persist(next))return;debts=next;render();
    });
    header.append(name,remove);
    const figures=el('div','','debt-figures');const amount=el('span','Остаток: ');amount.append(el('b',rub(debt.amount)));
    const pay=el('span',debt.payment>0?'Обязательный платёж/мес.: ':'Без обязательного платежа');if(debt.payment>0)pay.append(el('b',rub(debt.payment)));figures.append(amount,pay);
    if(debt.target>0&&!debt.payment){const voluntary=el('span','Добровольный план: ');voluntary.append(el('b',rub(debt.target)+'/мес.'));figures.append(voluntary);}
    if(typeof debt.rate==='number'){figures.append(el('span','Ставка: '+debt.rate.toLocaleString('ru-RU')+'% годовых'));}
    if(debt.due){figures.append(el('span','Вернуть к: '+new Date(debt.due+'T12:00:00').toLocaleDateString('ru-RU')));}
    item.append(header,figures);list.append(item);
  }
}
function persist(next){
  try{if(storageProblem)throw new Error('blocked');localStorage.setItem(KEY,JSON.stringify(next));$('formError').textContent='';return true;}
  catch{$('formError').textContent='Не удалось сохранить данные. Проверь хранилище браузера.';return false;}
}
$('debtForm').addEventListener('submit',event=>{
  event.preventDefault();
  const name=$('debtName').value.trim(),amount=toCents($('debtAmount').value),payment=$('debtPayment').value===''?0:toCents($('debtPayment').value);
  const target=$('debtTarget').value===''?0:toCents($('debtTarget').value);
  const due=$('debtDue').value;
  const rateText=$('debtRate').value,rate=rateText===''?undefined:Number(rateText);
  if(!name||name.length>80||amount===null||amount===0||payment===null||target===null||(rate!==undefined&&(!Number.isFinite(rate)||rate<0||rate>100))||(due&&!validDate(due))){$('formError').textContent='Проверь название, сумму долга и платёж.';return;}
  if(debts.length>=2000){$('formError').textContent='Достигнут лимит обязательств.';return;}
  const debt={id:globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2),name,amount,payment,target,...(rate===undefined?{}:{rate}),...(due?{due}:{})};
  const next=[...debts,debt];if(!persist(next))return;debts=next;$('debtForm').reset();render();$('debtName').focus();
});
render();