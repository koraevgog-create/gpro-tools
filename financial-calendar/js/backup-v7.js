'use strict';
/* Standalone backup module; does not change calendar data unless restoration is confirmed. */
(()=>{
const DATA='gpro-financial-calendar-v1', BAL='gpro-financial-calendar-opening-v1';
const el=id=>document.getElementById(id),status=message=>{el('backupStatus').textContent=message;};
const dateValid=s=>{if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const [y,m,d]=s.split('-').map(Number);const t=new Date(y,m-1,d);return y>=1900&&y<=2100&&t.getFullYear()===y&&t.getMonth()===m-1&&t.getDate()===d;};
const entryValid=x=>x&&typeof x.id==='string'&&x.id.length>0&&x.id.length<=120&&typeof x.name==='string'&&x.name.trim().length>0&&x.name.length<=80&&['expense','income'].includes(x.type)&&Number.isSafeInteger(x.cents)&&x.cents>0&&x.cents<=1e11&&dateValid(x.date)&&[undefined,'once','weekly','monthly'].includes(x.repeat)&&(x.skips===undefined||(Array.isArray(x.skips)&&x.skips.length<=2000&&x.skips.every(dateValid)&&new Set(x.skips).size===x.skips.length));
const entriesValid=a=>Array.isArray(a)&&a.length<=1000&&a.every(entryValid)&&new Set(a.map(x=>x.id)).size===a.length;
const balancesValid=b=>b&&typeof b==='object'&&!Array.isArray(b)&&Object.keys(b).length<=2400&&Object.entries(b).every(([k,v])=>/^(19\d\d|20\d\d|2100)-(0[1-9]|1[0-2])$/.test(k)&&Number.isSafeInteger(v)&&v>=0&&v<=1e11);
const parse=(raw,fallback)=>raw===null?fallback:JSON.parse(raw);
el('exportBackup').addEventListener('click',()=>{
 try{
 const entries=parse(localStorage.getItem(DATA),[]),balances=parse(localStorage.getItem(BAL),{});
 if(!entriesValid(entries)||!balancesValid(balances))throw Error('Сохранённые данные повреждены — экспорт отменён.');
 const backup={format:'gpro-financial-calendar-backup',version:1,createdAt:new Date().toISOString(),entries,openingBalances:balances};
 const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download='gpro-calendar-backup-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 status('Резервная копия сформирована. Сохрани файл в надёжном месте.');
 }catch(e){status('Ошибка экспорта: '+e.message);}
});
el('importBackup').addEventListener('change',async event=>{
 const file=event.target.files?.[0];event.target.value='';if(!file)return;
 try{
 if(file.size>3000000)throw Error('Файл слишком большой (максимум 3 МБ).');
 const obj=JSON.parse(await file.text());
 if(!obj||obj.format!=='gpro-financial-calendar-backup'||obj.version!==1||!entriesValid(obj.entries)||!balancesValid(obj.openingBalances))throw Error('Формат или данные резервной копии не прошли проверку.');
 const currentEntries=localStorage.getItem(DATA),currentBalances=localStorage.getItem(BAL);
 if(!confirm('Восстановить '+obj.entries.length+' записей и начальные остатки из файла? Текущие данные будут заменены. Рекомендуем сначала скачать их резервную копию.')){status('Импорт отменён. Текущие данные не изменены.');return;}
 try{
 localStorage.setItem(DATA,JSON.stringify(obj.entries));
 localStorage.setItem(BAL,JSON.stringify(obj.openingBalances));
 }catch(e){
 try{if(currentEntries===null)localStorage.removeItem(DATA);else localStorage.setItem(DATA,currentEntries);if(currentBalances===null)localStorage.removeItem(BAL);else localStorage.setItem(BAL,currentBalances);}catch{}
 throw Error('Не удалось сохранить резервную копию. Возможно, недостаточно места в браузере.');
 }
 status('Данные восстановлены. Обновляем календарь…');location.reload();
 }catch(e){status('Импорт не выполнен: '+e.message);}
});
})();
