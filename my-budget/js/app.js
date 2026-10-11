'use strict';

const $ = id => document.getElementById(id);
const KEY = 'gpro-my-budget-v1'; // Retain the v1 key to preserve existing transactions.
const LIMIT_KEY = 'gpro-my-budget-limits-v1';
const PLAN_KEY = 'gpro-my-budget-plans-v1';
const RECUR_KEY = 'gpro-my-budget-recurring-v1';
const PREF_KEY = 'gpro-my-budget-preferences-v1';
const CATEGORIES = {
  expense: ['Продукты', 'Жильё', 'Транспорт', 'Здоровье', 'Семья', 'Развлечения', 'Покупки', 'Другое'],
  income: ['Зарплата', 'Подработка', 'Доп доход 1', 'Доп доход 2', 'Подарки', 'Другое']
};
const validCategory = (type, category) => CATEGORIES[type]?.includes(category) || (type === 'income' && category === 'Возвраты');
const fmt = n => n.toLocaleString('ru-RU', {style: 'currency', currency: 'RUB', maximumFractionDigits: 2});
const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const uid = () => globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
const option = (value, label = value) => {
  const el = document.createElement('option');
  el.value = value;
  el.textContent = label;
  return el;
};
function readStorage(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
  catch { return fallback; }
}
const PREF_DEFAULTS = Object.freeze({density:'comfortable',defaultType:'expense',startMonth:'current',rememberSections:false,lastMonth:'' ,sections:{}});
function validPrefs(p) {
  return p && typeof p === 'object' && !Array.isArray(p) &&
    ['comfortable','compact'].includes(p.density) &&
    ['expense','income'].includes(p.defaultType) &&
    ['current','last'].includes(p.startMonth) &&
    typeof p.rememberSections === 'boolean' &&
    (p.lastMonth === '' || /^\\d{4}-(0[1-9]|1[0-2])$/.test(p.lastMonth)) &&
    p.sections && typeof p.sections === 'object' && !Array.isArray(p.sections) &&
    Object.keys(p.sections).length <= 10 &&
    Object.values(p.sections).every(x=>typeof x==='boolean');
}
const storedPrefs = readStorage(PREF_KEY, null);
let prefs = validPrefs(storedPrefs) ? storedPrefs : {...PREF_DEFAULTS};
const saved = readStorage(KEY, []);
let entries = Array.isArray(saved) ? saved.filter(x =>
  x && typeof x.id === 'string' && ['income', 'expense'].includes(x.type) &&
  typeof x.date === 'string' && typeof x.category === 'string' &&
  Number.isSafeInteger(x.cents) && x.cents > 0
) : [];
const savedPlans = readStorage(PLAN_KEY, []);
let plans = Array.isArray(savedPlans) ? savedPlans : [];
const savedRecurring = readStorage(RECUR_KEY, []);
let recurring = Array.isArray(savedRecurring) ? savedRecurring : [];
const savedLimits = readStorage(LIMIT_KEY, {});
let limits = savedLimits && typeof savedLimits === 'object' && !Array.isArray(savedLimits) ? savedLimits : {};
const centsFrom = (value, allowZero = false) => {
  const n = Number(value);
  if (value === '' || !Number.isFinite(n) || n > 1e12 || (allowZero ? n < 0 : n <= 0)) return null;
  const cents = Math.round(n * 100);
  return Number.isSafeInteger(cents) && (allowZero || cents > 0) ? cents : null;
};
function save(key, data, errorId) {
  try { localStorage.setItem(key, JSON.stringify(data)); return true; }
  catch {
    $(errorId).textContent = 'Не удалось сохранить изменения. Проверь свободное место и настройки браузера.';
    return false;
  }
}
const monthly = () => entries.filter(e => e.date.slice(0, 7) === $('month').value);
const element = (tag, text, className = '') => {
  const el = document.createElement(tag);
  el.textContent = text;
  if (className) el.className = className;
  return el;
};
function syncQuickTypes() {
  for (const [id,type] of [['quickExpense','expense'],['quickIncome','income']]) {
    const active = $('type').value === type;
    $(id).classList.toggle('active',active);
    $(id).setAttribute('aria-pressed',String(active));
  }
}
function updateCategories() {
  const previous = $('category').value;
  $('category').replaceChildren(...CATEGORIES[$('type').value].map(x => option(x)));
  if (CATEGORIES[$('type').value].includes(previous)) $('category').value = previous;
  syncQuickTypes();
}
function updateFilterCategories() {
  const previous = $('filterCategory').value;
  const type = $('filterType').value;
  const legacy = entries.some(e => e.type === 'income' && e.category === 'Возвраты') ? ['Возвраты'] : [];
  const names = type === 'all' ? [...new Set([...CATEGORIES.expense, ...CATEGORIES.income, ...legacy])] : [...CATEGORIES[type], ...(type === 'income' ? legacy : [])];
  $('filterCategory').replaceChildren(option('all', 'Все категории'), ...names.map(x => option(x)));
  $('filterCategory').value = names.includes(previous) ? previous : 'all';
}
function resetEditor() {
  $('editingId').value = '';
  $('operationForm').reset();
  $('type').value = prefs.defaultType;
  $('date').value = today();
  updateCategories();
  $('formHeading').textContent = 'Добавить операцию';
  $('saveOperation').textContent = 'Добавить операцию';
  $('cancelEdit').hidden = true;
  $('formError').textContent = '';
}
function editEntry(id) {
  const item = entries.find(x => x.id === id);
  if (!item) return;
  $('editingId').value = item.id;
  $('type').value = item.type;
  updateCategories();
  if (!CATEGORIES[item.type].includes(item.category)) $('category').append(option(item.category));
  $('category').value = item.category;
  $('amount').value = (item.cents / 100).toFixed(2);
  $('date').value = item.date;
  $('note').value = item.note || '';
  $('formHeading').textContent = 'Редактировать операцию';
  $('saveOperation').textContent = 'Сохранить изменения';
  $('cancelEdit').hidden = false;
  $('formError').textContent = '';
  $('historyFold').open = true;
  $('operationMessage').textContent = '';
  $('operationForm').scrollIntoView({behavior: 'smooth', block: 'start'});
  $('amount').focus({preventScroll: true});
}
function categoryTotals(data) {
  const totals = new Map();
  for (const e of data) if (e.type === 'expense')
    totals.set(e.category, (totals.get(e.category) || 0) + e.cents);
  return totals;
}
function renderBreakdown(totals, totalExpense) {
  const root = $('breakdown');
  root.replaceChildren();
  if (!totals.size) {
    root.append(element('div', 'Добавь расходы, чтобы увидеть распределение по категориям.', 'empty'));
    return;
  }
  for (const [name, cents] of [...totals].sort((a, b) => b[1] - a[1])) {
    const item = element('div', '', 'breakdown-item');
    const row = element('div', '', 'breakdown-row');
    const meter = element('div', '', 'meter');
    const fill = document.createElement('div');
    row.append(element('span', name), element('strong', fmt(cents / 100)));
    fill.style.width = (totalExpense ? cents / totalExpense * 100 : 0) + '%';
    meter.append(fill);
    item.append(row, meter);
    root.append(item);
  }
}
function renderLimits(totals) {
  const month = $('month').value;
  const monthLimits = limits[month] || {};
  const root = $('limitList');
  root.replaceChildren();
  const configured = CATEGORIES.expense.filter(name => Number.isSafeInteger(monthLimits[name]) && monthLimits[name] > 0);
  const totalLimit = configured.reduce((sum, name) => sum + monthLimits[name], 0);
  const totalSpent = [...totals.values()].reduce((sum, cents) => sum + cents, 0);
  const remaining = totalLimit - totalSpent;
  $('totalLimit').textContent = fmt(totalLimit / 100);
  $('totalLimitSpent').textContent = fmt(totalSpent / 100);
  $('totalLimitRemaining').textContent = fmt(Math.abs(remaining) / 100);
  $('limitRemainingLabel').textContent = remaining < 0 ? 'Превышение' : 'Осталось';
  $('totalLimitRemaining').className = remaining < 0 ? 'negative' : 'positive';
  $('totalLimitProgress').style.width = (totalLimit ? Math.min(100, totalSpent / totalLimit * 100) : 0) + '%';
  $('limitSummary').classList.toggle('over', totalLimit > 0 && remaining < 0);
  $('limitSummaryNote').textContent = totalLimit
    ? 'Общий лимит — сумма установленных лимитов. В расходах учитываются все категории, даже без отдельного лимита.'
    : 'Установи лимиты по категориям, чтобы увидеть их общую сумму и остаток.';
  if (!configured.length) {
    root.append(element('div', 'Лимиты пока не заданы. Выбери категорию и установи сумму.', 'empty'));
    return;
  }
  for (const name of configured) {
    const cap = monthLimits[name], spent = totals.get(name) || 0;
    const exceeded = spent > cap;
    const item = element('div', '', 'limit-item' + (exceeded ? ' over' : ''));
    const row = element('div', '', 'limit-row');
    row.append(element('strong', name), element('span', fmt(spent / 100) + ' / ' + fmt(cap / 100)));
    const meter = element('div', '', 'meter');
    const fill = document.createElement('div');
    fill.style.width = Math.min(100, spent / cap * 100) + '%';
    meter.append(fill);
    item.append(row, meter, element('small', exceeded ? 'Лимит превышен на ' + fmt((spent - cap) / 100) : 'Осталось ' + fmt((cap - spent) / 100), exceeded ? 'warning' : 'hint'));
    root.append(item);
  }
}
function renderHistory(data) {
  const type = $('filterType').value;
  const category = $('filterCategory').value;
  const search = $('filterSearch').value.trim().toLocaleLowerCase('ru-RU');
  const filtered = data.filter(e =>
    (type === 'all' || e.type === type) &&
    (category === 'all' || e.category === category) &&
    (!search || (e.category + ' ' + (e.note || '')).toLocaleLowerCase('ru-RU').includes(search))
  );
  $('count').textContent = filtered.length + ' из ' + data.length + ' операций';
  const root = $('entries');
  root.replaceChildren();
  if (!filtered.length) {
    root.append(element('div', data.length ? 'Нет операций по выбранным фильтрам.' : 'За этот месяц операций пока нет.', 'empty'));
    return;
  }
  let activeDate = '';
  let group = null;
  for (const e of [...filtered].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))) {
    if (e.date !== activeDate) {
      activeDate = e.date;
      group = element('div', '', 'history-day');
      const heading = element('h3', new Date(e.date + 'T12:00:00').toLocaleDateString('ru-RU', {weekday:'long', day:'numeric', month:'long'}), 'history-day-title');
      group.append(heading);
      root.append(group);
    }
    const item = element('div', '', 'entry');
    const date = element('time', new Date(e.date + 'T12:00:00').toLocaleDateString('ru-RU', {day: '2-digit', month: 'short'}));
    date.dateTime = e.date;
    const info = document.createElement('div');
    info.append(element('b', e.category));
    if (e.note) info.append(element('small', e.note));
    const amount = element('strong', (e.type === 'income' ? '+' : '−') + fmt(e.cents / 100), e.type === 'income' ? 'positive' : 'negative');
    const actions = element('div', '', 'entry-actions');
    const edit = element('button', 'Изменить', 'button secondary');
    edit.type = 'button';
    edit.addEventListener('click', () => editEntry(e.id));
    const remove = element('button', 'Удалить', 'button danger');
    remove.type = 'button';
    remove.addEventListener('click', () => {
      if (!confirm('Удалить эту операцию?')) return;
      const next = entries.filter(x => x.id !== e.id);
      if (!save(KEY, next, 'formError')) return;
      entries = next;
      if ($('editingId').value === e.id) resetEditor();
      render();
    });
    actions.append(edit, remove);
    item.append(date, info, amount, actions);
    group.append(item);
  }
}

