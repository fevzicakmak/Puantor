// Requests are private server-owned records. Submitting a request never deletes
// a business, disables its operators, or changes existing work/financial data.
const {receiptHash,writeReceipt}=require("./deletion-receipt");
function createAccountDeletionHandler({db,Timestamp,HttpsError,adminUid,completeDeletion,now=()=>Date.now()}){
 const fail=(code,message)=>{throw new HttpsError(code,message)};
 function recent(request){
  const authenticatedAt=request.auth.token?.auth_time;
  if(!Number.isFinite(authenticatedAt)||authenticatedAt*1000>now()+30000||now()-authenticatedAt*1000>5*60*1000)
   fail("failed-precondition","Güvenliğiniz için mevcut şifrenizle yeniden doğrulama yapın.");
 }
 const present=snapshot=>{
  if(!snapshot.exists)return {status:"none"};
  const data=snapshot.data();
  return {status:data.status,requestedAt:data.requestedAt?.toDate().toISOString()||null,scope:data.scope??null,requiresOwnerConsent:data.role==="tenant_admin"&&data.ownerClosureConsent!==true,expectedCompletionAt:data.expectedCompletionAt?.toDate().toISOString()||null,completedAt:data.completedAt?.toDate().toISOString()||null};
 };
 return async request=>{
  if(request.data?.action==="receipt"){
   const hash=receiptHash(request.data.receiptToken);
   if(!hash)return {status:"unknown"};
   const doc=await db.collection("accountDeletionReceipts").doc(hash).get(),data=doc.exists?doc.data():null;
   if(!data||!data.expiresAt||data.expiresAt.toMillis()<=now())return {status:"unknown"};
   return {status:data.status,expectedCompletionAt:data.expectedCompletionAt?.toDate().toISOString()||null,completedAt:data.completedAt?.toDate().toISOString()||null};
  }
  if(!request.auth)fail("unauthenticated","Hesap işlemleri için giriş yapın.");
  const uid=request.auth.uid,input=request.data||{},action=input.action;
  if(["reviewList","reviewStart","reviewReopen","reviewComplete","reviewCleanup"].includes(action)){
   if(!adminUid||uid!==adminUid)fail("permission-denied","Yalnızca uygulama destek yöneticisi erişebilir.");
   const validUid=value=>typeof value==="string"&&/^[a-zA-Z0-9_-]{1,128}$/.test(value);
   if(action==="reviewList"){
    if(input.cursor!==undefined&&!validUid(input.cursor))fail("invalid-argument","Geçersiz liste imleci.");
    // Scan by document ID, without a new composite-index dependency. Filtering
    // can be done by the support UI; pagination also exposes old requests.
    let query=db.collection("accountDeletionRequests").orderBy("__name__").limit(50);
    if(input.cursor)query=query.startAfter(input.cursor);
    const page=await query.get();
    return {items:page.docs.map(doc=>({uid:doc.id,...present(doc),role:doc.data().role||"unknown",email:doc.data().email||null,retryable:doc.data().retryable===true})),nextCursor:page.size===50?page.docs.at(-1).id:null};
   }
   recent(request);
   if(action==="reviewCleanup"){
    const stamp=Timestamp.fromMillis(now());
    const [requests,receipts]=await Promise.all([
     db.collection("accountDeletionRequests").where("purgeAfter","<=",stamp).limit(100).get(),
     db.collection("accountDeletionReceipts").where("expiresAt","<=",stamp).limit(100).get()
    ]);
    return db.runTransaction(async tx=>{
     const docs=await Promise.all([...requests.docs,...receipts.docs].map(doc=>tx.get(doc.ref)));
     let requestsRemoved=0,receiptsRemoved=0;
     for(const doc of docs){
      if(!doc.exists)continue;
      const data=doc.data();
      if(doc.ref.parent.id==="accountDeletionReceipts"){
       if(data.expiresAt?.toMillis()<=now()){tx.delete(doc.ref);receiptsRemoved++}
      }else if(["completed","cancelled"].includes(data.status)&&data.purgeAfter?.toMillis()<=now()){
       // At least 30 days after completion: the deleted Auth user's ID tokens
       // have long expired. Active/deleting requests are never purged here.
       tx.delete(doc.ref);requestsRemoved++;
      }
     }
     return {requestsRemoved,receiptsRemoved};
    });
   }
   if(!validUid(input.uid))fail("invalid-argument","Geçersiz hesap kimliği.");
   if(action==="reviewComplete"){
    if(input.confirmation!=="HESABI SİL:"+input.uid||input.recordsReviewed!==true)fail("invalid-argument","Hedef hesabı ve kayıt incelemesini açıkça onaylayın.");
    if(!completeDeletion)fail("failed-precondition","Hesap silme henüz etkin değil.");
    return completeDeletion({uid:input.uid,retentionNote:input.retentionNote});
   }
   return db.runTransaction(async tx=>{
    const target=db.collection("accountDeletionRequests").doc(input.uid),snapshot=await tx.get(target);
    if(!snapshot.exists)fail("not-found","Talep bulunamadı.");
    const state=snapshot.data().status,next=action==="reviewStart"?"processing":"pending";
    if(state===next)return present(snapshot);
    if(state!==(action==="reviewStart"?"pending":"processing"))fail("failed-precondition","Talep bu işlem için uygun durumda değil.");
    const expectedCompletionAt=action==="reviewStart"?input.expectedCompletionAt:null;
    if(action==="reviewStart"&&(!Number.isSafeInteger(expectedCompletionAt)||expectedCompletionAt<=now()||expectedCompletionAt>now()+30*24*60*60*1000))fail("invalid-argument","Önümüzdeki 30 gün içinde bir hedef tamamlanma tarihi seçin.");
    const stamp=Timestamp.fromMillis(now()),deadline=expectedCompletionAt?Timestamp.fromMillis(expectedCompletionAt):null;
    tx.update(target,{status:next,reviewedBy:uid,updatedAt:stamp,expectedCompletionAt:deadline});
    writeReceipt({tx,db,record:snapshot.data(),status:next,stamp,expectedCompletionAt:deadline});
    return {...present(snapshot),status:next,expectedCompletionAt:deadline?.toDate().toISOString()||null};
   });
  }
  if(!["status","request","cancel"].includes(action))fail("invalid-argument","Geçersiz hesap işlemi.");
  const ref=db.collection("accountDeletionRequests").doc(uid);
  if(action==="status")return present(await ref.get());
  recent(request);
  if(action==="request"&&input.confirmation!=="HESABIMI SİL")fail("invalid-argument","Silme talebinin sonuçlarını onaylayın.");
  const hash=action==="request"&&input.receiptToken!==undefined?receiptHash(input.receiptToken):null;
  if(action==="request"&&input.receiptToken!==undefined&&!hash)fail("invalid-argument","Geçersiz talep takip anahtarı.");
  return db.runTransaction(async tx=>{
   const [existing,profile,business]=await Promise.all([
    tx.get(ref),tx.get(db.collection("users").doc(uid)),tx.get(db.collection("businesses").doc(uid))
   ]);
   const previous=existing.exists?existing.data():null;
   if(action==="cancel"){
    if(!previous||previous.status==="cancelled")return {status:previous?.status||"none"};
    if(previous.status!=="pending")fail("failed-precondition","İşleme alınan talebi iptal etmek için destek ile iletişime geçin.");
    const stamp=Timestamp.fromMillis(now());
    tx.update(ref,{status:"cancelled",updatedAt:stamp,purgeAfter:Timestamp.fromMillis(now()+30*24*60*60*1000)});
    writeReceipt({tx,db,record:previous,status:"cancelled",stamp});
    return {status:"cancelled"};
   }
   if(previous&&["pending","processing","deleting","completed"].includes(previous.status))return present(existing);
   const user=profile.exists?profile.data():{},role=user.role||"unconfigured";
   if(role==="tenant_admin"&&(user.tenantId!==uid||!business.exists||business.data().ownerUid!==uid))
    fail("failed-precondition","Firma sahipliği doğrulanamadı. Destek ile iletişime geçin.");
   if(role==="tenant_admin"&&input.ownerClosureConsent!==true)fail("invalid-argument","Firma kapanışının operatör erişimini durduracağını ayrıca onaylayın.");
   if(hash){
    const receipt=await tx.get(db.collection("accountDeletionReceipts").doc(hash));
    if(receipt.exists&&receipt.data().uid!==uid)fail("already-exists","Talep takip anahtarını yenileyip tekrar deneyin.");
   }
   const stamp=Timestamp.fromMillis(now());
   const scope=role==="tenant_admin"?"business-owner-review":"account-review";
   tx.set(ref,{uid,role,tenantId:typeof user.tenantId==="string"?user.tenantId:null,
    email:typeof request.auth.token?.email==="string"?request.auth.token.email:null,
    scope,status:"pending",requestedAt:stamp,updatedAt:stamp,policyVersion:2,ownerClosureConsent:role==="tenant_admin",...(hash?{receiptHash:hash}:{})});
   if(hash)tx.set(db.collection("accountDeletionReceipts").doc(hash),{uid,status:"pending",updatedAt:stamp,expiresAt:Timestamp.fromMillis(now()+30*24*60*60*1000)});
   return {status:"pending",requestedAt:stamp.toDate().toISOString(),scope};
  });
 };
}
module.exports={createAccountDeletionHandler};
