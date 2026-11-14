function createAssignWorkHandler({db,Timestamp,HttpsError,adminUid}){
 const fail=(code,message)=>{throw new HttpsError(code,message)};
 const id=v=>typeof v==="string"&&v.length>0&&v.length<=128&&!v.includes("/")&&!/^\.{1,2}$/.test(v);
 return async request=>{
  if(!request.auth)fail("unauthenticated","Oturum açmanız gerekiyor.");
  const {machineId,operatorId,customerId,travelFee}=request.data||{};
  if(!id(machineId)||!id(operatorId)||!id(customerId)||!Number.isFinite(travelFee)||travelFee<0||travelFee>100000000)fail("invalid-argument","Makine, operatör, müşteri ve yol ücretini kontrol edin.");
  const managerUid=request.auth.uid;
  return db.runTransaction(async tx=>{
   const profile=await tx.get(db.collection("users").doc(managerUid));
   const manager=profile.exists?profile.data():{};
   const tenant=manager.role==="tenant_admin"&&manager.tenantId===managerUid;
   if(!tenant&&!(managerUid===adminUid&&manager.role==="admin"))fail("permission-denied","Yönetici yetkisi gerekli.");
   const parent=tenant?db.collection("businesses").doc(managerUid):db;
   if(tenant){const business=await tx.get(parent);if(!business.exists||business.data().ownerUid!==managerUid)fail("permission-denied","Firma yöneticisi doğrulanamadı.");}
   const machines=parent.collection("machines"),operatorRef=parent.collection("operators").doc(operatorId),machineRef=machines.doc(machineId);
   const [ms,os,cs]=await Promise.all([tx.get(machineRef),tx.get(operatorRef),tx.get(parent.collection("customers").doc(customerId))]);
   if(!ms.exists||!os.exists||!cs.exists)fail("not-found","Makine, operatör veya müşteri bulunamadı.");
   const machine=ms.data(),operator=os.data(),customer=cs.data();
   if(!id(operator.authUid)||operator.authStatus!=="active")fail("failed-precondition","Aktif operatör hesabı gerekli.");
   const userRef=db.collection("users").doc(operator.authUid),us=await tx.get(userRef);
   const validUser=u=>u&&u.role===(tenant?"tenant_operator":"operator")&&(!tenant||u.tenantId===managerUid);
   if(!us.exists||!validUser(us.data()))fail("permission-denied","Operatör firma eşleşmesi geçersiz.");
   const user=us.data();
   const assignments=await tx.get(machines.where("operatorUid","==",operator.authUid));
   if(assignments.docs.some(s=>s.id!==machineId&&(s.data().jobReady===true||["running","paused","broken","done"].includes(s.data().status))))fail("failed-precondition","Operatörün arşivlenmemiş başka bir işi var. Önce yönetici onayıyla arşivleyin.");
   if(machine.status!=="idle"||machine.jobReady===true)fail("failed-precondition","Önce makinenin mevcut işini tamamlayıp arşivleyin.");
   if(!Number.isFinite(machine.defaultHourlyRate)||machine.defaultHourlyRate<0||machine.defaultHourlyRate>100000000)fail("failed-precondition","Makinenin saatlik ücretini kontrol edin.");
   if(customer.archived===true)fail("failed-precondition","Pasif müşteriye yeni görev atanamaz.");
   if(typeof customer.name!=="string"||!customer.name.trim())fail("failed-precondition","Müşteri adı gerekli.");
   let previousUser,previousOperator;
   if(id(machine.operatorUid)&&machine.operatorUid!==operator.authUid){
    previousUser=await tx.get(db.collection("users").doc(machine.operatorUid));
    if(id(machine.operatorUsername))previousOperator=await tx.get(parent.collection("operators").doc(machine.operatorUsername));
   }
   const now=Timestamp.now();
   if(previousUser?.exists&&validUser(previousUser.data())){
    const old=previousUser.data(),patch={machineIds:(Array.isArray(old.machineIds)?old.machineIds:[]).filter(x=>x!==machineId),updatedAt:now};
    if(old.activeMachineId===machineId)patch.activeMachineId="";
    tx.update(previousUser.ref,patch);
    if(previousOperator?.exists&&previousOperator.data().authUid===machine.operatorUid)tx.update(previousOperator.ref,{machineIds:(Array.isArray(previousOperator.data().machineIds)?previousOperator.data().machineIds:[]).filter(x=>x!==machineId),updatedAt:now});
   }
   const machineIds=[...new Set([...assignments.docs.map(s=>s.id),machineId])];
   if(machineIds.length>100)fail("failed-precondition","Operatör makine atama sınırını aşıyor.");
   tx.update(machineRef,{operatorUid:operator.authUid,operatorUsername:operator.username||operatorId,operatorName:operator.displayName||"",customerId,customerName:customer.name,hourlyRate:machine.defaultHourlyRate,travelFee,jobReady:true,status:"idle",elapsedMs:0,startedAt:null,faultReason:"",timeline:[],updatedAt:now});
   tx.update(userRef,{machineIds,activeMachineId:"",updatedAt:now});
   tx.update(operatorRef,{machineIds,updatedAt:now});
   return {ok:true};
  });
 };
}
module.exports={createAssignWorkHandler};
