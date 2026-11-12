// Local-only pilot recording store; never sends sensor measurements to Firebase.
// Bounded store: truncates oldest rows to avoid unbounded browser storage use.
export const MOTION_STORAGE_KEY="puantor.motion.pilot.v1";
export const MOTION_RECORD_LIMIT=1800;
export function sanitizeMotionRecords(rows,max=MOTION_RECORD_LIMIT){
 if(!Array.isArray(rows))return [];
 return rows.filter(r=>r&&typeof r==="object"&&typeof r.time==="string"&&
   ["machine","wrist"].includes(r.mode)&&typeof r.machine==="string")
   .slice(-max).map(r=>({
    time:r.time.slice(0,40), mode:r.mode, machine:r.machine.slice(0,120),
    status:String(r.status??"").slice(0,32),message:String(r.message??"").slice(0,180),
    rms:r.rms??"",gyro:r.gyro??"",accelActive:r.accelActive??"",
    gyroActive:r.gyroActive??"",seconds:r.seconds??"",score:r.score??"",
    motionState:String(r.motionState??"").slice(0,36),truth:String(r.truth??"").slice(0,36)
   }));
}
export function loadMotionRecords(storage){
 try {
  const parsed=JSON.parse(storage.getItem(MOTION_STORAGE_KEY)||"[]");
  return sanitizeMotionRecords(parsed);
 }catch{return [];}
}
export function saveMotionRecords(storage,records){
 try {
  const cleaned=sanitizeMotionRecords(records);
  storage.setItem(MOTION_STORAGE_KEY,JSON.stringify(cleaned));
  return {ok:true,count:cleaned.length};
 }catch(e){return {ok:false,error:String(e?.message||e)};}
}
export function clearMotionRecords(storage){
 try{storage.removeItem(MOTION_STORAGE_KEY);return true;}catch{return false;}
}
