import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
const html=readFileSync(new URL("./motion-lab.html",import.meta.url),"utf8");
test("standalone lab has controls and no Firebase imports",()=>{
 for(const id of ["start","stop","mount","fixed","truth","label","report","export","clear","live"])
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
