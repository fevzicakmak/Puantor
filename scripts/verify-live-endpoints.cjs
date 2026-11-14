const assert=require("node:assert/strict");
const checks=[["completeBusinessRegistration",401,"UNAUTHENTICATED"],["operatorWorkState",401,"UNAUTHENTICATED"],["assignOperatorWork",401,"UNAUTHENTICATED"],["tenantOperatorAdmin",401,"UNAUTHENTICATED"],["operatorAdmin",403,"PERMISSION_DENIED"],["operatorLoginAddress",400,"INVALID_ARGUMENT"]];
(async()=>{
 for(const [name,status,error] of checks){
  let last;
  for(let attempt=0;attempt<6;attempt++){
   const response=await fetch("https://europe-west1-puantor-live.cloudfunctions.net/"+name,{method:"POST",headers:{"Content-Type":"application/json",Origin:"https://fevzicakmak.github.io"},body:'{"data":{}}',signal:AbortSignal.timeout(15000)});
   const body=await response.text();
   try{assert.equal(response.status,status);assert.equal(JSON.parse(body).error.status,error);last=null;break}
   catch(e){last=new Error(name+": expected "+status+" "+error+", received "+response.status+" "+body.slice(0,120))}
   await new Promise(resolve=>setTimeout(resolve,2000));
  }
  if(last)throw last;
  console.log("PASS live: "+name+" reachable; application guard returns "+error);
 }
})().catch(error=>{console.error(error);process.exitCode=1});
