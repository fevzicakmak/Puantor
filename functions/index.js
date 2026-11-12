const {onCall,HttpsError}=require("firebase-functions/v2/https");
const admin=require("firebase-admin");
admin.initializeApp();
const db=admin.firestore();
const ADMIN_UID="3m5MqDVbbFTVWl0VNWz1ipKZ8eO2";
const auth=admin.auth();
function adminOnly(request){if(!request.auth||request.auth.uid!==ADMIN_UID)throw new HttpsError("permission-denied","Yalnızca yönetici.");}
function username(v){const x=String(v||"").trim().toLowerCase();if(!/^[a-z0-9._-]{3,32}$/.test(x))throw new HttpsError("invalid-argument","Kullanıcı adı 3-32 karakter olmalı.");return x;}
function password(v){if(typeof v!=="string"||v.length<8||v.length>128)throw new HttpsError("invalid-argument","Şifre 8-128 karakter olmalı.");return v;}
function emailFor(name){return name+"@operators.puantor.invalid";}
exports.operatorAdmin=onCall({region:"europe-west1",enforceAppCheck:false},async request=>{
 adminOnly(request);
 const d=request.data||{},action=d.action;
 if(action==="create"){
  const name=username(d.username),displayName=String(d.displayName||"").trim();
  if(!displayName||displayName.length>80)throw new HttpsError("invalid-argument","Operatör adı gerekli.");
  const ref=db.collection("operators").doc(name),snap=await ref.get();
  if(snap.exists)throw new HttpsError("already-exists","Kullanıcı adı mevcut.");
  const email=emailFor(name);let user;
  try{
   user=await auth.createUser({email,password:password(d.password),displayName,emailVerified:true,disabled:false});
   await db.runTransaction(async tx=>{
    const current=await tx.get(ref);if(current.exists)throw new HttpsError("already-exists","Kullanıcı adı mevcut.");
    tx.create(ref,{username:name,displayName,authUid:user.uid,authStatus:"active",machineIds:[],createdAt:admin.firestore.FieldValue.serverTimestamp()});
    tx.create(db.collection("users").doc(user.uid),{role:"operator",username:name,displayName,email,machineIds:[],createdAt:admin.firestore.FieldValue.serverTimestamp()});
   });
  }catch(err){if(user)await auth.deleteUser(user.uid).catch(()=>{});throw err;}
  return {username:name};
 }
 if(action==="rename"){
  const name=username(d.username),displayName=String(d.displayName||"").trim();
  if(!displayName||displayName.length>80)throw new HttpsError("invalid-argument","Geçerli operatör adı gerekli.");
  const ref=db.collection("operators").doc(name),snap=await ref.get();
  if(!snap.exists||!snap.data().authUid)throw new HttpsError("not-found","Operatör bulunamadı.");
  await auth.updateUser(snap.data().authUid,{displayName});
  const batch=db.batch();batch.update(ref,{displayName});batch.update(db.collection("users").doc(snap.data().authUid),{displayName});await batch.commit();
  return {ok:true};
 }
 if(action==="password"){
  const name=username(d.username),snap=await db.collection("operators").doc(name).get();
  if(!snap.exists||!snap.data().authUid)throw new HttpsError("not-found","Operatör bulunamadı.");
  await auth.updateUser(snap.data().authUid,{password:password(d.password)});
  await auth.revokeRefreshTokens(snap.data().authUid);
  return {ok:true};
 }
 if(action==="delete"){
  const name=username(d.username),ref=db.collection("operators").doc(name),snap=await ref.get();
  if(!snap.exists)throw new HttpsError("not-found","Operatör bulunamadı.");
  const uid=snap.data().authUid;
  if(uid){await auth.updateUser(uid,{disabled:true});await auth.revokeRefreshTokens(uid);}
  const batch=db.batch();batch.delete(ref);if(uid)batch.delete(db.collection("users").doc(uid));await batch.commit();
  return {ok:true};
 }
 throw new HttpsError("invalid-argument","Geçersiz işlem.");
});

