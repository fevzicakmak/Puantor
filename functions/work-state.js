// The client sends an action, never elapsed time or a replacement history.
function createWorkStateHandler({db, Timestamp, HttpsError}) {
 const fail=(code,message)=>{throw new HttpsError(code,message)};
 const segment=v=>typeof v==="string" && /^[A-Za-z0-9_-]{1,128}$/.test(v);
 const allowed={start:["idle","paused","broken"],pause:["running"],fault:["running","paused","idle"],finish:["running","paused","broken","idle"]};
 return async request=>{
  if(!request.auth)fail("unauthenticated","Oturum açmanız gerekiyor.");
  const {machineId,action,requestId,expectedUpdatedAt,expectedStatus,reason=""}=request.data||{};
  if(!segment(machineId)||!segment(requestId)||typeof action!=="string"||!Object.hasOwn(allowed,action))fail("invalid-argument","Geçersiz çalışma işlemi.");
  if(!expectedUpdatedAt||!Number.isInteger(expectedUpdatedAt.seconds)||!Number.isInteger(expectedUpdatedAt.nanoseconds)||expectedUpdatedAt.nanoseconds<0||expectedUpdatedAt.nanoseconds>=1e9)
   fail("invalid-argument","Güncel makine bilgisi gerekli.");
  if(typeof reason!=="string"||reason.length>500||(action==="fault"&&!reason.trim()))fail("invalid-argument","Arıza açıklaması 1-500 karakter olmalı.");
  const uid=request.auth.uid,userRef=db.collection("users").doc(uid);
  const receiptRef=userRef.collection("workRequests").doc(requestId);
  return db.runTransaction(async tx=>{
   const [profile,receipt]=await Promise.all([tx.get(userRef),tx.get(receiptRef)]);
   if(!profile.exists)fail("permission-denied","Operatör hesabı doğrulanamadı.");
   const user=profile.data(),tenant=user.role==="tenant_operator";
   if(!tenant&&user.role!=="operator")fail("permission-denied","Operatör yetkisi gerekli.");
   if(tenant&&!segment(user.tenantId))fail("permission-denied","Firma kaydı doğrulanamadı.");
   if(tenant){
    const business=await tx.get(db.collection("businesses").doc(user.tenantId));
    if(!business.exists||business.data().accountStatus==="closed")fail("permission-denied","İşletme erişimi kapatılmış.");
   }
   if(receipt.exists){
    const saved=receipt.data();
    if(saved.machineId!==machineId||saved.action!==action||saved.reason!==reason||saved.tenantId!==(tenant?user.tenantId:null))fail("invalid-argument","İşlem kimliği başka bir istekte kullanılmış.");
    return saved.result;
   }
   const machines=tenant?db.collection("businesses").doc(user.tenantId).collection("machines"):db.collection("machines");
   const ref=machines.doc(machineId),snap=await tx.get(ref);
   if(!snap.exists)fail("not-found","Makine bulunamadı.");
   const machine=snap.data();
   if(machine.operatorUid!==uid||!Array.isArray(user.machineIds)||!user.machineIds.includes(machineId))fail("permission-denied","Bu makine size atanmış değil.");
   const updated=machine.updatedAt;
   if(machine.status!==expectedStatus||!updated||updated.seconds!==expectedUpdatedAt.seconds||updated.nanoseconds!==expectedUpdatedAt.nanoseconds)fail("failed-precondition","Makinenin durumu değişti. Güncel bilgileri kontrol edip yeniden deneyin.");
   if(machine.jobReady!==true||!allowed[action].includes(machine.status))fail("failed-precondition","Makinenin durumu bu işleme uygun değil veya yeni görev açılmadı.");
   if(action==="start"){
    // Query authoritative ownership. Historical machineIds may contain machines
    // which have since been assigned to someone else; they must not block work.
    const assignments=await tx.get(machines.where("operatorUid","==",uid));
    if(assignments.docs.some(s=>s.id!==machineId&&(s.data().jobReady===true||["running","paused","broken","done"].includes(s.data().status))))
     fail("failed-precondition","Başka makinede arşivlenmemiş işiniz var. Önce yönetici onayıyla arşivleyin.");
   }
   const now=Timestamp.now(),previous=machine.elapsedMs??0;
   if(!Number.isSafeInteger(previous)||previous<0)fail("failed-precondition","Çalışma süresini yönetici kontrol etmeli.");
   const start=machine.startedAt;
   if(machine.status==="running"&&(!start||typeof start.toMillis!=="function"))fail("failed-precondition","Başlangıç zamanı bulunamadı. Yöneticiyle görüşün.");
   // Existing serverTimestamp values can have sub-millisecond precision.
   const elapsedMs=previous+(machine.status==="running"?Math.floor(Math.max(0,now.toMillis()-start.toMillis())):0);
   if(!Number.isSafeInteger(elapsedMs))fail("failed-precondition","Çalışma süresini yönetici kontrol etmeli.");
   const status={start:"running",pause:"paused",fault:"broken",finish:"done"}[action];
   const event={action,at:now,elapsedMs,operatorName:machine.operatorName||"",reason:action==="fault"?reason.trim():""};
   const timeline=Array.isArray(machine.timeline)?machine.timeline:[];
   tx.update(ref,{status,elapsedMs,startedAt:action==="start"?now:null,faultReason:event.reason,jobReady:action!=="finish",updatedAt:now,timeline:[...timeline,event]});
   if(action==="start")tx.update(userRef,{activeMachineId:machineId});
   else if(user.activeMachineId===machineId)tx.update(userRef,{activeMachineId:""});
   const result={status,elapsedMs,serverNowMs:now.toMillis()};
   tx.create(receiptRef,{machineId,action,reason,tenantId:tenant?user.tenantId:null,result,createdAt:now});
   return result;
  });
 };
}
module.exports={createWorkStateHandler};
