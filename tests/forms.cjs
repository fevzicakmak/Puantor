const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const {JSDOM}=require("jsdom");

(async()=>{
 const ledger=await import("../customer-ledger.mjs");
 for(const file of ["yonetici.html","tenant-manager-preview.html"]){
  const tenant=file.startsWith("tenant"),uid="manager",base=tenant?"businesses/manager/":"";
  const dom=new JSDOM(fs.readFileSync(file,"utf8"),{url:"https://test.invalid/"+file,runScripts:"outside-only"});
  const {window:w}=dom,ctx=dom.getInternalVMContext();
  const store=new Map(),listeners=new Map(),calls=[],writes=[];
  const profile={role:tenant?"tenant_admin":"admin",...(tenant?{tenantId:uid}:{})};
  store.set("users/manager",profile);store.set(base+"customers/c1",{name:"Eski Ad"});
  const ref=(...args)=>({path:args.slice(1).join("/")});
  const snap=(path,data=store.get(path))=>({id:path.split("/").at(-1),exists:()=>data!==undefined,data:()=>data});
  let authChanged;
  const update=(r,patch)=>{writes.push({path:r.path,patch});store.set(r.path,{...store.get(r.path),...patch});};
  Object.assign(w,ledger,{
   firebaseConfig:{},initializeApp:()=>({}),getAuth:()=>({currentUser:{uid,email:"manager@example.com"}}),getFirestore:()=>({}),getFunctions:()=>({}),
   httpsCallable:(_,name)=>async data=>{calls.push({name,data});return {data:{ok:true}}},
   onAuthStateChanged:(_,callback)=>{authChanged=callback},signInWithEmailAndPassword:async()=>{},signOut:async()=>{},
   doc:ref,collection:ref,getDoc:async r=>snap(r.path),
   onSnapshot:(r,callback)=>{listeners.set(r.path,callback);return ()=>{}},
   serverTimestamp:()=>({server:true}),Timestamp:{fromMillis:ms=>({seconds:ms/1000,nanoseconds:0})},
   runTransaction:async(_,callback)=>callback({get:async r=>snap(r.path),update,set:update}),
   updateDoc:async(r,patch)=>update(r,patch),deleteDoc:async r=>store.delete(r.path),
   addDoc:async(r,data)=>{writes.push({path:r.path,data});return {id:"new"}},
   confirm:()=>true,prompt:()=>null,Blob:global.Blob,
  });
  w.URL.createObjectURL=()=>"blob:test";w.URL.revokeObjectURL=()=>{};
  w.HTMLAnchorElement.prototype.click=()=>{};
  w.HTMLElement.prototype.scrollIntoView=()=>{};
  try{
   for(const script of w.document.querySelectorAll("script:not([src])")){
    const code=script.textContent.replace(/^import .*?;\s*$/gm,"");
    vm.runInContext(code,ctx,{filename:file});
   }
   await authChanged({uid,email:"manager@example.com"});
   const feed=(type,rows)=>listeners.get(base+type)({docs:rows.map(row=>snap(base+type+"/"+row.id,row))});
   feed("customers",[{id:"c1",name:"Eski Ad"}]);
   feed("jobs",[{id:"j1",customerName:"Eski Ad",machineName:"Makine",elapsedMs:3600000,hourlyRate:1000}]);
   feed("payments",[{id:"p1",customerName:"Eski Ad",amount:100,date:"2026-11-14",note:"Ödeme"}]);
   feed("machines",[{id:"m1",machineName:"Makine",status:"idle",jobReady:false}]);
   feed("operators",[{id:"o1",username:"o1",displayName:"Operatör",authUid:"op",authStatus:"active"}]);
   const el=id=>w.document.getElementById(id),key=ledger.customerKey("c1");
   el("statementCustomer").value=key;el("statementCustomer").dispatchEvent(new w.Event("change"));
   assert.match(el("statementBalance").textContent,/900,00/);
   el("historyCustomer").value=key;
   el("manageType").value="customer";el("manageType").onchange();
   el("manageItem").value="c1";el("manageName").value="Yeni Ad";
   await el("manageRename").onclick();
   const renamed=store.get(base+"customers/c1");
   assert.equal(renamed.name,"Yeni Ad");assert.deepEqual([...renamed.previousNames],["Eski Ad"]);
   feed("customers",[{id:"c1",...renamed}]);
   assert.equal(el("statementCustomer").value,key);
   assert.equal(el("historyCustomer").value,key);
   assert.match(el("statementBalance").textContent,/900,00/);
   assert.equal(el("statementCustomer").selectedOptions[0].textContent,"Yeni Ad");
   el("paymentAmount").value="25";el("paymentNote").value="Yeni ödeme";
   el("paymentForm").dispatchEvent(new w.Event("submit",{cancelable:true}));
   await new Promise(resolve=>setImmediate(resolve));
   const payment=writes.find(x=>x.path===base+"payments"&&x.data);
   assert.equal(payment.data.customerId,"c1");assert.equal(payment.data.customerName,"Yeni Ad");
   el("taskMachine").value="Makine";el("taskOperator").value="Operatör (@o1)";el("taskCustomer").value="c1";el("taskRate").value="250";
   el("taskForm").dispatchEvent(new w.Event("submit",{cancelable:true}));
   await new Promise(resolve=>setImmediate(resolve));
   assert.equal(calls.find(x=>x.name==="assignOperatorWork").data.customerId,"c1");
   let printed="";w.open=()=>({document:{open(){},write:html=>{printed=html},close(){}}});
   el("statementPdf").click();assert.match(printed,/Yeni Ad/);assert.ok(!printed.includes("customer:c1"));
   const completed={id:"m1",machineName:"Makine",status:"done",jobReady:false,customerId:"c1",customerName:"Eski Ad",elapsedMs:3600000,hourlyRate:1000,travelFee:0,updatedAt:{toMillis:()=>5000},timeline:[]};
   store.set(base+"machines/m1",completed);feed("machines",[completed]);
   w.prompt=()=>"1000";
   el("archiveMachines").querySelector("button.reset-machine").click();
   await new Promise(resolve=>setImmediate(resolve));
   const archive=writes.find(x=>x.path===base+"jobs/m1_5000");
   assert.equal(archive.patch.customerId,"c1");assert.equal(archive.patch.customerName,"Eski Ad");assert.equal(archive.patch.amount,1000);
   el("manageType").value="customer";el("manageType").onchange();el("manageItem").value="c1";
   await el("manageDelete").onclick();
   assert.equal(store.get(base+"customers/c1").archived,true);
   feed("customers",[{id:"c1",...store.get(base+"customers/c1")}]);
   assert.equal([...el("taskCustomer").options].some(o=>o.value==="c1"),false);
   assert.match(el("statementBalance").textContent,/900,00/);
   el("customerName").value="Yeni Ad";
   el("customerForm").dispatchEvent(new w.Event("submit",{cancelable:true}));
   await new Promise(resolve=>setImmediate(resolve));
   assert.equal(store.get(base+"customers/c1").archived,false);
   feed("customers",[{id:"c1",...store.get(base+"customers/c1")}]);
   assert.equal([...el("taskCustomer").options].some(o=>o.value==="c1"),true);
   assert.match(el("statementBalance").textContent,/900,00/);
   console.log("PASS: "+file+" existing forms retain balance/selection after rename; ID payment/task, PDF and customer archive");
  }finally{w.close()}
 }
 for(const scenario of ["new","existing-auth","partial-account"]){
  const dom=new JSDOM(fs.readFileSync("giris.html","utf8"),{url:"https://test.invalid/giris.html",runScripts:"outside-only"});
  const {window:w}=dom,ctx=dom.getInternalVMContext(),calls=[];
  const user={uid:"signup",email:"manager@example.com"};
  const auth={currentUser:scenario==="partial-account"?user:null};
  let exists=scenario!=="new",failure=true;
  Object.assign(w,{
   firebaseConfig:{},initializeApp:()=>({}),getAuth:()=>auth,getFirestore:()=>({}),getFunctions:()=>({}),
   httpsCallable:(_,name)=>async data=>{
    calls.push({name,data});
    if(name==="completeBusinessRegistration"&&!data.company)throw Object.assign(new Error("Bilgileri tamamlayın"),{code:"functions/failed-precondition"});
    if(scenario==="new"&&failure){failure=false;throw Object.assign(new Error("Geçici bağlantı hatası"),{code:"functions/unavailable"})}
    return {data:{complete:true}};
   },
   doc:(_,path,id)=>({path:path+"/"+id}),getDoc:async()=>({exists:()=>false,data:()=>({})}),
   onAuthStateChanged:()=>{},setPersistence:async()=>{},browserLocalPersistence:"local",browserSessionPersistence:"session",
   createUserWithEmailAndPassword:async()=>{calls.push({name:"create"});if(exists)throw Object.assign(new Error("Kullanımda"),{code:"auth/email-already-in-use"});exists=true;auth.currentUser=user;return {user}},
   signInWithEmailAndPassword:async()=>{calls.push({name:"signIn"});auth.currentUser=user;return {user}},
   signOut:async()=>{auth.currentUser=null},sendEmailVerification:async()=>{},sendPasswordResetEmail:async()=>{},reload:async()=>{}
  });
  try{
   vm.runInContext(w.document.querySelector("script").textContent.replace(/^import .*?;\s*$/gm,""),ctx,{filename:"giris.html"});
   const el=id=>w.document.getElementById(id);
   if(scenario==="partial-account"){
    await vm.runInContext("route(auth.currentUser)",ctx);
    assert.equal(el("businessRegister").hidden,false);assert.equal(el("businessPassword").required,false);
   }
   el("businessName").value="Firma";el("businessManager").value="Yönetici";el("businessEmail").value=user.email;
   el("businessPassword").value=scenario==="partial-account"?"":"password123";
   el("businessRegister").dispatchEvent(new w.Event("submit",{cancelable:true}));
   await new Promise(resolve=>setImmediate(resolve));
   if(scenario==="new"){
    assert.match(el("businessStatus").textContent,/Geçici bağlantı hatası|functions\/unavailable/);
    el("businessPassword").value="password123";
    el("businessRegister").dispatchEvent(new w.Event("submit",{cancelable:true}));
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(calls.filter(x=>x.name==="signIn").length,1);
   }
   assert.equal(el("businessRegister").hidden,true);assert.equal(el("businessPassword").required,true);
   assert.equal(el("businessPassword").value,"");assert.equal(auth.currentUser,null);
   assert.ok(calls.some(x=>x.name==="completeBusinessRegistration"&&x.data.company==="Firma"));
   if(scenario==="partial-account")assert.equal(calls.some(x=>x.name==="create"),false);
   console.log("PASS: existing registration form "+scenario+" and recoverable retry");
  }finally{w.close()}
 }
})().catch(error=>{console.error(error);process.exitCode=1});
