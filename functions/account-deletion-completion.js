const {randomUUID}=require("node:crypto");
const {writeReceipt}=require("./deletion-receipt");
// Only called after the outer callable has authenticated the support admin,
// required recent authentication, and checked the explicit target confirmation.
function createAccountDeletionCompletion({db,auth,Timestamp,HttpsError,adminUid,enabled=()=>false,now=()=>Date.now()}){
 const fail=(code,message)=>{throw new HttpsError(code,message)};
 const active=machine=>machine.jobReady===true||["running","paused","broken","done"].includes(machine.status);
 return async ({uid,retentionNote})=>{
  if(!enabled())fail("failed-precondition","Kalıcı silme henüz yayın için etkinleştirilmedi. Önce erişim kuralları doğrulanmalı.");
  if(uid===adminUid)fail("failed-precondition","Uygulama destek yöneticisi bu işlemle silinemez. Önce yönetici devri gerekir.");
  if(typeof retentionNote!=="string"||retentionNote.trim().length<12||retentionNote.length>500)
   fail("invalid-argument","Korunacak kayıtlar, gerekçe ve saklama süresi için inceleme notu yazın (12-500 karakter).");
  const requestRef=db.collection("accountDeletionRequests").doc(uid),userRef=db.collection("users").doc(uid),leaseId=randomUUID();
  const plan=await db.runTransaction(async tx=>{
   const [request,profile,business]=await Promise.all([tx.get(requestRef),tx.get(userRef),tx.get(db.collection("businesses").doc(uid))]);
   if(!request.exists)fail("not-found","Silme talebi bulunamadı.");
   const record=request.data();
   if(record.status==="completed")return {complete:true};
   if(!["processing","deleting"].includes(record.status))fail("failed-precondition","Talep önce destek incelemesine alınmalı.");
   if(record.status==="deleting"){
    if(record.leaseUntil?.toMillis()>now())fail("aborted","Silme işlemi devam ediyor. Daha sonra durumunu kontrol edin.");
    tx.update(requestRef,{leaseId,leaseUntil:Timestamp.fromMillis(now()+10*60*1000),retryable:false,updatedAt:Timestamp.fromMillis(now())});
    return {complete:false,owner:record.role==="tenant_admin",memberCursor:record.memberCursor||null,membersDisabled:record.membersDisabled===true};
   }
   const user=profile.exists?profile.data():null;
   if(user&&user.role!==record.role)fail("failed-precondition","Hesap rolü değişmiş. Talebi yeniden inceleyin.");
   const owner=record.role==="tenant_admin";
   if(owner){
    if(!business.exists||business.data().ownerUid!==uid||record.tenantId!==uid||(user&&user.tenantId!==uid))fail("failed-precondition","Firma sahipliği değişmiş. Talebi yeniden inceleyin.");
    if(record.policyVersion<2||record.ownerClosureConsent!==true)fail("failed-precondition","Firma sahibi kapanış onayını yeniden vermeli. Talebi beklemeye alın; kullanıcı geri çekip yeniden oluştursun.");
    const machines=business.ref.collection("machines");
    const [ready,unfinished]=await Promise.all([tx.get(machines.where("jobReady","==",true).limit(1)),tx.get(machines.where("status","in",["running","paused","broken","done"]).limit(1))]);
    if(!ready.empty||!unfinished.empty)fail("failed-precondition","İşletmede açık veya arşivlenmemiş iş var. Önce mevcut iş akışından tamamlayıp arşivleyin.");
    const stamp=Timestamp.fromMillis(now());
    tx.update(business.ref,{accountStatus:"closed",closedAt:stamp,closedBy:adminUid,recordCustodianUid:adminUid,managerName:"Silinmiş hesap"});
    tx.delete(userRef);
    tx.update(requestRef,{status:"deleting",retentionNote:retentionNote.trim(),reviewedBy:adminUid,leaseId,leaseUntil:Timestamp.fromMillis(now()+10*60*1000),retryable:false,updatedAt:stamp});
    writeReceipt({tx,db,record,status:"deleting",stamp});
    return {complete:false,owner:true};
   }
   if(business.exists)fail("failed-precondition","Hesapla ilişkili bir işletme var. Sahiplik ilişkisini ayrıca inceleyin.");
   if(!["tenant_operator","operator","pending","tenant_operator_pending","business_pending","unconfigured"].includes(record.role))fail("failed-precondition","Bu hesap türü için özel destek incelemesi gerekli.");
   const tenant=["tenant_operator","tenant_operator_pending"].includes(record.role);
   if(tenant&&(typeof record.tenantId!=="string"||!record.tenantId||record.tenantId.includes("/")||(user&&user.tenantId!==record.tenantId)))
    fail("failed-precondition","Operatörün işletme eşleşmesi değişmiş.");
   const parent=tenant?db.collection("businesses").doc(record.tenantId):db;
   const [operators,assigned]=await Promise.all([
    tx.get(parent.collection("operators").where("authUid","==",uid).limit(11)),
    tx.get(parent.collection("machines").where("operatorUid","==",uid).limit(101))
   ]);
   if(operators.size>10||assigned.size>100)fail("failed-precondition","Atama sayısı destek sınırını aşıyor. Kayıtları ayrıca inceleyin.");
   const machines=new Map(assigned.docs.map(doc=>[doc.id,doc])),aliases=[];
   for(const op of operators.docs){
    const legacy=await tx.get(parent.collection("machines").where("operatorUsername","==",op.id).limit(101));
    if(legacy.size>100)fail("failed-precondition","Eski atama sayısı destek sınırını aşıyor.");
    for(const machine of legacy.docs){
     if(machine.data().operatorUid&&machine.data().operatorUid!==uid)fail("failed-precondition","Çakışan operatör ataması var. Önce kayıtları düzeltin.");
     machines.set(machine.id,machine);
    }
    if(tenant){
     const names=await tx.get(parent.collection("operatorLoginNames").where("operatorId","==",op.id).limit(101));
     if(names.size>100)fail("failed-precondition","Giriş adı kayıtlarını ayrıca inceleyin.");
     aliases.push(...names.docs);
    }
   }
   if(machines.size>100||[...machines.values()].some(doc=>active(doc.data())))
    fail("failed-precondition","Operatörün açık veya arşivlenmemiş işi var. Önce işi mevcut akıştan tamamlayıp arşivleyin.");
   const stamp=Timestamp.fromMillis(now());
   // Deleting the profile and operator bindings in this transaction also makes
   // concurrent assignment/work transactions retry and reject the removed user.
   tx.delete(userRef);
   for(const op of operators.docs)tx.delete(op.ref);
   for(const alias of aliases)tx.delete(alias.ref);
   for(const machine of machines.values())tx.update(machine.ref,{operatorUid:"",operatorUsername:"",operatorName:"",updatedAt:stamp});
   tx.update(requestRef,{status:"deleting",retentionNote:retentionNote.trim(),reviewedBy:adminUid,leaseId,leaseUntil:Timestamp.fromMillis(now()+10*60*1000),retryable:false,updatedAt:stamp});
   writeReceipt({tx,db,record,status:"deleting",stamp});
   return {complete:false};
  });
  if(plan.complete)return {status:"completed"};
  try{
   if(plan.owner&&!plan.membersDisabled){
    // The closed business is already inaccessible by rules and callables.
    // Disable only verified members; never trust manager-editable authUid
    // values in the operators collection to select accounts for disabling.
    let cursor=plan.memberCursor;
    for(;;){
     let query=db.collection("users").where("tenantId","==",uid).orderBy("__name__").limit(100);
     if(cursor)query=query.startAfter(cursor);
     const page=await query.get();
     for(const member of page.docs){
      if(member.id===adminUid||member.id===uid||!["tenant_operator","tenant_operator_pending"].includes(member.data().role))continue;
      try{await auth.updateUser(member.id,{disabled:true})}catch(error){if(error.code!=="auth/user-not-found")throw error}
     }
     if(page.size)cursor=page.docs.at(-1).id;
     await db.runTransaction(async tx=>{
      const current=await tx.get(requestRef);
      if(!current.exists||current.data().leaseId!==leaseId||current.data().status!=="deleting")fail("aborted","Silme işleminin durumu değişti.");
      tx.update(requestRef,{memberCursor:cursor||null,membersDisabled:page.size<100,updatedAt:Timestamp.fromMillis(now())});
     });
     if(page.size<100)break;
    }
   }
   try{await auth.deleteUser(uid)}catch(error){if(error.code!=="auth/user-not-found")throw error}
   // Includes idempotency receipts below the now-removed profile. Retrying
   // recursiveDelete is safe even if an earlier attempt removed some children.
   await db.recursiveDelete(userRef);
   await db.recursiveDelete(db.collection("searchPreferences").doc(uid));
   if(plan.owner)await db.recursiveDelete(db.collection("businesses").doc(uid).collection("searchPreferences").doc(uid));
   await db.runTransaction(async tx=>{
    const current=await tx.get(requestRef),record=current.data();
    if(!current.exists||record.status!=="deleting"||record.leaseId!==leaseId)fail("aborted","Silme işleminin durumu değişti.");
    const stamp=Timestamp.fromMillis(now());
    // Keep a minimal support receipt, never the former email or login name.
    tx.set(requestRef,{uid,role:record.role,tenantId:record.tenantId??null,scope:record.scope,status:"completed",requestedAt:record.requestedAt,completedAt:stamp,updatedAt:stamp,purgeAfter:Timestamp.fromMillis(now()+30*24*60*60*1000),reviewedBy:adminUid,retentionNote:record.retentionNote,policyVersion:record.policyVersion,ownerClosureConsent:record.ownerClosureConsent===true,...(record.receiptHash?{receiptHash:record.receiptHash}:{}),...(record.expectedCompletionAt?{expectedCompletionAt:record.expectedCompletionAt}:{})});
    writeReceipt({tx,db,record,status:"completed",stamp});
   });
   return {status:"completed"};
  }catch(error){
   await db.runTransaction(async tx=>{
    const current=await tx.get(requestRef);
    if(current.exists&&current.data().status==="deleting"&&current.data().leaseId===leaseId)
     tx.update(requestRef,{leaseUntil:Timestamp.fromMillis(now()),retryable:true,updatedAt:Timestamp.fromMillis(now())});
   }).catch(()=>{});
   if(error instanceof HttpsError)throw error;
   fail("unavailable","Silme tamamlanamadı. Erişim kapalı tutuluyor; destek aynı talebi tekrar deneyebilir.");
  }
 };
}
module.exports={createAccountDeletionCompletion};
