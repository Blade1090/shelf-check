(()=>{
const WISHLIST='shelfcheck-nes-matty-wishlist-v1';
const OWNED='shelfcheck-nes-matty-v1';
let cycle={signature:'',remaining:[],last:null};
const button=document.getElementById('randomWishlistBtn');
function wishlist(){try{return new Set(JSON.parse(localStorage.getItem(WISHLIST)||'[]'))}catch{return new Set()}}
function owned(){try{return new Set(JSON.parse(localStorage.getItem(OWNED)||'{}').owned||[])}catch{return new Set()}}
function dossier(id){const d=window.NES_DOSSIERS?.byId;return d?.get?.(id)||d?.[id]||null}
function pool(){
  const q=(document.getElementById('wishlistSearch')?.value||'').trim().toLowerCase(),have=owned();
  return [...wishlist()].filter(id=>!have.has(id)).filter(id=>{if(!q)return true;const d=dossier(id);if(!d)return true;return String(d.title||'').toLowerCase().includes(q)||(d.alternate_titles||[]).some(a=>String(a).toLowerCase().includes(q));});
}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function draw(ids){
  const signature=[...ids].sort().join('|');
  if(signature!==cycle.signature||!cycle.remaining.length){const next=shuffle(ids.slice());if(next.length>1&&next[next.length-1]===cycle.last){const j=Math.floor(Math.random()*(next.length-1));[next[next.length-1],next[j]]=[next[j],next[next.length-1]]}cycle={signature,remaining:next,last:cycle.last};}
  const id=cycle.remaining.pop();cycle.last=id;return id;
}
function sync(){if(!button)return;const n=pool().length;button.disabled=!n||typeof window.openNESDossier!=='function';button.textContent=n?`🎲 RANDOM WISHLIST GAME · ${n}`:'🎲 RANDOM WISHLIST GAME';}
function run(){const ids=pool();if(!ids.length)return;const id=draw(ids);const dlg=document.getElementById('wishlistDialog');if(dlg?.open)dlg.close();requestAnimationFrame(()=>window.openNESDossier?.(id));}
button?.addEventListener('click',run);
document.getElementById('wishlistBtn')?.addEventListener('click',()=>setTimeout(sync,0));
document.getElementById('wishlistSearch')?.addEventListener('input',sync);
document.addEventListener('shelfcheck:wishlist-toggle',()=>setTimeout(sync,0));
window.addEventListener('storage',e=>{if(e.key===WISHLIST||e.key===OWNED)sync();});
window.addEventListener('shelfcheck:dossiers-ready',sync);
setTimeout(sync,0);
})();
