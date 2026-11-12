// IndexedDB sensor archive. Data stays on the phone; no network requests.
// Stores every sampled row across sessions, up to a device-local safety limit.
export const ARCHIVE_DB="puantor-motion-field-v1";
export const ARCHIVE_STORE="samples";
export const ARCHIVE_MAX_ROWS=100000;
export function openMotionArchive(indexedDBFactory=globalThis.indexedDB){
 return new Promise((resolve,reject)=>{
  if(!indexedDBFactory){reject(new Error("IndexedDB kullanılamıyor"));return;}
  const req=indexedDBFactory.open(ARCHIVE_DB,1);
  req.onupgradeneeded=()=>{
   const db=req.result;
   if(!db.objectStoreNames.contains(ARCHIVE_STORE))db.createObjectStore(ARCHIVE_STORE,{keyPath:"id",autoIncrement:true});
  };
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error||new Error("Arşiv açılamadı"));
 });
}
export function insertMotionArchive(db,entries){
 if(!entries.length)return Promise.resolve({saved:0});
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(ARCHIVE_STORE,"readwrite");
  const store=tx.objectStore(ARCHIVE_STORE);
  entries.forEach(entry=>store.add(entry));
  let count;
  const countReq=store.count();
  countReq.onsuccess=()=>{
   count=countReq.result;
   if(count<=ARCHIVE_MAX_ROWS)return;
   let surplus=count-ARCHIVE_MAX_ROWS;
   const cursorReq=store.openCursor();
   cursorReq.onsuccess=()=>{
    const cursor=cursorReq.result;
    if(!cursor||surplus<=0)return;
    cursor.delete();surplus--;cursor.continue();
   };
  };
  tx.oncomplete=()=>resolve({saved:entries.length,count:Math.min(count??0,ARCHIVE_MAX_ROWS)});
  tx.onerror=()=>reject(tx.error||new Error("Arşiv kaydı başarısız"));
  tx.onabort=()=>reject(tx.error||new Error("Arşiv işlemi iptal edildi"));
 });
}
export function readMotionArchive(db){
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(ARCHIVE_STORE,"readonly");
  const req=tx.objectStore(ARCHIVE_STORE).getAll();
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error||new Error("Arşiv okunamadı"));
 });
}
export function clearMotionArchive(db){
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(ARCHIVE_STORE,"readwrite");
  tx.objectStore(ARCHIVE_STORE).clear();
  tx.oncomplete=()=>resolve();
  tx.onerror=()=>reject(tx.error||new Error("Arşiv silinemedi"));
 });
}