function shiftMonth(month, delta) {
  const [year, index] = month.split('-').map(Number);
  const date = new Date(year, index - 1 + delta, 1);
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
}
function monthStats(month) {
  let income = 0, expense = 0;
  for (const entry of entries) if (entry.date.slice(0, 7) === month) {
    if (entry.type === 'income') income += entry.cents;
    else expense += entry.cents;
  }
  return {income, expense};
}
function renderInsights() {
  const month = $('month').value;
  if (!/^\d{4}-\d{2}$/.test(month)) return;
  const current = monthStats(month);
  const previous = monthStats(shiftMonth(month, -1));
  const net = current.income - current.expense;
  $('savingsRate').textContent = current.income ? (net / current.income * 100).toFixed(1).replace('.', ',') + '%' : '—';
  $('savingsRate').className = net < 0 ? 'negative' : 'positive';
  $('savingsNote').textContent = current.income ? 'Разница доходов и расходов относительно дохода' : 'Добавь доход, чтобы увидеть долю';
  if (previous.expense) {
    const change = (current.expense - previous.expense) / previous.expense * 100;
    $('expenseChange').textContent = (change > 0 ? '+' : '') + change.toFixed(1).replace('.', ',') + '%';
    $('expenseChange').className = change > 0 ? 'negative' : 'positive';
    $('expenseChangeNote').textContent = 'Было ' + fmt(previous.expense / 100);
  } else {
    $('expenseChange').textContent = '—';
    $('expenseChange').className = '';
    $('expenseChangeNote').textContent = 'В прошлом месяце расходы не записаны';
  }
  const [year, monthNum] = month.split('-').map(Number);
  const days = new Date(year, monthNum, 0).getDate();
  $('dailyExpense').textContent = fmt(current.expense / days / 100);
  const periods = Array.from({length: 6}, (_, i) => shiftMonth(month, i - 5));
  const stats = periods.map(monthStats);
  const max = Math.max(1, ...stats.flatMap(x => [x.income, x.expense]));
  const root = $('trend');
  root.replaceChildren();
  for (let i = 0; i < periods.length; i++) {
    const wrap = element('div', '', 'trend-item');
    const bars = element('div', '', 'trend-bars');
    for (const type of ['income', 'expense']) {
      const bar = element('div', '', 'trend-bar ' + type);
      const value = stats[i][type];
      bar.style.height = Math.max(value ? 3 : 0, value / max * 100) + '%';
      bar.title = (type === 'income' ? 'Доходы: ' : 'Расходы: ') + fmt(value / 100);
      bars.append(bar);
    }
    wrap.append(bars, element('small', new Date(periods[i] + '-01T12:00:00').toLocaleDateString('ru-RU', {month: 'short', year: '2-digit'})));
    root.append(wrap);
  }
}
function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00');
  return !Number.isNaN(date.getTime()) &&
    date.getFullYear() === Number(value.slice(0, 4)) &&
    date.getMonth() + 1 === Number(value.slice(5, 7)) &&
    date.getDate() === Number(value.slice(8, 10));
}
function validBackup(data) {
  if (!data || data.app !== 'gpro-my-budget' || ![1,2,3].includes(data.version) ||
      !Array.isArray(data.entries) || data.entries.length > 20000 ||
      !data.limits || typeof data.limits !== 'object' || Array.isArray(data.limits)) return false;
  const ids = new Set();
  for (const e of data.entries) {
    if (!e || typeof e.id !== 'string' || !e.id || e.id.length > 120 || ids.has(e.id) ||
        !['income', 'expense'].includes(e.type) || !validDate(e.date) ||
        !validCategory(e.type, e.category) || !Number.isSafeInteger(e.cents) ||
        e.cents <= 0 || e.cents > 1e14 || (e.note != null && (typeof e.note !== 'string' || e.note.length > 120))) return false;
    ids.add(e.id);
  }
  if (Object.keys(data.limits).length > 1200) return false;
  for (const [month, cats] of Object.entries(data.limits)) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !cats ||
        typeof cats !== 'object' || Array.isArray(cats)) return false;
    for (const [name, cents] of Object.entries(cats)) {
      if (!CATEGORIES.expense.includes(name) || !Number.isSafeInteger(cents) || cents < 0 || cents > 1e14) return false;
    }
  }
  if (data.version >= 2) {
    if (!Array.isArray(data.plans) || data.plans.length > 20000 || !data.plans.every(p=>validExtra(p,'plan')) ||
        !Array.isArray(data.recurring) || data.recurring.length > 2000 || !data.recurring.every(t=>validExtra(t,'recurring'))) return false;
    if (new Set(data.plans.map(p=>p.id)).size !== data.plans.length ||
        new Set(data.recurring.map(t=>t.id)).size !== data.recurring.length) return false;
  }
  if (data.version === 3 && !validPrefs(data.preferences)) return false;
  return true;
}
$('prevMonth').addEventListener('click', () => { $('month').value = shiftMonth($('month').value, -1); rememberMonth(); resetEditor(); render(); });
$('nextMonth').addEventListener('click', () => { $('month').value = shiftMonth($('month').value, 1); rememberMonth(); resetEditor(); render(); });
$('backupExport').addEventListener('click', () => {
  downloadJSON({app: 'gpro-my-budget', version: 3, exportedAt: new Date().toISOString(), entries, limits, plans, recurring, preferences:prefs},
    'gpro-budget-backup-' + today() + '.json');
  $('backupMessage').textContent = 'Резервная копия подготовлена для скачивания.';
});
$('backupImport').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  const msg = $('backupMessage');
  msg.textContent = '';
  if (file.size > 5 * 1024 * 1024) { msg.textContent = 'Файл слишком большой (максимум 5 МБ).'; return; }
  try {
    const data = JSON.parse(await file.text());
    if (!validBackup(data)) { msg.textContent = 'Неверный формат или содержимое резервной копии.'; return; }
    if (!confirm('Заменить текущие операции, лимиты, планы, шаблоны и настройки данными из резервной копии? Это действие нельзя отменить.')) return;
    const restoredPlans = data.version >= 2 ? data.plans : [];
    const restoredRecurring = data.version >= 2 ? data.recurring : [];
    const restoredPrefs = data.version === 3 ? data.preferences : prefs;
    if (!savePair([[KEY,data.entries],[LIMIT_KEY,data.limits],[PLAN_KEY,restoredPlans],[RECUR_KEY,restoredRecurring],[PREF_KEY,restoredPrefs]],'backupMessage')) return;
    entries = data.entries;
    limits = data.limits;
    plans = restoredPlans;
    recurring = restoredRecurring;
    prefs = restoredPrefs;
    applyPrefs();
    resetEditor();
    updateFilterCategories();
    render();
    msg.textContent = 'Данные восстановлены: ' + entries.length + ' операций.';
  } catch {
    msg.textContent = 'Не удалось прочитать или сохранить файл. Данные не импортированы.';
  }
});


