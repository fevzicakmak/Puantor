const {initializeTestEnvironment,assertSucceeds,assertFails}=require("@firebase/rules-unit-testing");
const {doc,setDoc,getDoc,updateDoc,serverTimestamp}=require("firebase/firestore");
(async()=>{
 const env=await initializeTestEnvironment({projectId:"puantor-tenant-rules-test",firestore:{host:"127.0.0.1",port:8080}});
 try{
  await env.withSecurityRulesDisabled(async ctx=>{
   const db=ctx.firestore();
   for(const tenant of ["firm-a","firm-b"]){
    await setDoc(doc(db,"users",tenant),{role:"tenant_admin",tenantId:tenant});
    await setDoc(doc(db,"businesses",tenant),{ownerUid:tenant,name:tenant});
    await setDoc(doc(db,"businesses",tenant,"machines","machine1"),{machineName:"Test",operatorUid:tenant+"-op",status:"idle",jobReady:true,elapsedMs:0,timeline:[]});
    await setDoc(doc(db,"users",tenant+"-op"),{role:"tenant_operator",tenantId:tenant,machineIds:["machine1"],activeMachineId:""});
   }
  });
  const a=env.authenticatedContext("firm-a").firestore();
  const b=env.authenticatedContext("firm-b").firestore();
  const op=env.authenticatedContext("firm-a-op").firestore();
  const outsider=env.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(a,"businesses","firm-a","machines","machine1")));
  await assertSucceeds(updateDoc(doc(a,"businesses","firm-a","machines","machine1"),{machineName:"Yetkili yönetici düzenlemesi"}));
  await assertFails(updateDoc(doc(b,"businesses","firm-a","machines","machine1"),{machineName:"İzinsiz düzenleme"}));
  await assertFails(getDoc(doc(a,"businesses","firm-b","machines","machine1")));
  await assertFails(getDoc(doc(b,"businesses","firm-a","machines","machine1")));
  await assertFails(getDoc(doc(outsider,"businesses","firm-a","machines","machine1")));
  await assertSucceeds(getDoc(doc(op,"businesses","firm-a","machines","machine1")));
  await assertFails(getDoc(doc(op,"businesses","firm-b","machines","machine1")));
  await assertFails(getDoc(doc(op,"businesses","firm-a","customers","customer1")));
  await assertFails(updateDoc(doc(op,"users","firm-b-op"),{activeMachineId:"machine1"}));
  await assertFails(updateDoc(doc(op,"businesses","firm-a","machines","machine1"),{hourlyRate:1000}));
  await assertFails(updateDoc(doc(op,"businesses","firm-a","machines","machine1"),{jobReady:false}));
  await assertFails(updateDoc(doc(op,"businesses","firm-b","machines","machine1"),{status:"running"}));
  await assertSucceeds(setDoc(doc(a,"businesses","firm-a","searchPreferences","firm-a"),{preferences:{},updatedAt:serverTimestamp()}));
  await assertFails(getDoc(doc(b,"businesses","firm-a","searchPreferences","firm-a")));
  console.log("PASS: tenant isolation, assigned operator reads, denied privileged writes");
 }finally{await env.cleanup();}
})().catch(e=>{console.error(e);process.exitCode=1;});
