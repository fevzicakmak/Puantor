const fs=require("node:fs");
const path=require("node:path");
const {spawnSync}=require("node:child_process");
const root=path.resolve(__dirname,".."),PROJECT="puantor-staging";
function buildStagingPublic(config,output=path.join(root,".puantor-staging-public")){
 if(config?.projectId!==PROJECT||config.authDomain!==PROJECT+".firebaseapp.com"||typeof config.apiKey!=="string"||!config.apiKey||typeof config.appId!=="string"||!config.appId)
  throw Error("Staging Web App yapılandırması doğrulanamadı. Canlı yapılandırma kullanılamaz.");
 // Explicit public file list: never publish repository files or reset tools.
 fs.rmSync(output,{recursive:true,force:true});
 fs.mkdirSync(output,{recursive:true});
 for(const name of ["giris.html","tenant-manager-preview.html","tenant-operator-preview.html","yonetici.html","operator.html","operator-actions.js","customer-ledger.mjs","gizlilik.html","destek.html","hesap.html"])
  fs.copyFileSync(path.join(root,name),path.join(output,name));
 fs.copyFileSync(path.join(output,"giris.html"),path.join(output,"index.html"));
 fs.writeFileSync(path.join(output,"firebase-config.js"),"export const firebaseConfig = "+JSON.stringify(config,null,2)+";\n");
}
if(require.main===module){
 // Fetch config from the authenticated Firebase management API, rather than
 // trusting a hand-edited API key which might authenticate against production.
 const cli=path.join(root,"node_modules/.bin/firebase");
 const args=["apps:sdkconfig","WEB",...(process.env.PUANTOR_STAGING_APP_ID?[process.env.PUANTOR_STAGING_APP_ID]:[]),"--project",PROJECT,"--json","--non-interactive"];
 const result=spawnSync(cli,args,{cwd:root,encoding:"utf8"});
 if(result.status!==0)throw Error("Staging Web App yapılandırması alınamadı. Firebase staging erişimini ve varsa PUANTOR_STAGING_APP_ID seçimini kontrol edin.");
 const payload=JSON.parse(result.stdout);
 if(payload.status!=="success")throw Error("Firebase staging yapılandırma isteği başarısız.");
 buildStagingPublic(payload.result?.sdkConfig);
 console.log("Staging files built using the verified "+PROJECT+" Web App config; source configuration unchanged.");
}
module.exports={buildStagingPublic};
