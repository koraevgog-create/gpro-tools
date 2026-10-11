'use strict';
const $=id=>document.getElementById(id);
const KEY='gpro-debt-freedom-v1';
const rub=cents=>(cents/100).toLocaleString('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:2});
const toCents=value=>{
  if(value===''||!Number.isFinite(Number(value))||Number(value)<0||Number(value)>1e12)return null;
  const n=Math.round(Number(value)*100);
  return Number.isSafeInteger(n)?n:null;
};
function valid(item){return item&&typeof item.id==='string'&&item.id.length>0&&item.id.length<=120&&typeof item.name==='string'&&item.name.trim().length>0&&item.name.length<=80&&Number.isSafeInteger(item.amount)&&item.amount>0&&item.amount<=1e14&&Number.isSafeInteger(item.payment)&&item.payment>=0&&item.payment<=1e14;}
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
    const pay=el('span','Платёж/мес.: ');pay.append(el('b',rub(debt.payment)));figures.append(amount,pay);item.append(header,figures);list.append(item);
  }
}
function persist(next){
  try{if(storageProblem)throw new Error('blocked');localStorage.setItem(KEY,JSON.stringify(next));$('formError').textContent='';return true;}
  catch{$('formError').textContent='Не удалось сохранить данные. Проверь хранилище браузера.';return false;}
}
$('debtForm').addEventListener('submit',event=>{
  event.preventDefault();
  const name=$('debtName').value.trim(),amount=toCents($('debtAmount').value),payment=toCents($('debtPayment').value);
  if(!name||name.length>80||amount===null||amount===0||payment===null){$('formError').textContent='Проверь название, сумму долга и платёж.';return;}
  if(debts.length>=2000){$('formError').textContent='Достигнут лимит обязательств.';return;}
  const debt={id:globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2),name,amount,payment};
  const next=[...debts,debt];if(!persist(next))return;debts=next;$('debtForm').reset();render();$('debtName').focus();
});
render();