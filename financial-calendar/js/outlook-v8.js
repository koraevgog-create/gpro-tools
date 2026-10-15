'use strict';
/* GPRO v0.8.0: read-only three-month perspective. Never writes stored data. */
(()=>{
const $=id=>document.getElementById(id);
const KEY='gpro-financial-calendar-v1';
const money=c=>(c/100).toLocaleString('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:2});
const date=(y,m,d)=>String(y)+'-'+String(m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
const monthName=(y,m)=>new Intl.DateTimeFormat('ru-RU',{month:'long',year:'numeric'}).format(new Date(y,m,1));
const formatDate=s=>new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'short'}).format(new Date(s+'T12:00:00'));
const valid=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s);
function eventsForMonth(items,y,m){
 const first=date(y,m,1),last=new Date(y,m+1,0).getDate(),end=date(y,m,last),out=[];
 for(const e of items){
  if(!valid(e.date)||!Number.isSafeInteger(e.cents)||e.cents<=0||!['income','expense'].includes(e.type))continue;
  const skips=Array.isArray(e.skips)?e.skips:[];
  if(e.repeat==='weekly'){
   const start=new Date(e.date+'T12:00:00'),begin=new Date(first+'T12:00:00');
   const n=Math.max(0,Math.ceil((begin-start)/604800000));
   for(let k=n;k<n+6;k++){
    const d=new Date(start);d.setDate(d.getDate()+k*7);const key=date(d.getFullYear(),d.getMonth(),d.getDate());
    if(key>end)break;
    if(key>=first&&key>=e.date&&!skips.includes(key))out.push({...e,occurs:key});
   }
  }else if(e.repeat==='monthly'){
   if(e.date>end){continue;}
   const day=Math.min(Number(e.date.slice(8)),last),key=date(y,m,day);
   if(key>=e.date&&!skips.includes(key))out.push({...e,occurs:key});
  }else if(e.date>=first&&e.date<=end){out.push({...e,occurs:e.date});}
 }
 return out;
}
function update(){
 const root=$('outlookMonths'),upcoming=$('upcomingPayments');
 if(!root||!upcoming)return;
 root.replaceChildren();upcoming.replaceChildren();
 let items=[];
 try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');if(!Array.isArray(x)||x.length>1000)throw Error('invalid');items=x;}catch{root.textContent='Не удалось прочитать сохранённые события.';upcoming.textContent='Проверь сохранённые данные.';return;}
 const now=new Date(),start=new Date(now.getFullYear(),now.getMonth(),1),next=[];
 for(let i=0;i<3;i++){
  const at=new Date(start.getFullYear(),start.getMonth()+i,1),y=at.getFullYear(),m=at.getMonth(),a=eventsForMonth(items,y,m),inc=a.filter(x=>x.type==='income').reduce((s,x)=>s+x.cents,0),exp=a.filter(x=>x.type==='expense').reduce((s,x)=>s+x.cents,0),net=inc-exp;
  const card=document.createElement('div');card.className='outlook-card';
  const title=document.createElement('strong');title.textContent=monthName(y,m);
  const income=document.createElement('span');income.textContent='Поступления: '+money(inc);
  const expense=document.createElement('span');expense.textContent='Платежи: '+money(exp);
  const total=document.createElement('b');total.className='outlook-net'+(net<0?' negative':'');total.textContent='Разница: '+(net>0?'+':'')+money(net);
  card.append(title,income,expense,total);root.append(card);
  next.push(...a.filter(x=>x.type==='expense'));
 }
 const nowKey=date(now.getFullYear(),now.getMonth(),now.getDate());
 const limit=new Date(now.getFullYear(),now.getMonth(),now.getDate()+30),endKey=date(limit.getFullYear(),limit.getMonth(),limit.getDate());
 const near=next.filter(x=>x.occurs>=nowKey&&x.occurs<=endKey).sort((a,b)=>a.occurs.localeCompare(b.occurs)||a.name.localeCompare(b.name,'ru')).slice(0,8);
 if(!near.length){upcoming.textContent='В ближайшие 30 дней запланированных платежей нет.';return;}
 for(const x of near){const row=document.createElement('div');row.className='upcoming-row';const label=document.createElement('span');label.textContent=formatDate(x.occurs)+' · '+x.name;const sum=document.createElement('strong');sum.textContent=money(x.cents);row.append(label,sum);upcoming.append(row);}
}
document.addEventListener('gpro:calendar-updated',update);
window.addEventListener('storage',e=>{if(e.key===KEY)update();});
update();
})();
