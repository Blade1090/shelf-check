const FC_OWN='shelfcheck-famicom-matty-v1';
const FC_PLAY='shelfcheck-famicom-matty-play-v1';
const FC_WISH='shelfcheck-famicom-matty-wishlist-v1';
const NES_OWN='shelfcheck-nes-matty-v1';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
const $=id=>document.getElementById(id);
const active=()=>document.body.dataset.activeSet==='FAMICOM';
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(n);

function ownState(){try{return JSON.parse(localStorage.getItem(FC_OWN)||'{}')}catch{return{}}}
function owned(){return new Set(ownState().owned||[])}
function nesOwned(){try{return new Set(JSON.parse(localStorage.getItem(NES_OWN)||'{}').owned||[])}catch{return new Set()}}
function play(){try{const p=JSON.parse(localStorage.getItem(FC_PLAY)||'{}');return{played:new Set(p.played||[]),beaten:new Set(p.beaten||[])}}catch{return{played:new Set(),beaten:new Set()}}}
function savePlay(p){localStorage.setItem(FC_PLAY,JSON.stringify({played:[...p.played],beaten:[...p.beaten]}));window.dispatchEvent(new Event('shelfcheck:famicom-play-state'))}
function status(id){const p=play();return p.beaten.has(id)?'BEATEN':p.played.has(id)?'PLAYED':'UNPLAYED'}
function setStatus(id,s){const p=play();p.played.delete(id);p.beaten.delete(id);if(s==='PLAYED')p.played.add(id);if(s==='BEATEN')p.beaten.add(id);savePlay(p)}

function wish(){try{return new Set(JSON.parse(localStorage.getItem(FC_WISH)||'[]'))}catch{return new Set()}}
function saveWish(w){localStorage.setItem(FC_WISH,JSON.stringify([...w]));updateCount();enhanceCards(document)}
function toggleWish(id){const w=wish(),o=owned();if(o.has(id)||w.has(id))w.delete(id);else w.add(id);saveWish(w)}
function updateCount(){
  const n=active()?wish().size:(()=>{try{return new Set(JSON.parse(localStorage.getItem('shelfcheck-nes-matty-wishlist-v1')||'[]')).size}catch{return 0}})();
  document.querySelectorAll('[data-wishlist-count]').forEach(x=>x.textContent=n);
}

async function data(){
  if(window.FAMICOM_SHELF_DATA)return window.FAMICOM_SHELF_DATA;
  return await new Promise((resolve,reject)=>{
    const done=()=>{if(window.FAMICOM_SHELF_DATA){cleanup();resolve(window.FAMICOM_SHELF_DATA)}};
    const cleanup=()=>{window.removeEventListener('shelfcheck:famicom-data-ready',done);clearTimeout(to)};
    const to=setTimeout(()=>{cleanup();reject(new Error('Famicom data is still loading.'))},8000);
    window.addEventListener('shelfcheck:famicom-data-ready',done,{once:true});done();
  });
}
const title=x=>x?.english_reference_title||x?.romanized_title||x?.japanese_title||x?.identity_id||'Famicom';
const jp=x=>x?.japanese_title||x?.romanized_title||title(x);
const sortAz=(a,b)=>title(a).localeCompare(title(b),undefined,{numeric:true,sensitivity:'base'});
function art(d,x,cls='ct-cover'){const u=d.artwork?.[x.identity_id]?.box;return u?`<img class="${cls}" src="${esc(u)}" alt="${esc(title(x))} Famicom box art" loading="lazy" decoding="async">`:`<div class="${cls} ct-cover-missing">FC</div>`}
function price(d,x){const n=d.prices?.get?.(x.identity_id);return Number.isFinite(n)?n:null}
function cart(d,x){return d.cartColors?.get?.(x.identity_id)||{group:'UNKNOWN',display:null,variants:[]}}
function cartText(c){if(!c||c.group==='UNKNOWN')return 'CART ?';const vs=(c.variants||[]).map(v=>v?.[1]||v?.[0]).filter(Boolean);return 'CART '+(c.display||c.group.replaceAll('_',' '))+(vs.length?' / '+vs.join(' / '):'')}
function lang(x){return String(x.language_barrier||'UNKNOWN').toUpperCase()}
function openDossier(dlg,id){if(dlg?.open)dlg.close();setTimeout(()=>window.openFamicomDossier?.(id),0)}

