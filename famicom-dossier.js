const FC_STORAGE='shelfcheck-famicom-matty-v1';
const NES_STORAGE='shelfcheck-nes-matty-v1';
const FC_WISHLIST='shelfcheck-famicom-matty-wishlist-v1';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const [fcCensus,fcArt,manifest,fcPriceData]=await Promise.all([
  fetch('./famicom-census.json').then(r=>r.json()),
  fetch('./famicom-artwork.json').then(r=>r.json()).catch(()=>({})),
  fetch('./famicom-dossiers-manifest.json').then(r=>r.json()),
  fetch('./prices-famicom.json').then(r=>r.ok?r.json():({rows:[]})).catch(()=>({rows:[]}))
]);
const chunks=await Promise.all((manifest.chunks||[]).map(c=>fetch(`./${c.file}`).then(r=>r.json())));
const byId=new Map((fcCensus.identities||[]).map(x=>[x.identity_id,x]));
const dossiers=new Map(chunks.flat().map(x=>[x.identity_id,x]));
const fcPriceById=new Map((fcPriceData.rows||[]).map(([id,p])=>[id,Number(p)]));
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(n);

function readOwned(key){try{return new Set(JSON.parse(localStorage.getItem(key)||'{}').owned||[])}catch{return new Set()}}
function readWishlist(){try{return new Set(JSON.parse(localStorage.getItem(FC_WISHLIST)||'[]'))}catch{return new Set()}}
function wishlistButton(id,owned){
  if(owned)return '';
  const on=readWishlist().has(id);
  return `<button class="fc-dossier-wishlist ${on?'active':''}" type="button" data-fc-dossier-wish="${esc(id)}">${on?'♥ ON WISHLIST':'♡ ADD TO WISHLIST'}</button>`;
}
function title(x){return x?.japanese_title||x?.romanized_title||x?.english_reference_title||x?.identity_id||'Famicom'}
function langClass(v){return ['LOW','MEDIUM','HIGH'].includes(v)?v.toLowerCase():'unknown'}
function relationLabel(type){return String(type||'').replaceAll('_',' ').toLowerCase().replace(/\b\w/g,m=>m.toUpperCase())}
function cartInfo(id){return window.FAMICOM_CART_COLORS?.get?.(id)||null}
function cartLabel(c){
  if(!c||c.group==='UNKNOWN')return 'UNKNOWN';
  return c.display||String(c.group).replaceAll('_',' ');
}
function cartVariants(c){
  return (c?.variants||[]).map(v=>v?.[1]||v?.[0]).filter(Boolean);
}
function cartBlock(id){
  const c=cartInfo(id),group=String(c?.group||'UNKNOWN').toLowerCase(),label=cartLabel(c),variants=cartVariants(c);
  const detail=c?.group&&c.group!=='UNKNOWN'
    ? `<p>${esc(c.source||'Verified source')}${c.confidence?` · ${esc(c.confidence)} confidence`:''}</p>`
    : `<p>${esc(c?.note||'No reliable cartridge-color source yet.')}</p>`;
  const variantHtml=variants.length?`<div class="fc-cart-variants"><small>KNOWN VARIANT</small><b>${esc(variants.join(' / '))}</b></div>`:'';
  return `<div class="dossier-block fc-cart-block"><h4>CARTRIDGE SHELL</h4><div class="fc-cart-big"><span class="famicom-cart-swatch ${group}"></span><b>${esc(label)}</b></div>${variantHtml}${detail}</div>`;
}
function cartHero(id){
  const c=cartInfo(id),group=String(c?.group||'UNKNOWN').toLowerCase(),label=cartLabel(c);
  return `<span class="fc-hero-cart"><span class="famicom-cart-swatch ${group}"></span><b>CART · ${esc(label)}</b></span>`;
}
function markButton(id,owned){return `<button class="fc-own-toggle ${owned?'owned':''}" type="button" data-fc-own="${esc(id)}">${owned?'✓ OWNED · MARK NEEDED':'+ MARK FAMICOM OWNED'}</button>`}
function render(id){
  const changing=window.ShelfCheckDossierScroll?.current?.()!==id;
  if(changing)window.ShelfCheckDossierScroll?.resetDetailTop?.();
  const x=byId.get(id);if(!x)return;
  const body=changing?(window.ShelfCheckDossierScroll?.freshBody?.()||document.getElementById('dossierBody')):document.getElementById('dossierBody');
  const d=dossiers.get(id)||{},owned=readOwned(FC_STORAGE).has(id),nesOwned=x.nes_identity_id?readOwned(NES_STORAGE).has(x.nes_identity_id):false;
  const dlg=document.getElementById('dossierDialog'),head=document.getElementById('dossierTitle');if(!dlg||!body||!head)return;
  const art=fcArt[id]?.box||null,eng=x.english_reference_title||x.romanized_title||'',meta=[x.release_date,x.publisher,x.developer,x.product_code].filter(Boolean).join(' · '),loose=fcPriceById.get(id);
  const counterpart=x.nes_identity_id?`<section class="fc-counterpart ${nesOwned?'owned':''}"><div><small>NES SHELF</small><b>${nesOwned?'OWNED':'NOT OWNED'}</b></div><div><strong>${esc(x.nes_title||x.nes_identity_id)}</strong><span>${esc(relationLabel(x.relationship_type))}${x.relationship_confidence?` · ${esc(x.relationship_confidence)} confidence`:''}</span></div></section>`:`<section class="fc-counterpart japan-only"><div><small>NES COUNTERPART</small><b>NONE</b></div><div><strong>Japan-only identity</strong><span>No NES counterpart is linked for collection purposes.</span></div></section>`;
  head.textContent=title(x);
  body.innerHTML=`
    <section class="dossier-card fc-dossier-card">
      <section class="dossier-hero">
        <div class="dossier-cover-wrap">${art?`<img src="${esc(art)}" alt="${esc(title(x))} Famicom box art">`:'<div class="dossier-cover-missing">FC</div>'}</div>
        <div class="dossier-identity">
          <div class="dossier-title-row"><div><h3 class="fc-jp-title">${esc(title(x))}</h3>${eng&&eng!==title(x)?`<div class="fc-eng-title">${esc(eng)}</div>`:''}<div class="dossier-meta">${esc(meta||'Japanese Famicom cartridge')}</div></div><span class="dossier-badge ${owned?'owned':''}">${owned?'OWNED':'NEEDED'}</span></div>
          <div class="dossier-actions">${markButton(id,owned)}${wishlistButton(id,owned)}${cartHero(id)}</div>
        </div>
      </section>
      ${counterpart}
    </section>
    <section class="dossier-research-head"><div><small>MATTY'S SET · FAMICOM</small><h3>FAMICOM DOSSIER</h3></div><span class="dossier-confidence ${String(d.confidence||x.confidence||'').toLowerCase()}">${esc(d.confidence||x.confidence||'')} RESEARCH</span></section>
    <section class="dossier-grid">
      ${cartBlock(id)}
      ${Number.isFinite(loose)?`<div class="dossier-block fc-price-block"><h4>HUNT PRICE · LOOSE</h4><div class="fc-price-big">${money(loose)}</div><p>PriceCharting loose snapshot · ${esc(fcPriceData.snapshot||'2026-09-25')}</p></div>`:''}
      <div class="dossier-block fc-language-block"><h4>LANGUAGE BARRIER</h4><div class="fc-language-big ${langClass(d.language_barrier||x.language_barrier)}">${esc(d.language_barrier||x.language_barrier||'UNKNOWN')}</div><p>${esc(d.language_barrier_reason||'No language-barrier note is available yet.')}</p></div>
      <div class="dossier-block"><h4>GAME INFO</h4><div class="dossier-kv"><div><small>RELEASE</small><b>${esc(x.release_date||'—')}</b></div><div><small>PUBLISHER</small><b>${esc(x.publisher||'—')}</b></div><div><small>DEVELOPER</small><b>${esc(x.developer||'—')}</b></div><div><small>PRODUCT CODE</small><b>${esc(x.product_code||'—')}</b></div><div><small>GENRE</small><b>${esc([x.primary_genre,...(x.secondary_genres||[])].filter(Boolean).join(' / ')||'—')}</b></div><div><small>ENGLISH TITLE</small><b>${esc(x.english_title_type?x.english_title_type.replaceAll('_',' '):'—')}</b></div></div></div>
      <div class="dossier-block wide"><h4>WHAT IS IT?</h4><p>${esc(d.dossier||d.gameplay_summary||'Research note pending.')}</p></div>
      <div class="dossier-block wide"><h4>HOW IT PLAYS</h4><p>${esc(d.gameplay_summary||'Gameplay summary pending.')}</p></div>
      ${d.nes_counterpart_context?`<div class="dossier-block wide"><h4>NES CONNECTION</h4><p>${esc(d.nes_counterpart_context)}</p></div>`:''}
      ${d.japanese_version_notes?`<div class="dossier-block wide"><h4>JAPANESE VERSION NOTES</h4><p>${esc(d.japanese_version_notes)}</p></div>`:''}
    </section>`;
  window.ShelfCheckDossierScroll?.open(id);
}
window.openFamicomDossier=render;
document.addEventListener('click',e=>{
  const wishBtn=e.target.closest('[data-fc-dossier-wish]');if(wishBtn){e.preventDefault();e.stopPropagation();const id=wishBtn.dataset.fcDossierWish,w=readWishlist();w.has(id)?w.delete(id):w.add(id);localStorage.setItem(FC_WISHLIST,JSON.stringify([...w]));window.dispatchEvent(new CustomEvent('shelfcheck:famicom-wishlist-changed',{detail:{id,on:w.has(id)}}));render(id);return;}
  const own=e.target.closest('[data-fc-own]');if(own){e.preventDefault();e.stopPropagation();const id=own.dataset.fcOwn,owned=readOwned(FC_STORAGE);if(owned.has(id))owned.delete(id);else owned.add(id);let prev={};try{prev=JSON.parse(localStorage.getItem(FC_STORAGE)||'{}')}catch{}localStorage.setItem(FC_STORAGE,JSON.stringify({...prev,owned:[...owned]}));window.dispatchEvent(new Event('shelfcheck:famicom-ownership-changed'));render(id);return;}
  if(e.target.closest('button,input,select,a'))return;
  const card=e.target.closest('.famicom-game[data-identity-id]');if(card)render(card.dataset.identityId);
});
document.getElementById('dossierDialog')?.addEventListener('close',()=>window.ShelfCheckDossierScroll?.close());
