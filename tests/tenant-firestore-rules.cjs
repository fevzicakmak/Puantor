const {initializeTestEnvironment,assertSucceeds,assertFails}=require("@firebase/rules-unit-testing");
const {doc,setDoc,getDoc,updateDoc,serverTimestamp,writeBatch,Timestamp}=require("firebase/firestore");
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
  await assertSucceeds(getDoc(doc(a,"users","firm-a-op")));
  await assertFails(getDoc(doc(a,"users","firm-b-op")));
  await assertSucceeds(getDoc(doc(op,"users","firm-a-op")));
  await assertFails(getDoc(doc(op,"users","firm-b-op")));
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
  await assertFails(updateDoc(doc(op,"users","firm-b-op"),{activeMachineId:"machine1"}));
  await assertFails(updateDoc(doc(op,"businesses","firm-a","machines","machine1"),{hourlyRate:1000}));
  await assertFails(updateDoc(doc(op,"businesses","firm-a","machines","machine1"),{jobReady:false}));
  await assertFails(updateDoc(doc(op,"businesses","firm-b","machines","machine1"),{status:"running"}));
  await assertSucceeds(setDoc(doc(a,"businesses","firm-a","searchPreferences","firm-a"),{preferences:{},updatedAt:serverTimestamp()}));
  await assertFails(getDoc(doc(b,"businesses","firm-a","searchPreferences","firm-a")));
  // A legitimate operator transition must update machine and own activeMachineId atomically.
  const machineRef=doc(op,"businesses","firm-a","machines","machine1");
  const userRef=doc(op,"users","firm-a-op");
  const startEvent={action:"start",at:Timestamp.now(),elapsedMs:0,operatorName:"Test",reason:""};
  await assertFails(updateDoc(machineRef,{status:"running",startedAt:serverTimestamp(),elapsedMs:0,faultReason:"",jobReady:true,updatedAt:serverTimestamp(),timeline:[startEvent]}));
  const start=writeBatch(op);
  start.update(machineRef,{status:"running",startedAt:serverTimestamp(),elapsedMs:0,faultReason:"",jobReady:true,updatedAt:serverTimestamp(),timeline:[startEvent]});
  start.update(userRef,{activeMachineId:"machine1"});
  await assertSucceeds(start.commit());
  const pauseEvent={action:"pause",at:Timestamp.now(),elapsedMs:1,operatorName:"Test",reason:""};
  const pause=writeBatch(op);
  pause.update(machineRef,{status:"paused",startedAt:null,elapsedMs:1,faultReason:"",jobReady:true,updatedAt:serverTimestamp(),timeline:[startEvent,pauseEvent]});
  pause.update(userRef,{activeMachineId:""});
  await assertSucceeds(pause.commit());
  const finish=writeBatch(op);
  finish.update(machineRef,{status:"done",startedAt:null,elapsedMs:2,faultReason:"",jobReady:false,updatedAt:serverTimestamp(),timeline:[startEvent,pauseEvent,{action:"finish",at:Timestamp.now(),elapsedMs:2,operatorName:"Test",reason:""}]});
  await assertSucceeds(finish.commit());
  await assertFails(updateDoc(userRef,{role:"tenant_admin"}));
  await assertFails(updateDoc(userRef,{machineIds:["machine1","machine2"]}));
  await assertFails(updateDoc(machineRef,{status:"running",startedAt:serverTimestamp(),jobReady:true,updatedAt:serverTimestamp()}));
  console.log("PASS: tenant isolation, assigned operator reads, denied privileged writes");
 }finally{await env.cleanup();}
})().catch(e=>{console.error(e);process.exitCode=1;});