function tenantOperatorName(v) {
 const value=String(v||"").trim().toLowerCase();
 if(!/^[a-z0-9._-]{3,32}$/.test(value))throw new HttpsError("invalid-argument","Operatör kullanıcı adı geçersiz.");
 return value;
}
async function requireTenantManager(request) {
 if(!request.auth)throw new HttpsError("unauthenticated","Oturum açmanız gerekiyor.");
 const uid=request.auth.uid;
 const [profile,business]=await Promise.all([db.collection("users").doc(uid).get(),db.collection("businesses").doc(uid).get()]);
 if(!profile.exists||profile.data().role!=="tenant_admin"||profile.data().tenantId!==uid||!business.exists||business.data().ownerUid!==uid)
  throw new HttpsError("permission-denied","Firma yöneticisi doğrulanamadı.");
 return uid;
}
function firmCode(value) {
 const code=String(value||"").trim().toLowerCase();
 if(!/^[a-z0-9-]{3,20}$/.test(code))throw new HttpsError("invalid-argument","Firma kodu 3-20 harf, rakam veya tire içermeli.");
 return code;
}
exports.operatorLoginAddress=onCall({region:"europe-west1"},async ({data})=>{
 const code=firmCode(data?.code), name=tenantOperatorName(data?.username);
 const mapping=await db.collection("operatorFirmCodes").doc(code).get();
 if(!mapping.exists)throw new HttpsError("not-found","Firma kodu veya kullanıcı adı geçersiz.");
 const tenantId=mapping.data().tenantId, business=db.collection("businesses").doc(tenantId);
 const alias=await business.collection("operatorLoginNames").doc(name).get();
 const operatorId=alias.exists?alias.data().operatorId:name;
 const op=await business.collection("operators").doc(operatorId).get();
 if(!op.exists||op.data().authStatus!=="active"||(op.data().loginUsername||operatorId)!==name)
  throw new HttpsError("not-found","Firma kodu veya kullanıcı adı geçersiz.");
 return {email:tenantId+"."+operatorId+"@operators.puantor.invalid"};
});
exports.tenantOperatorAdmin=onCall({region:"europe-west1",enforceAppCheck:false},async request=>{
 const tenantId=await requireTenantManager(request),data=request.data||{},action=data.action;
 const business=db.collection("businesses").doc(tenantId);
 if(action==="setFirmCode"){
  const code=firmCode(data.code),ref=db.collection("operatorFirmCodes").doc(code);
  await db.runTransaction(async tx=>{
   const [owner,existing]=await Promise.all([tx.get(business),tx.get(ref)]);
   if(owner.data().operatorFirmCode&&owner.data().operatorFirmCode!==code)
    throw new HttpsError("failed-precondition","Firma kodu zaten belirlenmiş.");
   if(existing.exists&&existing.data().tenantId!==tenantId)
    throw new HttpsError("already-exists","Bu firma kodu kullanılıyor.");
   tx.set(ref,{tenantId});
   tx.update(business,{operatorFirmCode:code});
  });
  return {code};
 }
 const name=tenantOperatorName(data.username),ref=business.collection("operators").doc(name);
 const aliases=business.collection("operatorLoginNames");
 if(action==="renameLogin"){
  const next=tenantOperatorName(data.newUsername);
  await db.runTransaction(async tx=>{
   const [current,alias,original]=await Promise.all([tx.get(ref),tx.get(aliases.doc(next)),tx.get(business.collection("operators").doc(next))]);
   if(!current.exists||current.data().authStatus!=="active")throw new HttpsError("not-found","Aktif operatör bulunamadı.");
   if((alias.exists&&alias.data().operatorId!==name)||(original.exists&&next!==name))
    throw new HttpsError("already-exists","Bu kullanıcı adı kullanılıyor.");
   const previous=current.data().loginUsername||name;
   if(previous===next)return;
   if(previous!==name)tx.delete(aliases.doc(previous));
   if(next!==name)tx.set(aliases.doc(next),{operatorId:name});
   tx.update(ref,{loginUsername:next});
  });
  return {username:next};
 }
 if(action==="create"){
  const displayName=String(data.displayName||"").trim();
  if(!displayName||displayName.length>80)throw new HttpsError("invalid-argument","Operatör adı gerekli.");
  const existing=await ref.get();
  if(existing.exists)throw new HttpsError("already-exists","Bu firmada kullanıcı adı kayıtlı.");
  // A globally unique Auth email; users still sign in using the generated login email.
  const email=tenantId+"."+name+"@operators.puantor.invalid";
  let created;
  try{
   created=await auth.createUser({email,password:password(data.password),displayName,emailVerified:true});
   await db.runTransaction(async tx=>{
    const [current,alias]=await Promise.all([tx.get(ref),tx.get(aliases.doc(name))]);
    if(current.exists||alias.exists)throw new HttpsError("already-exists","Bu firmada kullanıcı adı kayıtlı.");
    tx.create(ref,{username:name,displayName,authUid:created.uid,authStatus:"active",machineIds:[],createdAt:admin.firestore.FieldValue.serverTimestamp()});
    tx.create(db.collection("users").doc(created.uid),{role:"tenant_operator",tenantId,username:name,displayName,email,machineIds:[],activeMachineId:"",createdAt:admin.firestore.FieldValue.serverTimestamp()});
   });
  }catch(err){if(created)await auth.deleteUser(created.uid).catch(()=>{});throw err;}
  return {username:name,loginEmail:email};
 }
 if(action==="delete"){
  const snap=await ref.get();
  if(!snap.exists||!snap.data().authUid)throw new HttpsError("not-found","Operatör bulunamadı.");
  const uid=snap.data().authUid;
  const [profile,machines,legacyAssignments]=await Promise.all([
   db.collection("users").doc(uid).get(),
   db.collection("businesses").doc(tenantId).collection("machines").where("operatorUid","==",uid).limit(1).get(),
   db.collection("businesses").doc(tenantId).collection("machines").where("operatorUsername","==",name).limit(1).get()
  ]);
  if(!profile.exists||profile.data().tenantId!==tenantId||profile.data().role!=="tenant_operator")
   throw new HttpsError("permission-denied","Operatör firma eşleşmesi geçersiz.");
  if(!machines.empty||!legacyAssignments.empty||profile.data().activeMachineId)
   throw new HttpsError("failed-precondition","Operatörün atanmış makinesi veya aktif işi var. Önce atamaları kaldırın.");
  await auth.updateUser(uid,{disabled:true});
  await auth.revokeRefreshTokens(uid);
  await db.runTransaction(async tx=>{
   const current=await tx.get(ref);
   if(!current.exists||current.data().authUid!==uid)return;
   const alias=current.data().loginUsername;
   if(alias&&alias!==name)tx.delete(aliases.doc(alias));
   tx.delete(ref);
   tx.delete(db.collection("users").doc(uid));
  });
  return {ok:true};
 }
 if(action==="password"){
  const snap=await ref.get();
  if(!snap.exists||snap.data().authStatus!=="active"||!snap.data().authUid)throw new HttpsError("not-found","Aktif operatör bulunamadı.");
  const uid=snap.data().authUid,profile=await db.collection("users").doc(uid).get();
  if(!profile.exists||profile.data().tenantId!==tenantId||profile.data().role!=="tenant_operator")
   throw new HttpsError("permission-denied","Operatör firma eşleşmesi geçersiz.");
  await auth.updateUser(uid,{password:password(data.password)});
  await auth.revokeRefreshTokens(uid);
  return {ok:true};
 }
 throw new HttpsError("invalid-argument","Geçersiz operatör işlemi.");
});
