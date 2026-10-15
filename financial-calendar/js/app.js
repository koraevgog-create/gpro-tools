'use strict';
const $=id=>document.getElementById(id);
const KEY='gpro-financial-calendar-v1';
const fmt=n=>(n/100).toLocaleString('ru-RU',{style:'currency',currency:'RUB',minimumFractionDigits:0,maximumFractionDigits:2});
const today=new Date(),dateKey=(y,m,d)=>String(y)+'-'+String(m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
const todayKey=dateKey(today.getFullYear(),today.getMonth(),today.getDate());
const validDate=s=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const [y,m,d]=s.split('-').map(Number);const t=new Date(y,m-1,d);return y>=1900&&y<=2100&&t.getFullYear()===y&&t.getMonth()===m-1&&t.getDate()===d;};
const validItem=x=>x&&typeof x.id==='string'&&x.id.length>0&&x.id.length<=120&&typeof x.name==='string'&&x.name.trim().length>0&&x.name.length<=80&&['income','expense'].includes(x.type)&&Number.isSafeInteger(x.cents)&&x.cents>0&&x.cents<=100000000000&&validDate(x.date)&&(x.repeat===undefined||['once','monthly'].includes(x.repeat));
let entries=[],storageLocked=false;
try{const raw=localStorage.getItem(KEY);if(raw!==null){const data=JSON.parse(raw);if(!Array.isArray(data)||data.length>1000||!data.every(validItem)||new Set(data.map(x=>x.id)).size!==data.length)throw Error('corrupt');entries=data;}}catch{storageLocked=true;}
let viewYear=today.getFullYear(),viewMonth=today.getMonth(),selected=todayKey;
$('entryDate').value=todayKey;
const monthText=(y,m)=>new Intl.DateTimeFormat('ru-RU',{month:'long',year:'numeric'}).format(new Date(y,m,1));
const dayText=s=>new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric'}).format(new Date(s+'T12:00:00'));
function save(next){if(storageLocked){$('formError').textContent='В браузере обнаружены повреждённые сохранённые данные. Новые записи заблокированы во избежание потери старых.';return false;}try{localStorage.setItem(KEY,JSON.stringify(next));entries=next;return true;}catch{$('formError').textContent='Не удалось сохранить данные. Проверь свободное место и настройки браузера.';return false;}}
function occurrencesForMonth(y,m){
 const first=dateKey(y,m,1),lastDay=new Date(y,m+1,0).getDate(),prefix=first.slice(0,7);
 return entries.flatMap(item=>{
  if(item.repeat!=='monthly')return item.date.startsWith(prefix)?[{...item,originId:item.id,recurring:false}]:[];
  if(item.date>dateKey(y,m,lastDay))return [];
  const sourceDay=Number(item.date.slice(8));
  const day=Math.min(sourceDay,lastDay);
  return [{...item,date:dateKey(y,m,day),originId:item.id,recurring:true}];
 });
}
function render(){
 $('monthTitle').textContent=monthText(viewYear,viewMonth);
 const monthEntries=occurrencesForMonth(viewYear,viewMonth);
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
  b.addEventListener('click',()=>{selected=key;render();});root.append(b);
 }
 $('selectedDayTitle').textContent=dayText(selected);
 const dayEntries=monthEntries.filter(x=>x.date===selected).sort((a,b)=>a.type.localeCompare(b.type,'ru')||a.name.localeCompare(b.name,'ru'));
 $('eventsCount').textContent=dayEntries.length+' '+(dayEntries.length===1?'событие':'событий');
 const list=$('dayEvents');list.replaceChildren();
 if(!dayEntries.length){const p=document.createElement('p');p.className='empty';p.textContent='На выбранную дату событий нет.';list.append(p);}
 for(const item of dayEntries){const row=document.createElement('article');row.className='event';const main=document.createElement('div');main.className='event-main';const title=document.createElement('strong');title.className='event-name';title.textContent=item.name;const type=document.createElement('span');type.className='event-meta';type.textContent=(item.type==='income'?'Поступление':'Платёж')+(item.recurring?' · Каждый месяц':'');main.append(title,type);const ctr=document.createElement('div');ctr.className='event-controls';const amount=document.createElement('span');amount.className='amount '+item.type;amount.textContent=(item.type==='income'?'+':'−')+fmt(item.cents);const del=document.createElement('button');del.className='delete';del.type='button';del.textContent=item.recurring?'Удалить серию':'Удалить';del.setAttribute('aria-label',(item.recurring?'Удалить все будущие повторения «':'Удалить событие «')+item.name+'»');del.addEventListener('click',()=>{if(!confirm(item.recurring?'Удалить регулярное событие «'+item.name+'» целиком, включая все месяцы?':'Удалить событие «'+item.name+'»?'))return;if(save(entries.filter(x=>x.id!==item.originId)))render();});ctr.append(amount,del);row.append(main,ctr);list.append(row);}
}
$('entryForm').addEventListener('submit',e=>{e.preventDefault();$('formError').textContent='';const name=$('entryName').value.trim(),number=Number($('entryAmount').value),cents=Math.round(number*100),date=$('entryDate').value,type=$('entryType').value,repeat=$('entryRepeat').value;
 if(!name||name.length>80||$('entryAmount').value===''||!Number.isFinite(number)||number<=0||number>1e9||!Number.isSafeInteger(cents)||cents<1||!validDate(date)||!['income','expense'].includes(type)||!['once','monthly'].includes(repeat)||entries.length>=1000){$('formError').textContent='Проверь название, сумму и дату. Максимум 1000 событий.';return;}
 const entry={id:globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2),name,cents,date,type,repeat};
 if(!save([...entries,entry]))return;
 const [year,month]=date.split('-').map(Number);viewYear=year;viewMonth=month-1;selected=date;$('entryName').value='';$('entryAmount').value='';render();$('entryName').focus();
});
function shiftMonth(delta){const d=new Date(viewYear,viewMonth+delta,1);if(d.getFullYear()<1900||d.getFullYear()>2100)return;viewYear=d.getFullYear();viewMonth=d.getMonth();selected=dateKey(viewYear,viewMonth,1);render();}
$('prevMonth').addEventListener('click',()=>shiftMonth(-1));$('nextMonth').addEventListener('click',()=>shiftMonth(1));$('todayMonth').addEventListener('click',()=>{viewYear=today.getFullYear();viewMonth=today.getMonth();selected=todayKey;render();});
if(storageLocked)$('formError').textContent='Не удалось загрузить ранее сохранённые записи. Добавление заблокировано, чтобы не потерять их.';
render();