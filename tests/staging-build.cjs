const assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {buildStagingPublic}=require("../scripts/build-staging-public.cjs");
const original=fs.readFileSync("firebase-config.js","utf8"),output=fs.mkdtempSync(path.join(os.tmpdir(),"puantor-staging-build-"));
try{
 const config={projectId:"puantor-staging",authDomain:"puantor-staging.firebaseapp.com",apiKey:"test-only",appId:"test-only"};
 assert.throws(()=>buildStagingPublic({...config,projectId:"puantor-live"},output));
 assert.throws(()=>buildStagingPublic({...config,authDomain:"puantor-live.firebaseapp.com"},output));
 assert.throws(()=>buildStagingPublic({...config,apiKey:""},output));
 assert.deepEqual(fs.readdirSync(output),[]);
 fs.writeFileSync(path.join(output,"test-sifirla.html"),"stale development tool");
 buildStagingPublic(config,output);
 assert.match(fs.readFileSync(path.join(output,"firebase-config.js"),"utf8"),/puantor-staging/);
 assert.equal(fs.readFileSync("firebase-config.js","utf8"),original);
 assert.equal(fs.readFileSync(path.join(output,"index.html"),"utf8"),fs.readFileSync("giris.html","utf8"));
 assert.ok(!fs.existsSync(path.join(output,"test-sifirla.html")));
 for(const name of ["operator-actions.js","customer-ledger.mjs","operator.html"])assert.ok(fs.existsSync(path.join(output,name)));
 console.log("PASS: staging build rejects live config, preserves source config and publishes only explicit application files");
}finally{fs.rmSync(output,{recursive:true,force:true})}
