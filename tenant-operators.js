// Tenant operator roster and isolated-session Firebase Auth provisioning.
import {collection,doc,addDoc,updateDoc,setDoc,getDoc,serverTimestamp} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";
import {initializeApp,deleteApp} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import {getAuth,createUserWithEmailAndPassword,signInWithEmailAndPassword,deleteUser,signOut} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import {firebaseConfig} from "./firebase-config.js";
function operatorsRef(db,session){
  if(!session?.uid||session.uid!==session.tenantId)throw Error("İşletme oturumu geçersiz");
  return collection(db,"businesses",session.tenantId,"operators");
}
export async function addPendingOperator(db,session,name){
  const clean=String(name||"").trim();
  if(clean.length<2||clean.length>80)throw Error("Operatör adı 2-80 karakter olmalı");
  return addDoc(operatorsRef(db,session),{
    name:clean,active:false,authStatus:"pending",createdAt:serverTimestamp()
  });
}
export async function renameTenantOperator(db,session,id,name){
  const clean=String(name||"").trim();
  if(!id||clean.length<2||clean.length>80)throw Error("Geçersiz operatör adı");
  return updateDoc(doc(operatorsRef(db,session),id),{name:clean});
}
export async function disableTenantOperator(db,session,id){
  if(!id)throw Error("Operatör kimliği gerekli");
  // Firestore authorization checks the active roster flag on each protected request.
  return updateDoc(doc(operatorsRef(db,session),id),{active:false});
}

export async function enableTenantOperator(db,session,id){
 if(!id)throw Error("Operatör kimliği gerekli");
 const ref=doc(operatorsRef(db,session),id);
 const snap=await getDoc(ref);
 if(!snap.exists())throw Error("Operatör bulunamadı");
 if(!snap.data().authUid||snap.data().authStatus!=="active")throw Error("Önce operatör giriş hesabını etkinleştirin");
 return updateDoc(ref,{active:true});
}
/**
 * Uses an isolated secondary Auth app, so the manager remains signed in.
 * Provisioning is not atomic across Auth and Firestore; failures require retry/support.
 * Use unique operator email addresses; never store passwords in Firestore.
 */
export async function provisionTenantOperator(db,session,id,email,password){
 if(!id||!session?.uid||session.uid!==session.tenantId)throw Error("İşletme oturumu geçersiz");
 const normalized=String(email||"").trim().toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized))throw Error("Geçerli e-posta girin");
 if(String(password||"").length<8)throw Error("Şifre en az 8 karakter olmalı");
 const secondary=initializeApp(firebaseConfig,"operator-provision-"+Date.now()+"-"+Math.random().toString(36).slice(2));
 const secondaryAuth=getAuth(secondary);
 let user=null,created=false,rosterLinked=false;
 try{
  const rosterRef=doc(operatorsRef(db,session),id);
  const roster=await getDoc(rosterRef);
  if(!roster.exists()||roster.data().active===true&&roster.data().authStatus==="active")throw Error("Operatör zaten etkin veya kayıt bulunamadı");
  if(roster.data().authUid){
    if(roster.data().email!==normalized)throw Error("Kurtarma için önceki e-posta adresini kullanın");
    const existing=await signInWithEmailAndPassword(secondaryAuth,normalized,password);
    if(existing.user.uid!==roster.data().authUid)throw Error("Operatör kimliği uyuşmuyor");
    user=existing.user;
  }else{
    const credential=await createUserWithEmailAndPassword(secondaryAuth,normalized,password);
    user=credential.user;
    created=true;
  }
  await updateDoc(rosterRef,{authUid:user.uid,email:normalized,active:true,authStatus:"active"});
  rosterLinked=true;
  // The secondary user may create its own profile, but only after manager authorization.
  // Auth and Firestore use separate sessions, so initialize a secondary Firestore instance.
  const {getFirestore}=await import("https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js");
  const operatorDb=getFirestore(secondary);
  const profileRef=doc(operatorDb,"users",user.uid);
  const profile=await getDoc(profileRef);
  if(profile.exists()){
    if(profile.data().tenantId!==session.tenantId||profile.data().operatorId!==id)throw Error("Operatör profili başka bir kayda bağlı");
  }else{
    await setDoc(profileRef,{role:"tenant_operator",tenantId:session.tenantId,operatorId:id,email:normalized,active:true,createdAt:serverTimestamp()});
  }
  return user.uid;
 }catch(err){
  // If Firestore linking failed after a new Auth signup, remove the orphaned Auth user.
  // Once the roster is linked, retain the account for safe retry of profile creation.
  if(created&&!rosterLinked&&user){
   try{await deleteUser(user);}catch(cleanupErr){throw Error("Hesap kaydı tamamlanamadı ve kimlik hesabı temizlenemedi. Destek gerekli: "+(cleanupErr.code||cleanupErr.message));}
  }
  throw err;
 }finally{
  await signOut(secondaryAuth).catch(()=>{});
  await deleteApp(secondary).catch(()=>{});
 }
}
