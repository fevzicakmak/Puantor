import test from "node:test";
import assert from "node:assert/strict";
import {analyzeMotionRecords} from "./motion-analysis.js";

const sample=(truth,motionState)=>({truth,motionState});
test("empty data never claims accuracy",()=>{
 const r=analyzeMotionRecords([]);
 assert.equal(r.total,0);
 assert.equal(r.accuracy,null);
 assert.equal(r.insufficient,true);
});
test("confusion matrix separates false alarms and missed activity",()=>{
 const r=analyzeMotionRecords([
  sample("working","motion_candidate"),
  sample("travel","still"),
  sample("motor_off","motion_candidate"),
  sample("idle_engine","still")
 ]);
 assert.deepEqual(r.matrix,{tp:1,tn:1,fp:1,fn:1});
 assert.equal(r.accuracy,50);
 assert.equal(r.falsePositiveRate,50);
});
test("unlabeled and calibration rows excluded",()=>{
 const r=analyzeMotionRecords([sample("working","calibrating"),sample("working","sensor_lost"),sample("","motion_candidate")]);
 assert.equal(r.total,0);
});
