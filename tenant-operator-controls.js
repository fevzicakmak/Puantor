// Tenant operator controls; only current assignment can be controlled.
import {doc,runTransaction,serverTimestamp} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";
export async function changeTenantMachineState(db,{tenantId,operatorUid,machineId,action,reason=""}){
 if(!tenantId||!operatorUid||!machineId)throw Error("Eksik görev kimliği");
 const allowed={start:["idle","paused","broken"],pause:["running"],fault:["idle","running","paused"],finish:["idle","running","paused","broken"]};
 if(!allowed[action])throw Error("Geçersiz işlem");
 const clean=String(reason||"").trim();
 if(action==="fault"&&(!clean||clean.length>500))throw Error("Arıza açıklaması zorunlu (en fazla 500 karakter)");
 const ref=doc(db,"businesses",tenantId,"machines",machineId);
 await runTransaction(db,async tx=>{
  const snap=await tx.get(ref);
  if(!snap.exists())throw Error("Makine bulunamadı");
  const m=snap.data();
  if(m.operatorUid!==operatorUid||m.jobReady!==true||!m.currentJobId)throw Error("Aktif görev yetkisi yok");
  if(!allowed[action].includes(m.status))throw Error("Makine durumu değişti");
  const jobRef=doc(db,"businesses",tenantId,"jobs",m.currentJobId);
  const job=await tx.get(jobRef);
  if(!job.exists()||job.data().operatorUid!==operatorUid||job.data().machineId!==machineId||job.data().status==="done")throw Error("Görev doğrulanamadı");
  const now=Date.now();
  const started=m.startedAt?.toMillis?.()||0;
  if(m.status==="running"&&!started)throw Error("Başlangıç zamanı henüz eşitlenmedi");
  const elapsed=Math.floor((Number(m.elapsedMs)||0)+(m.status==="running"?Math.max(0,now-started):0));
  const status={start:"running",pause:"paused",fault:"broken",finish:"done"}[action];
  tx.update(ref,{status,elapsedMs:action==="start"?(Number(m.elapsedMs)||0):elapsed,startedAt:action==="start"?serverTimestamp():null,faultReason:action==="fault"?clean:"",jobReady:action!=="finish",updatedAt:serverTimestamp()});
  if(action==="finish")tx.update(jobRef,{status:"done",finishedAt:serverTimestamp()});
 });
}
