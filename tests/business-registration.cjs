const assert=require("node:assert/strict");
const {initializeApp,deleteApp}=require("firebase-admin/app");
const {getFirestore,Timestamp}=require("firebase-admin/firestore");
const {createBusinessRegistrationHandler}=require("../functions/business-registration");
process.env.FIRESTORE_EMULATOR_HOST||="127.0.0.1:8080";
assert.match(process.env.FIRESTORE_EMULATOR_HOST,/^(127\.0\.0\.1|localhost):\d+$/);
const app=initializeApp({projectId:"puantor-tenant-rules-test"},"registration-tests"),db=getFirestore(app);
class RegistrationError extends Error{constructor(code,message){super(message);this.code=code}}
const complete=createBusinessRegistrationHandler({db,Timestamp,HttpsError:RegistrationError});
const request=(uid,data={})=>({auth:{uid,token:{email:uid+"@example.com"}},data});
const denied=(req,code)=>assert.rejects(()=>complete(req),error=>error.code===code);
(async()=>{try{
 await denied({data:{}},"unauthenticated");
 await denied({auth:{uid:"op",token:{email:"op@operators.puantor.invalid"}},data:{}},"permission-denied");
 for(const role of ["admin","operator","tenant_operator","business_pending"]){
  const uid="existing-"+role;
  await db.collection("users").doc(uid).set({role});
  await denied(request(uid,{company:"Firma",manager:"Yönetici"}),"permission-denied");
  assert.equal((await db.collection("users").doc(uid).get()).data().role,role);
  assert.equal((await db.collection("businesses").doc(uid).get()).exists,false);
 }
 await denied(request("incomplete"),"failed-precondition");
 assert.equal((await db.collection("users").doc("incomplete").get()).exists,false);
 assert.equal((await db.collection("businesses").doc("incomplete").get()).exists,false);
 for(const partial of ["none","profile","business","both"]){
  const uid="signup-"+partial,ur=db.collection("users").doc(uid),br=db.collection("businesses").doc(uid);
  const createdAt=Timestamp.fromMillis(1000);
  if(partial==="profile"||partial==="both")await ur.set({role:"tenant_admin",tenantId:uid,businessName:"Korunan Firma",managerName:"Korunan Yönetici",email:uid+"@example.com",createdAt});
  if(partial==="business"||partial==="both")await br.set({ownerUid:uid,name:"Korunan Firma",managerName:"Korunan Yönetici",operatorFirmCode:"korunan",createdAt});
  const req=request(uid,partial==="none"?{company:"Yeni Firma",manager:"Yeni Yönetici"}:{});
  const results=await Promise.all([complete(req),complete(req)]);
  assert.ok(results.every(x=>x.complete&&x.tenantId===uid));
  const user=(await ur.get()).data(),business=(await br.get()).data();
  assert.equal(user.role,"tenant_admin");assert.equal(user.tenantId,uid);assert.equal(business.ownerUid,uid);
  const snapshot=JSON.stringify({user,business});
  await complete(request(uid,{company:"Üzerine Yazma",manager:"Üzerine Yazma"}));
  assert.equal(JSON.stringify({user:(await ur.get()).data(),business:(await br.get()).data()}),snapshot);
  if(partial!=="none")assert.equal(business.name,"Korunan Firma");
  if(partial==="business"||partial==="both")assert.equal(business.operatorFirmCode,"korunan");
 }
 await db.collection("businesses").doc("foreign-owner").set({ownerUid:"someone-else",name:"Başka Firma"});
 await denied(request("foreign-owner",{company:"Firma",manager:"Yönetici"}),"permission-denied");
 console.log("PASS: atomic signup, both partial states, concurrent retries, preserved existing accounts and denied role changes");
}finally{await deleteApp(app)}})().catch(error=>{console.error(error);process.exitCode=1});
