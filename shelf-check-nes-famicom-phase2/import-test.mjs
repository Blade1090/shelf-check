import fs from 'node:fs';
import { importGameEye } from './import-core.mjs';

const ROOT=new URL('./',import.meta.url);
const j=p=>JSON.parse(fs.readFileSync(new URL(p,ROOT),'utf8'));
const csvPath=process.argv[2];
if(!csvPath)throw new Error('Usage: node import-test.mjs <Matty GameEye CSV>');

const data={
  census:j('nes-census.json'),
  tracked:j('nes-tracked-non-core.json'),
  pcu:j('pricecharting-unmapped.json'),
  pcAlias:j('pricecharting-alias-map.json')
};
const csv=fs.readFileSync(csvPath,'utf8');
const r=importGameEye(csv,data);
console.log(JSON.stringify(r.summary,null,2));

const exp={
  nes_famicom_game_rows:363,
  matched_core_rows:298,
  matched_non_core_rows:65,
  unmatched_or_reconcile_rows:0,
  identities_with_duplicate_copies:23,
  distinct_core_identities_owned:276,
  census_core_total:816
};
for(const [k,v] of Object.entries(exp))if(r.summary[k]!==v)throw new Error(`${k}: expected ${v}, got ${r.summary[k]}`);
if(r.summary.provisional_core_completion_pct!==33.82)throw new Error(`completion mismatch: expected 33.82, got ${r.summary.provisional_core_completion_pct}`);
console.log('PASS: Matty GameEye baseline matches reference importer exactly.');