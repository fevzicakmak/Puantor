import test from "node:test";
import assert from "node:assert/strict";
import {MachineMotionDetector} from "./machine-motion.js";
test("mounting mode only accepts machine and wrist values",()=>{
 const d=new MachineMotionDetector(()=>{},()=>{});
 d.setMode("wrist");assert.equal(d.mode,"wrist");
 d.setMode("unknown");assert.equal(d.mode,"machine");
 d.running=true;
 assert.throws(()=>d.setMode("wrist"),/mod değiştirilemez/);
});
test("resetSignal removes stale samples and prior movement",()=>{
 const d=new MachineMotionDetector(()=>{},()=>{});
 d.samples=[{t:1,accel:3}];d.baseline=[{rms:2}];d.detectedAt=123;d.lastSample=99;
 d.resetSignal();
 assert.deepEqual(d.samples,[]);assert.deepEqual(d.baseline,[]);
 assert.equal(d.detectedAt,0);assert.equal(d.lastSample,0);
});
