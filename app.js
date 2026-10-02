import { importGameEye, importFamicomGameEye } from './import-core.mjs?v=2';
const LIBRETRO_BASE='https://raw.githubusercontent.com/libretro-thumbnails/Nintendo_-_Nintendo_Entertainment_System/4d21463bf5d553afc34d99183c9ad5833f773b93/Named_Boxarts/';
const LAUNCHBOX_BASE='https://images.launchbox-app.com/';
const CORE_FETCHES=[
  fetch('./nes-census.json').then(r=>r.json()),
  fetch('./nes-tracked-non-core.json').then(r=>r.json()),
  fetch('./pricecharting-unmapped.json').then(r=>r.json()),
  fetch('./pricecharting-alias-map.json').then(r=>r.json()),
  fetch('./prices-nes.json').then(r=>r.json()).catch(()=>({rows:[]})),
  fetch('./covers-001-100.json').then(r=>r.json()).catch(()=>({})),
  ...['101-200','201-300','301-400','401-500','501-600','601-700','701-800','801-815'].map(n=>fetch(`./covers-${n}.json`).then(r=>r.json()).catch(()=>[]))
];
const loaded=await Promise.all(CORE_FETCHES);
const [census,tracked,pcu,pcAlias,priceData,first100,...coverChunks]=loaded;
let famicomCensus={identities:[]},famicomArtwork={},famicomPriceData={rows:[]},famicomCartColorMeta=null,famicomLoaded=false,famicomLoadPromise=null;
const covers={...first100};
for(const rows of coverChunks){for(const [id,src,val,label] of rows){const u=src===0?LIBRETRO_BASE+val:src===1?LAUNCHBOX_BASE+val:val;covers[id]={u,l:label||null};}}
const DATA={census,tracked,pcu,pcAlias,covers};
const STORAGE='shelfcheck-nes-matty-v1';
const FAMICOM_STORAGE='shelfcheck-famicom-matty-v1';
const SET_STORAGE='shelfcheck-active-set-v1';
let activeSet=localStorage.getItem(SET_STORAGE)==='FAMICOM'?'FAMICOM':'NES';
let famicomOwned=new Set(),famicomImported=false,famicomSummary=null;
try{const f=JSON.parse(localStorage.getItem(FAMICOM_STORAGE)||'null');if(f){famicomOwned=new Set(f.owned||[]);famicomImported=!!f.imported;famicomSummary=f.summary||null;}}catch{}
let famicomIds=[];
let famicomById=new Map();
let famicomSearch=new Map();
let famicomPriceById=new Map();
let famicomCartColors=new Map();
async function ensureFamicomLoaded(){
  if(famicomLoaded)return;
  if(!famicomLoadPromise)famicomLoadPromise=Promise.all([
    fetch('./famicom-census.json').then(r=>{if(!r.ok)throw new Error('Famicom census failed: '+r.status);return r.json();}),
    fetch('./famicom-artwork.json').then(r=>r.ok?r.json():{}).catch(()=>({})),
    fetch('./prices-famicom.json').then(r=>r.ok?r.json():({rows:[]})).catch(()=>({rows:[]})),
    fetch('./famicom-cart-colors-manifest.json').then(async r=>{
      if(!r.ok)return {meta:null,rows:[]};
      const meta=await r.json();
      const packs=await Promise.all((meta.chunks||[]).map(file=>fetch('./'+file).then(x=>x.ok?x.json():({rows:[]})).catch(()=>({rows:[]}))));
      return {meta,rows:packs.flatMap(p=>p.rows||[])};
    }).catch(()=>({meta:null,rows:[]}))
  ]).then(([census,art,prices,colors])=>{
    famicomCensus=census;famicomArtwork=art||{};famicomPriceData=prices||{rows:[]};famicomCartColorMeta=colors?.meta||null;
    famicomIds=famicomCensus.identities||[];
    famicomById=new Map(famicomIds.map(x=>[x.identity_id,x]));
    famicomPriceById=new Map((famicomPriceData.rows||[]).map(([id,p])=>[id,Number(p)]));
    famicomCartColors=new Map((colors?.rows||[]).map(([id,group,display,confidence,source,variants,note])=>[id,{group,display,confidence,source,variants:variants||[],note}]));
    window.FAMICOM_CART_COLORS=famicomCartColors;
    window.FAMICOM_CART_COLOR_META=famicomCartColorMeta;
    famicomSearch=new Map(famicomIds.map(x=>{
      const c=famicomCartColors.get(x.identity_id),variantTerms=(c?.variants||[]).flatMap(v=>[v?.[0],v?.[1]]);
      const aliases=(x.aliases||[]).map(v=>typeof v==='string'?v:v?.title).filter(Boolean);
      return [x.identity_id,[x.japanese_title,x.romanized_title,x.english_reference_title,...aliases,x.product_code,c?.group,c?.display,...variantTerms].filter(Boolean).join('\n').toLowerCase()];
    }));
    window.FAMICOM_SHELF_DATA={identities:famicomIds,byId:famicomById,artwork:famicomArtwork,prices:famicomPriceById,cartColors:famicomCartColors};
    famicomLoaded=true;
    window.dispatchEvent(new Event('shelfcheck:famicom-data-ready'));
  });
  await famicomLoadPromise;
}
function saveFamicom(){localStorage.setItem(FAMICOM_STORAGE,JSON.stringify({owned:[...famicomOwned],imported:famicomImported,summary:famicomSummary}));}
function fTitle(x){return x.japanese_title||x.romanized_title||x.english_reference_title||x.identity_id;}
function fSecondary(x){return x.english_reference_title||x.romanized_title||'';}
function fAz(a,b){return (a.romanized_title||a.english_reference_title||a.japanese_title||'').localeCompare((b.romanized_title||b.english_reference_title||b.japanese_title||''),undefined,{numeric:true,sensitivity:'base'});}
function fMoney(n){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(n);}
function fPriceSort(a,b,dir){const ap=famicomPriceById.get(a.identity_id),bp=famicomPriceById.get(b.identity_id),ah=Number.isFinite(ap),bh=Number.isFinite(bp);if(ah&&!bh)return -1;if(!ah&&bh)return 1;if(!ah&&!bh)return fAz(a,b);return ((ap-bp)*dir)||fAz(a,b);}
function fSortList(list){if(state.sort==='TITLE_DESC')return list.sort((a,b)=>-fAz(a,b));if(state.sort==='OWNED_FIRST')return list.sort((a,b)=>(Number(famicomOwned.has(b.identity_id))-Number(famicomOwned.has(a.identity_id)))||fAz(a,b));if(state.sort==='NEEDED_FIRST')return list.sort((a,b)=>(Number(famicomOwned.has(a.identity_id))-Number(famicomOwned.has(b.identity_id)))||fAz(a,b));if(state.sort==='PRICE_LOW')return list.sort((a,b)=>fPriceSort(a,b,1));if(state.sort==='PRICE_HIGH')return list.sort((a,b)=>fPriceSort(a,b,-1));return list.sort(fAz);}
function fCartColor(x){
  return famicomCartColors.get(x.identity_id)||{group:'UNKNOWN',display:null,confidence:null,source:null,variants:[],note:null};
}
function fCartLabel(c){
  if(!c||c.group==='UNKNOWN')return 'CART · ?';
  const variants=(c.variants||[]).map(v=>v?.[1]||v?.[0]).filter(Boolean);
  return 'CART · '+(c.display||c.group.replaceAll('_',' '))+(variants.length?' · '+variants.join(' / ')+' VARIANT':'');
}
function fCartBadge(c){
  const group=String(c?.group||'UNKNOWN').toLowerCase();
  const text=escapeHTML(fCartLabel(c));
  const title=c?.confidence?escAttr((c.source?c.source+' · ':'')+c.confidence+' confidence'):'Color unresolved';
  return `<span class="famicom-cart-color ${group}" title="${title}"><i class="famicom-cart-swatch ${group}"></i><b>${text}</b></span>`;
}
function escAttr(s){return escapeHTML(s).replace(/\n/g,' ');}
function fCardHTML(x){
  const o=famicomOwned.has(x.identity_id),art=famicomArtwork[x.identity_id]?.box,name=fTitle(x),secondary=fSecondary(x);
  const img=art?`<button class="cover-button" type="button" data-cover="${escapeHTML(art)}" data-title="${escapeHTML(name)}" aria-label="Enlarge ${escapeHTML(name)} cover"><img class="cover" src="${escapeHTML(art)}" alt="${escapeHTML(name)} Famicom box art" loading="lazy" decoding="async"></button>`:`<div class="cover cover-missing"><span>FC</span></div>`;
  const meta=[x.publisher,x.release_date,x.product_code].filter(Boolean).join(' • ');
  const nesOwned=x.nes_identity_id?state.owned.has(x.nes_identity_id):false;
  const cross=x.nes_identity_id?`<span class="famicom-cross ${nesOwned?'owned':''}"><b>NES ${nesOwned?'OWNED':'NOT OWNED'}</b>${x.nes_title?` · ${escapeHTML(x.nes_title)}`:''}</span>`:'';
  const lang=x.language_barrier?`<span class="famicom-language ${String(x.language_barrier).toLowerCase()}">LANGUAGE ${escapeHTML(x.language_barrier)}</span>`:'';
  const cart=fCartColor(x),cartLine=fCartBadge(cart);
  const price=famicomPriceById.get(x.identity_id),priceLine=Number.isFinite(price)?`<span class="famicom-price"><small>LOOSE</small> ${fMoney(price)}</span>`:'';
  return `<article class="game famicom-game ${o?'owned':''}" data-identity-id="${escapeHTML(x.identity_id)}">${img}<div class="game-copy"><strong class="famicom-title-jp">${escapeHTML(name)}</strong>${secondary&&secondary!==name?`<span class="famicom-title-en">${escapeHTML(secondary)}</span>`:''}<small class="famicom-meta">${escapeHTML(meta||'FAMICOM')}</small><div class="famicom-card-flags">${lang}${cross}</div><div class="famicom-hunt-meta">${cartLine}${priceLine}</div><span class="famicom-hint">Tap card for dossier</span></div><button class="status famicom-toggle" type="button" data-famicom-toggle="${escapeHTML(x.identity_id)}" aria-label="Mark ${escapeHTML(name)} ${o?'needed':'owned'}">${o?'OWNED':'NEEDED'}</button></article>`;
}

