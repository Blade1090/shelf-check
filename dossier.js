const D_CENSUS=await fetch('./nes-census.json').then(r=>r.json());
const D_LIB='https://raw.githubusercontent.com/libretro-thumbnails/Nintendo_-_Nintendo_Entertainment_System/4d21463bf5d553afc34d99183c9ad5833f773b93/Named_Boxarts/';
const D_LAUNCH='https://images.launchbox-app.com/';
const D_COVERS={};
const D_CHUNKS=['001-100','101-200','201-300','301-400','401-500','501-600','601-700','701-800','801-816'];
const [dCoverFirst,...dCoverRest]=await Promise.all([fetch('./covers-001-100.json').then(r=>r.json()).catch(()=>({})),...['101-200','201-300','301-400','401-500','501-600','601-700','701-800','801-815'].map(n=>fetch(`./covers-${n}.json`).then(r=>r.json()).catch(()=>[]))]);
Object.assign(D_COVERS,dCoverFirst);for(const rows of dCoverRest)for(const [id,src,val,label] of rows)D_COVERS[id]={u:src===0?D_LIB+val:src===1?D_LAUNCH+val:val,l:label||null};
const D_DOSSIER_FILES=await Promise.all(D_CHUNKS.map(n=>fetch(`./dossiers-${n}.json`).then(r=>{if(!r.ok)throw new Error(`dossiers-${n}.json ${r.status}`);return r.json()})));
const D_DOSSIERS=new Map();for(const pack of D_DOSSIER_FILES)for(const row of pack.entries||[])D_DOSSIERS.set(row.identity_id,row);
window.NES_DOSSIERS={byId:D_DOSSIERS,count:D_DOSSIERS.size,chunks:D_CHUNKS};
window.dispatchEvent(new CustomEvent('shelfcheck:dossiers-ready',{detail:{count:D_DOSSIERS.size}}));
const D_ALL=Object.values(D_CENSUS.identities).flat();const D_BYID=new Map(D_ALL.map(x=>[x.identity_id,x]));const dNorm=s=>String(s||'').trim().toLowerCase();const D_TITLE=new Map();for(const x of D_ALL){D_TITLE.set(dNorm(x.canonical_title),x.identity_id);for(const a of x.aliases||[])D_TITLE.set(dNorm(a),x.identity_id)}
const dEsc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const dMoney=n=>n==null?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);const dHours=n=>n==null||n===''?'—':Number.isFinite(Number(n))?`${Number(n)%1?Number(n).toFixed(1):Number(n).toFixed(0)}h`:'—';

// Shared NES/Famicom dossier scroll controller.
// The page/list keeps its own scroll position; the dialog owns a separate scroll position.
const D_SCROLL=window.ShelfCheckDossierScroll||(window.ShelfCheckDossierScroll=(()=>{
  let locked=false,mainY=0,currentId=null,restoreSeq=0,resetSeq=0;
  const dialog=()=>document.getElementById('dossierDialog');
  const scroller=()=>document.getElementById('dossierBody');
  const forceTop=(seq)=>{
    const dlg=dialog(),body=scroller();if(!dlg||!body||seq!==resetSeq)return;
    dlg.scrollTop=0;body.scrollTop=0;
  };
  const resetDetailTop=()=>{
    const seq=++resetSeq;
    forceTop(seq);
    requestAnimationFrame(()=>{forceTop(seq);requestAnimationFrame(()=>forceTop(seq));});
    setTimeout(()=>forceTop(seq),0);
    setTimeout(()=>forceTop(seq),50);
    setTimeout(()=>forceTop(seq),150);
    setTimeout(()=>forceTop(seq),300);
  };
  const open=(id)=>{
    const dlg=dialog();if(!dlg)return;
    const changed=currentId!==id;
    if(!dlg.open){
      mainY=window.scrollY||document.documentElement.scrollTop||0;
      locked=true;restoreSeq++;
      document.body.classList.add('dossier-open');
      document.body.style.position='fixed';
      document.body.style.top=`-${mainY}px`;
      document.body.style.left='0';
      document.body.style.right='0';
      document.body.style.width='100%';
      dlg.showModal();
    }
    currentId=id;
    if(changed)resetDetailTop();
  };
  const close=()=>{
    if(!locked)return;
    const y=mainY,seq=++restoreSeq;
    locked=false;currentId=null;resetSeq++;
    document.body.classList.remove('dossier-open');
    document.body.style.position='';
    document.body.style.top='';
    document.body.style.left='';
    document.body.style.right='';
    document.body.style.width='';
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(seq===restoreSeq)window.scrollTo({top:y,left:0,behavior:'auto'});
    }));
  };
  const freshBody=()=>{
    const old=scroller();if(!old)return null;
    const next=document.createElement('div');
    next.id='dossierBody';
    next.className='dossier-body';
    old.replaceWith(next);
    next.scrollTop=0;
    return next;
  };
  return {open,close,resetDetailTop,freshBody,current:()=>currentId};
})());