function populateCategory(selectId, typeId) {
  const select = $(selectId), previous = select.value;
  const names = CATEGORIES[$(typeId).value];
  select.replaceChildren(...names.map(name => option(name)));
  if (names.includes(previous)) select.value = previous;
}
function validExtra(item, kind) {
  return item && typeof item.id === 'string' && item.id.length > 0 && item.id.length <= 120 &&
    ['income','expense'].includes(item.type) && validCategory(item.type, item.category) &&
    Number.isSafeInteger(item.cents) && item.cents > 0 && item.cents <= 1e14 &&
    typeof item.note === 'string' && item.note.length <= 120 &&
    (kind === 'plan' ? /^\d{4}-(0[1-9]|1[0-2])$/.test(item.month) :
      Number.isInteger(item.day) && item.day >= 1 && item.day <= 31);
}
function renderPlans() {
  const month = $('month').value, items = plans.filter(p => p.month === month);
  const actual = monthStats(month);
  const projected = {income: actual.income, expense: actual.expense};
  for (const p of items) projected[p.type] += p.cents;
  $('forecastIncome').textContent = fmt(projected.income / 100);
  $('forecastExpense').textContent = fmt(projected.expense / 100);
  $('forecastBalance').textContent = fmt((projected.income - projected.expense) / 100);
  $('forecastBalance').className = projected.income < projected.expense ? 'negative' : 'positive';
  const root = $('planList'); root.replaceChildren();
  if (!items.length) { root.append(element('p','Нет запланированных операций на этот месяц.','hint')); return; }
  for (const p of items) {
    const row = element('div','','simple-item');
    const detail = element('div', (p.type === 'income' ? 'Доход · ' : 'Расход · ') + p.category + ' · ' + fmt(p.cents / 100));
    if (p.note) detail.append(element('small',p.note,'hint'));
    const actions = element('div','','simple-actions');
    const done = element('button','Внести в факт','button secondary');
    done.type='button';
    done.addEventListener('click',()=>{
      const monthNow = $('month').value;
      const date = monthNow + '-' + String(Math.min(Number(today().slice(8,10)),new Date(Number(monthNow.slice(0,4)),Number(monthNow.slice(5,7)),0).getDate())).padStart(2,'0');
      const nextEntries = [...entries,{id:uid(),type:p.type,cents:p.cents,date,category:p.category,note:p.note}];
      const nextPlans = plans.filter(x=>x.id!==p.id);
      if (!savePair([[KEY,nextEntries],[PLAN_KEY,nextPlans]],'planError')) return;
      entries=nextEntries; plans=nextPlans; render();
    });
    const remove=element('button','Удалить','button danger');
    remove.type='button';remove.addEventListener('click',()=>{
      const next=plans.filter(x=>x.id!==p.id);
      if(!save(PLAN_KEY,next,'planError'))return;
      plans=next;render();
    });
    actions.append(done,remove);row.append(detail,actions);root.append(row);
  }
}
function renderRecurring() {
  const root=$('recurringList');root.replaceChildren();
  if(!recurring.length)root.append(element('p','Регулярных шаблонов пока нет.','hint'));
  for(const template of recurring){
    const row=element('div','','simple-item');
    const detail=element('div',(template.type==='income'?'Доход · ':'Расход · ')+template.category+' · '+fmt(template.cents/100)+' · '+template.day+'-е число');
    if(template.note)detail.append(element('small',template.note,'hint'));
    const remove=element('button','Удалить шаблон','button danger');
    remove.type='button';remove.addEventListener('click',()=>{
      const next=recurring.filter(x=>x.id!==template.id);
      if(!save(RECUR_KEY,next,'recurringError'))return;
      recurring=next;renderRecurring();
    });
    row.append(detail,remove);root.append(row);
  }
}
function savePair(pairs,errorId){
  const previous=pairs.map(([key])=>[key,localStorage.getItem(key)]);
  try {for(const [key,value] of pairs)localStorage.setItem(key,JSON.stringify(value));return true;}
  catch {
    try{for(const [key,value] of previous){if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}}catch{}
    $(errorId).textContent='Не удалось сохранить изменения. Проверь настройки браузера.';
    return false;
  }
}
$('planType').addEventListener('change',()=>populateCategory('planCategory','planType'));
$('recurringType').addEventListener('change',()=>populateCategory('recurringCategory','recurringType'));
populateCategory('planCategory','planType');
populateCategory('recurringCategory','recurringType');
$('planForm').addEventListener('submit',event=>{
  event.preventDefault();$('planError').textContent='';
  const item={id:uid(),month:$('month').value,type:$('planType').value,category:$('planCategory').value,cents:centsFrom($('planAmount').value),note:$('planNote').value.trim()};
  if(!validExtra(item,'plan')){$('planError').textContent='Проверь поля плана.';return;}
  const next=[...plans,item];if(!save(PLAN_KEY,next,'planError'))return;
  plans=next;$('planAmount').value='';$('planNote').value='';render();
});
$('recurringForm').addEventListener('submit',event=>{
  event.preventDefault();$('recurringError').textContent='';
  const item={id:uid(),type:$('recurringType').value,category:$('recurringCategory').value,cents:centsFrom($('recurringAmount').value),day:Number($('recurringDay').value),note:$('recurringNote').value.trim()};
  if(!validExtra(item,'recurring')){$('recurringError').textContent='Проверь поля шаблона.';return;}
  const next=[...recurring,item];if(!save(RECUR_KEY,next,'recurringError'))return;
  recurring=next;$('recurringAmount').value='';$('recurringNote').value='';renderRecurring();
});
$('applyRecurring').addEventListener('click',()=>{
  const month=$('month').value,year=Number(month.slice(0,4)),m=Number(month.slice(5,7));
  const last=new Date(year,m,0).getDate();
  const next=[...entries];let count=0;
  for(const t of recurring){
    if(next.some(e=>e.recurringId===t.id && e.date.slice(0,7)===month))continue;
    next.push({id:uid(),type:t.type,category:t.category,cents:t.cents,
      date:month+'-'+String(Math.min(t.day,last)).padStart(2,'0'),note:t.note,recurringId:t.id});
    count++;
  }
  if(!count){$('recurringMessage').textContent='Новых операций нет: шаблоны уже внесены или список пуст.';return;}
  if(!save(KEY,next,'recurringError'))return;
  entries=next;render();
  $('recurringMessage').textContent='Добавлено операций: '+count+'. Повторное нажатие не создаст дубли.';
});
$('copyLimits').addEventListener('click',()=>{
  const month=$('month').value,source=limits[shiftMonth(month,-1)]||{};
  if(!Object.keys(source).length){$('limitError').textContent='В прошлом месяце лимиты не установлены.';return;}
  if(Object.keys(limits[month]||{}).length && !confirm('Заменить лимиты текущего месяца лимитами прошлого?'))return;
  const next={...limits,[month]:{...source}};
  if(!save(LIMIT_KEY,next,'limitError'))return;
  limits=next;$('limitError').textContent='Лимиты скопированы.';renderLimits(categoryTotals(monthly()));
});

