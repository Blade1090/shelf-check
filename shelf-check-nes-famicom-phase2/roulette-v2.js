const RV2_CENSUS=await fetch('./nes-census.json').then(r=>r.json());
const RV2_PRICES=await fetch('./prices-nes.json').then(r=>r.json()).catch(()=>({rows:[]}));
const RV2_LIB='https://raw.githubusercontent.com/libretro-thumbnails/Nintendo_-_Nintendo_Entertainment_System/4d21463bf5d553afc34d99183c9ad5833f773b93/Named_Boxarts/';
const RV2_LAUNCH='https://images.launchbox-app.com/';
const RV2_COVERS={};
const rv2CoverLoads=await Promise.all([fetch('./covers-001-100.json').then(r=>r.json()).catch(()=>({})),...['101-200','201-300','301-400','401-500','501-600','601-700','701-800','801-815'].map(n=>fetch(`./covers-${n}.json`).then(r=>r.json()).catch(()=>[]))]);
Object.assign(RV2_COVERS,rv2CoverLoads[0]);
for(const rows of rv2CoverLoads.slice(1))for(const [id,src,val,label] of rows)RV2_COVERS[id]={u:src===0?RV2_LIB+val:src===1?RV2_LAUNCH+val:val,l:label||null};
const RV2_ALL=Object.values(RV2_CENSUS.identities).flat();
const rv2ProductPrice=new Map((RV2_PRICES.rows||[]).map(([id,p])=>[Number(id),Number(p)]));
const rv2Price=new Map();
for(const x of RV2_ALL){const rows=(x.product_ids||[]).map(s=>Number(String(s).replace('pc-',''))).filter(id=>rv2ProductPrice.has(id)).map(id=>rv2ProductPrice.get(id));if(rows.length)rv2Price.set(x.identity_id,Math.min(...rows));}
const rv2Seen=new Map();
let rv2Mode='OWNED',rv2PriceFilter='ANY',rv2LengthFilter='ANY';
const rv2$=id=>document.getElementById(id);
const rv2Esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rv2Money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
function rv2Owned(){try{return new Set(JSON.parse(localStorage.getItem('shelfcheck-nes-matty-v1')||'{}').owned||[])}catch{return new Set()}}
function rv2Title(x){return x.canonical_title+(x.display_disambiguator?` ${x.display_disambiguator}`:'')}
function rv2Cover(id){const r=RV2_COVERS[id];if(!r)return null;if(Array.isArray(r))return {u:r[0].startsWith('http')?r[0]:RV2_LIB+r[0],l:r[1]||null};return r}
function rv2Dossier(id){const d=window.NES_DOSSIERS;if(!d)return null;if(d.byId?.get)return d.byId.get(id)||null;if(d.byId&&typeof d.byId==='object')return d.byId[id]||null;if(d instanceof Map)return d.get(id)||null;return d[id]||null}
function rv2Hours(x){const d=rv2Dossier(x.identity_id);if(!d)return null;const v=d.hltb_main_hours??d.main_hours??d.hltb?.main??d.hltbMainHours;if(v==null||v==='')return null;const n=Number(v);return Number.isFinite(n)&&n>=0?n:null}
function rv2HasHltb(){return RV2_ALL.some(x=>rv2Hours(x)!=null)}
function rv2PriceOk(x){if(rv2PriceFilter==='ANY')return true;const p=rv2Price.get(x.identity_id);if(!Number.isFinite(p))return false;if(rv2PriceFilter==='UNDER10')return p<10;if(rv2PriceFilter==='10_20')return p>=10&&p<20;if(rv2PriceFilter==='20_40')return p>=20&&p<40;if(rv2PriceFilter==='40PLUS')return p>=40;return true}
function rv2LengthOk(x){if(rv2LengthFilter==='ANY')return true;const h=rv2Hours(x);if(h==null)return false;if(rv2LengthFilter==='UNDER4')return h<4;if(rv2LengthFilter==='4_8')return h>=4&&h<8;if(rv2LengthFilter==='8_15')return h>=8&&h<15;if(rv2LengthFilter==='15PLUS')return h>=15;return true}
function rv2Pool(){const owned=rv2Owned();return RV2_ALL.filter(x=>rv2Mode==='ALL'||(rv2Mode==='OWNED'?owned.has(x.identity_id):!owned.has(x.identity_id))).filter(rv2PriceOk).filter(rv2LengthOk)}
function rv2Key(){return `${rv2Mode}|${rv2PriceFilter}|${rv2LengthFilter}`}
function rv2SyncModes(){document.querySelectorAll('[data-roulette-mode]').forEach(b=>b.classList.toggle('active',b.dataset.rouletteMode===rv2Mode))}
function rv2SyncFilters(){const p=rv2$('roulettePrice');if(p)p.value=rv2PriceFilter;const l=rv2$('rouletteLength');if(l){const has=rv2HasHltb();l.disabled=!has;l.value=has?rv2LengthFilter:'ANY';l.title=has?'Filter by HLTB main-story length':'No usable HLTB main-time data loaded';}const note=rv2$('rouletteFilterNote');if(note)note.textContent=rv2HasHltb()?'Filters use loose-market snapshot + dossier HLTB main time.':'Price filter is live. Length needs a verified or estimated HLTB main time.'}
function rv2Spin(){
  const pool=rv2Pool(),result=rv2$('rouletteResult'),info=rv2$('rouletteInfo');if(!result||!info)return;
  if(!pool.length){result.innerHTML='<div class="roulette-empty">Nothing matches those filters. Widen the price/length range or switch shelf status.</div>';info.textContent='0 matches';return;}
  const key=rv2Key();if(!rv2Seen.has(key))rv2Seen.set(key,new Set());const seen=rv2Seen.get(key);let unseen=pool.filter(x=>!seen.has(x.identity_id)),reshuffled=false;if(!unseen.length){seen.clear();unseen=pool;reshuffled=true;}
  const pick=unseen[Math.floor(Math.random()*unseen.length)];seen.add(pick.identity_id);
  const owned=rv2Owned().has(pick.identity_id),cover=rv2Cover(pick.identity_id),price=rv2Price.get(pick.identity_id),hours=rv2Hours(pick);const name=rv2Title(pick);const product=cover?.l?`<div class="roulette-product">${rv2Esc(cover.l)}</div>`:'';
  const art=cover?.u?`<div class="roulette-cover-button"><img src="${rv2Esc(cover.u)}" alt="${rv2Esc(name)} NES box art"></div>`:'<div class="roulette-cover-missing">NES</div>';
  result.innerHTML=`<article class="roulette-pick ${owned?'owned':''}" data-identity-id="${rv2Esc(pick.identity_id)}">${art}<div class="roulette-copy"><span class="roulette-kicker">YOUR PICK</span><h3>${rv2Esc(name)}</h3><div class="roulette-meta">${pick.license_class==='UNLICENSED'?'UNLICENSED • ':''}${pick.availability.replaceAll('_',' ')}</div>${product}<div class="roulette-facts"><span class="roulette-status ${owned?'owned':''}">${owned?'OWNED':'NEEDED'}</span>${Number.isFinite(price)?`<span class="roulette-fact"><small>LOOSE</small>${rv2Money(price)}</span>`:''}${hours!=null?`<span class="roulette-fact"><small>HLTB</small>${hours.toFixed(hours%1?1:0)}h</span>`:''}</div><div class="roulette-dossier-hint">TAP CARD FOR FULL DOSSIER</div></div></article>`;
  const remaining=Math.max(pool.length-seen.size,0);info.textContent=reshuffled?`You saw all ${pool.length} matches — deck reshuffled.`:`${pool.length} match${pool.length===1?'':'es'} · ${remaining} unseen before reshuffle.`;
}
function rv2Install(){
  const modes=document.querySelector('.roulette-modes');if(!modes||rv2$('roulettePrice'))return;
  for(const old of [...modes.querySelectorAll('[data-roulette-mode]')]){const b=old.cloneNode(true);old.replaceWith(b);b.addEventListener('click',()=>{rv2Mode=b.dataset.rouletteMode;rv2SyncModes();rv2Spin();});}
  const filters=document.createElement('section');filters.className='roulette-filters';filters.innerHTML=`<label><span>PRICE</span><select id="roulettePrice"><option value="ANY">ANY PRICE</option><option value="UNDER10">UNDER $10</option><option value="10_20">$10–20</option><option value="20_40">$20–40</option><option value="40PLUS">$40+</option></select></label><label><span>LENGTH</span><select id="rouletteLength"><option value="ANY">ANY LENGTH</option><option value="UNDER4">UNDER 4H</option><option value="4_8">4–8H</option><option value="8_15">8–15H</option><option value="15PLUS">15H+</option></select></label><div id="rouletteFilterNote" class="roulette-filter-note"></div>`;modes.after(filters);
  rv2$('roulettePrice').addEventListener('change',e=>{rv2PriceFilter=e.target.value;rv2Spin();});rv2$('rouletteLength').addEventListener('change',e=>{rv2LengthFilter=e.target.value;rv2Spin();});
  const oldSpin=rv2$('rouletteSpin');if(oldSpin){const spin=oldSpin.cloneNode(true);oldSpin.replaceWith(spin);spin.addEventListener('click',rv2Spin);}
  const launch=rv2$('rouletteBtn');launch?.addEventListener('click',()=>setTimeout(()=>{const imported=JSON.parse(localStorage.getItem('shelfcheck-nes-matty-v1')||'{}').imported;rv2Mode=imported?'OWNED':'ALL';rv2SyncModes();rv2SyncFilters();rv2Spin();},0));
  rv2SyncFilters();
  window.addEventListener('shelfcheck:dossiers-ready',()=>{rv2SyncFilters();rv2Spin();});
}
rv2Install();
