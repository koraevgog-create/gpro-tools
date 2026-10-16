'use strict';
(()=>{
const $=id=>document.getElementById(id),PLAN='gpro-paycheck-plan-v1',OLD='gpro-paycheck-advanced-v1';
const money=c=>(c/100).toLocaleString('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:2});
const validDate=s=>{if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const [y,m,d]=s.split('-').map(Number),t=new Date(y,m-1,d);return y>=1900&&y<=2100&&t.getFullYear()===y&&t.getMonth()===m-1&&t.getDate()===d;};
const safeMoney=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1e9;
const validPlan=p=>p&&typeof p==='object'&&!Array.isArray(p)&&['available','bills','reserve'].every(k=>safeMoney(p[k]))&&validDate(p.payday);
function daysLeft(s){if(!validDate(s))return 0;const [y,m,d]=s.split('-').map(Number),n=new Date();return Math.round((Date.UTC(y,m-1,d)-Date.UTC(n.getFullYear(),n.getMonth(),n.getDate()))/86400000);}
function readPlan(){try{const p=JSON.parse(localStorage.getItem(PLAN)||'null');return validPlan(p)?p:null;}catch{return null;}}
function render(){const p=readPlan(),root=$('scenarios');root.replaceChildren();const advice=$('shortageAdvice'),days=p?daysLeft(p.payday):0;
if(!p||days<1||days>366){root.textContent='Заполни основной план с будущей датой зарплаты.';advice.textContent='Укажи остаток, платежи, резерв и дату зарплаты, чтобы получить рекомендации.';advice.classList.remove('warn');return;}
const free=Math.round(p.available*100)-Math.round(p.bills*100)-Math.round(p.reserve*100),daily=Math.floor(Math.max(0,free)/days);
for(const percentage of [0,10,20,30]){const spent=Math.floor(daily*(100-percentage)/100),remaining=free-spent*days,box=document.createElement('div');box.className='scenario-mini';const title=document.createElement('span');title.textContent=percentage?'Лимит на '+percentage+'% ниже':'Текущий ориентир';const value=document.createElement('strong');value.textContent=money(spent)+' / день';const saving=document.createElement('small');saving.textContent=free<0?'Дефицит: '+money(-remaining):'Останется к зарплате: '+money(Math.max(0,remaining));box.append(title,value,saving);root.append(box);}
advice.classList.toggle('warn',free<0);advice.textContent=free<0?'Не хватает '+money(-free)+' на обязательные платежи и резерв. Чтобы закрыть дефицит за '+days+' дн., нужно найти или высвободить примерно '+money(Math.ceil(-free/days))+' в день.':free===0?'Свободных средств после обязательств нет. Не планируй дополнительные расходы без изменения плана.':'Если придерживаться лимита '+money(daily)+' в день, распределения средств должно хватить до зарплаты с учётом введённых обязательств.';
}
document.addEventListener('gpro:paycheck-updated',render);
$('quickForm').addEventListener('submit',e=>{e.preventDefault();const p=readPlan(),value=$('quickAmount').value,number=Number(value);
if(!p){$('quickStatus').textContent='Сначала сохрани основной план.';return;}if(!value||!Number.isFinite(number)||number<=0||number>1e9||Math.round(number*100)<1){$('quickStatus').textContent='Укажи сумму больше нуля.';return;}
const sign=$('quickType').value==='expense'?-1:1;
const next=Math.round(p.available*100)+sign*Math.round(number*100);
if(next<0||next>1e11){$('quickStatus').textContent='Получается отрицательный остаток или сумма выше допустимого предела. Уточни текущий остаток вручную.';return;}
const amount=next/100;const oldValue=$('available').value;$('available').value=amount.toFixed(2);$('plan').requestSubmit();
if($('error').textContent){$('available').value=oldValue;$('quickStatus').textContent='Сначала исправь ошибки в основном плане.';return;}
$('quickAmount').value='';$('quickStatus').textContent='Остаток обновлён: '+money(next)+'. Дневной лимит пересчитан.';render();
});
$('downloadBackup').addEventListener('click',()=>{
try{const planRaw=localStorage.getItem(PLAN),oldRaw=localStorage.getItem(OLD),plan=planRaw===null?null:JSON.parse(planRaw),legacy=oldRaw===null?null:JSON.parse(oldRaw);if(plan!==null&&!validPlan(plan))throw Error('Основной план повреждён.');if(legacy!==null&&(typeof legacy!=='object'||Array.isArray(legacy)))throw Error('Архив операций повреждён.');
const payload={format:'gpro-paycheck-backup',version:2,createdAt:new Date().toISOString(),plan,legacy};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='gpro-paycheck-backup-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);$('backupStatus').textContent='Копия сформирована, включая старые записи при их наличии.';
}catch(e){$('backupStatus').textContent='Не удалось создать копию: '+e.message;}
});
$('restoreBackup').addEventListener('change',async e=>{
const file=e.target.files?.[0];e.target.value='';if(!file)return;
try{if(file.size>3000000)throw Error('Размер файла превышает 3 МБ.');const b=JSON.parse(await file.text());if(!b||b.format!=='gpro-paycheck-backup'||![1,2].includes(b.version))throw Error('Неверный формат файла.');
const plan=b.plan??null;if(plan!==null&&!validPlan(plan))throw Error('Некорректные данные плана.');
const legacy=b.version===2?b.legacy:(Array.isArray(b.transactions)&&Array.isArray(b.bills)?{transactions:b.transactions,bills:b.bills}:null);
if(legacy!==null&&(!legacy||typeof legacy!=='object'||Array.isArray(legacy)||!Array.isArray(legacy.transactions)||!Array.isArray(legacy.bills)||legacy.transactions.length>1000||legacy.bills.length>500))throw Error('Некорректный архив записей.');
if(!confirm('Восстановить данные? Текущий план будет заменён. Сначала рекомендуем скачать действующую резервную копию.'))return;
const previousPlan=localStorage.getItem(PLAN),previousLegacy=localStorage.getItem(OLD);
try{if(plan===null)localStorage.removeItem(PLAN);else localStorage.setItem(PLAN,JSON.stringify(plan));if(legacy!==null)localStorage.setItem(OLD,JSON.stringify(legacy));}
catch{try{if(previousPlan===null)localStorage.removeItem(PLAN);else localStorage.setItem(PLAN,previousPlan);if(previousLegacy===null)localStorage.removeItem(OLD);else localStorage.setItem(OLD,previousLegacy);}catch{}throw Error('Не удалось сохранить восстановленные данные.');}
location.reload();
}catch(err){$('backupStatus').textContent='Восстановление отменено: '+err.message;}
});
window.addEventListener('storage',e=>{if(e.key===PLAN)render();});
render();
})();