const PRICE_DATA=await fetch('./prices-nes.json').then(r=>r.json());
const PRICE_CENSUS=await fetch('./nes-census.json').then(r=>r.json());
const priceByProduct=new Map(PRICE_DATA.rows.map(([id,p])=>[Number(id),Number(p)]));
const priceIds=Object.values(PRICE_CENSUS.identities).flat();
const priceByIdentity=new Map();
const priceTitleMap=new Map();
for(const x of priceIds){
  const opts=(x.product_ids||[]).map(s=>Number(String(s).replace('pc-',''))).filter(id=>priceByProduct.has(id)).map(id=>({id,price:priceByProduct.get(id)}));
  if(opts.length){opts.sort((a,b)=>a.price-b.price);priceByIdentity.set(x.identity_id,opts[0]);}
  const t=(x.canonical_title+(x.display_disambiguator?` ${x.display_disambiguator}`:'')).trim().toLowerCase();priceTitleMap.set(t,x.identity_id);
}
window.NES_PRICES={snapshot:PRICE_DATA.snapshot,byIdentity:priceByIdentity};
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
function identityFromNode(node){
  const direct=node?.dataset?.identityId||node?.dataset?.id;if(direct)return direct;
  const title=node?.querySelector?.('.game-copy strong,.wish-copy strong,.roulette-copy h3,.buy-result-copy h3')?.textContent?.trim().toLowerCase();
  return title?priceTitleMap.get(title)||null:null;
}
function priceForNode(node){const id=identityFromNode(node);return id?priceByIdentity.get(id)||null:null;}
function addPrice(node){
  if(!node||node.dataset.priceEnhanced==='1')return;
  const p=priceForNode(node);if(!p)return;
  node.dataset.priceEnhanced='1';
  const copy=node.querySelector('.game-copy,.wish-copy,.roulette-copy');
  if(copy){
    const tag=document.createElement('span');tag.className='nes-price';
    const lead=node.matches?.('.game')?'Tap for details <i>·</i> ':'';
    tag.innerHTML=`${lead}<b>Loose ${money(p.price)}</b>`;
    copy.appendChild(tag);
  }
}
function enhanceCards(root=document){
  for(const node of root.querySelectorAll?.('.game,.wish-card,.roulette-pick')||[])addPrice(node);
  enhanceBuy(root);
  updateWishlistValue();
}
function enhanceBuy(root=document){
  for(const card of root.querySelectorAll?.('.buy-result-card')||[]){
    if(card.dataset.priceEnhanced==='1')continue;
    const p=priceForNode(card);if(!p)continue;
    card.dataset.priceEnhanced='1';
    const copy=card.querySelector('.buy-result-copy');if(!copy)continue;
    const old=copy.querySelector('.buy-pricing-note');if(old)old.remove();
    const panel=document.createElement('section');panel.className='price-check';
    panel.innerHTML=`<div class="price-market"><span>LOOSE MARKET</span><strong>${money(p.price)}</strong><small>PriceCharting snapshot ${PRICE_DATA.snapshot}</small></div><label>ASKING PRICE <span class="price-input-wrap">$<input inputmode="decimal" type="number" min="0" step="0.01" placeholder="0.00"></span></label><div class="price-readout">Enter the price in front of you.</div>`;
    const input=panel.querySelector('input'),out=panel.querySelector('.price-readout');
    input.addEventListener('input',()=>{const ask=Number(input.value);if(!ask&&ask!==0){out.textContent='Enter the price in front of you.';out.className='price-readout';return;}const ratio=ask/p.price;let text,cls;if(ratio<=.70){text=`Strong price — ${Math.round((1-ratio)*100)}% under loose market.`;cls='great';}else if(ratio<=.90){text=`Below market — ${Math.round((1-ratio)*100)}% under the snapshot.`;cls='good';}else if(ratio<=1.10){text='Around current loose market.';cls='fair';}else{text=`Above market — ${Math.round((ratio-1)*100)}% over the snapshot.`;cls='high';}out.textContent=text;out.className=`price-readout ${cls}`;});
    copy.appendChild(panel);
  }
}
function updateWishlistValue(){
  const summary=document.querySelector('#wishlistDialog .wishlist-summary');if(!summary)return;
  let total=0;const seenProducts=new Set();let count=0;
  for(const card of document.querySelectorAll('#wishlistList .wish-card')){const p=priceForNode(card);if(p&&!seenProducts.has(p.id)){seenProducts.add(p.id);total+=p.price;count++;}}
  let v=summary.querySelector('.wishlist-value');if(!v){v=document.createElement('span');v.className='wishlist-value';summary.appendChild(v);}v.textContent=count?`Loose est. ${money(total)}`:'Loose est. —';
}
const priceObserver=new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes)if(n.nodeType===1)enhanceCards(n.matches?.('.game,.wish-card,.roulette-pick,.buy-result-card')?n.parentElement||document:n);});
priceObserver.observe(document.body,{childList:true,subtree:true});
setTimeout(()=>enhanceCards(document),0);
