// Tenant task assignment API. Server rules must enforce tenant ownership and state transitions.
// This file does not provision Firebase Auth users.
import {collection,doc,getDoc,addDoc,updateDoc,runTransaction,serverTimestamp} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";
function path(session,type,id){
  if(!session?.uid||session.uid!==session.tenantId)throw Error("İşletme oturumu geçersiz");
  if(!["machines","customers","operators","jobs"].includes(type))throw Error("Kayıt türü geçersiz");
  if(!id)throw Error("Kayıt kimliği gerekli");
  return ["businesses",session.tenantId,type,id];
}
function ref(db,session,type,id){return doc(db,...path(session,type,id));}
export async function assignTenantJob(db,session,{machineId,customerId,operatorId,description=""}){
  const note=String(description).trim();
  if(note.length>500)throw Error("İş açıklaması çok uzun");
  const jobRef=doc(collection(db,"businesses",session.tenantId,"jobs"));
  await runTransaction(db,async tx=>{
    const machineRef=ref(db,session,"machines",machineId);
    const customerRef=ref(db,session,"customers",customerId);
    const operatorRef=ref(db,session,"operators",operatorId);
    const [machine,customer,operator]=await Promise.all([tx.get(machineRef),tx.get(customerRef),tx.get(operatorRef)]);
    if(!machine.exists()||!customer.exists()||!operator.exists())throw Error("Makine, müşteri veya operatör bulunamadı");
    if(operator.data().active===false)throw Error("Operatör pasif");
    if(!operator.data().authUid)throw Error("Operatörün giriş hesabı henüz etkin değil");
    if(machine.data().jobReady===true || machine.data().status==="running")throw Error("Makinede tamamlanmamış görev var");
    tx.set(jobRef,{machineId,customerId,operatorId,operatorUid:operator.data().authUid,description:note,status:"assigned",createdAt:serverTimestamp()});
    tx.update(machineRef,{operatorUid:operator.data().authUid,operatorId,customerId,currentJobId:jobRef.id,jobReady:true,status:"idle",elapsedMs:0,startedAt:null,faultReason:"",updatedAt:serverTimestamp()});
  });
  return jobRef.id;
}
export async function finishTenantJob(db,session,jobId){
  await runTransaction(db,async tx=>{
    const jobRef=ref(db,session,"jobs",jobId);
    const job=await tx.get(jobRef);
    if(!job.exists())throw Error("Görev bulunamadı");
    const machineRef=ref(db,session,"machines",job.data().machineId);
    const machine=await tx.get(machineRef);
    if(!machine.exists()||machine.data().currentJobId!==jobId)throw Error("Görev/makine eşleşmiyor");
    if(machine.data().status==="running")throw Error("Çalışan makine önce operatör tarafından durdurulmalı");
    if(job.data().status==="done")throw Error("Görev zaten tamamlandı");
    tx.update(jobRef,{status:"done",finishedAt:serverTimestamp()});
    tx.update(machineRef,{jobReady:false,status:"done",startedAt:null,updatedAt:serverTimestamp()});
  });
}