const el=id=>document.getElementById(id);
const allIds=Object.values(DATA.census.identities).flat();
const searchTextById=new Map(allIds.map(x=>[x.identity_id,[x.canonical_title,...(x.aliases||[])].join('\n').toLowerCase()]));
const priceByProduct=new Map((priceData.rows||[]).map(([id,p])=>[Number(id),Number(p)]));
const priceByIdentity=new Map();
for(const x of allIds){const prices=(x.product_ids||[]).map(s=>Number(String(s).replace('pc-',''))).filter(id=>priceByProduct.has(id)).map(id=>priceByProduct.get(id));if(prices.length)priceByIdentity.set(x.identity_id,Math.min(...prices));}
let state={owned:new Set(),imported:false,summary:null,filter:'ALL',q:'',sort:'TITLE_ASC'};
let modalScrollY=0;
let rouletteMode='OWNED';
const rouletteSeen={OWNED:new Set(),NEEDED:new Set(),ALL:new Set()};
const mainCardNodes=new Map();
let mainCardsMounted=false;
let mainFilterFrame=0;
const famicomCardNodes=new Map();
let famicomCardsMounted=false;
let famicomFilterFrame=0;
try{const saved=JSON.parse(localStorage.getItem(STORAGE)||'null');if(saved){state.owned=new Set(saved.owned||[]);state.imported=!!saved.imported;state.summary=saved.summary||null;state.sort=saved.sort||'TITLE_ASC';}}catch{}
function save(){localStorage.setItem(STORAGE,JSON.stringify({owned:[...state.owned],imported:state.imported,summary:state.summary,sort:state.sort}));}
function coverInfo(id){const row=DATA.covers[id];if(!row)return null;if(Array.isArray(row))return {u:row[0].startsWith('http')?row[0]:LIBRETRO_BASE+row[0],l:row[1]||null};return row;}
function titleFor(x){return x.canonical_title+(x.display_disambiguator?` ${x.display_disambiguator}`:'');}
function az(a,b){return titleFor(a).localeCompare(titleFor(b),undefined,{numeric:true,sensitivity:'base'});}
function priceSort(a,b,dir){const ap=priceByIdentity.get(a.identity_id),bp=priceByIdentity.get(b.identity_id);const ah=Number.isFinite(ap),bh=Number.isFinite(bp);if(ah&&!bh)return -1;if(!ah&&bh)return 1;if(!ah&&!bh)return az(a,b);return ((ap-bp)*dir)||az(a,b);}
function sortList(list){if(state.sort==='TITLE_DESC')return list.sort((a,b)=>-az(a,b));if(state.sort==='OWNED_FIRST')return list.sort((a,b)=>(Number(state.owned.has(b.identity_id))-Number(state.owned.has(a.identity_id)))||az(a,b));if(state.sort==='NEEDED_FIRST')return list.sort((a,b)=>(Number(state.owned.has(a.identity_id))-Number(state.owned.has(b.identity_id)))||az(a,b));if(state.sort==='PRICE_LOW')return list.sort((a,b)=>priceSort(a,b,1));if(state.sort==='PRICE_HIGH')return list.sort((a,b)=>priceSort(a,b,-1));return list.sort(az);}
function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function cardHTML(x,forceOwned=false){const o=forceOwned||state.owned.has(x.identity_id);const name=titleFor(x);const cover=coverInfo(x.identity_id);const art=cover?.u?`<button class="cover-button" type="button" data-cover="${escapeHTML(cover.u)}" data-title="${escapeHTML(name)}" aria-label="Enlarge ${escapeHTML(name)} cover"><img class="cover" src="${escapeHTML(cover.u)}" alt="${escapeHTML(name)} NES box art" loading="lazy" decoding="async"></button>`:`<div class="cover cover-missing" aria-hidden="true"><span>NES</span></div>`;const label=cover?.l?`<em class="product-note">${escapeHTML(cover.l)}</em>`:'';return `<article class="game ${o?'owned':''}" data-identity-id="${escapeHTML(x.identity_id)}">${art}<div class="game-copy"><strong>${escapeHTML(name)}</strong><small>${x.license_class==='UNLICENSED'?'UNLICENSED • ':''}${x.availability.replaceAll('_',' ')}</small>${label}</div><span class="status">${o?'OWNED':'NEEDED'}</span></article>`;}
function mountMainCards(){
  if(mainCardsMounted)return;
  const list=sortList(allIds.slice());
  const host=el('gameList');
  host.innerHTML=list.map(x=>cardHTML(x)).join('');
  for(const node of host.querySelectorAll('.game[data-identity-id]'))mainCardNodes.set(node.dataset.identityId,node);
  mainCardsMounted=true;
}
function refreshMainOwnership(){
  for(const x of allIds){const node=mainCardNodes.get(x.identity_id);if(!node)continue;const owned=state.owned.has(x.identity_id);node.classList.toggle('owned',owned);const badge=node.querySelector('.status');if(badge)badge.textContent=owned?'OWNED':'NEEDED';}
}
function reorderMainCards(){
  if(!mainCardsMounted)return;
  const frag=document.createDocumentFragment();
  for(const x of sortList(allIds.slice())){const node=mainCardNodes.get(x.identity_id);if(node)frag.appendChild(node);}
  el('gameList').appendChild(frag);
}
function applyMainView(){
  mainFilterFrame=0;
  if(!mainCardsMounted)return;
  const q=state.q.trim().toLowerCase();
  const ownedOnly=state.filter==='OWNED',neededOnly=state.filter==='NEEDED';
  for(const x of allIds){
    const node=mainCardNodes.get(x.identity_id);if(!node)continue;
    const owned=state.owned.has(x.identity_id);
    const statusMatch=!ownedOnly&&!neededOnly||(ownedOnly&&owned)||(neededOnly&&!owned);
    const searchMatch=!q||(searchTextById.get(x.identity_id)||'').includes(q);
    node.hidden=!(statusMatch&&searchMatch);
  }
}
function scheduleMainView(){if(mainFilterFrame)cancelAnimationFrame(mainFilterFrame);mainFilterFrame=requestAnimationFrame(applyMainView);}
function updateMainSummary(){const owned=state.owned.size,total=allIds.length,pct=(owned/total*100).toFixed(1);el('ownedCount').textContent=owned;el('totalCount').textContent=total;el('pct').textContent=pct+'%';el('barFill').style.width=pct+'%';if(el('headerProgress'))el('headerProgress').textContent=`${owned} / ${total}`;el('importStatus').textContent=state.imported?`${state.summary?.nes_famicom_game_rows||0} NES/Famicom rows imported • ${state.summary?.matched_non_core_rows||0} tracked outside CORE • ${state.summary?.unmatched_or_reconcile_rows||0} reconcile`:'No GameEye file imported yet';if(state.summary&&el('details'))el('details').textContent=JSON.stringify(state.summary,null,2);if(el('sort'))el('sort').value=state.sort;}
function render({ownershipChanged=false,reorder=false}={}){updateMainSummary();mountMainCards();if(ownershipChanged)refreshMainOwnership();if(reorder)reorderMainCards();applyMainView();}
function renderMyShelf(){const total=allIds.length,owned=state.owned.size,remaining=total-owned,pct=(owned/total*100).toFixed(1);el('shelfOwned').textContent=owned;el('shelfRemaining').textContent=remaining;el('shelfPct').textContent=pct+'%';el('shelfBar').style.width=pct+'%';const q=(el('shelfSearch')?.value||'').trim().toLowerCase();const ownedGames=allIds.filter(x=>state.owned.has(x.identity_id)).filter(x=>!q||x.canonical_title.toLowerCase().includes(q)||(x.aliases||[]).some(a=>a.toLowerCase().includes(q))).sort(az);el('shelfList').innerHTML=ownedGames.length?ownedGames.map(x=>cardHTML(x,true)).join(''):`<div class="shelf-empty">${state.imported?'No owned games match that search.':'Import Matty\'s GameEye CSV first and his shelf will appear here.'}</div>`;}
function roulettePool(){if(rouletteMode==='OWNED')return allIds.filter(x=>state.owned.has(x.identity_id));if(rouletteMode==='NEEDED')return allIds.filter(x=>!state.owned.has(x.identity_id));return allIds;}
function setRouletteMode(mode){rouletteMode=mode;document.querySelectorAll('[data-roulette-mode]').forEach(b=>b.classList.toggle('active',b.dataset.rouletteMode===mode));spinRoulette();}
function spinRoulette(){const pool=roulettePool();const result=el('rouletteResult');const info=el('rouletteInfo');if(!pool.length){result.innerHTML=`<div class="roulette-empty">${rouletteMode==='OWNED'&&!state.imported?'Import Matty\'s GameEye CSV first so Roulette knows what is on his shelf.':'No games are available in this group.'}</div>`;info.textContent='';return;}let unseen=pool.filter(x=>!rouletteSeen[rouletteMode].has(x.identity_id));let reshuffled=false;if(!unseen.length){rouletteSeen[rouletteMode].clear();unseen=pool;reshuffled=true;}const pick=unseen[Math.floor(Math.random()*unseen.length)];rouletteSeen[rouletteMode].add(pick.identity_id);const owned=state.owned.has(pick.identity_id);const cover=coverInfo(pick.identity_id);const name=titleFor(pick);const art=cover?.u?`<button class="roulette-cover-button cover-button" type="button" data-cover="${escapeHTML(cover.u)}" data-title="${escapeHTML(name)}"><img src="${escapeHTML(cover.u)}" alt="${escapeHTML(name)} NES box art"></button>`:`<div class="roulette-cover-missing">NES</div>`;const label=cover?.l?`<div class="roulette-product">${escapeHTML(cover.l)}</div>`:'';result.innerHTML=`<div class="roulette-pick ${owned?'owned':''}" data-identity-id="${escapeHTML(pick.identity_id)}">${art}<div class="roulette-copy"><span class="roulette-kicker">YOUR PICK</span><h3>${escapeHTML(name)}</h3><div class="roulette-meta">${pick.license_class==='UNLICENSED'?'UNLICENSED • ':''}${pick.availability.replaceAll('_',' ')}</div>${label}<span class="roulette-status ${owned?'owned':''}">${owned?'OWNED':'NEEDED'}</span></div></div>`;const remaining=Math.max(pool.length-rouletteSeen[rouletteMode].size,0);info.textContent=reshuffled?`You saw every ${rouletteMode.toLowerCase()} game — deck reshuffled.`:`${remaining} unseen ${rouletteMode.toLowerCase()} game${remaining===1?'':'s'} left before a reshuffle.`;}
function lockPage(){modalScrollY=window.scrollY||0;document.body.classList.add('shelf-open');document.body.style.position='fixed';document.body.style.top=`-${modalScrollY}px`;document.body.style.width='100%';}
function unlockPage(){document.body.classList.remove('shelf-open');document.body.style.position='';document.body.style.top='';document.body.style.width='';window.scrollTo(0,modalScrollY);}
el('file').addEventListener('change',async e=>{
  const f=e.target.files[0];if(!f)return;
  const text=await f.text();
  const result=importGameEye(text,DATA);
  state.owned=new Set(result.owned_core_identities.map(x=>x.identity_id));
  state.imported=true;state.summary=result.summary;Object.values(rouletteSeen).forEach(s=>s.clear());save();
  await ensureFamicomLoaded();
  const fcResult=importFamicomGameEye(text,famicomCensus);
  famicomOwned=new Set(fcResult.owned_famicom_identities.map(x=>x.identity_id));
  famicomImported=true;famicomSummary=fcResult.summary;saveFamicom();
  render({ownershipChanged:true,reorder:true});
  if(famicomCardsMounted){refreshFamicomOwnership();reorderFamicomCards();}
  if(activeSet==='FAMICOM'){updateFamicomSummary();applyFamicomView();}
  window.dispatchEvent(new CustomEvent('shelfcheck:famicom-imported',{detail:fcResult.summary}));
});
el('search').addEventListener('input',e=>{state.q=e.target.value;if(activeSet==='NES')scheduleMainView();else scheduleFamicomView();});
if(el('sort'))el('sort').addEventListener('change',e=>{state.sort=e.target.value;save();if(activeSet==='NES'){reorderMainCards();applyMainView();}else{reorderFamicomCards();applyFamicomView();}});
for(const b of document.querySelectorAll('[data-filter]'))b.addEventListener('click',()=>{state.filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));if(activeSet==='NES')scheduleMainView();else scheduleFamicomView();});
el('myShelfBtn')?.addEventListener('click',()=>{el('shelfSearch').value='';renderMyShelf();lockPage();el('myShelfDialog').showModal();});
el('myShelfDialog')?.addEventListener('close',()=>{if(activeSet==='NES')unlockPage();});
el('shelfSearch')?.addEventListener('input',renderMyShelf);
el('rouletteBtn')?.addEventListener('click',()=>{rouletteMode=state.imported?'OWNED':'ALL';document.querySelectorAll('[data-roulette-mode]').forEach(b=>b.classList.toggle('active',b.dataset.rouletteMode===rouletteMode));lockPage();el('rouletteDialog').showModal();spinRoulette();});
el('rouletteDialog')?.addEventListener('close',()=>{if(activeSet==='NES')unlockPage();});
el('rouletteSpin')?.addEventListener('click',spinRoulette);
for(const b of document.querySelectorAll('[data-roulette-mode]'))b.addEventListener('click',()=>setRouletteMode(b.dataset.rouletteMode));
el('reset').addEventListener('click',()=>{if(confirm('Clear the local NES + Famicom ownership import on this device?')){
  localStorage.removeItem(STORAGE);localStorage.removeItem(FAMICOM_STORAGE);
  state={owned:new Set(),imported:false,summary:null,filter:'ALL',q:'',sort:'TITLE_ASC'};
  famicomOwned=new Set();famicomImported=false;famicomSummary=null;
  Object.values(rouletteSeen).forEach(s=>s.clear());el('search').value='';if(el('sort'))el('sort').value='TITLE_ASC';
  document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x.dataset.filter==='ALL'));
  if(el('details'))el('details').textContent='Import Matty\'s GameEye file to test ownership matching.';
  render({ownershipChanged:true,reorder:true});if(famicomCardsMounted)refreshFamicomOwnership();if(activeSet==='FAMICOM')updateFamicomSummary();
}});
document.addEventListener('click',e=>{const b=e.target.closest('.cover-button');if(!b)return;const d=el('coverDialog');el('coverDialogImg').src=b.dataset.cover;el('coverDialogImg').alt=`${b.dataset.title} NES box art`;el('coverDialogTitle').textContent=b.dataset.title;d.showModal();});
function updateFamicomSummary(){
  const owned=famicomOwned.size,total=famicomIds.length||1040,pct=total?(owned/total*100).toFixed(1):'0.0';
  el('ownedCount').textContent=owned;el('totalCount').textContent=total;el('pct').textContent=pct+'%';el('barFill').style.width=pct+'%';
  if(el('headerProgress'))el('headerProgress').textContent=`${owned} / ${total}`;
  if(el('importStatus'))el('importStatus').textContent=famicomImported
    ?`${famicomSummary?.famicom_japan_game_rows||0} Famicom Japan rows imported • ${famicomSummary?.matched_famicom_rows||0} matched • ${famicomSummary?.unmatched_or_reconcile_rows||0} reconcile`
    :'No Famicom GameEye rows imported yet';
  if(famicomSummary&&el('details'))el('details').textContent=JSON.stringify({FAMICOM:famicomSummary,NES:state.summary},null,2);
}
function mountFamicomCards(){
  if(famicomCardsMounted)return;
  const host=el('famicomGameList');
  host.innerHTML=fSortList(famicomIds.slice()).map(fCardHTML).join('');
  for(const node of host.querySelectorAll('.famicom-game[data-identity-id]'))famicomCardNodes.set(node.dataset.identityId,node);
  famicomCardsMounted=true;
}
function reorderFamicomCards(){
  if(!famicomCardsMounted)return;
  const frag=document.createDocumentFragment();
  for(const x of fSortList(famicomIds.slice())){const node=famicomCardNodes.get(x.identity_id);if(node)frag.appendChild(node);}
  el('famicomGameList').appendChild(frag);
}
function updateFamicomCardOwnership(id){
  const node=famicomCardNodes.get(id);if(!node)return;
  const owned=famicomOwned.has(id);node.classList.toggle('owned',owned);
  const badge=node.querySelector('.famicom-toggle');if(badge){badge.textContent=owned?'OWNED':'NEEDED';badge.setAttribute('aria-label',`Mark ${id} ${owned?'needed':'owned'}`);}
}
function refreshFamicomOwnership(){for(const id of famicomCardNodes.keys())updateFamicomCardOwnership(id);}
function applyFamicomView(){
  famicomFilterFrame=0;if(!famicomCardsMounted)return;
  const q=state.q.trim().toLowerCase(),ownedOnly=state.filter==='OWNED',neededOnly=state.filter==='NEEDED';
  for(const x of famicomIds){
    const node=famicomCardNodes.get(x.identity_id);if(!node)continue;
    const owned=famicomOwned.has(x.identity_id);
    const statusMatch=!ownedOnly&&!neededOnly||(ownedOnly&&owned)||(neededOnly&&!owned);
    const searchMatch=!q||(famicomSearch.get(x.identity_id)||'').includes(q);
    node.hidden=!(statusMatch&&searchMatch);
  }
}
function scheduleFamicomView(){if(famicomFilterFrame)cancelAnimationFrame(famicomFilterFrame);famicomFilterFrame=requestAnimationFrame(applyFamicomView);}
async function renderFamicom(){
  const host=el('famicomGameList');
  if(!famicomLoaded){
    host.innerHTML='<div class="shelf-empty">Loading Famicom shelf…</div>';
    updateFamicomSummary();
    try{await ensureFamicomLoaded();}catch(err){host.innerHTML='<div class="shelf-empty">Famicom data failed to load. Refresh and try again.</div>';throw err;}
    if(activeSet!=='FAMICOM')return;
  }
  mountFamicomCards();updateFamicomSummary();applyFamicomView();
}
function paintSet(){
  document.body.dataset.activeSet=activeSet;
  document.querySelectorAll('[data-set]').forEach(b=>b.classList.toggle('active',b.dataset.set===activeSet));
  el('setLabel').textContent=`MATTY'S SET · ${activeSet==='NES'?'NES':'FAMICOM'}`;
  el('heroEyebrow').textContent=activeSet==='NES'?'PHYSICAL NES COLLECTION COMPANION':'PHYSICAL FAMICOM COLLECTION COMPANION';
  el('summaryLabel').textContent=activeSet==='NES'?'NORTH AMERICAN CORE SET':'JAPANESE FAMICOM CARTRIDGE SET';
  el('search').placeholder=activeSet==='NES'?'Search ShelfCheck…':'Search Japanese, romanized or English title…';
  el('gameList').hidden=activeSet!=='NES';
  el('famicomGameList').hidden=activeSet!=='FAMICOM';
  if(activeSet==='NES'){render();}else{renderFamicom();}
}
document.querySelectorAll('[data-set]').forEach(b=>b.addEventListener('click',()=>{if(activeSet===b.dataset.set)return;activeSet=b.dataset.set;localStorage.setItem(SET_STORAGE,activeSet);state.q='';el('search').value='';paintSet();}));
el('famicomGameList').addEventListener('click',e=>{if(activeSet!=='FAMICOM')return;const b=e.target.closest('[data-famicom-toggle]');if(!b)return;e.preventDefault();e.stopPropagation();const id=b.dataset.famicomToggle;if(famicomOwned.has(id))famicomOwned.delete(id);else famicomOwned.add(id);saveFamicom();updateFamicomCardOwnership(id);updateFamicomSummary();applyFamicomView();});
window.addEventListener('shelfcheck:famicom-ownership-changed',()=>{try{const f=JSON.parse(localStorage.getItem(FAMICOM_STORAGE)||'null');famicomOwned=new Set(f?.owned||[]);famicomImported=!!f?.imported;famicomSummary=f?.summary||null;}catch{famicomOwned=new Set();famicomImported=false;famicomSummary=null;}if(famicomCardsMounted)refreshFamicomOwnership();if(activeSet==='FAMICOM'){updateFamicomSummary();applyFamicomView();}});
paintSet();
// Test deployment: service worker intentionally disabled while NES/Famicom integration is being validated.
