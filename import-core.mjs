const ROMAN = { ii: '2', iii: '3', iv: '4' };
const NON_NA_TAG = /\[(?!NA\b)(?!NA\/)[A-Z]{2,4}(?:\/[A-Z]{2,4})*\]/;
const ANY_TAG = /\s*[\[(]([^\])]+)[\])]/g;
const TAG_HINT = { 'tengen':'tengen', 'namco':'namco', 'taito':'taito', 'ubi':'ubi-soft', 'ubisoft':'ubi-soft', 'color dreams':'color-dreams' };

export function norm(s='') {
  let t = String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ');
  t = t.replace(/,\s*(The|A|An)$/i, ' $1').replace(/[’']/g, '').toLowerCase();
  t = t.replace(/[^a-z0-9]+/g, ' ').trim();
  let words = t.split(/\s+/).filter(Boolean);
  words = words.filter(w => !['the','a','an'].includes(w));
  return words.join(' ');
}
export function mkey(s='') {
  return norm(String(s).replace(/\s*\[[A-Z/]+\]/g, '')).split(' ').map(w => ROMAN[w] || w).join(' ');
}

export function parseCSV(text) {
  const rows=[]; let row=[], field='', q=false;
  for (let i=0;i<text.length;i++) {
    const c=text[i];
    if (q) {
      if (c==='"' && text[i+1]==='"') { field+='"'; i++; }
      else if (c==='"') q=false;
      else field+=c;
    } else {
      if (c==='"') q=true;
      else if (c===',') { row.push(field); field=''; }
      else if (c==='\n') { row.push(field.replace(/\r$/,'')); rows.push(row); row=[]; field=''; }
      else field+=c;
    }
  }
  if (field.length || row.length) { row.push(field.replace(/\r$/,'')); rows.push(row); }
  if (!rows.length) return [];
  const headers=rows.shift().map((h,i)=>i===0?h.replace(/^\uFEFF/,''):h);
  return rows.filter(r=>r.some(x=>x!=='')).map(r => Object.fromEntries(headers.map((h,i)=>[h,r[i] ?? ''])));
}

export function buildResolver(census, tracked, pcu, pcAlias) {
  const idents = new Map();
  for (const group of Object.values(census.identities)) for (const x of group) idents.set(x.identity_id, x);
  const products = new Map();
  for (const group of Object.values(census.products)) for (const p of group) products.set(p.product_id, p);
  const coreTotal = idents.size;
  const nameToIdent = new Map();
  function add(map,k,v){ if(!map.has(k)) map.set(k,new Set()); map.get(k).add(v); }
  for (const x of idents.values()) {
    for (const n of [x.canonical_title, ...(x.aliases||[]), ...(x.derived_aliases||[])]) {
      if (!NON_NA_TAG.test(n)) add(nameToIdent,mkey(n),x.identity_id);
    }
  }
  const canonicalProductGroups=['licensed_compilations','unlicensed_multicarts','unlicensed_reissues_of_licensed'];
  const canonicalProducts=new Map();
  const nameToProduct=new Map();
  for(const g of canonicalProductGroups){
    for(const p of census.products[g]||[]){ canonicalProducts.set(p.product_id,p); for(const n of [p.title,...(p.aliases||[])]) add(nameToProduct,mkey(n),p.product_id); }
  }
  const pcFull=new Map();
  for(const p of census.products.pricecharting_catalog||[]) add(pcFull,mkey(p.title.replaceAll('[',' ').replaceAll(']',' ')),p.product_id);
  for(const [a,target] of Object.entries(pcAlias||{})){
    if(a.startsWith('_')) continue;
    for(const i of nameToIdent.get(mkey(target))||[]) add(nameToIdent,mkey(a),i);
    for(const pid of nameToProduct.get(mkey(target))||[]) add(nameToProduct,mkey(a),pid);
  }
  const trackedBy=new Map((tracked||[]).map(t=>[mkey(t.canonical_title),t]));
  const pcuBy=new Map((pcu||[]).map(u=>[mkey(u.title.replace(/\s*\[[^\]]*\]/g,'')),u]));
  function disambiguate(cands,hints){
    if(cands.size<=1) return cands;
    for(const h of hints){ for(const [k,suf] of Object.entries(TAG_HINT)){ if(h.includes(k)){ const f=new Set([...cands].filter(c=>c.endsWith(suf))); if(f.size) return f; } } }
    const plain=new Set([...cands].filter(c=>!idents.get(c)?.display_disambiguator));
    const hasTagHint=hints.some(h=>Object.keys(TAG_HINT).some(k=>h.includes(k)));
    if(hints.length && !hasTagHint && plain.size===1) return plain;
    return cands;
  }
  function prefix(k,index){ const hits=new Set(); for(const [n,vs] of index){ if(n.startsWith(k+' ')) for(const v of vs) hits.add(v); } return hits; }
  function _resolve(title,publisher=''){
    const tags=[...String(title).matchAll(ANY_TAG)].map(m=>m[1].toLowerCase());
    const base=String(title).replace(/\s*[\[(][^\])]+[\])]/g,'').trim();
    const hints=[...tags,String(publisher).toLowerCase()]; const k=mkey(base);
    const full=mkey(String(title).replace(/[\[\]()]/g,' '));
    if(pcFull.has(full)&&pcFull.get(full).size===1&&tags.length) return ['product',[...pcFull.get(full)][0],'pricecharting_listing_with_tags'];
    if(nameToProduct.has(k)&&nameToProduct.get(k).size===1) return ['product',[...nameToProduct.get(k)][0],'product_title'];
    if(nameToIdent.has(k)){ const c=disambiguate(nameToIdent.get(k),hints); if(c.size===1)return ['identity',[...c][0],'identity_title_or_alias']; return ['collision',[...c].sort(),'unresolved_title_collision']; }
    if(base.includes(' / ')){
      const parts=base.split(' / ').map(x=>nameToIdent.get(mkey(x.trim()))||new Set());
      if(parts.every(p=>p.size===1)){ const want=new Set(parts.map(p=>[...p][0])); const matches=[...canonicalProducts].filter(([,p])=>p.covers_identities.length===want.size&&p.covers_identities.every(i=>want.has(i))); if(matches.length===1)return ['product',matches[0][0],'slash_compilation']; }
    }
    for(const [idx,kind] of [[nameToProduct,'product'],[nameToIdent,'identity']]){ let c=prefix(k,idx); if(kind==='identity') c=disambiguate(c,hints); if(c.size===1)return [kind,[...c][0],'unique_prefix']; }
    if(trackedBy.has(k)){const t=trackedBy.get(k);return ['tracked',t.canonical_title,`tracked:${t.core_status}:${t.track_class}`];}
    if(pcuBy.has(k)){const u=pcuBy.get(k);return ['pc_unmapped',u.title,`pricecharting_unmapped:${u.classification}`];}
    return ['unmatched',null,null];
  }
  function resolve(title,publisher=''){
    let r=_resolve(title,publisher);
    if(r[0]==='unmatched'&&String(title).includes(' - ')){const r2=_resolve(String(title).split(' - ')[0],publisher);if(r2[0]!=='unmatched') return [r2[0],r2[1],(r2[2]||'')+'+edition_suffix_stripped'];}
    if(r[0]==='unmatched'){
      const sk=mkey(String(title).replace(/\s*[\[(][^\])]*[\])]/g,'')).replaceAll(' ','');
      for(const [idx,kind] of [[nameToIdent,'identity'],[nameToProduct,'product']]){const c=new Set();for(const [n,vs] of idx)if(n.replaceAll(' ','')===sk)for(const v of vs)c.add(v);if(c.size===1)return[kind,[...c][0],'spacing_insensitive'];}
      for(const [n,u] of pcuBy)if(n.replaceAll(' ','')===sk)return['pc_unmapped',u.title,`pricecharting_unmapped:${u.classification}`];
    }
    return r;
  }
  return {idents,products,coreTotal,resolve};
}

