'use strict';
(()=>{const key='gpro-theme-preference',button=document.getElementById('themeToggle'),label=document.getElementById('themeLabel'),meta=document.querySelector('meta[name="theme-color"]');if(!button)return;
function apply(theme){const light=theme==='light';document.documentElement.dataset.theme=light?'light':'dark';button.setAttribute('aria-label',light?'Включить тёмную тему':'Включить светлую тему');button.setAttribute('aria-pressed',String(light));label.textContent=light?'☀ Светлая':'☾ Тёмная';if(meta)meta.content=light?'#f7f3fb':'#181b33';}
button.addEventListener('click',()=>{const next=document.documentElement.dataset.theme==='light'?'dark':'light';apply(next);try{localStorage.setItem(key,next);}catch{}});
try{apply(localStorage.getItem(key)==='light'?'light':'dark');}catch{apply('dark');}
})();
