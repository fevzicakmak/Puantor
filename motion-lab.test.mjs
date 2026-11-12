import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
const html=readFileSync(new URL("./motion-lab.html",import.meta.url),"utf8");
test("standalone lab has controls and no Firebase imports",()=>{
 for(const id of ["mountRule","screenState","truth","label","report","export","clear","live"])
  assert.match(html,new RegExp('id="'+id+'"'));
 const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
 assert.ok(script);
 assert.doesNotMatch(script,/firebase|runTransaction|changeState\(/i);
});
test("standalone browser module passes JavaScript syntax check",()=>{
 const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
 assert.ok(script);
 const result=spawnSync(process.execPath,["--check","--input-type=module"],{input:script,encoding:"utf8"});
 assert.equal(result.status,0,result.stderr);
});

test("automatic sensor startup replaces explicit start button",()=>{
 assert.doesNotMatch(html,/id="start"|id="stop"|id="fixed"/);
 assert.match(html,/function startAutomatic\(/);
 assert.match(html,/document\.addEventListener\("click",firstGesture,true\)/);
 assert.match(html,/typeof DeviceMotionEvent\.requestPermission==="function"/);
 assert.match(html,/void startAutomatic\(\)/);
});

test("field observations autosave every five seconds and export complete archive",()=>{
 assert.match(html,/setInterval\(\(\)=>\{save\(true\);void flushArchive\(\);\},5000\)/);
 assert.match(html,/archiveQueue\.push\(entry\)/);
 assert.match(html,/await readMotionArchive\(archiveDb\)/);
 assert.match(html,/exported\.map\(/);
 assert.match(html,/id="archiveState"/);
});
test("archive module is syntax valid",()=>{
 const filename=new URL("./motion-field-archive.js",import.meta.url);
 const result=spawnSync(process.execPath,["--check",filename.pathname],{encoding:"utf8"});
 assert.equal(result.status,0,result.stderr);
});

test("machine-fixed rule removes pocket and wrist selection from field lab",()=>{
 assert.doesNotMatch(html,/id="mount"/);
 assert.match(html,/Telefon makine kabininde sağlam bir aparata sabitlenmelidir/);
 assert.match(html,/Cep, el ve bilekte ölçüm geçerli saha testi sayılmaz/);
 assert.match(html,/mode:"machine"/);
 assert.match(html,/detector\.setMode\("machine"\)/);
});
test("screen wake lock is best-effort and visibility interruptions warn the operator",()=>{
 assert.match(html,/navigator\.wakeLock\.request\("screen"\)/);
 assert.match(html,/document\.addEventListener\("visibilitychange"/);
 assert.match(html,/Ekran kilidi koruması kapandı/);
 assert.match(html,/tarayıcı ekranı açık tutma izni/);
});