export function importGameEye(csvText, data){
  const rows=parseCSV(csvText); const {idents,products,coreTotal,resolve}=buildResolver(data.census,data.tracked,data.pcu,data.pcAlias);
  const nes=rows.map((r,i)=>[i+2,r]).filter(([,r])=>r.Platform==='NES/Famicom'&&r.Category==='Games');
  const out={matched_core:[],matched_non_core:[],unmatched_or_reconcile:[],duplicates:[],owned_core_identities:[]};
  const ownedCore=new Map();
  for(const [line,r] of nes){
    const rec={csv_line:line,title:r.Title,country:r.Country,release_type:r.ReleaseType,publisher:r.Publisher};
    const [kind,target,method]=resolve(r.Title,r.Publisher); Object.assign(rec,{match_kind:kind,match_target:target,match_method:method});
    let covers=[],cs=null;
    if(kind==='product'){const p=products.get(target);covers=p.covers_identities||[];cs=p.core_satisfying;rec.product_title=p.title;}
    else if(kind==='identity'){covers=[target];cs=true;}
    rec.identities=covers.map(i=>({identity_id:i,canonical_title:idents.get(i).canonical_title,display_disambiguator:idents.get(i).display_disambiguator}));
    const rt=r.ReleaseType, country=r.Country;
    if(country==='Japan'){rec.bucket='FAMICOM_NON_CORE';rec.core_satisfying=false;out.matched_non_core.push(rec);continue;}
    if(['Homebrew','Afterlife','Digital'].includes(rt)){rec.bucket=kind==='unmatched'?'HOMEBREW_NOT_IN_CATALOG_TRACKED':'AFTERMARKET_OR_HOMEBREW_NON_CORE';rec.core_satisfying=false;out.matched_non_core.push(rec);continue;}
    if(['tracked','pc_unmapped'].includes(kind)){rec.bucket='NON_CORE_'+String(method).split(':')[1];rec.core_satisfying=false;out.matched_non_core.push(rec);continue;}
    if(['unmatched','collision'].includes(kind)){rec.bucket='RECONCILE';out.unmatched_or_reconcile.push(rec);continue;}
    if(!['United States of America','Canada',''].includes(country)){rec.bucket='NON_NA_COPY_OF_NA_IDENTITY';rec.core_satisfying=false;out.matched_non_core.push(rec);continue;}
    if(cs!==true){rec.bucket='PRODUCT_NOT_CORE_SATISFYING';rec.core_satisfying=cs;out.matched_non_core.push(rec);continue;}
    rec.bucket='CORE';rec.core_satisfying=true;out.matched_core.push(rec);
    for(const i of covers){if(!ownedCore.has(i))ownedCore.set(i,[]);ownedCore.get(i).push(line);}
  }
  for(const [i,lines] of ownedCore) if(lines.length>1) out.duplicates.push({identity_id:i,canonical_title:idents.get(i).canonical_title,csv_lines:lines,copies:lines.length});
  out.owned_core_identities=[...ownedCore].map(([i,lines])=>({identity_id:i,canonical_title:idents.get(i).canonical_title,display_disambiguator:idents.get(i).display_disambiguator,license_class:idents.get(i).license_class,availability:idents.get(i).availability,csv_lines:lines})).sort((a,b)=>a.canonical_title.localeCompare(b.canonical_title));
  const buckets={};for(const r of out.matched_non_core)buckets[r.bucket]=(buckets[r.bucket]||0)+1;
  const methods={};for(const r of out.matched_core)methods[r.match_method]=(methods[r.match_method]||0)+1;
  out.summary={nes_famicom_game_rows:nes.length,matched_core_rows:out.matched_core.length,matched_non_core_rows:out.matched_non_core.length,unmatched_or_reconcile_rows:out.unmatched_or_reconcile.length,identities_with_duplicate_copies:out.duplicates.length,distinct_core_identities_owned:ownedCore.size,census_core_total:coreTotal,provisional_core_completion_pct:Math.round((10000*ownedCore.size/coreTotal))/100,non_core_buckets:buckets,match_methods:methods};
  return out;
}


