const crypto=require("node:crypto"),fs=require("node:fs");
function makeToken({key,keyId,issuer,now=Math.floor(Date.now()/1000)}){
 const encode=value=>Buffer.from(JSON.stringify(value)).toString("base64url");
 const unsigned=encode({alg:"ES256",kid:keyId,typ:"JWT"})+"."+encode({iss:issuer,iat:now-10,exp:now+1100,aud:"appstoreconnect-v1"});
 return unsigned+"."+crypto.sign("sha256",Buffer.from(unsigned),{key,dsaEncoding:"ieee-p1363"}).toString("base64url");
}
function selectBuild(data,included,version,build){
 return data.find(item=>item.attributes?.version===build&&included.some(v=>v.type==="preReleaseVersions"&&v.id===item.relationships?.preReleaseVersion?.data?.id&&v.attributes?.version===version));
}
async function getStatus({bundle,version,build,token,fetcher=fetch}){
 const get=async path=>{
  const response=await fetcher("https://api.appstoreconnect.apple.com/v1/"+path,{headers:{Authorization:"Bearer "+token},signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error("App Store Connect request failed (HTTP "+response.status+")");
  return response.json();
 };
 const apps=await get("apps?"+new URLSearchParams({"filter[bundleId]":bundle}));
 const matches=apps.data?.filter(app=>app.attributes?.bundleId===bundle)||[];
 if(matches.length!==1)throw Error("A unique App Store Connect app matching the approved Bundle ID was not found");
 const appId=matches[0].id;
 const builds=await get("builds?"+new URLSearchParams({"filter[app]":appId,"filter[version]":build,include:"preReleaseVersion,buildBetaDetail",limit:"100"}));
 const found=selectBuild(builds.data||[],builds.included||[],version,build);
 const beta=found&&(builds.included||[]).find(item=>item.type==="buildBetaDetails"&&item.id===found.relationships?.buildBetaDetail?.data?.id);
 return found?{appId,buildId:found.id,processingState:found.attributes.processingState,usesNonExemptEncryption:found.attributes.usesNonExemptEncryption??null,internalBuildState:beta?.attributes?.internalBuildState??null,externalBuildState:beta?.attributes?.externalBuildState??null}:{appId,processingState:"NOT_FOUND"};
}
async function main(){
 const env=process.env,once=process.argv.includes("--once"),key=fs.readFileSync(env.APPLE_KEY_PATH);
 const start=Date.now();let status;
 do{
  const token=makeToken({key,keyId:env.APPLE_ASC_KEY_ID,issuer:env.APPLE_ASC_ISSUER_ID});
  status=await getStatus({bundle:env.IOS_BUNDLE_ID,version:env.IOS_VERSION,build:env.IOS_BUILD_NUMBER,token});
  if(once||["VALID","FAILED","INVALID"].includes(status.processingState))break;
  await new Promise(resolve=>setTimeout(resolve,15000));
 }while(Date.now()-start<300000);
 const report={bundleId:env.IOS_BUNDLE_ID,version:env.IOS_VERSION,build:env.IOS_BUILD_NUMBER,...status};
 fs.writeFileSync(env.TESTFLIGHT_REPORT,JSON.stringify(report,null,2)+"\n");
 if(env.GITHUB_OUTPUT)fs.appendFileSync(env.GITHUB_OUTPUT,"build_exists="+(status.processingState!=="NOT_FOUND")+"\n");
 console.log("TestFlight build state: "+status.processingState);
 if(["FAILED","INVALID"].includes(status.processingState))throw Error("Apple processing rejected the uploaded build; inspect App Store Connect");
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1});
module.exports={makeToken,selectBuild,getStatus};
