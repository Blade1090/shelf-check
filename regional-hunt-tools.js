const RH_NES='NES',RH_FC='FAMICOM';
const rh$=s=>document.querySelector(s);
const rhEsc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rhCycle={NES:{NEEDED:{sig:'',left:[],last:null},OWNED:{sig:'',left:[],last:null}},FAMICOM:{NEEDED:{sig:'',left:[],last:null},OWNED:{sig:'',left:[],last:null}}};
let rhPriceBand={NES:'ALL',FAMICOM:'ALL'},rhOwnedBand={NES:'ALL',FAMICOM:'ALL'},rhFrame=0;
const RH_PRICE_BANDS=[['ALL','ALL PRICES'],['UNDER10','UNDER $10'],['10TO20','$10–20'],['20TO40','$20–40'],['40PLUS','$40+'],['PENDING','PRICE PENDING']];
const RH_TIME_BANDS=[['ALL','ANY LENGTH'],['UNDER4','UNDER 4H'],['4TO8','4–8H'],['8TO15','8–15H'],['15TO30','15–30H'],['30PLUS','30H+'],['PENDING','TIME PENDING']];
const RH_LANG_BANDS=[['ALL','ANY LANGUAGE'],['LOW','LOW'],['MEDIUM','MEDIUM'],['HIGH','HIGH']];

