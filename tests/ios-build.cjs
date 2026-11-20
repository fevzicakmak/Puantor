const assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {buildIosPublic,publicLogin}=require("../scripts/build-ios-public.cjs");
const output=fs.mkdtempSync(path.join(os.tmpdir(),"puantor-ios-"));
const sourceLogin=fs.readFileSync("giris.html","utf8"),sourceManager=fs.readFileSync("tenant-manager-preview.html","utf8");
const sourceIndex=fs.readFileSync("index.html","utf8"),sourceConfig=fs.readFileSync("firebase-config.js","utf8");
try{
 fs.writeFileSync(path.join(output,"test-sifirla.html"),"stale reset tool");
 buildIosPublic(output);
 assert.deepEqual(fs.readdirSync(output).sort(),["index.html","giris.html","tenant-manager-preview.html","tenant-operator-preview.html","yonetici.html","operator.html","operator-actions.js","customer-ledger.mjs","firebase-config.js","gizlilik.html","destek.html","hesap.html"].sort());
 assert.equal(fs.readFileSync(path.join(output,"index.html"),"utf8"),sourceLogin,"The app must launch the current login, never the legacy localStorage application");
 for(const name of ["giris.html","tenant-operator-preview.html","yonetici.html","operator.html","operator-actions.js","customer-ledger.mjs","gizlilik.html","destek.html","hesap.html"])
  assert.equal(fs.readFileSync(path.join(output,name),"utf8"),fs.readFileSync(name,"utf8"),name+" must preserve the existing UI and business logic");
 const manager=fs.readFileSync(path.join(output,"tenant-manager-preview.html"),"utf8");
 assert.equal(manager,sourceManager.replace('new URL("./giris.html",location.href)',`new URL(${JSON.stringify(publicLogin)})`));
 const invite=new URL(publicLogin);invite.searchParams.set("f","ornek");invite.searchParams.set("u","bekir");
 assert.equal(invite.protocol,"https:");assert.equal(invite.searchParams.get("f"),"ornek");assert.ok(!invite.searchParams.has("password"));
 assert.equal(fs.readFileSync("index.html","utf8"),sourceIndex);
 assert.equal(fs.readFileSync("firebase-config.js","utf8"),sourceConfig);
 const config=JSON.parse(fs.readFileSync("capacitor.config.json","utf8"));
 assert.equal(config.webDir,".puantor-ios-public");assert.ok(!config.server,"Never silently load an entire remote site or permit arbitrary navigation");
 assert.match(sourceLogin,/href="\.\/gizlilik.html"/);assert.match(sourceLogin,/href="\.\/destek.html"/);
 console.log("PASS: iOS build launches current login, excludes legacy/reset/repository files, preserves application screens and source configuration, and emits public HTTPS invitations");
}finally{fs.rmSync(output,{recursive:true,force:true})}
