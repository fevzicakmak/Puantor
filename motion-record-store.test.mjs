import test from "node:test";
import assert from "node:assert/strict";
import {sanitizeMotionRecords,loadMotionRecords,saveMotionRecords,clearMotionRecords,MOTION_STORAGE_KEY} from "./motion-record-store.js";
function fakeStorage(){
 const m=new Map();
 return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};
}
const row=(i)=>({time:"2026-11-10T10:00:00.000Z",mode:"machine",machine:"test-"+i,motionState:"still",truth:"motor_off"});
test("records survive local save and reload",()=>{
 const st=fakeStorage();assert.deepEqual(saveMotionRecords(st,[row(1)]),{ok:true,count:1});
 assert.equal(loadMotionRecords(st)[0].machine,"test-1");
 assert.equal(clearMotionRecords(st),true);
 assert.deepEqual(loadMotionRecords(st),[]);
});
test("invalid and excess records are excluded",()=>{
 const rows=[null,{time:"x",mode:"invalid",machine:"x"},...Array.from({length:1900},(_,i)=>row(i))];
 const saved=sanitizeMotionRecords(rows);
 assert.equal(saved.length,1800);
 assert.equal(saved[0].machine,"test-100");
});
test("corrupt local data fails closed",()=>{
 const st=fakeStorage();st.setItem(MOTION_STORAGE_KEY,"{");
 assert.deepEqual(loadMotionRecords(st),[]);
});
test("quota error is surfaced, not thrown",()=>{
 const st={setItem(){throw Error("quota exceeded")}};
 const result=saveMotionRecords(st,[row(1)]);
 assert.equal(result.ok,false);
 assert.match(result.error,/quota/i);
});
