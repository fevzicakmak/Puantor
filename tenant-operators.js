// Tenant operator roster management (NOT Firebase Auth account provisioning).
// A trusted backend must create Auth users and set authUid before operators can sign in.
import {collection,doc,addDoc,updateDoc,setDoc,serverTimestamp} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";
import {initializeApp,deleteApp} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import {getAuth,createUserWithEmailAndPassword,signOut} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
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
  // Disabling a roster record does not revoke Firebase Auth access;
  // backend authorization and rules must enforce active=false.
  return updateDoc(doc(operatorsRef(db,session),id),{active:false});
}

/**
 * Uses an isolated secondary Auth app, so the manager remains signed in.
 * Provisioning is not atomic across Auth and Firestore; failures require retry/support.
 * Use unique operator email addresses; never store passwords in Firestore.
 */
export async function provisionTenantOperator(db,session,id,email,password){
 if(!id||!session?.uid||session.uid!==session.tenantId)throw Error("İşletme oturumu geçersiz");
 const normalized=String(email||"").trim().toLowerCase();
 if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(normalized))throw Error("Geçerli e-posta girin");
 if(String(password||"").length<8)throw Error("Şifre en az 8 karakter olmalı");
 const secondary=initializeApp(firebaseConfig,"operator-provision-"+Date.now());
 const secondaryAuth=getAuth(secondary);
 let user=null;
 try{
  const credential=await createUserWithEmailAndPassword(secondaryAuth,normalized,password);
  user=credential.user;
  await updateDoc(doc(operatorsRef(db,session),id),{authUid:user.uid,email:normalized,active:true,authStatus:"active"});
  // The secondary user may create its own profile, but only after manager authorization.
  // Auth and Firestore use separate sessions, so initialize a secondary Firestore instance.
  const {getFirestore}=await import("https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js");
  const operatorDb=getFirestore(secondary);
  await setDoc(doc(operatorDb,"users",user.uid),{role:"tenant_operator",tenantId:session.tenantId,operatorId:id,email:normalized,active:true,createdAt:serverTimestamp()});
  return user.uid;
 }finally{
  await signOut(secondaryAuth).catch(()=>{});
  await deleteApp(secondary).catch(()=>{});
 }
}
