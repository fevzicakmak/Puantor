const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const publicLogin="https://fevzicakmak.github.io/Puantor/giris.html";
const files=["giris.html","tenant-manager-preview.html","tenant-operator-preview.html","yonetici.html","operator.html","operator-actions.js","customer-ledger.mjs","firebase-config.js","gizlilik.html","destek.html","hesap.html"];
function buildIosPublic(output=path.join(root,".puantor-ios-public")){
 // Always package a local, explicit application file set. Never use a remote
 // server.url, the legacy localStorage index, reset tools, or repository files.
 fs.rmSync(output,{recursive:true,force:true});
 fs.mkdirSync(output,{recursive:true});
 for(const name of files){
  let source=fs.readFileSync(path.join(root,name),"utf8");
  if(name==="tenant-manager-preview.html"){
   const expression='new URL("./giris.html",location.href)';
   if(source.split(expression).length!==2)throw Error("Operatör davet adresi değişti; iOS SMS bağlantısını gözden geçirin.");
   source=source.replace(expression,`new URL(${JSON.stringify(publicLogin)})`);
  }
  fs.writeFileSync(path.join(output,name),source);
 }
 fs.copyFileSync(path.join(output,"giris.html"),path.join(output,"index.html"));
 return output;
}
if(require.main===module)console.log("iOS web assets prepared: "+buildIosPublic());
module.exports={buildIosPublic,publicLogin};
