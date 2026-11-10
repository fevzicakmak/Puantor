import test from "node:test";
import assert from "node:assert/strict";
import {createMotionTestPanel} from "./motion-test-panel.js";
function panelStub(){
 const els=new Map();
 const root={querySelector(selector){
  if(!els.has(selector))els.set(selector,{style:{},textContent:""});
  return els.get(selector);
 }};
 return {root,get:k=>els.get('[data-role="'+k+'"]')};
}
test("panel renders readings without access to Firebase",()=>{
 const v=panelStub();
 const p=createMotionTestPanel(v.root);
 p.render({message:"Hareket adayı",rms:0.74,gyro:5.6,threshold:0.3,seconds:9,confidenceScore:65});
 assert.equal(v.get("classification").textContent,"Hareket adayı");
 assert.equal(v.get("score").textContent,"65/100");
 assert.equal(v.get("sustained").textContent,"9 sn");
 assert.equal(v.get("accel").textContent,"0.74 m/s²");
 assert.equal(v.get("scorebar").style.width,"65%");
});
test("panel handles missing measurements and stops timer",()=>{
 const v=panelStub();const p=createMotionTestPanel(v.root);
 p.start();assert.equal(p.isActive(),true);
 p.stop();assert.equal(p.isActive(),false);
 p.render({stale:true,message:"Sensör kesildi"});
 assert.equal(v.get("connection").textContent,"Bağlantı kesildi");
 assert.equal(v.get("accel").textContent,"— m/s²");
});
