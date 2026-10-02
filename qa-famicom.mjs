import fs from 'node:fs';
const j=f=>JSON.parse(fs.readFileSync(new URL(f,import.meta.url),'utf8'));
const fc=j('./famicom-census.json'),rel=j('./famicom-relationships.json'),releases=j('./famicom-releases.json'),manifest=j('./famicom-dossiers-manifest.json'),nes=j('./nes-census.json');
const nesIds=Object.values(nes.identities).flat();
const dossiers=(await Promise.all(manifest.chunks.map(c=>Promise.resolve(j(`./${c.file}`))))).flat();
const checks=[
 ['NES CORE remains 816',nesIds.length===816],
 ['Famicom identities 1040',fc.identities.length===1040],
 ['Famicom identity IDs unique',new Set(fc.identities.map(x=>x.identity_id)).size===1040],
 ['Famicom releases 1041',releases.releases.length===1041],
 ['Famicom relationships 1040',rel.relationships.length===1040],
 ['Famicom dossiers 1040',dossiers.length===1040],
 ['Every Famicom identity has dossier',fc.identities.every(x=>dossiers.some(d=>d.identity_id===x.identity_id))],
 ['Relationships cannot grant ownership',rel.relationships.every(r=>!('owned' in r)&&!('completion' in r))],
 ['All linked NES IDs exist',fc.identities.filter(x=>x.nes_identity_id).every(x=>nesIds.some(n=>n.identity_id===x.nes_identity_id))],
 ['Phase 2 script present',fs.existsSync(new URL('./famicom-dossier.js',import.meta.url))],
 ['Famicom CSS present',fs.existsSync(new URL('./famicom.css',import.meta.url))]
];
for(const [name,ok] of checks)console.log(`${ok?'PASS':'FAIL'}  ${name}`);
if(checks.some(([,ok])=>!ok))process.exit(1);
