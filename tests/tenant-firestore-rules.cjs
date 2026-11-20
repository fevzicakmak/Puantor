const {initializeTestEnvironment,assertSucceeds,assertFails}=require("@firebase/rules-unit-testing");
const {doc,setDoc,getDoc,updateDoc,deleteDoc,serverTimestamp,writeBatch,Timestamp}=require("firebase/firestore");
(async()=>{
 const env=await initializeTestEnvironment({projectId:"puantor-tenant-rules-test",firestore:{host:"127.0.0.1",port:8080}});
 try{
  await env.withSecurityRulesDisabled(async ctx=>{
   const db=ctx.firestore();
   for(const tenant of ["firm-a","firm-b"]){
    await setDoc(doc(db,"users",tenant),{role:"tenant_admin",tenantId:tenant});
    await setDoc(doc(db,"businesses",tenant),{ownerUid:tenant,name:tenant,managerName:"Test Yönetici",createdAt:serverTimestamp()});
    await setDoc(doc(db,"businesses",tenant,"machines","machine1"),{machineName:"Test",operatorUid:tenant+"-op",status:"idle",jobReady:true,elapsedMs:0,timeline:[]});
    await setDoc(doc(db,"users",tenant+"-op"),{role:"tenant_operator",tenantId:tenant,machineIds:["machine1"],activeMachineId:""});
   }
   await setDoc(doc(db,"users","firm-a-other-op"),{role:"tenant_operator",tenantId:"firm-a",machineIds:[],activeMachineId:""});
  });
  const a=env.authenticatedContext("firm-a").firestore();
  const b=env.authenticatedContext("firm-b").firestore();
  const op=env.authenticatedContext("firm-a-op").firestore();
  const outsider=env.unauthenticatedContext().firestore();
  const unassigned=env.authenticatedContext("firm-a-other-op").firestore();
  // Requests can only be accessed through the own-account callable, including
  // for company managers. No client can forge completion or inspect a colleague.
  await env.withSecurityRulesDisabled(async ctx=>{
   await setDoc(doc(ctx.firestore(),"accountDeletionRequests","firm-a-op"),{uid:"firm-a-op",status:"pending"});
  });
  for(const client of [a,b,op,outsider]){
   await assertFails(getDoc(doc(client,"accountDeletionRequests","firm-a-op")));
   await assertFails(setDoc(doc(client,"accountDeletionRequests","forged"),{uid:"firm-a-op",status:"completed"}));
   await assertFails(getDoc(doc(client,"accountDeletionReceipts","secret-hash")));
   await assertFails(setDoc(doc(client,"accountDeletionReceipts","secret-hash"),{status:"completed"}));
  }
  await assertSucceeds(getDoc(doc(a,"users","firm-a-op")));
  await assertFails(getDoc(doc(a,"users","firm-b-op")));
  await assertSucceeds(getDoc(doc(op,"users","firm-a-op")));
  await assertFails(getDoc(doc(op,"users","firm-b-op")));
  await assertFails(updateDoc(doc(a,"users","firm-b-op"),{displayName:"İzinsiz"}));
  await assertFails(updateDoc(doc(b,"users","firm-a-op"),{machineIds:[]}));
  await assertFails(updateDoc(doc(op,"users","firm-a"),{role:"tenant_operator"}));
  await assertFails(updateDoc(doc(a,"users","firm-a-op"),{tenantId:"firm-b",updatedAt:serverTimestamp()}));
  await assertFails(updateDoc(doc(a,"users","firm-a-op"),{role:"tenant_admin",updatedAt:serverTimestamp()}));
  await assertSucceeds(updateDoc(doc(a,"users","firm-a-op"),{displayName:"Operatör Test",updatedAt:serverTimestamp()}));
  await assertFails(setDoc(doc(outsider,"businesses","anonymous-firm"),{name:"Sahte Firma",managerName:"Anonim",ownerUid:"anonymous-firm",createdAt:serverTimestamp()}));
  await assertFails(deleteDoc(doc(a,"businesses","firm-a")));
  await assertFails(deleteDoc(doc(b,"businesses","firm-a")));
  await assertSucceeds(getDoc(doc(a,"businesses","firm-a")));
  await assertSucceeds(updateDoc(doc(a,"businesses","firm-a"),{name:"Firma A Güncel"}));
  await assertFails(updateDoc(doc(a,"businesses","firm-a"),{ownerUid:"firm-b"}));
  await assertFails(updateDoc(doc(a,"businesses","firm-a"),{createdAt:serverTimestamp()}));
  await assertSucceeds(getDoc(doc(a,"businesses","firm-a","machines","machine1")));
  await assertSucceeds(updateDoc(doc(a,"businesses","firm-a","machines","machine1"),{machineName:"Yetkili yönetici düzenlemesi"}));
  await assertFails(updateDoc(doc(b,"businesses","firm-a","machines","machine1"),{machineName:"İzinsiz düzenleme"}));
  await assertFails(getDoc(doc(a,"businesses","firm-b","machines","machine1")));
  await assertFails(getDoc(doc(b,"businesses","firm-a","machines","machine1")));
  await assertFails(getDoc(doc(outsider,"businesses","firm-a","machines","machine1")));
  await assertSucceeds(getDoc(doc(op,"businesses","firm-a","machines","machine1")));
  await assertFails(getDoc(doc(unassigned,"businesses","firm-a","machines","machine1")));
  await assertFails(getDoc(doc(op,"businesses","firm-b","machines","machine1")));
  await assertFails(getDoc(doc(op,"businesses","firm-a","customers","customer1")));
  await assertFails(setDoc(doc(op,"businesses","firm-a","customers","injected"),{name:"İzinsiz müşteri"}));
  await assertFails(setDoc(doc(op,"businesses","firm-a","machines","injected"),{machineName:"İzinsiz makine"}));
  await assertFails(deleteDoc(doc(op,"businesses","firm-a","machines","machine1")));
  await assertFails(setDoc(doc(b,"businesses","firm-a","payments","injected"),{amount:100}));
  await assertFails(setDoc(doc(b,"businesses","firm-a","jobs","injected"),{status:"done"}));
  await assertSucceeds(setDoc(doc(a,"businesses","firm-a","customers","customer1"),{name:"Yetkili müşteri"}));
  await assertFails(getDoc(doc(b,"businesses","firm-a","customers","customer1")));

  await assertFails(updateDoc(doc(op,"users","firm-b-op"),{activeMachineId:"machine1"}));
  await assertFails(updateDoc(doc(op,"businesses","firm-a","machines","machine1"),{hourlyRate:1000}));
  await assertFails(updateDoc(doc(op,"businesses","firm-a","machines","machine1"),{jobReady:false}));
  await assertFails(updateDoc(doc(op,"businesses","firm-b","machines","machine1"),{status:"running"}));
  await assertSucceeds(setDoc(doc(a,"businesses","firm-a","searchPreferences","firm-a"),{preferences:{},updatedAt:serverTimestamp()}));
  await assertFails(getDoc(doc(b,"businesses","firm-a","searchPreferences","firm-a")));
  // Runtime changes are now server-only; even an atomic valid-looking batch
  // cannot supply elapsed time, replace history, or claim activeMachineId.
  const machineRef=doc(op,"businesses","firm-a","machines","machine1");
  const userRef=doc(op,"users","firm-a-op");
  const start=writeBatch(op);
  start.update(machineRef,{status:"running",startedAt:serverTimestamp(),elapsedMs:3600000000,faultReason:"",jobReady:true,updatedAt:serverTimestamp(),timeline:[{action:"start"}]});
  start.update(userRef,{activeMachineId:"machine1"});
  await assertFails(start.commit());
  await assertFails(updateDoc(userRef,{activeMachineId:"machine1"}));
  await assertFails(updateDoc(userRef,{role:"tenant_admin"}));
  await assertFails(updateDoc(userRef,{machineIds:["machine1","machine2"]}));
  const roleless=env.authenticatedContext("new-account").firestore();
  await assertFails(setDoc(doc(roleless,"jobs","fake"),{operatorUid:"new-account",amount:1000}));
  await assertFails(setDoc(doc(op,"jobs","fake-op"),{operatorUid:"firm-a-op"}));
  const payment=doc(a,"businesses","firm-a","payments","receipt");
  const original=Timestamp.fromMillis(1000);
  await assertSucceeds(setDoc(payment,{customerName:"Müşteri",amount:100,date:"2026-11-14",note:"",createdAt:original}));
  await assertSucceeds(updateDoc(payment,{amount:50,note:"Düzeltme"}));
  await assertFails(updateDoc(payment,{amount:-1}));
  await assertFails(updateDoc(payment,{customerName:"Başka Müşteri"}));
  await assertFails(updateDoc(payment,{customerId:"another"}));
  await assertFails(updateDoc(payment,{createdAt:serverTimestamp()}));
  await assertFails(updateDoc(payment,{note:"x".repeat(151)}));
  await assertFails(setDoc(doc(a,"businesses","firm-a","payments","bad"),{amount:-999,customerName:123}));
  await assertFails(getDoc(doc(b,"businesses","firm-a","payments","receipt")));
  const identified=doc(a,"businesses","firm-a","payments","identified");
  await assertSucceeds(setDoc(identified,{customerId:"customer1",customerName:"Müşteri",amount:100,date:"2026-11-14",note:"",createdAt:original}));
  await assertSucceeds(updateDoc(identified,{amount:125}));
  await assertFails(updateDoc(identified,{customerId:"customer2"}));
  await assertFails(setDoc(doc(a,"businesses","firm-a","payments","invalid-id"),{customerId:12,customerName:"Müşteri",amount:100,date:"2026-11-14",note:"",createdAt:original}));
  await assertFails(getDoc(doc(a,"customers","wrong-root")));
  // All three rename paths remain in the current company.
  for(const type of ["customers","machines","operators"]){
   const ref=doc(a,"businesses","firm-a",type,"rename-test");
   await assertSucceeds(setDoc(ref,{name:"Eski"}));
   await assertSucceeds(updateDoc(ref,{name:"Yeni"}));
   await assertFails(updateDoc(doc(b,"businesses","firm-a",type,"rename-test"),{name:"İzinsiz"}));
  }
  // Simulate previously issued valid ID tokens: authentication alone must not
  // preserve access after a deletion lock or controlled business closure.
  await env.withSecurityRulesDisabled(async ctx=>{
   await setDoc(doc(ctx.firestore(),"jobs","former-op-job"),{operatorUid:"firm-a-op",amount:25});
  });
  for(const status of ["pending","processing","deleting","completed"]){
   await env.withSecurityRulesDisabled(async ctx=>{
    await setDoc(doc(ctx.firestore(),"accountDeletionRequests","firm-a-op"),{status});
   });
   const check=["pending","processing"].includes(status)?assertSucceeds:assertFails;
   await check(getDoc(doc(op,"businesses","firm-a","machines","machine1")));
   await check(getDoc(doc(op,"jobs","former-op-job")));
   await check(getDoc(doc(op,"users","firm-a-op")));
  }
  await env.withSecurityRulesDisabled(async ctx=>{
   await setDoc(doc(ctx.firestore(),"accountDeletionRequests","firm-a-op"),{status:"cancelled"});
   await updateDoc(doc(ctx.firestore(),"businesses","firm-a"),{accountStatus:"closed",recordCustodianUid:"support"});
  });
  await assertFails(getDoc(doc(a,"businesses","firm-a")));
  await assertFails(getDoc(doc(a,"businesses","firm-a","customers","customer1")));
  await assertFails(getDoc(doc(op,"businesses","firm-a","machines","machine1")));
  await assertFails(updateDoc(doc(a,"businesses","firm-a"),{accountStatus:"active"}));
  await assertSucceeds(getDoc(doc(b,"businesses","firm-b")));
  await env.withSecurityRulesDisabled(async ctx=>{
   await deleteDoc(doc(ctx.firestore(),"users","firm-a"));
   await setDoc(doc(ctx.firestore(),"accountDeletionRequests","firm-a"),{status:"completed"});
  });
  const formerOwner=env.authenticatedContext("firm-a",{email:"former-owner@example.com"}).firestore();
  await assertFails(setDoc(doc(formerOwner,"users","firm-a"),{role:"tenant_admin",tenantId:"firm-a",businessName:"Tekrar",managerName:"Eski yönetici",email:"former-owner@example.com",createdAt:serverTimestamp()}));
  console.log("PASS: tenant isolation, assigned operator reads, denied privileged writes, private receipts, deletion-token locks and closed-business access");
 }finally{await env.cleanup();}
})().catch(e=>{console.error(e);process.exitCode=1;});
