'use strict';const $=id=>document.getElementById(id);const KEY='gpro-buy-or-save-v1';const rub=c=>(c/100).toLocaleString('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:0});const money=v=>{if(v===''||!Number.isFinite(Number(v))||Number(v)<0||Number(v)>1e9)return null;return Math.round(Number(v)*100)};const resultText=(n)=>n===null?'Не рассчитано':n===0?'Сейчас':n===1?'1 месяц':n+' мес.';
function calculate(price,saved,monthly,growth){if([price,saved,monthly].some(x=>!Number.isSafeInteger(x)||x<0||x>1e11)||price<=0||!Number.isFinite(growth)||growth< -30||growth>100)return null;const shortfall=Math.max(price-saved,0);const r=Math.pow(1+growth/100,1/12);let target=price, months=0;const canNow=saved>=price; if(!canNow){let found=false;for(let i=1;i<=600;i++){target=price*Math.pow(r,i);if(!Number.isFinite(target)||target>1e13)break;if(saved+monthly*i>=target){months=i;found=true;break;}}if(!found)months=null;}const future=months===null?null:Math.round(target);const remainder=months===null?null:Math.round(saved+monthly*months-future);return {shortfall,months,future,remainder,price,saved,monthly,growth,progress:Math.min(100,saved/price*100),canNow};}
function show(x){$('shortfall').textContent=rub(x.shortfall);$('months').textContent=x.months===null?'Свыше 50 лет / недостижимо':resultText(x.months);$('futurePrice').textContent=x.future===null?'—':rub(x.future);$('remaining').textContent=x.remainder===null?'—':rub(x.remainder);$('meter').setAttribute('aria-valuenow',String(Math.round(x.progress)));$('fill').style.width=x.progress+'%';$('progressText').textContent='Сейчас накоплено '+x.progress.toLocaleString('ru-RU',{maximumFractionDigits:1})+'% от сегодняшней цены.';$('nowResult').textContent=x.canNow?'Денег хватает. После покупки останется '+rub(x.saved-x.price)+'. Оцени, достаточен ли оставшийся резерв.':'Не хватает '+rub(x.shortfall)+'. Без дополнительных денег оплатить полную стоимость сейчас не получится.';$('waitResult').textContent=x.months===null?'При выбранных параметрах накопление не достигает прогнозируемой цены за 50 лет. Пересмотри ежемесячный взнос или рост цены.':x.months===0?'Покупку уже можно оплатить из накоплений.':'При регулярных взносах потребуется '+resultText(x.months)+'. Прогнозная цена покупки — '+rub(x.future)+'.';$('advice').textContent=x.canNow?'Покупка доступна сегодня. Сравни её важность с резервом, который останется после оплаты.':x.months===null?'При текущих параметрах цель не достигнута в пределах расчёта. Попробуй увеличить взнос или выбрать более доступную альтернативу.':x.months<=3?'До цели относительно недолго. Реши, стоит ли подождать и избежать заимствований.':'Покупка потребует времени. Сопоставь пользу покупки с другими финансовыми целями.';}
const PERSONAL_KEY='gpro-buy-or-save-personal-v1';
let storageLocked=false;
let personalization={one:25,two:50,showLoan:true};
try{const saved=JSON.parse(localStorage.getItem(PERSONAL_KEY)||'null');if(saved&&Number.isInteger(saved.one)&&saved.one>=1&&saved.one<=300&&Number.isInteger(saved.two)&&saved.two>=1&&saved.two<=300&&typeof saved.showLoan==='boolean')personalization=saved;}catch{}
function refreshPersonal(){ $('increaseOne').value=personalization.one;$('increaseTwo').value=personalization.two;$('showLoan').checked=personalization.showLoan;$('loanSection').hidden=!personalization.showLoan; }
function savePersonal(){if(storageLocked||checkStorage()){storageLocked=true;$('personalStatus').textContent='Сохранённые данные требуют восстановления.';return;}try{localStorage.setItem(PERSONAL_KEY,JSON.stringify(personalization));$('personalStatus').textContent='Настройки сохранены.';}catch{$('personalStatus').textContent='Не удалось сохранить настройки браузера.';}}
function showAlternatives(x){
 const root=$('alternativeRows');root.replaceChildren();
 for(const [name,mult] of [['Текущий план',1],['Взнос +'+personalization.one+'%',1+personalization.one/100],['Взнос +'+personalization.two+'%',1+personalization.two/100]]){
  const contribution=Math.round(x.monthly*mult);
  const scenario=calculate(x.price,x.saved,contribution,x.growth);
  const article=document.createElement('article');article.className='alternative-row';
  const heading=document.createElement('div');heading.className='alternative-heading';
  const label=document.createElement('strong');label.textContent=name;
  const amount=document.createElement('span');amount.textContent=rub(contribution)+'/мес.';
  heading.append(label,amount);
  const result=document.createElement('p');
  result.textContent=scenario.months===null?'Цель не достигнута за 50 лет':scenario.months===0?'Можно купить уже сейчас':'Срок: '+resultText(scenario.months)+' · Цена: '+rub(scenario.future);
  if(mult>1){const apply=document.createElement('button');apply.type='button';apply.className='button secondary apply-alternative';apply.textContent='Выбрать этот взнос';apply.setAttribute('aria-label','Установить ежемесячный взнос '+rub(contribution));apply.addEventListener('click',()=>{$('monthly').value=(contribution/100).toFixed(2);$('calculator').requestSubmit();$('monthly').focus();});article.append(heading,result,apply);}else article.append(heading,result);root.append(article);
 }
}
function credit(shortfall,rate,term){if(!Number.isSafeInteger(shortfall)||shortfall<0||!Number.isFinite(rate)||rate<0||rate>100||!Number.isInteger(term)||term<1||term>120)return null;if(shortfall===0)return {payment:0,overpayment:0};const r=rate/1200;const pay=r===0?shortfall/term:shortfall*r/(1-Math.pow(1+r,-term));if(!Number.isFinite(pay))return null;return {payment:Math.round(pay),overpayment:Math.max(0,Math.round(pay*term-shortfall))};}
function showCredit(x){const rate=Number($('loanRate').value),term=Number($('loanTerm').value);const result=$('loanRate').value!==''&&$('loanTerm').value!==''?credit(x.shortfall,rate,term):null;$('loanPayment').textContent=result?rub(result.payment):'—';$('loanOverpayment').textContent=result?rub(result.overpayment):'—';$('loanAdvice').textContent=!result?'Проверь ставку и срок: 0–100% годовых, от 1 до 120 месяцев.':x.shortfall===0?'Для покупки уже хватает собственных средств: кредит на недостающую сумму не нужен.':'Кредит позволит оплатить недостающую часть сейчас, но потребует '+rub(result.payment)+' ежемесячно. Сопоставь этот платёж со своими возможностями и сроком накопления.';}
function read(){const price=money($('price').value),saved=money($('savings').value),monthly=money($('monthly').value),growth=Number($('growth').value);if($('growth').value===''||price===null||saved===null||monthly===null)return null;return calculate(price,saved,monthly,growth)}
$('calculator').addEventListener('submit',e=>{e.preventDefault();const x=read();if(!x){$('error').textContent='Проверь суммы и процент: цена больше нуля, остальные суммы неотрицательные.';return;}$('error').textContent='';$('purchaseTitle').textContent=$('item').value.trim()||'Новая покупка';show(x);showCredit(x);showAlternatives(x);if(storageLocked||checkStorage()){storageLocked=true;$('error').textContent='Сохранение заблокировано до восстановления данных.';return;}try{localStorage.setItem(KEY,JSON.stringify({item:$('item').value.slice(0,75),price:$('price').value,savings:$('savings').value,monthly:$('monthly').value,growth:$('growth').value,loanRate:$('loanRate').value,loanTerm:$('loanTerm').value}));}catch{$('error').textContent='Расчёт выполнен, но сохранить его в браузере не удалось.';}});
$('reset').addEventListener('click',()=>{if(!confirm('Сбросить расчёт к исходным значениям?'))return;$('calculator').reset();try{if(!storageLocked&&!checkStorage())localStorage.removeItem(KEY)}catch{}$('calculator').requestSubmit();});
let liveUpdate=null;for(const id of ['item','price','savings','monthly','growth','loanRate','loanTerm'])$(id).addEventListener('input',()=>{clearTimeout(liveUpdate);liveUpdate=setTimeout(()=>{$('calculator').requestSubmit();},260);});
for(const id of ['loanRate','loanTerm'])$(id).addEventListener('change',()=>{$('calculator').requestSubmit();});
try{const saved=JSON.parse(localStorage.getItem(KEY)||'null');if(saved&&typeof saved==='object'){for(const id of ['item','price','savings','monthly','growth','loanRate','loanTerm'])if(typeof saved[id]==='string')$(id).value=saved[id];}}catch{}
refreshPersonal();
storageLocked=Boolean(checkStorage());
for(const [id,key] of [['increaseOne','one'],['increaseTwo','two']])$(id).addEventListener('change',()=>{
 const v=Number($(id).value);if(!Number.isInteger(v)||v<1||v>300){$('personalStatus').textContent='Укажи целое увеличение от 1 до 300%.';return;}
 personalization[key]=v;savePersonal();$('calculator').requestSubmit();
});
$('showLoan').addEventListener('change',()=>{personalization.showLoan=$('showLoan').checked;refreshPersonal();savePersonal();});
$('resetPersonal').addEventListener('click',()=>{personalization={one:25,two:50,showLoan:true};refreshPersonal();savePersonal();$('calculator').requestSubmit();});
$('calculator').requestSubmit();

/* Level 7: local backup and robust restore. Existing storage keys stay unchanged. */
const INPUT_IDS=['item','price','savings','monthly','growth','loanRate','loanTerm'];
function validPersonal(p){return p&&typeof p==='object'&&Number.isInteger(p.one)&&p.one>=1&&p.one<=300&&Number.isInteger(p.two)&&p.two>=1&&p.two<=300&&typeof p.showLoan==='boolean';}
function validInputs(o){
 if(!o||typeof o!=='object'||typeof o.item!=='string'||o.item.length>75)return false;
 if(!INPUT_IDS.slice(1).every(k=>typeof o[k]==='string'&&o[k].length<=32))return false;
 const p=money(o.price),a=money(o.savings),m=money(o.monthly),g=Number(o.growth);
 const lr=Number(o.loanRate),lt=Number(o.loanTerm);
 return p!==null&&p>0&&a!==null&&m!==null&&o.growth!==''&&Number.isFinite(g)&&g>=-30&&g<=100&&o.loanRate!==''&&Number.isFinite(lr)&&lr>=0&&lr<=100&&o.loanTerm!==''&&Number.isInteger(lt)&&lt>=1&&lt<=120;
}
function snapshotInputs(){const o={};for(const id of INPUT_IDS)o[id]=$(id).value;return o;}
function checkStorage(){
 try{const raw=localStorage.getItem(KEY),p=localStorage.getItem(PERSONAL_KEY);
  if(raw!==null&&!validInputs(JSON.parse(raw)))return 'Сохранённый расчёт содержит некорректные данные.';
  if(p!==null&&!validPersonal(JSON.parse(p)))return 'Сохранённые настройки повреждены.';
  return '';
 }catch{return 'Не удалось проверить данные браузера.';}
}
storageLocked=Boolean(checkStorage());
function showStorageProblem(){if(storageLocked)$('backupStatus').textContent='Внимание: '+checkStorage()+' Запись приостановлена, чтобы не стереть исходные данные.';}
$('validateData').addEventListener('click',()=>{$('backupStatus').textContent=checkStorage()||'Сохранённые данные прошли проверку.';});
$('exportData').addEventListener('click',()=>{
 const issue=checkStorage();if(issue){$('backupStatus').textContent=issue+' Экспорт остановлен.';return;}
 if(!validInputs(snapshotInputs())){$('backupStatus').textContent='Исправь значения в калькуляторе перед экспортом.';return;}
 try{const payload={app:'gpro-buy-or-save',version:1,exportedAt:new Date().toISOString(),inputs:snapshotInputs(),personal:personalization};
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='gpro-buy-or-save-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
 $('backupStatus').textContent='Резервная копия подготовлена к скачиванию.';}catch{$('backupStatus').textContent='Не удалось подготовить файл.';}
});
$('importData').addEventListener('change',async e=>{
 const file=e.target.files?.[0];e.target.value='';if(!file)return;
 if(file.size>1024*1024){$('backupStatus').textContent='Файл превышает 1 МБ.';return;}
 let data;try{data=JSON.parse(await file.text());}catch{$('backupStatus').textContent='Не удалось прочитать JSON-файл.';return;}
 if(!data||data.app!=='gpro-buy-or-save'||data.version!==1||!validInputs(data.inputs)||!validPersonal(data.personal)){$('backupStatus').textContent='Неверный формат резервной копии. Данные не изменены.';return;}
 if(!confirm('Восстановить расчёт и настройки из файла? Текущие данные будут заменены.'))return;
 const keys=[KEY,PERSONAL_KEY],prev=[];
 try{
  for(const key of keys)prev.push(localStorage.getItem(key));
  const next=[JSON.stringify(data.inputs),JSON.stringify(data.personal)];
  try{keys.forEach((key,i)=>localStorage.setItem(key,next[i]));}
  catch(err){let rolledBack=true;for(let i=0;i<keys.length;i++)try{if(prev[i]===null)localStorage.removeItem(keys[i]);else localStorage.setItem(keys[i],prev[i]);}catch{rolledBack=false;}throw Error(rolledBack?'write':'rollback');}
 }catch(err){$('backupStatus').textContent=err.message==='rollback'?'Не удалось полностью вернуть прежние данные. Не закрывай страницу.':'Ошибка сохранения. Попытка восстановления отменена.';return;}
 for(const id of INPUT_IDS)$(id).value=data.inputs[id];personalization=data.personal;storageLocked=false;refreshPersonal();$('calculator').requestSubmit();$('backupStatus').textContent='Расчёт и настройки восстановлены.';
});
showStorageProblem();
