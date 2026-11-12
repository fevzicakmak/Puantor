import test from "node:test";
import assert from "node:assert/strict";
import {classifyMotion} from "./motion-classifier.js";

test("bozuk veya eksik ölçüm onay üretmez",()=>{
 assert.equal(classifyMotion({rms:NaN,accelThreshold:0.2}).ready,false);
 assert.equal(classifyMotion({stale:true}).state,"sensor_lost");
 assert.equal(classifyMotion({calibrating:true}).state,"calibrating");
});
test("durağan sinyal adayı değildir",()=>{
 const r=classifyMotion({rms:0.02,gyro:0,accelThreshold:0.2,gyroThreshold:4,seconds:20});
 assert.equal(r.state,"still");assert.equal(r.ready,false);
});
test("hareket 12 saniyeden önce hazır değildir",()=>{
 const v={rms:0.8,gyro:13,accelThreshold:0.2,gyroThreshold:4};
 assert.equal(classifyMotion({...v,seconds:11}).ready,false);
 assert.equal(classifyMotion({...v,seconds:12}).ready,true);
});
test("bilek puanına sınır uygulanır",()=>{
 const r=classifyMotion({mode:"wrist",rms:8,gyro:80,accelThreshold:0.2,gyroThreshold:4,seconds:15});
 assert.ok(r.score<=79);
});
test("jiroskop yoksa skor 74 ile sınırlıdır",()=>{
 const r=classifyMotion({rms:8,gyro:null,accelThreshold:0.2,gyroThreshold:4,seconds:15});
 assert.ok(r.score<=74);
});
