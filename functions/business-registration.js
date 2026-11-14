function createBusinessRegistrationHandler({db,Timestamp,HttpsError}){
 const fail=(code,message)=>{throw new HttpsError(code,message)};
 const text=(value,min,max)=>typeof value==="string"&&value.trim().length>=min&&value.trim().length<=max;
 return async request=>{
  if(!request.auth)fail("unauthenticated","Oturum açmanız gerekiyor.");
  const uid=request.auth.uid,email=request.auth.token?.email;
  if(typeof email!=="string"||email.toLowerCase().endsWith("@operators.puantor.invalid"))fail("permission-denied","İşletme kaydı için yönetici e-postası gerekli.");
  const input=request.data||{},userRef=db.collection("users").doc(uid),businessRef=db.collection("businesses").doc(uid);
  return db.runTransaction(async tx=>{
   const [profile,business]=await Promise.all([tx.get(userRef),tx.get(businessRef)]);
   const user=profile.exists?profile.data():null,firm=business.exists?business.data():null;
   if(user&&(user.role!=="tenant_admin"||user.tenantId!==uid))fail("permission-denied","Mevcut hesabın yetkisi değiştirilemez.");
   if(firm&&firm.ownerUid!==uid)fail("permission-denied","Firma sahibi doğrulanamadı.");
   if(user&&firm)return {tenantId:uid,complete:true};
   // Recover from either half of the old two-write signup. Existing names and
   // metadata are authoritative; a retry never overwrites a completed account.
   const name=firm?.name||user?.businessName||input.company;
   const managerName=firm?.managerName||user?.managerName||input.manager;
   if(!text(name,2,100)||!text(managerName,2,80))fail("failed-precondition","İşletme ve yönetici bilgilerini tamamlayın.");
   const createdAt=Timestamp.now();
   if(!profile.exists)tx.create(userRef,{role:"tenant_admin",tenantId:uid,businessName:name.trim(),managerName:managerName.trim(),email,createdAt});
   if(!business.exists)tx.create(businessRef,{name:name.trim(),managerName:managerName.trim(),ownerUid:uid,createdAt});
   return {tenantId:uid,complete:true};
  });
 };
}
module.exports={createBusinessRegistrationHandler};
