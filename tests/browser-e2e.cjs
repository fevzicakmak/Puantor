const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");
const {initializeApp,deleteApp}=require("firebase-admin/app");
const {getFirestore}=require("firebase-admin/firestore");

const PROJECT="demo-puantor-e2e",URL="http://127.0.0.1:5000",artifacts=path.resolve("test-results/browser");
assert.match(process.env.FIRESTORE_EMULATOR_HOST||"",/^127\.0\.0\.1:\d+$/);
assert.match(process.env.FIREBASE_AUTH_EMULATOR_HOST||"",/^127\.0\.0\.1:\d+$/);
fs.rmSync(artifacts,{recursive:true,force:true});
fs.mkdirSync(artifacts,{recursive:true});
const app=initializeApp({projectId:PROJECT},"browser-e2e"),db=getFirestore(app);
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label){for(let i=0;i<100;i++){if(await fn())return;await pause(100)}throw Error("Timed out: "+label)}
async function openPanel(page,target){
 const index=await page.locator(target).evaluate(el=>[...document.querySelectorAll("#managerPanels>details.toolbox")].indexOf(el.closest("details.toolbox")));
 assert.ok(index>=0,target+" panel");await page.locator(`#managerToolbar button[data-panel="${index}"]`).click();
}
async function signup(page,email){
 await page.goto(URL+"/giris.html");await page.waitForFunction(()=>document.getElementById("status").textContent.includes("Giriş yapmak"));await page.locator("#showBusinessRegister").click();
 await page.locator("#businessName").fill("Tarayıcı Test Firması");await page.locator("#businessManager").fill("Test Yönetici");
 await page.locator("#businessEmail").fill(email);await page.locator("#businessPassword").fill("Browser-test-123!");
 await page.locator("#businessSubmit").click();await page.locator("#businessRegister").waitFor({state:"hidden"});
 await login(page,email,"Browser-test-123!");
 await page.waitForURL("**/tenant-manager-preview.html");await page.locator("#dashboard").waitFor({state:"visible"});
}
async function login(page,email,password){
 await page.locator("#email").fill(email);await page.locator("#password").fill(password);await page.locator("#submit").click();
}
(async()=>{
 let browser;const contexts=[],errors=[],failed=[],outbound=[];let manager,operator;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.PUANTOR_CHROMIUM_PATH||(fs.existsSync("/usr/bin/chromium")?"/usr/bin/chromium":undefined),args:["--no-sandbox"]});
  const context=async()=>{
   const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,ignoreHTTPSErrors:process.env.PUANTOR_E2E_IGNORE_HTTPS_ERRORS==="1"});contexts.push(ctx);
   // Only local emulators and static Firebase SDK modules are permitted. Any
   // accidental production endpoint fails the test before it can be contacted.
   await ctx.route("**/*",async route=>{
    const url=new global.URL(route.request().url());
    if(["127.0.0.1","localhost","www.gstatic.com"].includes(url.hostname))return route.continue();
    outbound.push(url.origin+url.pathname);return route.abort("blockedbyclient");
   });
   ctx.on("page",page=>{page.on("pageerror",error=>errors.push(error.message));page.on("requestfailed",req=>{
    const requestUrl=new global.URL(req.url());
    const firestoreStream=["127.0.0.1","localhost"].includes(requestUrl.hostname)&&/google\.firestore\.v1\.Firestore\/(Listen|Write)\/channel$/.test(requestUrl.pathname);
    const canceledNavigationRequest=req.failure()?.errorText==="net::ERR_ABORTED"&&(firestoreStream||requestUrl.searchParams.has("timecheck"));
    if(!canceledNavigationRequest)failed.push(req.url()+" "+req.failure()?.errorText);
   });page.on("dialog",dialog=>dialog.accept(dialog.type()==="prompt"?(dialog.message().includes("Arıza")?"Test arızası":"1500"):undefined));});
   return ctx;
  };
  manager=await (await context()).newPage();await signup(manager,"browser-a@example.com");
  const firms=await db.collection("businesses").get();assert.equal(firms.size,1);const tenantId=firms.docs[0].id,parent=firms.docs[0].ref;
  console.log("PASS browser: signup → callable → Auth/Firestore → manager panel");
  await manager.locator('#managerToolbar button[data-panel="0"]').click();
  await manager.locator("#addType").selectOption("machine");await manager.locator("#newMachine").fill("Test Makinesi");await manager.locator("#newMachineRate").fill("1500");await manager.locator("#addMachine").click();
  await until(async()=>!(await parent.collection("machines").get()).empty,"machine saved");
  await manager.locator("#addType").selectOption("customer");await manager.locator("#customerName").fill("Eski Müşteri");await manager.locator("#customerSave").click();
  await until(async()=>!(await parent.collection("customers").get()).empty,"customer saved");
  await manager.locator("#addType").selectOption("operator");await manager.locator("#opName").fill("Test Operatörü");await manager.locator("#opPhone").fill("05321234567");await manager.locator("#opSave").click();
  await manager.locator("#opMessage").waitFor({state:"visible"});
  const message=await manager.locator("#opMessageText").inputValue();
  const invite=message.split("\n")[1],username=message.match(/Kullanıcı:\s*(\S+)/)?.[1],password=message.match(/Şifre:\s*(\S+)/)?.[1];
  assert.ok(invite&&username&&password,"operator credentials are available in the existing form");
  assert.equal(password.length,8);assert.equal(username,"test");assert.ok(!message.includes("@operators.puantor.invalid"));
  // No SMS is opened or sent. The generated credentials are only used locally.
  operator=await (await context()).newPage();await operator.goto(invite);await operator.waitForFunction(()=>document.getElementById("status").textContent.includes("Giriş yapmak"));
  assert.equal(await operator.locator("#email").inputValue(),username);
  await operator.locator("#password").fill(password);await operator.locator("#submit").click();
  await operator.waitForURL("**/tenant-operator-preview.html");
  await until(async()=>(await operator.locator("#error").textContent()).includes("Makine ataması"),"unassigned operator");
  await operator.locator("#signout").click();await operator.waitForURL("**/giris.html");
  await operator.waitForFunction(()=>document.getElementById("status").textContent.includes("Giriş yapmak"));
  assert.equal(await operator.locator("#email").inputValue(),username);
  await operator.locator("#password").fill(password);await operator.locator("#submit").click();
  await operator.waitForURL("**/tenant-operator-preview.html");
  await manager.locator("#operatorToolbarButtons button").filter({hasText:"Test Operatörü"}).click();
  await manager.locator("#taskMachine").selectOption({label:"Test Makinesi"});await manager.locator("#taskCustomer").selectOption({label:"Eski Müşteri"});await manager.locator("#taskRate").fill("250");await manager.locator("#taskSave").click();
  await until(async()=>await operator.locator("#start").isEnabled(),"live assignment without reload");
  console.log("PASS browser: manager assignment → callable transaction → open operator screen updates without reload");
  await operator.locator("#start").click();await until(async()=>(await operator.locator("#machineStatus").textContent())==="Çalışıyor","started");
  await pause(1100);await operator.locator("#pause").click();await until(async()=>(await operator.locator("#machineStatus").textContent())==="Duraklatıldı","paused");
  await operator.screenshot({path:path.join(artifacts,"operator-mobile.png"),fullPage:true});
  await operator.locator("#start").click();await until(async()=>(await operator.locator("#machineStatus").textContent())==="Çalışıyor","resumed");
  await operator.locator("#fault").click();await until(async()=>(await operator.locator("#machineStatus").textContent())==="Arızalı","fault");
  await operator.locator("#start").click();await until(async()=>(await operator.locator("#machineStatus").textContent())==="Çalışıyor","resumed after fault");
  await operator.locator("#finish").click();
  const machine=(await parent.collection("machines").get()).docs[0];
  await until(async()=>(await machine.ref.get()).data().status==="done","finished");
  await until(async()=>(await operator.locator("#machineStatus").textContent())==="Tamamlandı","finished operator status");
  const done=(await machine.ref.get()).data();assert.ok(done.elapsedMs>=1000);assert.equal(done.jobReady,false);
  assert.deepEqual(done.timeline.map(e=>e.action),["start","pause","start","fault","start","finish"]);
  console.log("PASS browser: start → pause → resume → fault → resume → finish; persisted server duration/history");
  await manager.locator('#managerToolbar button[data-panel="7"]').click();await manager.locator("#archiveMachines button.reset-machine").click();
  await until(async()=>!(await parent.collection("jobs").get()).empty,"archived");
  const job=(await parent.collection("jobs").get()).docs[0].data(),customer=(await parent.collection("customers").get()).docs[0];
  assert.equal(job.customerId,customer.id);assert.equal(job.amount,Math.round((Math.floor(done.elapsedMs/1000)*1500/3600+250)*100)/100);
  await openPanel(manager,"#statementCustomer");await manager.locator("#statementCustomer").selectOption("customer:"+customer.id);
  await manager.locator("#paymentAmount").fill("25");await manager.locator("#paymentNote").fill("Test tahsilatı");await manager.locator("#paymentSave").click();
  await until(async()=>!(await parent.collection("payments").get()).empty,"payment saved");
  assert.equal((await parent.collection("payments").get()).docs[0].data().customerId,customer.id);
  const balance=await manager.locator("#statementBalance").textContent();
  await openPanel(manager,"#manageType");await manager.locator("#manageType").selectOption("customer");await manager.locator("#manageItem").selectOption(customer.id);await manager.locator("#manageName").fill("Yeni Müşteri");await manager.locator("#manageRename").click();
  await until(async()=>(await customer.ref.get()).data().name==="Yeni Müşteri","customer renamed");
  await openPanel(manager,"#statementCustomer");
  await until(async()=>(await manager.locator("#statementCustomer option:checked").textContent())==="Yeni Müşteri","renamed statement");
  assert.equal(await manager.locator("#statementBalance").textContent(),balance);
  const popupPromise=manager.waitForEvent("popup");await manager.locator("#statementPdf").click();const popup=await popupPromise;
  await popup.waitForLoadState();assert.ok((await popup.title()).includes("Yeni Müşteri"));await popup.close();
  const downloadPromise=manager.waitForEvent("download");await manager.locator("#statementCsv").click();const download=await downloadPromise;
  await download.saveAs(path.join(artifacts,"statement.csv"));
  const csv=fs.readFileSync(path.join(artifacts,"statement.csv"),"utf8");assert.ok(csv.includes("KALAN ALACAK"));
  await manager.screenshot({path:path.join(artifacts,"manager-mobile.png"),fullPage:true});
  console.log("PASS browser: archive/payment IDs, unchanged balance after rename, real PDF popup and CSV download");
  const second=await (await context()).newPage();await signup(second,"browser-b@example.com");
  const denied=await second.evaluate(async ({tenantId,customerId})=>{
   const {getFirestore,doc,getDoc}=await import("./emulator-firestore.js");const {getApp}=await import("https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js");
   try{await getDoc(doc(getFirestore(getApp()),"businesses",tenantId,"customers",customerId));return false}catch(error){return error.code==="permission-denied"}
  },{tenantId,customerId:customer.id});
  assert.equal(denied,true);assert.equal(await second.locator("#statementCustomer option").count(),1);
  console.log("PASS browser: second firm has no first-firm records and cross-firm Firestore access is denied");
  const createdNames=[];
  manager.on("request",request=>{if(request.url().endsWith("/tenantOperatorAdmin")&&request.method()==="POST"){try{const data=request.postDataJSON().data;if(data.action==="create")createdNames.push(data.username)}catch{}}});
  async function operatorAction(data){return manager.evaluate(async data=>{
   const {getApp}=await import("https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js");
   const {getFunctions,httpsCallable}=await import("./emulator-functions.js");
   return (await httpsCallable(getFunctions(getApp(),"europe-west1"),"tenantOperatorAdmin")(data)).data;
  },data)}
  await operatorAction({action:"create",username:"taken",displayName:"Taken Test",password:"Testpass23"});
  await manager.waitForFunction(()=>window.__puantorSearchData.operators.some(o=>o.username==="taken"));
  await operatorAction({action:"delete",username:"taken"});
  await manager.waitForFunction(()=>!window.__puantorSearchData.operators.some(o=>o.username==="taken"));
  await manager.locator('#managerToolbar button[data-panel="0"]').click();await manager.locator("#addType").selectOption("operator");
  await manager.locator("#opName").fill("Taken Test");await manager.locator("#opPhone").fill("05321234567");
  await manager.locator("#opSave").click();
  await until(async()=>(await manager.locator("#opMessageText").inputValue()).includes("Kullanıcı: taken2"),"disabled Auth name collision recovered");
  assert.deepEqual(createdNames.slice(-2),["taken","taken2"]);
  console.log("PASS browser: deleted operator Auth username is skipped automatically without account overwrite");
  await manager.locator('footer a[href="./hesap.html"]').click();
  await manager.locator("#requestForm").waitFor({state:"visible"});
  await manager.locator("#password").fill("wrong-password");await manager.locator("#acknowledge").check();
  await manager.locator("#submit").click();
  await manager.waitForFunction(()=>document.getElementById("status").textContent.includes("Şifre doğrulanamadı"));
  assert.equal((await db.collection("accountDeletionRequests").doc(tenantId).get()).exists,false);
  await manager.locator("#password").fill("Browser-test-123!");await manager.locator("#submit").click();
  await manager.locator("#cancelForm").waitFor({state:"visible"});
  assert.equal((await db.collection("accountDeletionRequests").doc(tenantId).get()).data().status,"pending");
  assert.equal(await manager.locator("#password").inputValue(),"");
  assert.equal((await parent.collection("payments").get()).size,1);
  assert.equal((await parent.collection("jobs").get()).size,1);
  await manager.reload();await manager.locator("#cancelForm").waitFor({state:"visible"});
  await manager.screenshot({path:path.join(artifacts,"account-deletion-mobile.png"),fullPage:true});
  await second.goto(URL+"/hesap.html");await second.locator("#requestForm").waitFor({state:"visible"});
  assert.equal(await second.locator("#cancelForm").isHidden(),true,"another account cannot see or cancel the first account's request");
  await operator.goto(URL+"/hesap.html");await operator.locator("#requestForm").waitFor({state:"visible"});
  assert.equal(await operator.locator("#ownerNotice").isHidden(),true);
  await operator.locator("#password").fill(password);await operator.locator("#acknowledge").check();await operator.locator("#submit").click();
  await operator.locator("#cancelForm").waitFor({state:"visible"});
  const operatorRequest=(await db.collection("accountDeletionRequests").get()).docs.find(doc=>doc.id!==tenantId);
  assert.equal(operatorRequest.data().scope,"account-review");
  assert.equal(operatorRequest.data().tenantId,tenantId);
  await manager.locator("#cancelPassword").fill("Browser-test-123!");await manager.locator("#cancelRequest").click();
  await manager.locator("#requestForm").waitFor({state:"visible"});
  assert.equal((await db.collection("accountDeletionRequests").doc(tenantId).get()).data().status,"cancelled");
  assert.equal((await parent.get()).exists,true);
  console.log("PASS browser: account page → password reauthentication → private persisted request → own-account cancellation; business and financial data retained");
  const supportUid="3m5MqDVbbFTVWl0VNWz1ipKZ8eO2";
  await require("firebase-admin/auth").getAuth(app).createUser({uid:supportUid,email:"browser-support@example.com",password:"Support-test-123!"});
  await db.collection("users").doc(supportUid).set({role:"admin"});
  const support=await (await context()).newPage();await support.goto(URL+"/hesap.html");
  await support.evaluate(async()=>{
   const {getAuth,signInWithEmailAndPassword}=await import("./emulator-auth.js");
   await signInWithEmailAndPassword(getAuth(),"browser-support@example.com","Support-test-123!");
  });
  await support.locator("#review").waitFor({state:"visible"});await support.locator("#loadRequests").click();
  await support.locator("#requests button").filter({hasText:"İncelemeye al"}).waitFor({state:"visible"});
  await support.screenshot({path:path.join(artifacts,"support-deletion-mobile.png"),fullPage:true});
  await support.locator("#reviewPassword").fill("Support-test-123!");
  await support.locator("#requests button").filter({hasText:"İncelemeye al"}).click();
  await support.locator("#requests button").filter({hasText:"Beklemeye geri al"}).waitFor({state:"visible"});
  assert.equal((await operatorRequest.ref.get()).data().status,"processing");
  await operator.reload();await operator.waitForFunction(()=>document.getElementById("status").textContent.includes("işleme alındı"));
  assert.equal(await operator.locator("#cancelForm").isHidden(),true);
  await support.locator("#reviewPassword").fill("Support-test-123!");
  await support.locator("#requests button").filter({hasText:"Beklemeye geri al"}).click();
  await support.locator("#requests button").filter({hasText:"İncelemeye al"}).waitFor({state:"visible"});
  assert.equal((await operatorRequest.ref.get()).data().status,"pending");
  assert.equal(await manager.locator("#review").isHidden(),true);
  console.log("PASS browser: root support review list and reauthenticated processing/reopen; company managers cannot access support controls");
  assert.deepEqual(errors,[],"unhandled browser errors");assert.deepEqual(outbound,[],"unexpected production/network endpoint");assert.deepEqual(failed,[],"failed browser requests");
  fs.writeFileSync(path.join(artifacts,"result.json"),JSON.stringify({project:PROJECT,status:"passed",viewport:"390x844 Chromium",productionRequests:outbound.length,browserErrors:errors,failedRequests:failed},null,2));
 }catch(error){
  for(const [name,page] of [["manager",manager],["operator",operator]])if(page)await page.screenshot({path:path.join(artifacts,name+"-failure.png"),fullPage:true}).catch(()=>{});
  fs.writeFileSync(path.join(artifacts,"failure.json"),JSON.stringify({error:String(error),browserErrors:errors,failedRequests:failed,outbound},null,2));throw error;
 }finally{for(const ctx of contexts)await ctx.close();if(browser)await browser.close();await deleteApp(app)}
})().catch(error=>{console.error(error);process.exitCode=1});
