// Requests are private server-owned records. Submitting a request never deletes
// a business, disables its operators, or changes existing work/financial data.
function createAccountDeletionHandler({db,Timestamp,HttpsError,adminUid,now=()=>Date.now()}){
 const fail=(code,message)=>{throw new HttpsError(code,message)};
 function recent(request){
  const authenticatedAt=request.auth.token?.auth_time;
  if(!Number.isFinite(authenticatedAt)||authenticatedAt*1000>now()+30000||now()-authenticatedAt*1000>5*60*1000)
   fail("failed-precondition","Güvenliğiniz için mevcut şifrenizle yeniden doğrulama yapın.");
 }
 const present=snapshot=>{
  if(!snapshot.exists)return {status:"none"};
  const data=snapshot.data();
  return {status:data.status,requestedAt:data.requestedAt?.toDate().toISOString()||null,scope:data.scope};
 };
 return async request=>{
  if(!request.auth)fail("unauthenticated","Hesap işlemleri için giriş yapın.");
  const uid=request.auth.uid,input=request.data||{},action=input.action;
  if(["reviewList","reviewStart","reviewReopen"].includes(action)){
   if(!adminUid||uid!==adminUid)fail("permission-denied","Yalnızca uygulama destek yöneticisi erişebilir.");
   const validUid=value=>typeof value==="string"&&/^[a-zA-Z0-9_-]{1,128}$/.test(value);
   if(action==="reviewList"){
    if(input.cursor!==undefined&&!validUid(input.cursor))fail("invalid-argument","Geçersiz liste imleci.");
    // Scan by document ID, without a new composite-index dependency. Filtering
    // can be done by the support UI; pagination also exposes old requests.
    let query=db.collection("accountDeletionRequests").orderBy("__name__").limit(50);
    if(input.cursor)query=query.startAfter(input.cursor);
    const page=await query.get();
    return {items:page.docs.map(doc=>({uid:doc.id,...present(doc),role:doc.data().role,email:doc.data().email})),nextCursor:page.size===50?page.docs.at(-1).id:null};
   }
   recent(request);
   if(!validUid(input.uid))fail("invalid-argument","Geçersiz hesap kimliği.");
   return db.runTransaction(async tx=>{
    const target=db.collection("accountDeletionRequests").doc(input.uid),snapshot=await tx.get(target);
    if(!snapshot.exists)fail("not-found","Talep bulunamadı.");
    const state=snapshot.data().status,next=action==="reviewStart"?"processing":"pending";
    if(state===next)return present(snapshot);
    if(state!==(action==="reviewStart"?"pending":"processing"))fail("failed-precondition","Talep bu işlem için uygun durumda değil.");
    tx.update(target,{status:next,reviewedBy:uid,updatedAt:Timestamp.fromMillis(now())});
    return {...present(snapshot),status:next};
   });
  }
  if(!["status","request","cancel"].includes(action))fail("invalid-argument","Geçersiz hesap işlemi.");
  const ref=db.collection("accountDeletionRequests").doc(uid);
  if(action==="status")return present(await ref.get());
  recent(request);
  if(action==="request"&&input.confirmation!=="HESABIMI SİL")fail("invalid-argument","Silme talebinin sonuçlarını onaylayın.");
  return db.runTransaction(async tx=>{
   const [existing,profile,business]=await Promise.all([
    tx.get(ref),tx.get(db.collection("users").doc(uid)),tx.get(db.collection("businesses").doc(uid))
   ]);
   const previous=existing.exists?existing.data():null;
   if(action==="cancel"){
    if(!previous||previous.status==="cancelled")return {status:previous?.status||"none"};
    if(previous.status!=="pending")fail("failed-precondition","İşleme alınan talebi iptal etmek için destek ile iletişime geçin.");
    tx.update(ref,{status:"cancelled",updatedAt:Timestamp.fromMillis(now())});
    return {status:"cancelled"};
   }
   if(previous&&["pending","processing","completed"].includes(previous.status))return present(existing);
   const user=profile.exists?profile.data():{},role=user.role||"unconfigured";
   if(role==="tenant_admin"&&(user.tenantId!==uid||!business.exists||business.data().ownerUid!==uid))
    fail("failed-precondition","Firma sahipliği doğrulanamadı. Destek ile iletişime geçin.");
   const stamp=Timestamp.fromMillis(now());
   const scope=role==="tenant_admin"?"business-owner-review":"account-review";
   tx.set(ref,{uid,role,tenantId:typeof user.tenantId==="string"?user.tenantId:null,
    email:typeof request.auth.token?.email==="string"?request.auth.token.email:null,
    scope,status:"pending",requestedAt:stamp,updatedAt:stamp,policyVersion:1});
   return {status:"pending",requestedAt:stamp.toDate().toISOString(),scope};
  });
 };
}
module.exports={createAccountDeletionHandler};
