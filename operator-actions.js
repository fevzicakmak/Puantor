import {getFunctions,httpsCallable} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-functions.js";

// Keep the same operation ID after a lost response. A retry cannot apply the
// same start/pause/finish twice, including after a page refresh.
export function createOperatorActions(app,auth){
 const call=httpsCallable(getFunctions(app,"europe-west1"),"operatorWorkState");
 return async(machineId,machine,action,reason)=>{
  const uid=auth.currentUser?.uid;
  if(!uid||!machine.updatedAt)throw Error("Güncel makine bilgisi bekleniyor.");
  const key="puantor-work-request:"+uid;
  let pending;
  try{pending=JSON.parse(sessionStorage.getItem(key)||"null")}catch{}
  if(!pending||pending.machineId!==machineId||pending.action!==action||pending.reason!==reason){
   pending={machineId,action,reason,requestId:crypto.randomUUID(),expectedStatus:machine.status,expectedUpdatedAt:{seconds:machine.updatedAt.seconds,nanoseconds:machine.updatedAt.nanoseconds}};
  }
  try{sessionStorage.setItem(key,JSON.stringify(pending))}catch{}
  try{
   const {data}=await call(pending);
   try{sessionStorage.removeItem(key)}catch{}
   return data;
  }catch(error){
   if(!["functions/unavailable","functions/deadline-exceeded","functions/internal","functions/unknown"].includes(error.code)){
    try{sessionStorage.removeItem(key)}catch{}
   }
   throw error;
  }
 };
}
