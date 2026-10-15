'use strict';
const $=id=>document.getElementById(id);
const KEY='gpro-financial-calendar-v1', BALANCE_KEY='gpro-financial-calendar-opening-v1';
const fmt=n=>(n/100).toLocaleString('ru-RU',{style:'currency',currency:'RUB',minimumFractionDigits:0,maximumFractionDigits:2});
const today=new Date(),dateKey=(y,m,d)=>String(y)+'-'+String(m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
const todayKey=dateKey(today.getFullYear(),today.getMonth(),today.getDate());
const validDate=s=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const [y,m,d]=s.split('-').map(Number);const t=new Date(y,m-1,d);return y>=1900&&y<=2100&&t.getFullYear()===y&&t.getMonth()===m-1&&t.getDate()===d;};
const validItem=x=>x&&typeof x.id==='string'&&x.id.length>0&&x.id.length<=120&&typeof x.name==='string'&&x.name.trim().length>0&&x.name.length<=80&&['income','expense'].includes(x.type)&&Number.isSafeInteger(x.cents)&&x.cents>0&&x.cents<=100000000000&&validDate(x.date)&&(x.skips===undefined||(Array.isArray(x.skips)&&x.skips.length<=2000&&x.skips.every(validDate)&&new Set(x.skips).size===x.skips.length))&&(x.repeat===undefined||['once','monthly','weekly'].includes(x.repeat));
let entries=[],storageLocked=false,editingId=null;
try{const raw=localStorage.getItem(KEY);if(raw!==null){const data=JSON.parse(raw);if(!Array.isArray(data)||data.length>1000||!data.every(validItem)||new Set(data.map(x=>x.id)).size!==data.length)throw Error('corrupt');entries=data;}}catch{storageLocked=true;}
let viewYear=today.getFullYear(),viewMonth=today.getMonth(),selected=todayKey;
let openingBalances={},balanceLocked=false;
try{const raw=localStorage.getItem(BALANCE_KEY);if(raw!==null){const data=JSON.parse(raw);if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).length>2400||!Object.entries(data).every(([k,v])=>/^(19\d\d|20\d\d|2100)-(0[1-9]|1[0-2])$/.test(k)&&Number.isSafeInteger(v)&&v>=0&&v<=1e11))throw Error('invalid');openingBalances=data;}}catch{balanceLocked=true;}
$('entryDate').value=todayKey;
const monthText=(y,m)=>new Intl.DateTimeFormat('ru-RU',{month:'long',year:'numeric'}).format(new Date(y,m,1));
const dayText=s=>new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric'}).format(new Date(s+'T12:00:00'));
function save(next){if(storageLocked){$('formError').textContent='В браузере обнаружены повреждённые сохранённые данные. Новые записи заблокированы во избежание потери старых.';return false;}try{localStorage.setItem(KEY,JSON.stringify(next));entries=next;return true;}catch{$('formError').textContent='Не удалось сохранить данные. Проверь свободное место и настройки браузера.';return false;}}
function occurrencesForMonth(y,m){
 const first=dateKey(y,m,1),lastDay=new Date(y,m+1,0).getDate(),prefix=first.slice(0,7);
 return entries.flatMap(item=>{
  if(item.repeat==='weekly'){const start=new Date(item.date+'T12:00:00'),firstDate=new Date(first+'T12:00:00');let offset=Math.max(0,Math.ceil((firstDate-start)/86400000/7));const results=[];for(let k=offset;k<offset+6;k++){const d=new Date(start);d.setDate(start.getDate()+7*k);const key=dateKey(d.getFullYear(),d.getMonth(),d.getDate());if(key.startsWith(prefix)&&key>=item.date&&!(item.skips||[]).includes(key))results.push({...item,date:key,originId:item.id,recurring:true});if(d.getFullYear()>y||(d.getFullYear()===y&&d.getMonth()>m))break;}return results;}
  if(item.repeat!=='monthly')return item.date.startsWith(prefix)?[{...item,originId:item.id,recurring:false}]:[];
  if(item.date>dateKey(y,m,lastDay))return [];
  const sourceDay=Number(item.date.slice(8));
  const day=Math.min(sourceDay,lastDay);
  const occurrence=dateKey(y,m,day);return (item.skips||[]).includes(occurrence)?[]:[{...item,date:occurrence,originId:item.id,recurring:true}];
 });
}
function monthKey(){return dateKey(viewYear,viewMonth,1).slice(0,7);}
function forecast(monthEntries){
 const key=monthKey(),opening=openingBalances[key],input=$('openingBalance');
 input.value=opening===undefined?'':(opening/100).toFixed(2);
 const end=$('closingBalance'),minimum=$('minimumBalance'),notice=$('forecastNotice');
 if(opening===undefined){end.textContent='—';minimum.textContent='—';notice.textContent=balanceLocked?'Данные начальных остатков повреждены — сохранение заблокировано.':'Введи начальную сумму месяца, чтобы увидеть прогноз.';return;}
 let balance=opening,min=balance,lowDay='';
 const count=new Date(viewYear,viewMonth+1,0).getDate();
 for(let day=1;day<=count;day++){
  const date=dateKey(viewYear,viewMonth,day);
  for(const item of monthEntries)if(item.date===date)balance+=item.type==='income'?item.cents:-item.cents;
  if(balance<min){min=balance;lowDay=date;}
 }
 end.textContent=fmt(balance);minimum.textContent=fmt(min);
 end.classList.toggle('negative',balance<0);minimum.classList.toggle('negative',min<0);
 notice.textContent=min<0?'Внимание: по плану денег не хватит'+(lowDay?' к '+dayText(lowDay):'')+'. Возможный дефицит: '+fmt(-min)+'.':min===0?'Минимальный остаток равен нулю. Не забывай про незапланированные траты.':'По внесённым событиям отрицательного остатка не ожидается.';
}
$('openingBalance').addEventListener('change',()=>{
 if(balanceLocked){$('forecastNotice').textContent='Хранилище начальных остатков повреждено, изменения заблокированы.';return;}
 const raw=$('openingBalance').value.trim(),key=monthKey();
 if(raw!==''&&(!Number.isFinite(Number(raw))||Number(raw)<0||Number(raw)>1e9||!Number.isSafeInteger(Math.round(Number(raw)*100)))){$('forecastNotice').textContent='Укажи сумму от 0 до 1 млрд ₽.';return;}
 const next={...openingBalances};
 if(raw==='')delete next[key];else next[key]=Math.round(Number(raw)*100);
 try{localStorage.setItem(BALANCE_KEY,JSON.stringify(next));openingBalances=next;render();}catch{$('forecastNotice').textContent='Не удалось сохранить остаток в браузере.';}
});
function render(){
 $('monthTitle').textContent=monthText(viewYear,viewMonth);
 $('jumpMonth').value=monthKey();
 const monthEntries=occurrencesForMonth(viewYear,viewMonth);
 forecast(monthEntries);
 const income=monthEntries.filter(x=>x.type==='income').reduce((n,x)=>n+x.cents,0),expense=monthEntries.filter(x=>x.type==='expense').reduce((n,x)=>n+x.cents,0);
 $('totalIncome').textContent=fmt(income);$('totalExpense').textContent=fmt(expense);
 $('totalBalance').textContent=fmt(income-expense);$('totalBalance').classList.toggle('negative',income<expense);
 const root=$('calendarGrid');root.replaceChildren();
 const first=(new Date(viewYear,viewMonth,1).getDay()+6)%7;
 const days=new Date(viewYear,viewMonth+1,0).getDate();
 for(let blank=0;blank<first;blank++){const e=document.createElement('div');e.className='day outside';e.setAttribute('aria-hidden','true');root.append(e);}
 for(let d=1;d<=days;d++){
  const key=dateKey(viewYear,viewMonth,d),daily=monthEntries.filter(x=>x.date===key);
  const inc=daily.filter(x=>x.type==='income').length,exp=daily.length-inc;
  const b=document.createElement('button');b.type='button';b.className='day';if(key===todayKey)b.classList.add('today');if(key===selected)b.classList.add('selected');
  b.setAttribute('aria-pressed',String(key===selected));b.setAttribute('aria-label',dayText(key)+', поступлений: '+inc+', платежей: '+exp);
  const num=document.createElement('span');num.className='day-number';num.textContent=d;b.append(num);
  if(daily.length){const tags=document.createElement('span');tags.className='day-tags';if(inc){const a=document.createElement('span');a.className='mini inc';a.textContent='+'+inc;tags.append(a);}if(exp){const a=document.createElement('span');a.className='mini exp';a.textContent='−'+exp;tags.append(a);}b.append(tags);}
  b.addEventListener('click',()=>{selected=key;$('entryDate').value=key;render();});root.append(b);
 }
 $('selectedDayTitle').textContent=dayText(selected);
 const dayEntries=monthEntries.filter(x=>x.date===selected).sort((a,b)=>a.type.localeCompare(b.type,'ru')||a.name.localeCompare(b.name,'ru'));
 $('eventsCount').textContent=dayEntries.length+' '+(dayEntries.length===1?'событие':'событий');
 const list=$('dayEvents');list.replaceChildren();
 if(!dayEntries.length){const p=document.createElement('p');p.className='empty';p.textContent='На выбранную дату событий нет.';list.append(p);}
 for(const item of dayEntries){const row=document.createElement('article');row.className='event';const main=document.createElement('div');main.className='event-main';const title=document.createElement('strong');title.className='event-name';title.textContent=item.name;const type=document.createElement('span');type.className='event-meta';type.textContent=(item.type==='income'?'Поступление':'Платёж')+(item.recurring?(item.repeat==='weekly'?' · Каждую неделю':' · Каждый месяц'):'');main.append(title,type);const ctr=document.createElement('div');ctr.className='event-controls';const amount=document.createElement('span');amount.className='amount '+item.type;amount.textContent=(item.type==='income'?'+':'−')+fmt(item.cents);const del=document.createElement('button');del.className='delete';del.type='button';del.textContent=item.recurring?'Удалить серию':'Удалить';del.setAttribute('aria-label',(item.recurring?'Удалить все будущие повторения «':'Удалить событие «')+item.name+'»');del.addEventListener('click',()=>{if(!confirm(item.recurring?'Удалить регулярное событие «'+item.name+'» целиком, включая все месяцы?':'Удалить событие «'+item.name+'»?'))return;if(save(entries.filter(x=>x.id!==item.originId)))render();});const edit=document.createElement('button');edit.className='edit';edit.type='button';edit.textContent=item.recurring?'Изменить серию':'Изменить';edit.addEventListener('click',()=>beginEdit(item.originId));ctr.append(amount,edit);if(item.recurring){const skip=document.createElement('button');skip.className='edit';skip.type='button';skip.textContent='Пропустить дату';skip.setAttribute('aria-label','Пропустить '+dayText(item.date)+' для «'+item.name+'»');skip.addEventListener('click',()=>{if(!confirm('Пропустить только '+dayText(item.date)+' для «'+item.name+'»?'))return;const next=entries.map(e=>e.id===item.originId?{...e,skips:[...new Set([...(e.skips||[]),item.date])]}:e);if(save(next))render();});ctr.append(skip);}ctr.append(del);row.append(main,ctr);list.append(row);}
}
function resetEditor(){editingId=null;$('editorKicker').textContent='Новая запись';$('editorTitle').textContent='Запланировать событие';$('submitLabel').textContent='Добавить в календарь';$('cancelEdit').hidden=true;document.querySelector('.editor').classList.remove('editing');$('formError').textContent='';}
function beginEdit(id){const item=entries.find(x=>x.id===id);if(!item)return;editingId=id;$('entryName').value=item.name;$('entryAmount').value=(item.cents/100).toFixed(2);$('entryType').value=item.type;$('entryDate').value=item.date;$('entryRepeat').value=item.repeat||'once';$('editorKicker').textContent='Редактирование';$('editorTitle').textContent='Изменить '+(item.repeat&&item.repeat!=='once'?'всю серию':'событие');$('submitLabel').textContent='Сохранить изменения';$('cancelEdit').hidden=false;document.querySelector('.editor').classList.add('editing');document.querySelector('.editor').scrollIntoView({behavior:'smooth',block:'center'});$('entryName').focus();}
$('cancelEdit').addEventListener('click',()=>{resetEditor();$('entryName').value='';$('entryAmount').value='';$('entryDate').value=selected;});
$('entryForm').addEventListener('submit',e=>{e.preventDefault();$('formError').textContent='';const name=$('entryName').value.trim(),number=Number($('entryAmount').value),cents=Math.round(number*100),date=$('entryDate').value,type=$('entryType').value,repeat=$('entryRepeat').value;
 if(!name||name.length>80||$('entryAmount').value===''||!Number.isFinite(number)||number<=0||number>1e9||!Number.isSafeInteger(cents)||cents<1||!validDate(date)||!['income','expense'].includes(type)||!['once','monthly','weekly'].includes(repeat)||(!editingId&&entries.length>=1000)){$('formError').textContent='Проверь название, сумму и дату. Максимум 1000 событий.';return;}
 const previous=editingId?entries.find(x=>x.id===editingId):null;
 const entry={id:previous?.id||globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2),name,cents,date,type,repeat};
 if(previous&&previous.date===date&&previous.repeat===repeat&&previous.skips)entry.skips=previous.skips;
 if(!save(previous?entries.map(x=>x.id===previous.id?entry:x):[...entries,entry]))return;
 resetEditor();
 const [year,month]=date.split('-').map(Number);viewYear=year;viewMonth=month-1;selected=date;$('entryName').value='';$('entryAmount').value='';render();$('entryName').focus();
});
function pickMonth(y,m){if(!Number.isInteger(y)||y<1900||y>2100||!Number.isInteger(m)||m<0||m>11)return;viewYear=y;viewMonth=m;selected=dateKey(y,m,1);$('entryDate').value=selected;render();}
$('jumpMonth').addEventListener('change',()=>{const v=$('jumpMonth').value;if(!/^(19\d{2}|20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(v))return;const [y,m]=v.split('-').map(Number);pickMonth(y,m-1);});
$('planSelected').addEventListener('click',()=>{$('entryDate').value=selected;$('entryName').focus();$('entryForm').scrollIntoView({behavior:'smooth',block:'center'});});
function shiftMonth(delta){const d=new Date(viewYear,viewMonth+delta,1);if(d.getFullYear()<1900||d.getFullYear()>2100)return;pickMonth(d.getFullYear(),d.getMonth());}
$('prevMonth').addEventListener('click',()=>shiftMonth(-1));$('nextMonth').addEventListener('click',()=>shiftMonth(1));$('todayMonth').addEventListener('click',()=>{viewYear=today.getFullYear();viewMonth=today.getMonth();selected=todayKey;$('entryDate').value=todayKey;render();});
if(storageLocked)$('formError').textContent='Не удалось загрузить ранее сохранённые записи. Добавление заблокировано, чтобы не потерять их.';
render();