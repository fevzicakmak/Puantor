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
