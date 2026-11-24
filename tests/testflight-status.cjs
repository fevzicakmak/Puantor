const assert=require("node:assert/strict"),crypto=require("node:crypto");
const {makeToken,selectBuild,getStatus}=require("../scripts/testflight-status.cjs");
(async()=>{
 const {privateKey,publicKey}=crypto.generateKeyPairSync("ec",{namedCurve:"P-256"});
 const token=makeToken({key:privateKey,keyId:"TEST123456",issuer:"test-issuer",now:1000});
 const [header,payload,signature]=token.split(".");
 assert.equal(JSON.parse(Buffer.from(header,"base64url")).alg,"ES256");
 assert.equal(JSON.parse(Buffer.from(payload,"base64url")).aud,"appstoreconnect-v1");
 assert.equal(crypto.verify("sha256",Buffer.from(header+"."+payload),{key:publicKey,dsaEncoding:"ieee-p1363"},Buffer.from(signature,"base64url")),true);
 const builds=[{id:"wrong-version",attributes:{version:"73"},relationships:{preReleaseVersion:{data:{id:"v2"}}}},{id:"correct",attributes:{version:"73",processingState:"VALID"},relationships:{preReleaseVersion:{data:{id:"v1"}}}}];
 const included=[{id:"v1",type:"preReleaseVersions",attributes:{version:"1.0"}},{id:"v2",type:"preReleaseVersions",attributes:{version:"2.0"}}];
 assert.equal(selectBuild(builds,included,"1.0","73").id,"correct");
 assert.equal(selectBuild(builds,included,"1.0","74"),undefined);
 const requests=[];
 const fetcher=async(url,options)=>{
  requests.push(url);assert.ok(!options.method||options.method==="GET");
  return {ok:true,json:async()=>url.includes("/apps?")?{data:[{id:"app",attributes:{bundleId:"com.example.puantor"}}]}:{data:builds,included}};
 };
 const status=await getStatus({bundle:"com.example.puantor",version:"1.0",build:"73",token:"test-only",fetcher});
 assert.equal(status.buildId,"correct");assert.equal(status.processingState,"VALID");assert.equal(requests.length,2);
 await assert.rejects(()=>getStatus({bundle:"com.example.puantor",version:"1.0",build:"73",token:"test-only",fetcher:async()=>({ok:false,status:403})}),/HTTP 403/);
 console.log("PASS: ES256 Apple token, exact version/build matching and read-only processing lookup");
})().catch(error=>{console.error(error);process.exitCode=1});
