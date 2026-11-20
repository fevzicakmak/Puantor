const assert=require("node:assert/strict");
const {initializeApp,deleteApp}=require("firebase-admin/app");
const {getFirestore,Timestamp}=require("firebase-admin/firestore");
const {createWorkStateHandler}=require("../functions/work-state");
const {createAssignWorkHandler}=require("../functions/assign-work");

// Real Firestore transactions, but a deterministic server clock. Never uses a
// production project or the client's clock/elapsedMs/timeline.
process.env.FIRESTORE_EMULATOR_HOST||="127.0.0.1:8080";
assert.match(process.env.FIRESTORE_EMULATOR_HOST,/^(127\.0\.0\.1|localhost):\d+$/);
const app=initializeApp({projectId:"puantor-tenant-rules-test"},"work-state-tests");
const db=getFirestore(app);
class WorkError extends Error{constructor(code,message){super(message);this.code=code}}
let clock=1800000000000,sequence=0;
const handle=createWorkStateHandler({db,Timestamp:{now:()=>Timestamp.fromMillis(clock)},HttpsError:WorkError});
const assign=createAssignWorkHandler({db,Timestamp:{now:()=>Timestamp.fromMillis(clock)},HttpsError:WorkError,adminUid:"test-admin"});
const reject=(fn,code)=>assert.rejects(fn,e=>e.code===code);
async function seed(scope="tenant",suffix=""){
 const uid="state-op"+suffix,tenantId="state-firm"+suffix;
 if(scope==="tenant")await db.collection("businesses").doc(tenantId).set({ownerUid:tenantId});
 const machines=scope==="tenant"?db.collection("businesses").doc(tenantId).collection("machines"):db.collection("machines");
 const user=db.collection("users").doc(uid),machine=machines.doc("state-machine"+suffix);
 await user.set({role:scope==="tenant"?"tenant_operator":"operator",...(scope==="tenant"?{tenantId}:{}),machineIds:[machine.id,"old-machine"],activeMachineId:""});
 await machine.set({operatorUid:uid,operatorName:"Test Operatörü",status:"idle",jobReady:true,elapsedMs:0,timeline:[],updatedAt:Timestamp.fromMillis(clock)});
 return {uid,user,machine,machines};
}
async function request(f,action,extra={}){
 const machine=(await f.machine.get()).data();
 return {auth:{uid:f.uid},data:{action,machineId:f.machine.id,requestId:"request-"+(++sequence),reason:action==="fault"?"Hidrolik arıza":"",expectedStatus:machine.status,expectedUpdatedAt:{seconds:machine.updatedAt.seconds,nanoseconds:machine.updatedAt.nanoseconds},...extra}};
}
(async()=>{try{
 for(const scope of ["tenant","legacy"]){
  const f=await seed(scope,"-"+scope);
  // A stale historical assignment now belongs to someone else. It must not
  // prevent this operator from starting their own assigned machine.
  await f.machines.doc("old-machine").set({operatorUid:"someone-else",status:"running",jobReady:true});
  await f.user.update({activeMachineId:"old-machine"});
  await reject(()=>handle({data:{}}),"unauthenticated");
  const first=await request(f,"start",{elapsedMs:999999999,timeline:[{action:"finish"}]});
  const started=await handle(first);
  assert.equal(started.elapsedMs,0);
  assert.equal((await f.user.get()).data().activeMachineId,f.machine.id);
  clock+=60000;
  const pause=await request(f,"pause");
  const paused=await handle(pause);
  assert.equal(paused.elapsedMs,60000);
  assert.equal((await f.user.get()).data().activeMachineId,"");
  clock+=10000;
  assert.deepEqual(await handle(pause),paused,"lost-response retry must return the original result");
  assert.equal((await f.machine.get()).data().timeline.length,2);
  await reject(()=>handle({...pause,data:{...pause.data,action:"start"}}),"invalid-argument");
  assert.deepEqual(await handle(first),started);
  const resume=await request(f,"start");
  await handle(resume);clock+=30000;
  const fault=await request(f,"fault");
  await handle(fault);
  assert.equal((await f.machine.get()).data().elapsedMs,90000);
  assert.equal((await f.machine.get()).data().faultReason,"Hidrolik arıza");
  await handle(await request(f,"start"));clock+=15000;
  await handle(await request(f,"finish"));
  const finished=(await f.machine.get()).data();
  assert.equal(finished.elapsedMs,105000);
  assert.equal(finished.jobReady,false);
  assert.equal(finished.status,"done");
  assert.deepEqual(finished.timeline.map(x=>x.action),["start","pause","start","fault","start","finish"]);
  await reject(async()=>handle(await request(f,"start")),"failed-precondition");
  // A manager archives the completed job and authorizes a new task as before.
  await f.machine.update({status:"idle",jobReady:true,elapsedMs:0,timeline:[],updatedAt:Timestamp.fromMillis(++clock)});
  await handle(await request(f,"start"));
  // Device clock / elapsed/history payloads have no influence on persisted time.
  clock+=2000;
  await handle(await request(f,"pause",{elapsedMs:1,timeline:[],serverNowMs:0}));
  assert.equal((await f.machine.get()).data().elapsedMs,2000);
  console.log("PASS: "+scope+" start/pause/resume/fault/finish, retry, new job and stale assignment");
 }
 const f=await seed("tenant","-limits");
 const previous=Array.from({length:250},(_,i)=>({action:i%2?"pause":"start",at:Timestamp.fromMillis(clock-500+i),elapsedMs:i}));
 await f.machine.update({status:"running",startedAt:new Timestamp(Math.floor((clock-5000)/1000),123456),timeline:previous});
 await f.user.update({activeMachineId:f.machine.id});
 await handle(await request(f,"finish"));
 const ended=(await f.machine.get()).data();
 assert.equal(ended.timeline.length,251);
 assert.deepEqual(ended.timeline.slice(0,250),previous);
 assert.equal(ended.status,"done");
 assert.ok(Number.isSafeInteger(ended.elapsedMs));
 console.log("PASS: a 250-event job can finish without losing its previous history");
 const g=await seed("tenant","-permissions");
 const valid=await request(g,"start");
 await reject(()=>handle({...valid,auth:{uid:"another-operator"}}),"permission-denied");
 const other=await seed("tenant","-other-firm");
 await other.machine.set((await g.machine.get()).data());
 await other.user.update({machineIds:[g.machine.id]});
 await reject(()=>handle({...valid,auth:{uid:other.uid}}),"not-found");
 await reject(()=>handle({...valid,data:{...valid.data,machineId:"../escape"}}),"invalid-argument");
 await reject(()=>handle({...valid,data:{...valid.data,action:"constructor"}}),"invalid-argument");
 await reject(()=>handle({...valid,data:{...valid.data,expectedUpdatedAt:null}}),"invalid-argument");
 await reject(()=>handle({...valid,data:{...valid.data,action:"fault",reason:" "}}),"invalid-argument");
 await g.user.update({activeMachineId:"different-machine"});
 await g.machines.doc("different-machine").set({operatorUid:g.uid,status:"running",jobReady:true});
 await reject(()=>handle(valid),"failed-precondition");
 await g.machines.doc("different-machine").delete();
 await g.user.update({activeMachineId:""});
 await g.machines.doc("other-owned").set({operatorUid:g.uid,status:"paused",jobReady:true});
 await reject(()=>handle(valid),"failed-precondition");
 await g.machines.doc("other-owned").delete();
 await g.machine.update({updatedAt:Timestamp.fromMillis(++clock)});
 await reject(()=>handle(valid),"failed-precondition");
 const stale=await request(g,"pause");
 const start=await request(g,"start");
 await handle(start);
 await reject(()=>handle(stale),"failed-precondition");
 console.log("PASS: cross-firm, assignment, stale requests, active work and input validation");
 // Two starts racing on the same snapshot commit exactly once.
 const race=await seed("tenant","-race");
 const outcomes=await Promise.allSettled([handle(await request(race,"start")),handle(await request(race,"start"))]);
 assert.equal(outcomes.filter(x=>x.status==="fulfilled").length,1);
 assert.equal((await race.machine.get()).data().timeline.length,1);
 console.log("PASS: concurrent starts cannot duplicate a transition");
 for(const scope of ["tenant","legacy"]){
  const suffix="-assignment-"+scope;
  const f=await seed(scope,suffix);
  const managerUid=scope==="tenant"?"state-firm"+suffix:"test-admin";
  await db.collection("users").doc(managerUid).set(scope==="tenant"?{role:"tenant_admin",tenantId:managerUid}:{role:"admin"});
  const parent=scope==="tenant"?db.collection("businesses").doc(managerUid):db;
  if(scope==="tenant")await parent.set({ownerUid:managerUid});
  const oldUid="previous"+suffix,oldRef=db.collection("users").doc(oldUid);
  await oldRef.set({role:scope==="tenant"?"tenant_operator":"operator",...(scope==="tenant"?{tenantId:managerUid}:{}),machineIds:[f.machine.id],activeMachineId:""});
  await parent.collection("operators").doc("old").set({authUid:oldUid,machineIds:[f.machine.id]});
  await parent.collection("operators").doc("new").set({authUid:f.uid,authStatus:"active",username:"new",displayName:"Yeni",machineIds:["outdated-assignment"]});
  await parent.collection("customers").doc("customer").set({name:"Müşteri"});
  await f.machine.update({operatorUid:oldUid,operatorUsername:"old",defaultHourlyRate:1500,jobReady:false});
  const req={auth:{uid:managerUid},data:{machineId:f.machine.id,operatorId:"new",customerId:"customer",travelFee:250}};
  await reject(()=>assign({...req,auth:{uid:f.uid}}),"permission-denied");
  await reject(()=>assign({...req,data:{...req.data,travelFee:-1}}),"invalid-argument");
  await assign(req);
  assert.deepEqual((await oldRef.get()).data().machineIds,[]);
  assert.deepEqual((await parent.collection("operators").doc("old").get()).data().machineIds,[]);
  assert.deepEqual((await f.user.get()).data().machineIds,[f.machine.id]);
  const assigned=(await f.machine.get()).data();
  assert.equal(assigned.customerName,"Müşteri");assert.equal(assigned.hourlyRate,1500);assert.equal(assigned.travelFee,250);
  assert.equal(assigned.customerId,"customer");
  await reject(()=>assign(req),"failed-precondition");
  await handle(await request(f,"start"));
  clock+=3600000;
  await handle(await request(f,"finish"));
  const completed=(await f.machine.get()).data();
  assert.equal(completed.elapsedMs,3600000);
  assert.equal(completed.elapsedMs/3600000*completed.hourlyRate+completed.travelFee,1750);
  // Emulate the unchanged manager archive transaction.
  const job=parent.collection("jobs").doc("archived"+suffix);
  await db.runTransaction(async tx=>{
   const snap=await tx.get(f.machine);assert.equal(snap.data().status,"done");
   tx.set(job,{...snap.data(),machineId:f.machine.id,status:"done"});
   tx.update(f.machine,{status:"idle",jobReady:false,elapsedMs:0,timeline:[],updatedAt:Timestamp.fromMillis(++clock)});
  });
  assert.equal((await job.get()).data().timeline.length,2);
  await assign(req);
  await handle(await request(f,"start"));
  await parent.collection("customers").doc("archived").set({name:"Pasif",archived:true});
  await reject(()=>assign({...req,data:{...req.data,customerId:"archived"}}),"failed-precondition");
  console.log("PASS: "+scope+" assignment/reassignment cleanup → work → finish → archive → new task, unchanged billing");
 }
}finally{await deleteApp(app)}})().catch(error=>{console.error(error);process.exitCode=1});
