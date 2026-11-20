// Read-only, unauthenticated probes. A callable must return its JSON Auth/input
// error, rather than a Cloud Run HTML 403 before the handler is reached.
const assert=require("node:assert/strict");
const probes=[
 ["completeBusinessRegistration",401,"UNAUTHENTICATED"],["accountDeletion",401,"UNAUTHENTICATED"],
 ["operatorWorkState",401,"UNAUTHENTICATED"],
 ["assignOperatorWork",401,"UNAUTHENTICATED"],
 ["tenantOperatorAdmin",401,"UNAUTHENTICATED"],
 ["operatorAdmin",403,"PERMISSION_DENIED"],
 ["operatorLoginAddress",400,"INVALID_ARGUMENT"]
];
(async()=>{
 for(const [name,status,error] of probes){
  let last;
  for(let attempt=0;attempt<5;attempt++){
   const response=await fetch("https://europe-west1-puantor-staging.cloudfunctions.net/"+name,{method:"POST",headers:{"Content-Type":"application/json",Origin:"https://puantor-staging.web.app"},body:'{"data":{}}',signal:AbortSignal.timeout(15000)});
   const body=await response.text();
   try{
    assert.equal(response.status,status);
    assert.equal(JSON.parse(body).error.status,error);
    last=null;break;
   }catch(failure){last=new Error(name+": expected callable "+status+" "+error+", received "+response.status+" "+body.slice(0,120));}
   if(attempt<4)await new Promise(resolve=>setTimeout(resolve,2000));
  }
  if(last)throw last;
  console.log("PASS staging: "+name+" reachable; application guard returns "+error);
 }
})().catch(error=>{console.error(error);process.exitCode=1});