function fcPubNorm(s=''){
  return String(s).toLowerCase()
    .replace(/\b(co|inc|ltd|corporation|entertainment|of america)\b/g,' ')
    .replace(/[^a-z0-9]+/g,' ').trim();
}
function fcNorm(s=''){
  let t=String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/&/g,' and ').replace(/[’']/g,'').toLowerCase();
  t=t.replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).filter(Boolean).filter(w=>!['the','a','an'].includes(w)).join(' ');
  // Common long-vowel romanization differences in Japanese GameEye titles.
  t=t.replace(/ou/g,'o').replace(/uu/g,'u').replace(/\bgump\b/g,'gamp');
  return t;
}
function fcAliasText(a){return typeof a==='string'?a:(a?.title||'');}

export function importFamicomGameEye(csvText,famicomCensus){
  const rows=parseCSV(csvText);
  const identities=famicomCensus?.identities||[];
  const candidates=identities.map(x=>({
    x,
    keys:[x.romanized_title,x.english_reference_title,x.japanese_title,...(x.aliases||[]).map(fcAliasText)]
      .filter(Boolean).map(fcNorm).filter(Boolean)
  }));
  const japan=rows.map((r,i)=>[i+2,r]).filter(([,r])=>
    r.Platform==='NES/Famicom'&&r.Category==='Games'&&r.Country==='Japan'&&
    (!r.UserRecordType||r.UserRecordType==='Owned')
  );
  const out={matched:[],unmatched_or_reconcile:[],duplicates:[],owned_famicom_identities:[]};
  const owned=new Map();

  function matchRow(r){
    const q=fcNorm(r.Title),qp=fcPubNorm(r.Publisher);
    if(!q)return [null,'empty_title'];
    let hits=candidates.filter(c=>c.keys.includes(q));
    const uniq=arr=>[...new Map(arr.map(c=>[c.x.identity_id,c])).values()];
    hits=uniq(hits);
    if(hits.length===1)return[hits[0].x,'exact_title_or_alias'];

    hits=uniq(candidates.filter(c=>c.keys.some(k=>
      k.startsWith(q+' ') ||
      (q.startsWith(k+' ') && k.split(' ').length>=2)
    )));
    if(hits.length>1&&qp){
      const ph=hits.filter(c=>{
        const p=fcPubNorm(c.x.publisher);
        return p&&qp&&(p.includes(qp)||qp.includes(p));
      });
      if(ph.length===1)hits=ph;
    }
    if(hits.length===1)return[hits[0].x,'unique_prefix'];

    // Final conservative token-overlap pass. Require strong overlap and publisher agreement.
    const qt=q.split(' ').filter(Boolean);
    if(qt.length>=3){
      let scored=[];
      for(const c of candidates){
        let best=0;
        for(const k of c.keys){
          const kt=k.split(' ').filter(Boolean),isect=qt.filter(t=>kt.includes(t)).length;
          const score=isect/Math.max(qt.length,kt.length);
          if(score>best)best=score;
        }
        const p=fcPubNorm(c.x.publisher),pubOK=!qp||!p||p.includes(qp)||qp.includes(p);
        if(best>=0.8&&pubOK)scored.push([best,c]);
      }
      scored.sort((a,b)=>b[0]-a[0]);
      if(scored.length&&(!scored[1]||scored[0][0]>scored[1][0]))return[scored[0][1].x,'high_token_overlap'];
    }
    return[null,hits.length?'ambiguous':'unmatched'];
  }

  for(const [line,r] of japan){
    const rec={csv_line:line,title:r.Title,publisher:r.Publisher,release_type:r.ReleaseType,ownership:r.Ownership};
    if(['Homebrew','Afterlife','Digital','Hack'].includes(r.ReleaseType)){
      rec.match_method='non_scope_release_type';out.unmatched_or_reconcile.push(rec);continue;
    }
    const [x,method]=matchRow(r);
    if(!x){rec.match_method=method;out.unmatched_or_reconcile.push(rec);continue;}
    Object.assign(rec,{identity_id:x.identity_id,romanized_title:x.romanized_title,english_reference_title:x.english_reference_title,match_method:method});
    out.matched.push(rec);
    if(!owned.has(x.identity_id))owned.set(x.identity_id,[]);
    owned.get(x.identity_id).push(line);
  }
  for(const [id,lines] of owned)if(lines.length>1){
    const x=identities.find(y=>y.identity_id===id);
    out.duplicates.push({identity_id:id,romanized_title:x?.romanized_title,csv_lines:lines,copies:lines.length});
  }
  out.owned_famicom_identities=[...owned].map(([id,lines])=>{
    const x=identities.find(y=>y.identity_id===id);
    return {identity_id:id,romanized_title:x?.romanized_title,english_reference_title:x?.english_reference_title,csv_lines:lines};
  }).sort((a,b)=>(a.romanized_title||'').localeCompare(b.romanized_title||''));
  const methods={};for(const r of out.matched)methods[r.match_method]=(methods[r.match_method]||0)+1;
  out.summary={
    famicom_japan_game_rows:japan.length,
    matched_famicom_rows:out.matched.length,
    unmatched_or_reconcile_rows:out.unmatched_or_reconcile.length,
    identities_with_duplicate_copies:out.duplicates.length,
    distinct_famicom_identities_owned:owned.size,
    famicom_census_total:identities.length,
    famicom_completion_pct:identities.length?Math.round((10000*owned.size/identities.length))/100:0,
    match_methods:methods,
    reconcile_items:out.unmatched_or_reconcile.map(r=>({
      csv_line:r.csv_line,
      title:r.title,
      publisher:r.publisher,
      release_type:r.release_type,
      reason:r.match_method
    }))
  };
  return out;
}
