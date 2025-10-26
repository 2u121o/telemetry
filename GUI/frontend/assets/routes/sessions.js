import { $, $$, setRows } from '../utils/dom.js';
import { api } from '../services/api.js';
let abortCtrl=null;
function renderRows(tbody,data){
  const rows=data.map(s=>`
    <tr><td>#${s.id}</td><td>${s.name}</td><td>${s.date}</td><td>${s.duration_min} min</td>
    <td><button class="icon-btn" data-id="${s.id}">Open</button></td></tr>`);
  setRows(tbody,rows);
}
export async function mount(root){
  console.log('Mounting sessions component', root);
  
  if (!root || !root.querySelector) {
    console.error('Invalid root element provided to mount');
    return;
  }

  const tbody = $('#tblSessions', root);
  console.log('Found tbody:', tbody);
  
  if(!tbody) {
    console.error('Table body not found in root element');
    return;
  }
  
  setRows(tbody,[`<tr><td colspan="5">Loading…</td></tr>`]);
  console.log('Set loading state');
  
  if(abortCtrl)abortCtrl.abort();
  abortCtrl=new AbortController();
  
  try{
    console.log('Fetching sessions...');
    const data=await api.listSessions({signal:abortCtrl.signal});
    console.log('Sessions received:', data);
    
    renderRows(tbody,data);
    console.log('Rows rendered');
    
    const buttons = $$('#tblSessions button', root);
    console.log('Found buttons:', buttons.length);
    
    buttons.forEach(btn=>{
      btn.addEventListener('click',()=>alert(`Open session ${btn.dataset.id}`));
    });
    console.log('Button listeners added');
  }catch(e){
    console.error('Error loading sessions:', e);
    if(e.name==='AbortError') {
      console.log('Request aborted');
      return;
    }
    setRows(tbody,[`<tr><td colspan="5">Failed to load sessions</td></tr>`]);
  }
}
export function unmount(){if(abortCtrl){abortCtrl.abort();abortCtrl=null;}}
