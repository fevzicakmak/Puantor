const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,".."),output=path.join(root,".puantor-e2e-public");
fs.rmSync(output,{recursive:true,force:true});
fs.mkdirSync(output,{recursive:true});
const files=["giris.html","tenant-manager-preview.html","tenant-operator-preview.html","yonetici.html","operator.html","operator-actions.js","customer-ledger.mjs"];
for(const name of files){
 let source=fs.readFileSync(path.join(root,name),"utf8");
 for(const sdk of ["auth","firestore","functions"])source=source.replaceAll(`https://www.gstatic.com/firebasejs/13.2.0/firebase-${sdk}.js`,`./emulator-${sdk}.js`);
 fs.writeFileSync(path.join(output,name),source);
}
fs.copyFileSync(path.join(output,"giris.html"),path.join(output,"index.html"));
fs.writeFileSync(path.join(output,"firebase-config.js"),'export const firebaseConfig = {apiKey:"fake-api-key",authDomain:"localhost",projectId:"demo-puantor-e2e"};\n');
for(const [sdk,getter,connect,args] of [
 ["auth","getAuth","connectAuthEmulator",'"http://127.0.0.1:9099",{disableWarnings:true}'],
 ["firestore","getFirestore","connectFirestoreEmulator",'"127.0.0.1",8080'],
 ["functions","getFunctions","connectFunctionsEmulator",'"127.0.0.1",5001']
]){
 const url=`https://www.gstatic.com/firebasejs/13.2.0/firebase-${sdk}.js`;
 fs.writeFileSync(path.join(output,`emulator-${sdk}.js`),`export * from "${url}";\nimport {${getter} as original,${connect}} from "${url}";\nconst connected=new WeakSet();\nexport function ${getter}(...args){const service=original(...args);if(!connected.has(service)){${connect}(service,${args});connected.add(service);}return service;}\n`);
}
console.log("Built local-only demo-puantor-e2e site; production configuration was not copied.");
