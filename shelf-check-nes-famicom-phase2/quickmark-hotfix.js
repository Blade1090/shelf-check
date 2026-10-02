(()=>{
const dlg=document.getElementById('myShelfDialog');
let quickMarkActive=false;
function statusApi(){return window.NES_PLAY_STATE}
function showToast(text){if(!dlg)return;let t=dlg.querySelector('.qm-toast');if(!t){t=document.createElement('div');t.className='qm-toast';dlg.appendChild(t)}t.textContent=text;t.classList.add('show');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>t.classList.remove('show'),1400)}
function addHelp(){if(!dlg||!quickMarkActive)return;const search=dlg.querySelector('#ctMarkSearch');if(!search||dlg.querySelector('.qm-help'))return;const p=document.createElement('p');p.className='qm-help';p.textContent='Tap PLAYED or BEATEN for any game. Changes save instantly on this device.';search.insertAdjacentElement('afterend',p)}
const observer=new MutationObserver(()=>{if(dlg?.querySelector('#ctMarkList')){quickMarkActive=true;addHelp()}});if(dlg)observer.observe(dlg,{childList:true,subtree:true});
document.addEventListener('click',e=>{
  const q=e.target.closest('#ctQuickMark');
  if(q){quickMarkActive=true;setTimeout(addHelp,0);return}
  const back=e.target.closest('#ctBackShelf,.ct-close');if(back){quickMarkActive=false;return}
  const b=e.target.closest('#myShelfDialog [data-status][data-id]');if(!b)return;
  const api=statusApi();if(!api?.setStatus)return;
  e.preventDefault();e.stopImmediatePropagation();
  const id=b.dataset.id,status=b.dataset.status;api.setStatus(id,status);
  const group=b.closest('.ct-mark-actions');group?.querySelectorAll('[data-status]').forEach(x=>{const on=x.dataset.status===status;x.classList.toggle('active',on);x.setAttribute('aria-pressed',String(on))});
  const title=b.closest('.ct-mark-row')?.querySelector('.ct-mark-title')?.textContent?.trim()||'Game';
  showToast(`✓ ${title} marked ${status}`);
},{capture:true});
window.addEventListener('shelfcheck:dossiers-ready',e=>{if(quickMarkActive&&dlg?.open)e.stopImmediatePropagation()},{capture:true});
})();
