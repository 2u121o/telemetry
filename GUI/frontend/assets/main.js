import { createRouter } from './router.js';
import { api } from './services/api.js';
import * as Sessions from './routes/sessions.js';
import * as Device from './routes/device.js';
import * as Settings from './routes/settings.js';

console.log('Modules loaded:', { Sessions, Device, Settings });

const view=document.getElementById('view');
const pageTitle=document.getElementById('pageTitle');
const sidebar=document.getElementById('sidebar');
const openSidebarBtn=document.getElementById('openSidebar');
const closeSidebarBtn=document.getElementById('closeSidebar');
const healthBtn=document.getElementById('btnHealth');

openSidebarBtn?.addEventListener('click',()=>sidebar.classList.add('open'));
closeSidebarBtn?.addEventListener('click',()=>sidebar.classList.remove('open'));
window.addEventListener('hashchange',()=>sidebar.classList.remove('open'));

healthBtn?.addEventListener('click',async()=>{
  try{const j=await api.health();alert('API health: '+JSON.stringify(j));}
  catch(e){alert('Error: '+e);}
});

function setActive(name){
  document.querySelectorAll('.menu-item').forEach(a=>{
    const r=a.getAttribute('data-route');
    if(r===name)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
  });
  pageTitle.textContent=name.charAt(0).toUpperCase()+name.slice(1);
}

// Define routes
const routes = {
  sessions: { fragment: 'sessions', mount: Sessions.mount, unmount: Sessions.unmount },
  device:   { fragment: 'device',   mount: Device.mount,   unmount: Device.unmount },
  settings: { fragment: 'settings', mount: Settings.mount, unmount: Settings.unmount }
};

console.log('Routes configured:', routes);

const router=createRouter({viewEl:view,setActive});
if(!location.hash)location.hash='#/sessions';
router.start(routes);