function render() {
  const data = monthly();
  const incomeCents = data.filter(e => e.type === 'income').reduce((sum, e) => sum + e.cents, 0);
  const expenseCents = data.filter(e => e.type === 'expense').reduce((sum, e) => sum + e.cents, 0);
  $('income').textContent = fmt(incomeCents / 100);
  $('expense').textContent = fmt(expenseCents / 100);
  $('balance').textContent = fmt((incomeCents - expenseCents) / 100);
  $('balance').className = incomeCents < expenseCents ? 'negative' : 'positive';
  const totals = categoryTotals(data);
  renderBreakdown(totals, expenseCents);
  renderLimits(totals);
  renderHistory(data);
  renderInsights();
  renderPlans();
  renderRecurring();
}
function applyPrefs() {
  document.body.classList.toggle('compact-mode',prefs.density==='compact');
  $('prefDensity').value=prefs.density;
  $('prefDefaultType').value=prefs.defaultType;
  $('prefStartMonth').value=prefs.startMonth;
  $('prefRememberSections').checked=prefs.rememberSections;
  for (const fold of document.querySelectorAll('details.fold')) {
    if (fold.id && fold.id !== 'settingsFold')
      fold.open = prefs.rememberSections ? Boolean(prefs.sections[fold.id]) : false;
  }
}
function persistPrefs() {
  try {localStorage.setItem(PREF_KEY,JSON.stringify(prefs));$('settingsMessage').textContent='Настройки сохранены.';}
  catch {$('settingsMessage').textContent='Не удалось сохранить настройки в этом браузере.';}
}
function rememberMonth() {
  if (prefs.startMonth !== 'last' || !/^\\d{4}-(0[1-9]|1[0-2])$/.test($('month').value)) return;
  prefs.lastMonth=$('month').value;
  persistPrefs();
}
for (const [id,key] of [['prefDensity','density'],['prefDefaultType','defaultType'],['prefStartMonth','startMonth']]) {
  $(id).addEventListener('change',()=>{
    prefs={...prefs,[key]:$(id).value};
    if(key==='startMonth' && prefs.startMonth==='last')prefs.lastMonth=$('month').value;
    applyPrefs();persistPrefs();
    if(key==='defaultType' && !$('editingId').value)resetEditor();
  });
}
$('prefRememberSections').addEventListener('change',()=>{
  prefs={...prefs,rememberSections:$('prefRememberSections').checked};
  if(prefs.rememberSections){
    prefs.sections=Object.fromEntries([...document.querySelectorAll('details.fold')].filter(x=>x.id && x.id!=='settingsFold').map(x=>[x.id,x.open]));
  }
  persistPrefs();
});
for(const fold of document.querySelectorAll('details.fold')){
  if(fold.id && fold.id!=='settingsFold')fold.addEventListener('toggle',()=>{
    if(!prefs.rememberSections)return;
    prefs.sections={...prefs.sections,[fold.id]:fold.open};
    persistPrefs();
  });
}
$('month').value = prefs.startMonth==='last' && prefs.lastMonth ? prefs.lastMonth : today().slice(0, 7);
applyPrefs();
$('date').value = today();
$('limitCategory').replaceChildren(...CATEGORIES.expense.map(x => option(x)));
updateCategories();
updateFilterCategories();
$('type').addEventListener('change', updateCategories);
for (const [id,type] of [['quickExpense','expense'],['quickIncome','income']]) {
  $(id).addEventListener('click',()=>{
    $('type').value=type;updateCategories();$('amount').focus();
  });
}
$('todayDate').addEventListener('click',()=>{$('date').value=today();});
$('currentMonth').addEventListener('click',()=>{
  $('month').value=today().slice(0,7);rememberMonth();resetEditor();render();
});
$('operationForm').addEventListener('keydown',event=>{
  if ((event.ctrlKey || event.metaKey) && event.key==='Enter') {
    event.preventDefault();$('saveOperation').click();
  }
});
$('month').addEventListener('change', () => {
  resetEditor();
  $('limitAmount').value = '';
  rememberMonth();
  render();
});
$('filterType').addEventListener('change', () => { updateFilterCategories(); renderHistory(monthly()); });
$('filterCategory').addEventListener('change', () => renderHistory(monthly()));
$('filterSearch').addEventListener('input', () => renderHistory(monthly()));
$('clearFilters').addEventListener('click', () => {
  $('filterType').value = 'all';
  updateFilterCategories();
  $('filterCategory').value = 'all';
  $('filterSearch').value = '';
  renderHistory(monthly());
});
$('cancelEdit').addEventListener('click', resetEditor);
$('operationForm').addEventListener('submit', event => {
  event.preventDefault();
  $('formError').textContent = '';
  const cents = centsFrom($('amount').value);
  const date = $('date').value, type = $('type').value, category = $('category').value;
  const note = $('note').value.trim();
  const isValidDate = validDate(date);
  if (cents === null || !isValidDate || !validCategory(type, category)) {
    $('formError').textContent = 'Проверь сумму, дату и категорию.';
    return;
  }
  const id = $('editingId').value;
  const wasEditing = Boolean(id);
  const original = id ? entries.find(x => x.id === id) : null;
  const updated = {id: id || uid(), type, cents, date, category, note, ...(original?.recurringId ? {recurringId: original.recurringId} : {})};
  if (id && !entries.some(x => x.id === id)) {
    $('formError').textContent = 'Операция не найдена. Обнови страницу.';
    return;
  }
  const next = id ? entries.map(x => x.id === id ? updated : x) : [...entries, updated];
  if (!save(KEY, next, 'formError')) return;
  entries = next;
  resetEditor();
  $('month').value = date.slice(0, 7);
  rememberMonth();
  render();
  $('operationMessage').textContent = wasEditing ? 'Изменения сохранены.' : 'Операция добавлена. Можно сразу внести следующую.';
  $('amount').focus({preventScroll:true});
});
$('limitForm').addEventListener('submit', event => {
  event.preventDefault();
  $('limitError').textContent = '';
  const category = $('limitCategory').value;
  const cents = centsFrom($('limitAmount').value, true);
  if (!CATEGORIES.expense.includes(category) || cents === null) {
    $('limitError').textContent = 'Введи корректный лимит от 0 ₽.';
    return;
  }
  const month = $('month').value;
  const next = {...limits, [month]: {...(limits[month] || {})}};
  if (cents === 0) delete next[month][category];
  else next[month][category] = cents;
  if (!save(LIMIT_KEY, next, 'limitError')) return;
  limits = next;
  $('limitAmount').value = '';
  renderLimits(categoryTotals(monthly()));
});
$('export').addEventListener('click', () => {
  const data = monthly();
  const rows = [
    ['Дата', 'Тип', 'Категория', 'Сумма', 'Комментарий'],
    ...data.map(e => [e.date, e.type === 'income' ? 'Доход' : 'Расход', e.category, (e.cents / 100).toFixed(2).replace('.', ','), e.note || ''])
  ];
  const quote = value => '"' + String(value).replace(/"/g, '""') + '"';
  const csv = '\uFEFF' + rows.map(row => row.map(quote).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], {type: 'text/csv;charset=utf-8'}));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'gpro-budget-' + $('month').value + '.csv';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
const bot = window.GPRO_CONFIG?.telegramBotUrl?.trim() || '';
if (/^https:\/\/t\.me\/[A-Za-z0-9_]{5,32}(?:\?start=[A-Za-z0-9_-]{1,64})?$/.test(bot)) {
  const a = element('a', 'Открыть Telegram ↗', 'button');
  a.href = bot;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  $('tgAction').replaceChildren(a);
}
render();