function rhSet(){return document.body.dataset.activeSet===RH_FC?RH_FC:RH_NES}
function rhFilter(){return document.querySelector('[data-filter].active')?.dataset.filter||'ALL'}
function rhHost(){return rhSet()===RH_FC?document.getElementById('famicomGameList'):document.getElementById('gameList')}
function rhCardId(card){return card?.dataset?.identityId||null}
function rhPrice(id,set=rhSet()){
  if(set===RH_FC){const p=window.FAMICOM_SHELF_DATA?.prices?.get?.(id);return Number.isFinite(p)?Number(p):null}
  const p=window.NES_PRICES?.byIdentity?.get?.(id)?.price;return Number.isFinite(p)?Number(p):null
}
function rhInPriceBand(v,band){
  if(band==='ALL')return true;if(band==='PENDING')return v==null;if(v==null)return false;
  if(band==='UNDER10')return v<10;if(band==='10TO20')return v>=10&&v<20;if(band==='20TO40')return v>=20&&v<40;return band==='40PLUS'&&v>=40
}
function rhNesHours(id){const d=window.NES_DOSSIERS?.byId?.get?.(id),n=Number(d?.hltb_main_hours);return Number.isFinite(n)&&n>0?n:null}
function rhInTimeBand(h,band){
  if(band==='ALL')return true;if(band==='PENDING')return h==null;if(h==null)return false;
  if(band==='UNDER4')return h<4;if(band==='4TO8')return h>=4&&h<=8;if(band==='8TO15')return h>8&&h<=15;if(band==='15TO30')return h>15&&h<=30;return band==='30PLUS'&&h>30
}
function rhFcLanguage(id){return String(window.FAMICOM_SHELF_DATA?.byId?.get?.(id)?.language_barrier||'UNKNOWN').toUpperCase()}
function rhSchedule(){if(rhFrame)cancelAnimationFrame(rhFrame);rhFrame=requestAnimationFrame(()=>requestAnimationFrame(()=>{rhFrame=0;rhApply();rhRenderTools()}))}
function rhApply(){
  const set=rhSet(),filter=rhFilter(),host=rhHost();if(!host)return;
  if(filter==='NEEDED'){
    const band=rhPriceBand[set];
    for(const card of host.querySelectorAll('.game[data-identity-id]')){
      if(card.hidden)continue;
      if(!rhInPriceBand(rhPrice(rhCardId(card),set),band))card.hidden=true;
    }
  }else if(filter==='OWNED'){
    const band=rhOwnedBand[set];if(band==='ALL')return;
    for(const card of host.querySelectorAll('.game[data-identity-id]')){
      if(card.hidden)continue;const id=rhCardId(card);
      const ok=set===RH_NES?rhInTimeBand(rhNesHours(id),band):rhFcLanguage(id)===band;
      if(!ok)card.hidden=true;
    }
  }
}
function rhVisiblePool(){
  const host=rhHost();if(!host)return[];
  return [...host.querySelectorAll('.game[data-identity-id]')].filter(c=>!c.hidden&&c.offsetParent!==null).map(c=>c.dataset.identityId).filter(Boolean)
}
function rhShuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function rhDraw(mode){
  const set=rhSet(),ids=rhVisiblePool(),state=rhCycle[set][mode],sig=ids.slice().sort().join('|');
  if(!ids.length)return null;
  if(state.sig!==sig||!state.left.length){
    const next=rhShuffle(ids.slice());
    if(next.length>1&&next[next.length-1]===state.last){const j=Math.floor(Math.random()*(next.length-1));[next[j],next[next.length-1]]=[next[next.length-1],next[j]]}
    state.sig=sig;state.left=next;
  }
  const id=state.left.pop();state.last=id;return id
}
function rhOpen(id,mode){
  if(!id)return;
  const set=rhSet();if(set===RH_FC)window.openFamicomDossier?.(id);else window.openNESDossier?.(id);
  setTimeout(()=>rhInstallAgain(mode),0);setTimeout(()=>rhInstallAgain(mode),120);
}
function rhRandom(mode){
  const id=rhDraw(mode);
  if(!id){const s=document.getElementById('importStatus');if(s)s.textContent=mode==='NEEDED'?'No needed games match this search/price range.':'No owned games match these filters.';return}
  rhOpen(id,mode)
}
function rhInstallAgain(mode){
  const dlg=document.getElementById('dossierDialog');if(!dlg?.open)return;
  const body=document.getElementById('dossierBody');if(!body||body.querySelector('.rh-another'))return;
  const b=document.createElement('button');b.type='button';b.className='rh-another';b.textContent=mode==='NEEDED'?'🎲 ANOTHER RANDOM GAME':'🎲 PICK ANOTHER GAME';b.onclick=()=>rhRandom(mode);
  const card=body.querySelector('.dossier-card');if(card)card.after(b);else body.prepend(b)
}
function rhCount(){
  rhApply();return rhVisiblePool().length
}
function rhRenderTools(){
  const box=document.getElementById('huntTools');if(!box)return;
  const set=rhSet(),filter=rhFilter();
  if(filter!=='NEEDED'&&filter!=='OWNED'){box.hidden=true;box.innerHTML='';return}
  box.hidden=false;
  if(filter==='NEEDED'){
    const count=rhCount(),band=rhPriceBand[set];
    box.innerHTML=`<div class="rh-random-row"><div><small>THE HUNT</small><b>${count} needed ${count===1?'game':'games'} in this price range</b></div><button id="rhRandomNeeded" type="button">🎲 RANDOM GAME</button></div><div class="rh-bands">${RH_PRICE_BANDS.map(([k,l])=>`<button type="button" data-rh-price="${k}" class="${band===k?'active':''}">${l}</button>`).join('')}</div>`;
    box.querySelector('#rhRandomNeeded').onclick=()=>rhRandom('NEEDED');
    box.querySelector('.rh-bands').onclick=e=>{const k=e.target.dataset.rhPrice;if(!k)return;rhPriceBand[set]=k;rhSchedule()}
  }else{
    const count=rhCount(),band=rhOwnedBand[set],bands=set===RH_NES?RH_TIME_BANDS:RH_LANG_BANDS;
    const sub=set===RH_NES?'in this playtime':'in this language range';
    box.innerHTML=`<div class="rh-random-row owned"><div><small>CAN'T PICK YOUR NEXT GAME?</small><b>${count} owned ${count===1?'game':'games'} ${sub}</b></div><button id="rhRandomOwned" type="button">🎲 WHAT SHOULD I PLAY?</button></div><div class="rh-bands">${bands.map(([k,l])=>`<button type="button" data-rh-owned="${k}" class="${band===k?'active':''}">${l}</button>`).join('')}</div>`;
    box.querySelector('#rhRandomOwned').onclick=()=>rhRandom('OWNED');
    box.querySelector('.rh-bands').onclick=e=>{const k=e.target.dataset.rhOwned;if(!k)return;rhOwnedBand[set]=k;rhSchedule()}
  }
}
function rhTheme(){
  const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=rhSet()===RH_FC?'#241416':'#0d1016'
}
document.addEventListener('click',e=>{
  if(e.target.closest('[data-filter],[data-set]'))setTimeout(()=>{rhTheme();rhSchedule()},0)
});
document.getElementById('search')?.addEventListener('input',rhSchedule);
document.getElementById('sort')?.addEventListener('change',rhSchedule);
window.addEventListener('shelfcheck:famicom-data-ready',rhSchedule);
window.addEventListener('shelfcheck:famicom-imported',rhSchedule);
window.addEventListener('shelfcheck:famicom-ownership-changed',rhSchedule);
window.addEventListener('shelfcheck:dossiers-ready',rhSchedule);
setTimeout(()=>{rhTheme();rhSchedule()},0);
