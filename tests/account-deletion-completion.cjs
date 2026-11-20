const assert=require("node:assert/strict");
const {initializeApp,deleteApp}=require("firebase-admin/app");
const {getFirestore,Timestamp}=require("firebase-admin/firestore");
const {randomBytes}=require("node:crypto");
const {createAccountDeletionCompletion}=require("../functions/account-deletion-completion");
const {createAccountDeletionHandler}=require("../functions/account-deletion");
const {createBusinessRegistrationHandler}=require("../functions/business-registration");
const {createWorkStateHandler}=require("../functions/work-state");
process.env.FIRESTORE_EMULATOR_HOST||="127.0.0.1:8080";
assert.match(process.env.FIRESTORE_EMULATOR_HOST,/^(127\.0\.0\.1|localhost):\d+$/);
const app=initializeApp({projectId:"puantor-tenant-rules-test"},"deletion-completion"),db=getFirestore(app);
class TestError extends Error{constructor(code,message){super(message);this.code=code}}
const adminUid="finish-support",accounts=new Map(),deleted=[],disabled=[];
let clock=Date.UTC(2026,10,20,12),failDelete="",failDisable="",deleteGate=null;
const auth={
 async deleteUser(uid){
  if(deleteGate?.uid===uid){deleteGate.started();await deleteGate.wait}
  if(failDelete===uid){failDelete="";throw Object.assign(Error("injected Auth outage"),{code:"auth/internal-error"})}
  if(!accounts.has(uid))throw Object.assign(Error("missing"),{code:"auth/user-not-found"});
  accounts.delete(uid);deleted.push(uid);
 },
 async updateUser(uid,patch){if(failDisable===uid){failDisable="";throw Object.assign(Error("injected member outage"),{code:"auth/internal-error"})}if(!accounts.has(uid))throw Object.assign(Error("missing"),{code:"auth/user-not-found"});accounts.set(uid,{...accounts.get(uid),...patch});disabled.push(uid)}
};
const complete=createAccountDeletionCompletion({db,auth,Timestamp,HttpsError:TestError,adminUid,enabled:()=>true,now:()=>clock});
const api=createAccountDeletionHandler({db,Timestamp,HttpsError:TestError,adminUid,completeDeletion:complete,now:()=>clock});
const req=(uid,action,data={})=>({auth:{uid,token:{auth_time:clock/1000,email:uid+"@example.com"}},data:{action,...data}});
const finish=uid=>api(req(adminUid,"reviewComplete",{uid,confirmation:"HESABI SİL:"+uid,recordsReviewed:true,retentionNote:"Örnek ticari kayıtlar inceleme kapsamında korundu; saklama süresi testte 30 gün."}));
const denied=(fn,code)=>assert.rejects(fn,error=>error.code===code);
async function request(uid){
 const token=randomBytes(32).toString("base64url");
 await api(req(uid,"request",{confirmation:"HESABIMI SİL",ownerClosureConsent:true,receiptToken:token}));
 await api(req(adminUid,"reviewStart",{uid,expectedCompletionAt:clock+7*86400000}));
 return token;
}
async function seedOperator(uid,legacy=false){
 const tenantId="company-"+uid,parent=legacy?db:db.collection("businesses").doc(tenantId);
 if(!legacy)await parent.set({ownerUid:tenantId,name:"Korunan işletme"});
 await db.collection("users").doc(uid).set({role:legacy?"operator":"tenant_operator",...(legacy?{}:{tenantId}),username:uid,machineIds:[uid],activeMachineId:""});
 await db.collection("users").doc(uid).collection("workRequests").doc("old").set({createdAt:Timestamp.fromMillis(clock)});
 await db.collection("searchPreferences").doc(uid).set({preferences:{personal:1}});
 await parent.collection("operators").doc(uid).set({authUid:uid,username:uid,displayName:"Operatör",authStatus:"active"});
 if(!legacy)await parent.collection("operatorLoginNames").doc("alias-"+uid).set({operatorId:uid});
 const machine=parent.collection("machines").doc(uid);await machine.set({operatorUid:uid,operatorUsername:uid,operatorName:"Operatör",status:"idle",jobReady:false,elapsedMs:0,updatedAt:Timestamp.fromMillis(clock)});
 await parent.collection("jobs").doc("history-"+uid).set({operatorUid:uid,operatorName:"Ticari kayıttaki ad",amount:1200});
 await parent.collection("payments").doc("pay-"+uid).set({amount:120});
 accounts.set(uid,{disabled:false});
 return {parent,machine,tenantId};
}
(async()=>{try{
 accounts.set(adminUid,{disabled:false});
 const disabledCompletion=createAccountDeletionCompletion({db,auth,Timestamp,HttpsError:TestError,adminUid});
 await denied(()=>disabledCompletion({uid:"some-account",retentionNote:"Reviewed records for this test"}),"failed-precondition");
 await denied(()=>finish(adminUid),"failed-precondition");
 await denied(()=>api(req("finish-outsider","reviewComplete",{uid:adminUid})),"permission-denied");
 for(const legacy of [false,true]){
  const uid=legacy?"finish-legacy":"finish-operator",f=await seedOperator(uid,legacy),token=await request(uid);
  await f.machine.update({jobReady:true,status:"paused"});
  await denied(()=>finish(uid),"failed-precondition");
  assert.equal(accounts.has(uid),true);assert.equal((await db.collection("users").doc(uid).get()).exists,true);
  await f.machine.update({jobReady:false,status:"idle"});
  assert.equal((await finish(uid)).status,"completed");
  assert.equal(accounts.has(uid),false);
  assert.equal((await db.collection("users").doc(uid).get()).exists,false);
  assert.equal((await db.collection("users").doc(uid).collection("workRequests").get()).empty,true);
  assert.equal((await db.collection("searchPreferences").doc(uid).get()).exists,false);
  assert.equal((await f.parent.collection("operators").doc(uid).get()).exists,false);
  assert.equal((await f.machine.get()).data().operatorUid,"");
  assert.equal((await f.parent.collection("jobs").doc("history-"+uid).get()).data().amount,1200);
  assert.equal((await f.parent.collection("payments").doc("pay-"+uid).get()).data().amount,120);
  const result=await api({data:{action:"receipt",receiptToken:token}});
  assert.equal(result.status,"completed");assert.deepEqual(Object.keys(result).sort(),["completedAt","expectedCompletionAt","status"]);
  assert.equal((await api({data:{action:"receipt",receiptToken:randomBytes(32).toString("base64url")}})).status,"unknown");
  const record=(await db.collection("accountDeletionRequests").doc(uid).get()).data();assert.ok(!("email" in record));assert.ok(!("leaseId" in record));
  assert.equal((await finish(uid)).status,"completed");assert.equal(deleted.filter(id=>id===uid).length,1);
  await denied(()=>api(req("collision-"+uid,"request",{confirmation:"HESABIMI SİL",receiptToken:token})),"already-exists");
 }
 const retry="finish-retry",retryFixture=await seedOperator(retry);await request(retry);failDelete=retry;
 await denied(()=>finish(retry),"unavailable");
 assert.equal((await db.collection("accountDeletionRequests").doc(retry).get()).data().status,"deleting");
 assert.equal((await db.collection("users").doc(retry).get()).exists,false);
 assert.equal((await api(req(retry,"request",{confirmation:"HESABIMI SİL"}))).status,"deleting","a retry must never overwrite the deletion lock");
 await finish(retry);assert.equal(accounts.has(retry),false);
 assert.equal((await retryFixture.parent.collection("jobs").doc("history-"+retry).get()).exists,true);
 const cleanup="finish-cleanup";await seedOperator(cleanup);await request(cleanup);
 const originalDelete=db.recursiveDelete.bind(db);let injected=true;
 db.recursiveDelete=async ref=>{if(injected&&ref.id===cleanup){injected=false;throw Error("injected Firestore cleanup outage")}return originalDelete(ref)};
 await denied(()=>finish(cleanup),"unavailable");assert.equal(accounts.has(cleanup),false);
 await finish(cleanup);db.recursiveDelete=originalDelete;
 const concurrent="finish-concurrent";await seedOperator(concurrent);await request(concurrent);
 let release,started;const wait=new Promise(resolve=>{release=resolve}),began=new Promise(resolve=>{started=resolve});
 deleteGate={uid:concurrent,wait,started};const first=finish(concurrent);await began;
 await denied(()=>finish(concurrent),"aborted");release();await first;deleteGate=null;
 assert.equal(deleted.filter(id=>id===concurrent).length,1);
 const owner="finish-owner",business=db.collection("businesses").doc(owner);
 await business.set({ownerUid:owner,name:"Korunan Firma",managerName:"Silinecek yönetici"});
 await db.collection("users").doc(owner).set({role:"tenant_admin",tenantId:owner});accounts.set(owner,{disabled:false});
 await business.collection("jobs").doc("archive").set({amount:300});await business.collection("payments").doc("receipt").set({amount:100});
 await business.collection("customers").doc("customer").set({name:"Korunan Müşteri"});
 await business.collection("searchPreferences").doc(owner).set({preferences:{personal:1}});
 await business.collection("searchPreferences").doc("other-person").set({preferences:{other:1}});
 await business.collection("machines").doc("open").set({status:"done",jobReady:false});
 const token=await request(owner);await denied(()=>finish(owner),"failed-precondition");
 assert.equal((await business.get()).data().accountStatus,undefined);
 await business.collection("machines").doc("open").update({status:"idle"});
 const batch=db.batch();
 for(let i=0;i<103;i++){const uid="finish-member-"+String(i).padStart(3,"0");batch.set(db.collection("users").doc(uid),{role:"tenant_operator",tenantId:owner,machineIds:[]});accounts.set(uid,{disabled:false})}
 await batch.commit();
 accounts.set("finish-foreign",{disabled:false});await db.collection("users").doc("finish-foreign").set({role:"tenant_operator",tenantId:"some-other-business"});
 await business.collection("operators").doc("forged").set({authUid:"finish-foreign"});
 const r=db.collection("accountDeletionRequests").doc(owner);await r.update({policyVersion:1,ownerClosureConsent:false});
 await denied(()=>finish(owner),"failed-precondition");assert.equal(accounts.has(owner),true);
 await r.update({policyVersion:2,ownerClosureConsent:true});failDisable="finish-member-101";
 await denied(()=>finish(owner),"unavailable");
 assert.equal((await r.get()).data().memberCursor,"finish-member-099");
 await finish(owner);assert.equal(disabled.filter(uid=>uid==="finish-member-000").length,1,"resume must skip completed member pages");
 assert.equal(accounts.has(owner),false);assert.equal(accounts.get("finish-foreign").disabled,false);
 assert.equal([...accounts.entries()].filter(([uid,a])=>uid.startsWith("finish-member-")&&a.disabled).length,103);
 const closed=(await business.get()).data();assert.equal(closed.accountStatus,"closed");assert.equal(closed.recordCustodianUid,adminUid);assert.equal(closed.managerName,"Silinmiş hesap");
 assert.equal((await business.collection("jobs").doc("archive").get()).data().amount,300);
 assert.equal((await business.collection("payments").doc("receipt").get()).data().amount,100);
 assert.equal((await business.collection("customers").doc("customer").get()).data().name,"Korunan Müşteri");
 assert.equal((await business.collection("searchPreferences").doc(owner).get()).exists,false);
 assert.equal((await business.collection("searchPreferences").doc("other-person").get()).exists,true);
 assert.equal((await api({data:{action:"receipt",receiptToken:token}})).status,"completed");
 const register=createBusinessRegistrationHandler({db,Timestamp,HttpsError:TestError});
 await denied(()=>register(req(owner,"unused",{company:"Tekrar oluştur",manager:"Yeni yönetici"})),"permission-denied");
 const work=createWorkStateHandler({db,Timestamp,HttpsError:TestError});
 await denied(()=>work({auth:{uid:"finish-member-000"},data:{machineId:"open",requestId:"after-close",action:"start",expectedStatus:"idle",expectedUpdatedAt:{seconds:1,nanoseconds:0}}}),"permission-denied");
 clock+=31*86400000;assert.equal((await api({data:{action:"receipt",receiptToken:token}})).status,"unknown");
 await db.collection("accountDeletionRequests").doc("finish-still-processing").set({status:"processing",purgeAfter:Timestamp.fromMillis(clock-1000)});
 const purged=await api(req(adminUid,"reviewCleanup"));assert.ok(purged.requestsRemoved>=5);assert.ok(purged.receiptsRemoved>=5);
 assert.equal((await r.get()).exists,false);assert.equal((await business.get()).exists,true);
 assert.equal((await db.collection("accountDeletionRequests").doc("finish-still-processing").get()).exists,true);
 console.log("PASS: actual account/profile cleanup, retained ledgers, active-work gates, Auth/Firestore failure recovery, concurrent deletion lease, consented business closure, paged member disabling, forged-member isolation and private post-deletion receipts");
}finally{await deleteApp(app)}})().catch(error=>{console.error(error);process.exitCode=1});