function enhanceCards(root=document){
  const cards=[];if(root?.matches?.('.famicom-game'))cards.push(root);
  root.querySelectorAll?.('.famicom-game').forEach(c=>cards.push(c));
  const w=wish(),o=owned();
  for(const card of cards){
    const id=card.dataset.identityId;if(!id)continue;
    let heart=card.querySelector('.wishlist-heart');
    if(o.has(id)){heart?.remove();continue}
    if(!heart){heart=document.createElement('button');heart.type='button';heart.className='wishlist-heart';heart.dataset.fcWishlist=id;heart.title='Famicom wishlist';card.appendChild(heart)}
    const on=w.has(id);heart.classList.toggle('active',on);heart.textContent=on?'♥':'♡';heart.setAttribute('aria-label',on?'Remove from Famicom wishlist':'Add to Famicom wishlist');
  }
}
new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes)if(n.nodeType===1)enhanceCards(n)}).observe(document.body,{childList:true,subtree:true});
new MutationObserver(()=>{updateCount();if(active())enhanceCards(document)}).observe(document.body,{attributes:true,attributeFilter:['data-active-set']});
window.addEventListener('shelfcheck:famicom-imported',()=>enhanceCards(document));
window.addEventListener('shelfcheck:famicom-ownership-changed',()=>enhanceCards(document));
updateCount();

