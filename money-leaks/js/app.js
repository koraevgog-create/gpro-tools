'use strict';
const $=id=>document.getElementById(id),KEY='gpro-money-leaks-v1';
const rub=c=>(c/100).toLocaleString('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:2});
const frequency={day:365,week:52,month:12,year:1},names={day:'ежедневно',week:'раз в неделю',month:'ежемесячно',year:'раз в год'};
const categories={food:'Еда и напитки',subscription:'Подписки',transport:'Транспорт',shopping:'Покупки',entertainment:'Развлечения',other:'Другое'};
function valid(o){return o&&typeof o.id==='string'&&o.id.length>0&&typeof o.name==='string'&&o.name.trim().length>0&&o.name.length<=70&&Number.isSafeInteger(o.amount)&&o.amount>0&&o.amount<=1e9&&Object.hasOwn(frequency,o.frequency)&&Object.hasOwn(categories,o.category)&&(o.count===undefined||(Number.isInteger(o.count)&&o.count>=1&&o.count<=365));}
const cents=s=>{if(s===''||!Number.isFinite(Number(s))||Number(s)<=0||Number(s)>1e7)return null;const n=Math.round(Number(s)*100);return Number.isSafeInteger(n)&&n>0&&n<=1e9?n:null;};
let items=[];try{const value=JSON.parse(localStorage.getItem(KEY)||'[]');if(Array.isArray(value)&&value.length<=1000&&value.every(valid)&&new Set(value.map(x=>x.id)).size===value.length)items=value;else throw Error('invalid');}catch{$('formError').textContent='Сохранённые данные не удалось загрузить. Чтобы не потерять их, изменения заблокированы.';}
let storageIssue=Boolean($('formError').textContent),cut=10;
function persist(next){if(storageIssue){$('formError').textContent='Сохранение заблокировано: проверь сохранённые данные.';return false;}try{localStorage.setItem(KEY,JSON.stringify(next));return true;}catch{$('formError').textContent='Браузер не смог сохранить изменения.';return false;}}
const annual=item=>annual(item)*(item.count??1);
function totals(){return items.reduce((sum,item)=>sum+annual(item),0);}
function renderCategories(){
 const root=$('categoryBreakdown');root.replaceChildren();
 const totalsByCategory=Object.keys(categories).map(key=>({key,name:categories[key],year:items.filter(x=>x.category===key).reduce((sum,x)=>sum+annual(x),0)})).filter(x=>x.year>0).sort((a,b)=>b.year-a.year);
 const grand=totalsByCategory.reduce((sum,x)=>sum+x.year,0);
 if(!grand){const empty=document.createElement('p');empty.className='muted';empty.textContent='Добавь расходы, чтобы увидеть структуру.';root.append(empty);return;}
 for(const group of totalsByCategory){
  const row=document.createElement('div');row.className='category-row';
  const heading=document.createElement('div');heading.className='category-heading';
  const title=document.createElement('strong');title.textContent=group.name;
  const value=document.createElement('span');value.textContent=rub(group.year)+' / год · '+(group.year/grand*100).toLocaleString('ru-RU',{maximumFractionDigits:1})+'%';
  const track=document.createElement('div');track.className='category-track';
  const fill=document.createElement('span');fill.style.width=(group.year/grand*100)+'%';
  track.append(fill);heading.append(title,value);row.append(heading,track);root.append(row);
 }
}
function resetEditor(){
 $('editingId').value='';$('formTitle').textContent='Добавить привычную трату';
 $('submitExpense').textContent='Добавить расход';$('cancelEdit').hidden=true;
 $('expenseForm').reset();$('itemCount').value='1';$('formError').textContent='';
}
function editExpense(item){
 $('editingId').value=item.id;$('itemName').value=item.name;
 $('itemAmount').value=(item.amount/100).toFixed(2);
 $('itemFrequency').value=item.frequency;$('itemCategory').value=item.category;$('itemCount').value=String(item.count??1);
 $('formTitle').textContent='Изменить расход';$('submitExpense').textContent='Сохранить изменения';
 $('cancelEdit').hidden=false;$('itemName').focus();
 window.scrollTo({top:0,behavior:'smooth'});
}
$('cancelEdit').addEventListener('click',resetEditor);
function render(){const year=totals();renderCategories();$('yearlyTotal').textContent=rub(year);$('monthlyTotal').textContent=rub(Math.round(year/12));$('expenseCount').textContent=items.length;
const first=[...items].sort((a,b)=>annual(b)-annual(a))[0];$('insight').textContent=first?'Больше всего в этом списке за год уходит на «'+first.name+'»: '+rub(first.amount*frequency[first.frequency])+'. Подумай, насколько эта трата тебе полезна.':'Добавь хотя бы одну трату, чтобы увидеть её реальную стоимость.';
const filter=$('cutCategory').value;const eligible=items.filter(x=>filter==='all'||x.category===filter);const eligibleYear=eligible.reduce((total,x)=>total+annual(x),0);const yearlySavings=Math.round(eligibleYear*cut/100);$('savedYear').textContent=rub(yearlySavings);$('savedFive').textContent=rub(yearlySavings*5);$('cutExplanation').textContent='Сценарий: сократить '+(filter==='all'?'все указанные расходы':('категорию «'+categories[filter]+'»'))+' на '+cut+'%. База расчёта — '+rub(eligibleYear)+' в год.';
const root=$('expenseList');root.replaceChildren();$('clearItems').hidden=!items.length;
if(!items.length){const p=document.createElement('p');p.className='muted';p.textContent='Список пока пуст.';root.append(p);return;}
for(const item of [...items].sort((a,b)=>annual(b)-annual(a))){const article=document.createElement('article');article.className='item';const info=document.createElement('div'),strong=document.createElement('strong'),p=document.createElement('p');strong.textContent=item.name;p.textContent=categories[item.category]+' · '+rub(item.amount)+' × '+(item.count??1)+' '+names[item.frequency]+' · '+rub(annual(item))+'/год';info.append(strong,p);const actions=document.createElement('div');actions.className='item-actions';const edit=document.createElement('button');edit.type='button';edit.className='button secondary small';edit.textContent='Изменить';edit.addEventListener('click',()=>editExpense(item));const remove=document.createElement('button');remove.type='button';remove.className='button secondary small';remove.textContent='Удалить';remove.addEventListener('click',()=>{const next=items.filter(x=>x.id!==item.id);if(persist(next)){items=next;if($('editingId').value===item.id)resetEditor();render();}});actions.append(edit,remove);article.append(info,actions);root.append(article);}
}
$('expenseForm').addEventListener('submit',event=>{event.preventDefault();$('formError').textContent='';const name=$('itemName').value.trim(),amount=cents($('itemAmount').value),frequencyValue=$('itemFrequency').value,category=$('itemCategory').value,count=Number($('itemCount').value);if(!name||name.length>70||amount===null||!Object.hasOwn(frequency,frequencyValue)||!Object.hasOwn(categories,category)||!Number.isInteger(count)||count<1||count>365||(items.length>=1000&&!$('editingId').value)){$('formError').textContent='Проверь название, сумму и частоту покупки.';return;}const editingId=$('editingId').value;const original=editingId?items.find(x=>x.id===editingId):null;if(editingId&&!original){$('formError').textContent='Редактируемая запись не найдена.';return;}const item={id:original?.id||globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2),name,amount,frequency:frequencyValue,category,count};const next=original?items.map(x=>x.id===editingId?item:x):[...items,item];if(!persist(next))return;items=next;resetEditor();render();$('itemName').focus();});
$('clearItems').addEventListener('click',()=>{if(confirm('Очистить весь список расходов?')){if(persist([])){items=[];resetEditor();render();}}});
$('cutCategory').addEventListener('change',render);
for(const button of document.querySelectorAll('[data-cut]'))button.addEventListener('click',()=>{cut=Number(button.dataset.cut);for(const b of document.querySelectorAll('[data-cut]')){b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',String(b===button));}render();});
for(const b of document.querySelectorAll('[data-cut]'))b.setAttribute('aria-pressed',String(Number(b.dataset.cut)===cut));
render();