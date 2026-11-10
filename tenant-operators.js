// Tenant operator roster management (NOT Firebase Auth account provisioning).
// A trusted backend must create Auth users and set authUid before operators can sign in.
import {collection,doc,addDoc,updateDoc,serverTimestamp} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";
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