// ---------- ROULETTE ----------
let seen=new Set(),includePlayed=false,includeBeaten=false,lowOnly=false,currentHand=[],picking=false,pickTimer=null;
function role(d,x){
  const p=price(d,x);
  if(lang(x)==='LOW')return['⚡','LOW BARRIER'];
  if(!x.nes_identity_id)return['🇯🇵','JAPAN ONLY'];
  if(p!=null&&p>=50)return['💎','PRICY PICK'];
  return['🎲','WILDCARD'];
}
function eligible(d){
  const o=owned(),p=play();
  return d.identities.filter(x=>o.has(x.identity_id))
    .filter(x=>includePlayed||!p.played.has(x.identity_id))
    .filter(x=>includeBeaten||!p.beaten.has(x.identity_id))
    .filter(x=>!lowOnly||lang(x)==='LOW');
}
function deal(d){const pool=eligible(d);let choices=pool.filter(x=>!seen.has(x.identity_id));if(choices.length<Math.min(3,pool.length)){seen=new Set();choices=pool}const hand=shuffle(choices.slice()).slice(0,Math.min(3,choices.length));hand.forEach(x=>seen.add(x.identity_id));return{pool,hand}}
function rouletteCard(d,x,i){
  const [icon,r]=role(d,x),p=price(d,x),c=cart(d,x);
  return `<article class="ct-roulette-card fc-roulette-card" data-id="${esc(x.identity_id)}" style="animation-delay:${i*80}ms">
    <button class="ct-roulette-art" type="button" data-fc-open="${esc(x.identity_id)}">${art(d,x)}</button>
    <div class="ct-roulette-copy" data-fc-open="${esc(x.identity_id)}"><div class="ct-winner" hidden>🏆 TONIGHT'S PICK</div><span class="ct-role">${icon} ${r}</span><strong>${esc(title(x))}</strong><span class="fc-roulette-jp">${esc(jp(x))}</span><span class="ct-time">LANGUAGE ${esc(lang(x))}${p!=null?' · '+money(p):''}</span><p>${esc(cartText(c))}${x.nes_identity_id?' · NES '+(nesOwned().has(x.nes_identity_id)?'OWNED':'NOT OWNED'):' · JAPAN ONLY'}</p></div>
    <div class="ct-card-actions"><button type="button" data-fc-mark="PLAYED" data-id="${esc(x.identity_id)}">✓ PLAYED THIS</button><button type="button" data-fc-mark="BEATEN" data-id="${esc(x.identity_id)}">🏆 BEAT THIS</button></div>
  </article>`;
}
async function renderRoulette(){
  clearInterval(pickTimer);pickTimer=null;picking=false;
  const d=await data(),dlg=$('rouletteDialog');if(!dlg)return;
  const p=play(),{pool,hand}=deal(d);currentHand=hand;
  const toggles=`<label class="ct-toggle"><input id="fcLowOnly" type="checkbox"${lowOnly?' checked':''}><span>LOW LANGUAGE ONLY <small>(easy hunt/play picks)</small></span></label><label class="ct-toggle"><input id="fcIncludePlayed" type="checkbox"${includePlayed?' checked':''}><span>INCLUDE PLAYED <small>(${p.played.size} marked)</small></span></label><label class="ct-toggle"><input id="fcIncludeBeaten" type="checkbox"${includeBeaten?' checked':''}><span>INCLUDE BEATEN <small>(${p.beaten.size} marked)</small></span></label>`;
  let body=!owned().size?'<div class="ct-empty">Import GameEye or mark some Famicom games owned first.</div>':!hand.length?'<div class="ct-empty">No owned Famicom games match those Roulette settings.</div>':`<div class="ct-roulette-hand">${hand.map((x,i)=>rouletteCard(d,x,i)).join('')}</div>${hand.length>1?'<button id="fcPickForMe" class="ct-pick" type="button">🎰 PICK FOR ME</button>':''}<button id="fcDealAgain" class="ct-deal" type="button">🎲 DEAL AGAIN</button>`;
  dlg.innerHTML=`<div class="ct-modal-head"><div><span>FAMICOM ROULETTE</span><h2>🎰 What should I play?</h2></div><button class="ct-close" type="button">×</button></div><div class="ct-modal-body">${toggles}${body}<p class="ct-pool-note">${pool.length} owned Famicom ${pool.length===1?'game':'games'} eligible · played/beaten excluded by default</p></div>`;
  dlg.querySelector('.ct-close')?.addEventListener('click',()=>dlg.close());
  dlg.querySelector('#fcLowOnly')?.addEventListener('change',e=>{lowOnly=e.target.checked;renderRoulette()});
  dlg.querySelector('#fcIncludePlayed')?.addEventListener('change',e=>{includePlayed=e.target.checked;renderRoulette()});
  dlg.querySelector('#fcIncludeBeaten')?.addEventListener('change',e=>{includeBeaten=e.target.checked;renderRoulette()});
  dlg.querySelector('#fcDealAgain')?.addEventListener('click',renderRoulette);
  dlg.querySelector('#fcPickForMe')?.addEventListener('click',pickForMe);
  dlg.querySelectorAll('[data-fc-open]').forEach(n=>n.addEventListener('click',()=>openDossier(dlg,n.dataset.fcOpen)));
  dlg.querySelectorAll('[data-fc-mark]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();setStatus(b.dataset.id,b.dataset.fcMark);seen.delete(b.dataset.id);renderRoulette()}));
}
function pickForMe(){
  if(picking||!currentHand.length)return;
  const dlg=$('rouletteDialog'),cards=[...dlg.querySelectorAll('.ct-roulette-card')],btn=dlg.querySelector('#fcPickForMe');if(!cards.length)return;
  picking=true;if(btn)btn.disabled=true;cards.forEach(c=>{c.classList.remove('winner','cycling');c.querySelector('.ct-winner').hidden=true});
  const winner=currentHand[Math.floor(Math.random()*currentHand.length)].identity_id;let step=0,total=10+Math.floor(Math.random()*4);
  const settle=()=>{cards.forEach(c=>{const yes=c.dataset.id===winner;c.classList.toggle('winner',yes);c.querySelector('.ct-winner').hidden=!yes});if(btn){btn.disabled=false;btn.textContent='❌ NOPE — PICK AGAIN';btn.onclick=()=>{renderRoulette().then(()=>setTimeout(pickForMe,0))}}picking=false;pickTimer=null};
  if(matchMedia?.('(prefers-reduced-motion: reduce)').matches||cards.length<2){settle();return}
  pickTimer=setInterval(()=>{cards.forEach(c=>c.classList.remove('cycling'));cards[step%cards.length].classList.add('cycling');if(++step>=total){clearInterval(pickTimer);cards.forEach(c=>c.classList.remove('cycling'));settle()}},105);
}

// ---------- MY SHELF ----------
function stat(label,value,sub){return `<div class="ct-shelf-stat"><small>${esc(label)}</small><strong>${esc(value)}</strong><span>${esc(sub||'')}</span></div>`}
function shelfStats(d){
  const o=owned(),games=d.identities.filter(x=>o.has(x.identity_id)),p=play();
  const beaten=games.filter(x=>p.beaten.has(x.identity_id)),played=games.filter(x=>p.played.has(x.identity_id)&&!p.beaten.has(x.identity_id)),unplayed=games.filter(x=>!p.played.has(x.identity_id)&&!p.beaten.has(x.identity_id)),unfinished=games.filter(x=>!p.beaten.has(x.identity_id));
  const priced=games.map(x=>({x,p:price(d,x)})).filter(v=>v.p!=null),value=priced.reduce((n,v)=>n+v.p,0);
  return{games,beaten,played,unplayed,unfinished,priced,value,low:games.filter(x=>lang(x)==='LOW'),japanOnly:games.filter(x=>!x.nes_identity_id)};
}
function superCards(d,s){
  const priced=s.priced.slice().sort((a,b)=>a.p-b.p),out=[];
  if(priced.length)out.push({icon:'💸',label:'CHEAPEST HUNT',sub:money(priced[0].p)+' loose',x:priced[0].x});
  if(priced.length>1)out.push({icon:'💎',label:'SHELF GRAIL',sub:money(priced[priced.length-1].p)+' loose',x:priced[priced.length-1].x});
  const jp=s.japanOnly.length?shuffle(s.japanOnly.slice())[0]:null;if(jp)out.push({icon:'🇯🇵',label:'JAPAN-ONLY PICK',sub:'No NES counterpart',x:jp});
  return out.slice(0,3);
}
function superCard(d,v){return `<article class="ct-super" data-fc-open="${esc(v.x.identity_id)}"><div class="ct-super-cover">${art(d,v.x)}</div><div><small>${v.icon} ${esc(v.label)}</small><strong>${esc(title(v.x))}</strong><span>LANGUAGE ${esc(lang(v.x))}</span><em>${esc(v.sub)}</em></div></article>`}
async function renderShelf(){
  const d=await data(),dlg=$('myShelfDialog');if(!dlg)return;const s=shelfStats(d);
  if(!s.games.length){dlg.innerHTML='<div class="ct-modal-head"><div><span>MY SHELF</span><h2>📊 Matty’s Famicom Collection</h2></div><button class="ct-close" type="button">×</button></div><div class="ct-modal-body"><div class="ct-empty">Import Matty’s GameEye CSV or mark Famicom games owned and his Japanese shelf will appear here.</div></div>';dlg.querySelector('.ct-close')?.addEventListener('click',()=>dlg.close());return}
  const pct=Math.round(s.games.length/d.identities.length*100),supers=superCards(d,s),strip=shuffle(s.games.slice()).slice(0,Math.min(14,s.games.length));
  dlg.innerHTML=`<div class="ct-modal-head"><div class="ct-shelf-heading"><span>MY SHELF · FAMICOM</span><h2>📊 Matty’s Famicom Collection</h2></div><button class="ct-close" type="button">×</button></div><div class="ct-modal-body">
  <section class="ct-shelf-hero"><div class="ct-ring fc-ring" style="--pct:${pct}%"><b>${pct}%</b><small>COMPLETE</small></div><div class="ct-big"><div><b>${s.games.length}</b><small>OWNED</small></div><div><b>${d.identities.length}</b><small>FAMICOM SET</small></div></div></section>
  <h3 class="ct-section">PLAY PROGRESS</h3><div class="ct-stats">${stat('UNPLAYED',s.unplayed.length,'Roulette default pool')}${stat('PLAYED',s.played.length,'Started / sampled')}${stat('BEATEN',s.beaten.length,'Finished games')}${stat('UNFINISHED',s.unfinished.length,'Unplayed + played')}</div>
  <button id="fcQuickMark" class="ct-quick-mark" type="button">⚡ QUICK MARK MY FAMICOM SHELF</button>
  <h3 class="ct-section">HUNT SNAPSHOT</h3><div class="ct-stats">${stat('KNOWN LOOSE VALUE',money(s.value),s.priced.length+' owned with prices')}${stat('PRICED OWNED',s.priced.length,s.games.length+' owned total')}${stat('LOW LANGUAGE',s.low.length,'Easy language-barrier picks')}${stat('JAPAN ONLY',s.japanOnly.length,'No NES counterpart')}</div>
  <p class="ct-note">HLTB/time progress is waiting on the Famicom time-data pass. Nothing is guessed or copied from NES versions.</p>
  ${supers.length?`<h3 class="ct-section">COLLECTION SUPERLATIVES</h3><div class="ct-supers">${supers.map(v=>superCard(d,v)).join('')}</div>`:''}
  <h3 class="ct-section">THE SHELF</h3><div class="ct-strip">${strip.map(x=>`<button type="button" data-fc-open="${esc(x.identity_id)}" title="${esc(title(x))}">${art(d,x)}</button>`).join('')}</div><button id="fcReshuffle" class="ct-reshuffle" type="button">🔀 RESHUFFLE</button></div>`;
  dlg.querySelector('.ct-close')?.addEventListener('click',()=>dlg.close());dlg.querySelector('#fcQuickMark')?.addEventListener('click',renderQuickMark);dlg.querySelector('#fcReshuffle')?.addEventListener('click',renderShelf);dlg.querySelectorAll('[data-fc-open]').forEach(n=>n.addEventListener('click',()=>openDossier(dlg,n.dataset.fcOpen)));
}
async function renderQuickMark(){
  const d=await data(),dlg=$('myShelfDialog'),o=owned(),games=d.identities.filter(x=>o.has(x.identity_id)).sort(sortAz);
  dlg.innerHTML=`<div class="ct-modal-head"><div><span>MY SHELF · FAMICOM</span><h2>⚡ Quick Mark</h2></div><button class="ct-close" type="button">×</button></div><div class="ct-modal-body"><button id="fcBackShelf" class="ct-back" type="button">← BACK TO MY SHELF</button><input id="fcMarkSearch" class="ct-mark-search" type="search" placeholder="Search owned Famicom games…" autocomplete="off"><div id="fcMarkList" class="ct-mark-list"></div></div>`;
  dlg.querySelector('.ct-close')?.addEventListener('click',()=>dlg.close());dlg.querySelector('#fcBackShelf')?.addEventListener('click',renderShelf);
  const list=dlg.querySelector('#fcMarkList'),search=dlg.querySelector('#fcMarkSearch');
  const paint=()=>{const q=search.value.trim().toLowerCase(),rows=games.filter(x=>!q||title(x).toLowerCase().includes(q)||jp(x).toLowerCase().includes(q));list.innerHTML=rows.map(x=>{const s=status(x.identity_id);return `<div class="ct-mark-row"><button class="ct-mark-title" type="button" data-fc-open="${esc(x.identity_id)}">${esc(title(x))}<small>${esc(jp(x))}</small></button><div class="ct-mark-actions"><button type="button" data-fc-status="UNPLAYED" data-id="${esc(x.identity_id)}" class="${s==='UNPLAYED'?'active':''}">UNPLAYED</button><button type="button" data-fc-status="PLAYED" data-id="${esc(x.identity_id)}" class="${s==='PLAYED'?'active':''}">PLAYED</button><button type="button" data-fc-status="BEATEN" data-id="${esc(x.identity_id)}" class="${s==='BEATEN'?'active':''}">BEATEN</button></div></div>`}).join('')||'<div class="ct-empty">No owned games match that search.</div>';list.querySelectorAll('[data-fc-status]').forEach(b=>b.addEventListener('click',()=>{setStatus(b.dataset.id,b.dataset.fcStatus);paint()}));list.querySelectorAll('[data-fc-open]').forEach(b=>b.addEventListener('click',()=>openDossier(dlg,b.dataset.fcOpen)))};search.addEventListener('input',paint);paint();
}

// ---------- WISHLIST ----------
async function renderWishlist(){
  const d=await data(),dlg=$('wishlistDialog'),w=wish(),o=owned();
  dlg.innerHTML=`<div class="feature-head"><div><div class="eyebrow">FAMICOM HUNT LIST</div><h2>Wishlist</h2></div><button class="feature-close" type="button">×</button></div><input id="fcWishSearch" class="feature-search" type="search" placeholder="Search Famicom wishlist…" autocomplete="off"><div class="wishlist-summary"><span>Saved for the Japan hunt</span><span><strong id="fcWishTotal">${w.size}</strong> games</span></div><button id="fcRandomWish" class="wishlist-random-btn" type="button">🎲 RANDOM WISHLIST GAME</button><section id="fcWishList" class="wishlist-list"></section>`;
  const paint=()=>{const q=(dlg.querySelector('#fcWishSearch').value||'').trim().toLowerCase(),rows=[...w].map(id=>d.byId.get(id)).filter(Boolean).filter(x=>!q||title(x).toLowerCase().includes(q)||jp(x).toLowerCase().includes(q)).sort(sortAz);dlg.querySelector('#fcWishTotal').textContent=w.size;dlg.querySelector('#fcWishList').innerHTML=rows.length?rows.map(x=>{const p=price(d,x),c=cart(d,x);return `<article class="wish-card"><button class="feature-cover-button" type="button" data-fc-open="${esc(x.identity_id)}">${art(d,x,'wish-cover')}</button><div class="wish-copy"><strong>${esc(title(x))}</strong><small>${esc(jp(x))}</small><em>LANGUAGE ${esc(lang(x))} · ${esc(cartText(c))}${p!=null?' · '+money(p):''}</em></div><div class="wish-actions"><span class="wish-needed">${o.has(x.identity_id)?'OWNED':'NEEDED'}</span><button type="button" data-fc-wish-remove="${esc(x.identity_id)}">REMOVE</button></div></article>`}).join(''):'<div class="feature-empty">Nothing here yet. Tap ♡ on a needed Famicom game to build the Japan hunt list.</div>';dlg.querySelectorAll('[data-fc-open]').forEach(n=>n.addEventListener('click',()=>openDossier(dlg,n.dataset.fcOpen)));dlg.querySelectorAll('[data-fc-wish-remove]').forEach(b=>b.addEventListener('click',()=>{w.delete(b.dataset.fcWishRemove);saveWish(w);paint()}))};
  dlg.querySelector('.feature-close')?.addEventListener('click',()=>dlg.close());dlg.querySelector('#fcWishSearch')?.addEventListener('input',paint);dlg.querySelector('#fcRandomWish')?.addEventListener('click',()=>{const ids=[...w].filter(id=>d.byId.has(id));if(ids.length)openDossier(dlg,ids[Math.floor(Math.random()*ids.length)])});paint();
}

// ---------- SHOULD I BUY THIS? ----------
function searchText(x){return [x.japanese_title,x.romanized_title,x.english_reference_title,...(x.aliases||[]).map(a=>typeof a==='string'?a:a?.title)].filter(Boolean).join('\n').toLowerCase()}
async function renderBuy(){
  const d=await data(),dlg=$('buyDialog');
  dlg.innerHTML=`<div class="feature-head"><div><div class="eyebrow">FAMICOM COLLECTOR CHECK</div><h2>Should I Buy This?</h2></div><button class="feature-close" type="button">×</button></div><p class="buy-intro">Search the cart in front of you. Shelf Check will show Famicom ownership, loose value, cartridge color, language barrier and the NES counterpart.</p><input id="fcBuySearch" class="feature-search" type="search" placeholder="Search Japanese, romanized or English title…" autocomplete="off"><div id="fcBuyMatches" class="buy-matches"><div class="buy-hint">Search a Famicom game to check it against Matty's shelf.</div></div><section id="fcBuyResult" class="buy-result"></section>`;
  const show=x=>{const o=owned().has(x.identity_id),p=price(d,x),c=cart(d,x),w=wish().has(x.identity_id),no=nesOwned(),nes=x.nes_identity_id?(no.has(x.nes_identity_id)?'NES OWNED':'NES NOT OWNED'):'JAPAN ONLY';dlg.querySelector('#fcBuyResult').innerHTML=`<div class="buy-result-card ${o?'owned':''}"><button class="feature-cover-button" type="button" data-fc-open="${esc(x.identity_id)}">${art(d,x,'buy-cover')}</button><div class="buy-result-copy"><span class="buy-verdict ${o?'owned':''}">${o?'ALREADY OWNED':'NEEDED'}</span><h3>${esc(title(x))}</h3><p>${esc(jp(x))}</p><div class="fc-buy-tags"><span>LANGUAGE ${esc(lang(x))}</span><span>${esc(cartText(c))}</span><span>${esc(nes)}</span>${p!=null?`<span>LOOSE ${money(p)}</span>`:''}</div><p class="buy-physical">${o?'Already on Matty’s Famicom shelf. Another copy would be a duplicate unless he wants a variant or condition upgrade.':'This fills a missing Japanese Famicom cartridge identity. NES ownership does not change Famicom completion.'}</p>${o?'':`<div class="buy-result-actions"><button type="button" id="fcBuyWish" class="buy-wishlist ${w?'active':''}">${w?'♥ ON WISHLIST':'♡ ADD TO WISHLIST'}</button></div>`}</div></div>`;dlg.querySelector('[data-fc-open]')?.addEventListener('click',()=>openDossier(dlg,x.identity_id));dlg.querySelector('#fcBuyWish')?.addEventListener('click',()=>{toggleWish(x.identity_id);show(x)})};
  const search=q=>{q=q.trim().toLowerCase();const box=dlg.querySelector('#fcBuyMatches');if(q.length<2){box.innerHTML='<div class="buy-hint">Type at least 2 letters.</div>';return}const exact=[],starts=[],contains=[];for(const x of d.identities){const t=searchText(x);const primary=title(x).toLowerCase();if(primary===q||t.split('\n').includes(q))exact.push(x);else if(primary.startsWith(q)||t.split('\n').some(v=>v.startsWith(q)))starts.push(x);else if(t.includes(q))contains.push(x)}const rows=[...exact,...starts,...contains].slice(0,8);box.innerHTML=rows.length?rows.map(x=>`<button type="button" class="buy-match" data-fc-buy="${esc(x.identity_id)}"><span>${esc(title(x))}</span><small>${owned().has(x.identity_id)?'OWNED':'NEEDED'}</small></button>`).join(''):'<div class="buy-hint">No Famicom title found.</div>';box.querySelectorAll('[data-fc-buy]').forEach(b=>b.addEventListener('click',()=>{const x=d.byId.get(b.dataset.fcBuy);dlg.querySelector('#fcBuySearch').value=title(x);box.innerHTML='';show(x)}))};
  dlg.querySelector('.feature-close')?.addEventListener('click',()=>dlg.close());dlg.querySelector('#fcBuySearch')?.addEventListener('input',e=>{dlg.querySelector('#fcBuyResult').innerHTML='';search(e.target.value)});setTimeout(()=>dlg.querySelector('#fcBuySearch')?.focus(),50);
}

// Capture the four main feature buttons only when Famicom is active.
document.addEventListener('click',e=>{
  if(!active())return;
  const id=e.target.closest?.('#rouletteBtn,#myShelfBtn,#wishlistBtn,#buyBtn')?.id;if(!id)return;
  e.preventDefault();e.stopImmediatePropagation();
  if(id==='rouletteBtn'){seen=new Set();includePlayed=false;includeBeaten=false;lowOnly=false;renderRoulette().then(()=>$('rouletteDialog')?.showModal())}
  if(id==='myShelfBtn')renderShelf().then(()=>$('myShelfDialog')?.showModal());
  if(id==='wishlistBtn')renderWishlist().then(()=>$('wishlistDialog')?.showModal());
  if(id==='buyBtn')renderBuy().then(()=>$('buyDialog')?.showModal());
},true);

document.addEventListener('click',e=>{
  const h=e.target.closest?.('[data-fc-wishlist]');if(h){e.preventDefault();e.stopPropagation();toggleWish(h.dataset.fcWishlist);return}
});
enhanceCards(document);
window.FAMICOM_PLAY_STATE={storageKey:FC_PLAY,status,setStatus,read:play};