function dCover(id){const r=D_COVERS[id];if(!r)return null;if(Array.isArray(r))return {u:r[0].startsWith('http')?r[0]:D_LIB+r[0],l:r[1]||null};return r}
function dOwned(){try{return new Set(JSON.parse(localStorage.getItem('shelfcheck-nes-matty-v1')||'{}').owned||[])}catch{return new Set()}}
function dWishlist(){try{return new Set(JSON.parse(localStorage.getItem('shelfcheck-nes-matty-wishlist-v1')||'[]'))}catch{return new Set()}}
function dTitle(x){return x.canonical_title+(x.display_disambiguator?` ${x.display_disambiguator}`:'')}
function dIdFromNode(node){if(node.dataset?.identityId)return node.dataset.identityId;if(node.dataset?.id&&D_BYID.has(node.dataset.id))return node.dataset.id;const t=node.querySelector?.('.game-copy strong,.wish-copy strong,.roulette-copy h3,.buy-result-copy h3')?.textContent;return t?D_TITLE.get(dNorm(t))||null:null}
function dPrice(id){return window.NES_PRICES?.byIdentity?.get(id)||null}
function dWishlistToggle(id){document.dispatchEvent(new CustomEvent('shelfcheck:wishlist-toggle',{detail:{id}}));const btn=document.querySelector('#dossierDialog [data-dossier-wish]');if(btn){const on=dWishlist().has(id);btn.classList.toggle('active',on);btn.textContent=on?'♥ ON WISHLIST':'♡ ADD TO WISHLIST'}}
function dFallbackQuick(x){const bits=[];if(x.na_release_year)bits.push(`${x.na_release_year} North American NES release`);if(x.publisher_na)bits.push(`published by ${x.publisher_na}`);if(x.developer)bits.push(`developed by ${x.developer}`);let s=bits.length?bits.join(', ')+'.':'';s+=` ${x.license_class==='UNLICENSED'?'Unlicensed':'Licensed'} title tracked as ${x.availability.replaceAll('_',' ').toLowerCase()}.`;return s.trim()}
function dNotes(d,x,c){const rows=[];if(c?.l)rows.push(`Physical acquisition: ${c.l.replace(/^On /,'')}`);if(d?.multicart_notes)rows.push(d.multicart_notes);if(d?.collecting_notes)rows.push(d.collecting_notes);if(d?.content_notes)rows.push(d.content_notes);const aliases=(d?.alternate_titles?.length?d.alternate_titles:x.aliases||[]).filter(Boolean);if(aliases.length)rows.push(`Also known as: ${aliases.join(' · ')}`);rows.push(`Availability: ${(d?.availability||x.availability).replaceAll('_',' ')}`);return rows}
function dDifficulty(d){if(!d?.difficulty)return '';const level=typeof d.difficulty==='string'?d.difficulty:d.difficulty.level;const reason=typeof d.difficulty==='object'?d.difficulty.reason:null;if(!level)return '';return `<div class="dossier-difficulty"><small>DIFFICULTY</small><b>${dEsc(level)}</b>${reason?`<span>${dEsc(reason)}</span>`:''}</div>`}
function dHltb(d){const status=d?.hltb_status||'NO_DATA';const has=[d?.hltb_main_hours,d?.hltb_extra_hours,d?.hltb_completionist_hours].some(v=>v!=null&&v!==''&&Number.isFinite(Number(v)));return `<div class="dossier-times"><div><small>MAIN</small><b>${dHours(d?.hltb_main_hours)}</b></div><div><small>MAIN + EXTRA</small><b>${dHours(d?.hltb_extra_hours)}</b></div><div><small>COMPLETIONIST</small><b>${dHours(d?.hltb_completionist_hours)}</b></div></div><div class="dossier-hltb-foot"><span class="dossier-research ${status.toLowerCase()}">${dEsc(status.replace('_',' '))}</span><span>${dEsc(d?.hltb_note||(has?'NES timing data':'No reliable NES timing match yet.'))}</span></div>`}
function dRender(id){
  const changing=D_SCROLL.current?.()!==id;
  const x=D_BYID.get(id);if(!x)return;
  if(changing)D_SCROLL.resetDetailTop?.();
  const body=changing?(D_SCROLL.freshBody?.()||document.getElementById('dossierBody')):document.getElementById('dossierBody');
  const d=D_DOSSIERS.get(id)||null,owned=dOwned().has(id),wish=dWishlist().has(id),c=dCover(id),p=dPrice(id),dlg=document.getElementById('dossierDialog');
  document.getElementById('dossierTitle').textContent=dTitle(x);
  const summary=d?.summary||dFallbackQuick(x),year=d?.release_year||x.na_release_year,publisher=d?.publisher||x.publisher_na,developer=d?.developer||x.developer,license=d?.license_class||x.license_class,genres=d?.genres||[],players=d?.players||'—';
  const notes=dNotes(d,x,c),mainTime=d?.hltb_main_hours!=null?` · ~${dHours(d.hltb_main_hours)} main`:'';
  const priceGuide=p?`<div class="dossier-times"><div><small>STRONG BUY</small><b>${dMoney(p.price*.5)}</b></div><div><small>TARGET</small><b>${dMoney(p.price*.75)}</b></div><div><small>LOOSE MARKET</small><b>${dMoney(p.price)}</b></div></div>`:`<p class="dossier-pending">No reliable loose-market snapshot for this identity yet.</p>`;
  const storeLine=p?`Loose ${dMoney(p.price)}${mainTime}`:`Loose price pending${mainTime}`;
  body.innerHTML=`
    <section class="dossier-card">
      <section class="dossier-hero">
        <div class="dossier-cover-wrap">${c?.u?`<img src="${dEsc(c.u)}" alt="${dEsc(dTitle(x))} NES box art">`:'<div class="dossier-cover-missing">NES</div>'}</div>
        <div class="dossier-identity">
          <div class="dossier-title-row"><div><h3>${dEsc(dTitle(x))}</h3><div class="dossier-meta">${year||'Year unknown'} · ${dEsc(publisher||'Publisher unknown')} · ${dEsc(developer||'Developer unknown')}</div></div><span class="dossier-badge ${owned?'owned':''}">${owned?'OWNED':'NEEDED'}</span></div>
          <div class="dossier-actions">${owned?'':`<button class="dossier-wish ${wish?'active':''}" data-dossier-wish="${dEsc(id)}">${wish?'♥ ON WISHLIST':'♡ ADD TO WISHLIST'}</button>`}</div>
        </div>
      </section>
      <section class="dossier-store">
        <div class="dossier-store-head"><h3>Store Mode</h3><p>${dEsc(storeLine)}</p></div>
        ${p?`<div class="dossier-store-form"><label class="dossier-store-input"><span>$</span><input id="dossierAsk" type="number" inputmode="decimal" min="0" step="0.01" placeholder="Store price"></label><button id="dossierCheck" class="dossier-check-btn" type="button">SHOULD I BUY IT?</button></div><div id="dossierVerdict" class="dossier-verdict">${owned?'Already owned — another copy is a duplicate unless Matty wants a variant/condition upgrade.':'Enter the store price, then check it.'}</div>`:`<div class="dossier-verdict">No reliable loose-market snapshot for this identity yet.</div>`}
      </section>
    </section>
    <section class="dossier-research-head"><div><small>MATTY'S SET · NES</small><h3>NES DOSSIER</h3></div>${d?`<span class="dossier-confidence ${String(d.confidence||'').toLowerCase()}">${dEsc(d.confidence||'')} RESEARCH</span>`:''}</section>
    <section class="dossier-grid">
      <div class="dossier-block wide"><h4>HOW LONG TO BEAT</h4>${dHltb(d)}</div>
      <div class="dossier-block wide"><h4>QUICK SUMMARY</h4><p>${dEsc(summary)}</p></div>
      <div class="dossier-block"><h4>GAME INFO</h4><div class="dossier-kv"><div><small>YEAR</small><b>${year||'—'}</b></div><div><small>LICENSE</small><b>${license==='UNLICENSED'?'Unlicensed':'Licensed'}</b></div><div><small>PUBLISHER</small><b>${dEsc(publisher||'—')}</b></div><div><small>DEVELOPER</small><b>${dEsc(developer||'—')}</b></div><div><small>PLAYERS</small><b>${dEsc(players)}</b></div><div><small>GENRE</small><b>${dEsc(genres.length?genres.join(' / '):'—')}</b></div></div></div>
      <div class="dossier-block"><h4>GAMEPLAY</h4>${d?.gameplay_notes?`<p>${dEsc(d.gameplay_notes)}</p>`:'<p class="dossier-pending">No detailed gameplay note in the current research.</p>'}${dDifficulty(d)}</div>
      <div class="dossier-block wide"><h4>PRICE GUIDE · LOOSE</h4>${priceGuide}</div>
      <div class="dossier-block wide"><h4>WHY IT MATTERS</h4>${d?.why_it_matters?`<p>${dEsc(d.why_it_matters)}</p>`:'<p class="dossier-pending">No additional historical hook in the current research.</p>'}</div>
      <div class="dossier-block wide"><h4>COLLECTOR NOTES</h4>${notes.length?`<ul class="dossier-notes">${notes.map(n=>`<li>${dEsc(n)}</li>`).join('')}</ul>`:'<p class="dossier-pending">No special collector notes for this identity.</p>'}</div>
      ${d?.review_flags?.length?`<div class="dossier-block wide dossier-review"><h4>RESEARCH NOTE</h4><p>${dEsc(d.review_flags.join(' '))}</p></div>`:''}
    </section>`;
  const ask=document.getElementById('dossierAsk'),out=document.getElementById('dossierVerdict'),check=document.getElementById('dossierCheck');
  const runCheck=()=>{if(!ask||!out||!p)return;const v=Number(ask.value);if(!Number.isFinite(v)||ask.value===''){out.className='dossier-verdict';out.textContent=owned?'Already owned — another copy is a duplicate unless Matty wants a variant/condition upgrade.':'Enter the store price, then check it.';return}if(owned){out.className='dossier-verdict owned';out.textContent='SKIP · Already owned unless this is a wanted variant or condition upgrade.';return}const r=v/p.price;if(r<=.5){out.className='dossier-verdict great';out.textContent=`GRAB IT · At/below the ${dMoney(p.price*.5)} strong-buy mark.`}else if(r<=.75){out.className='dossier-verdict good';out.textContent=`BUY · Within the ${dMoney(p.price*.75)} target.`}else if(r<=1){out.className='dossier-verdict fair';out.textContent=`FAIR · At or below the ${dMoney(p.price)} loose market.`}else{out.className='dossier-verdict high';out.textContent=`WAIT · Above the ${dMoney(p.price)} loose market snapshot.`}};
  check?.addEventListener('click',runCheck);ask?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();runCheck()}});
  D_SCROLL.open(id);
}
window.openNESDossier=dRender;
const dlg=document.getElementById('dossierDialog');dlg?.addEventListener('close',D_SCROLL.close);document.addEventListener('click',e=>{const w=e.target.closest('[data-dossier-wish]');if(w){e.preventDefault();e.stopPropagation();dWishlistToggle(w.dataset.dossierWish);return}if(e.target.closest('button,input,select,a'))return;const node=e.target.closest('.game,.wish-card,.roulette-pick,.buy-result-card');if(!node)return;const id=dIdFromNode(node);if(id)dRender(id)});
