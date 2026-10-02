(()=>{
const OWNED='shelfcheck-nes-matty-v1';
const WISHLIST='shelfcheck-nes-matty-wishlist-v1';
const PLAY='shelfcheck-nes-matty-play-v1';
const FAMICOM='shelfcheck-famicom-matty-v1';
const ACTIVE_SET='shelfcheck-active-set-v1';
const FAMICOM_WISHLIST='shelfcheck-famicom-matty-wishlist-v1';
const FAMICOM_PLAY='shelfcheck-famicom-matty-play-v1';
const V1_KEYS=[OWNED,WISHLIST,PLAY],V2_KEYS=[...V1_KEYS,FAMICOM,ACTIVE_SET],V3_KEYS=[...V2_KEYS,FAMICOM_WISHLIST,FAMICOM_PLAY];
const backupBtn=document.getElementById('backupBtn');
const restoreBtn=document.getElementById('restoreBtn');
const restoreFile=document.getElementById('restoreFile');
function backup(){
  const storage={};for(const key of V3_KEYS)storage[key]=localStorage.getItem(key);
  const payload={app:'ShelfCheck NES',schema:3,created_at:new Date().toISOString(),storage};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`shelfcheck-backup-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);
}
async function restore(file){
  let data;try{data=JSON.parse(await file.text())}catch{alert('That backup file is not valid JSON.');return}
  if(data?.app!=='ShelfCheck NES'||![1,2,3].includes(data?.schema)||!data.storage||typeof data.storage!=='object'){alert('That is not a compatible Shelf Check backup.');return}
  const keys=data.schema===1?V1_KEYS:data.schema===2?V2_KEYS:V3_KEYS,next={};for(const key of keys){const value=data.storage[key];if(value!=null&&typeof value!=='string'){alert('Backup data is malformed. Nothing was restored.');return}next[key]=value??null;}
  const msg=data.schema===1?'Restore this older NES backup? NES ownership, wishlist, and play-progress will be replaced. Famicom data will be left alone.':data.schema===2?'Restore this older Shelf Check backup? NES and Famicom ownership will be replaced; newer Famicom play/wishlist data will be left alone.':'Restore this Shelf Check backup on this device? NES and Famicom ownership, wishlists, and play-progress will be replaced.';
  if(!confirm(msg))return;
  for(const key of keys){if(next[key]==null)localStorage.removeItem(key);else localStorage.setItem(key,next[key]);}
  location.reload();
}
backupBtn?.addEventListener('click',backup);
restoreBtn?.addEventListener('click',()=>restoreFile?.click());
restoreFile?.addEventListener('change',e=>{const f=e.target.files?.[0];if(f)restore(f);e.target.value='';});
})();
