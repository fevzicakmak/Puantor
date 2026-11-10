// Pilot saha analizi. Yalnızca operatörün işaretlediği gerçek durumları sayar.
// İş durumu doğrulaması yerine kullanılmaz.
const positive=new Set(["working","travel"]);
const negative=new Set(["motor_off","idle_engine","walking","phone_handled"]);
export function analyzeMotionRecords(records=[]){
 const rows=records.filter(r=>r&&r.truth&&r.motionState&&r.motionState!=="unknown"&&r.motionState!=="calibrating"&&r.motionState!=="sensor_lost");
 const matrix={tp:0,tn:0,fp:0,fn:0};
 const byTruth={};
 for(const row of rows){
  if(!positive.has(row.truth)&&!negative.has(row.truth))continue;
  const actual=positive.has(row.truth);
  const predicted=row.motionState==="motion_candidate";
  matrix[actual?(predicted?"tp":"fn"):(predicted?"fp":"tn")]++;
  if(!byTruth[row.truth])byTruth[row.truth]={count:0,candidate:0};
  byTruth[row.truth].count++;
  if(predicted)byTruth[row.truth].candidate++;
 }
 const n=Object.values(matrix).reduce((a,b)=>a+b,0);
 const ratio=(a,b)=>b?Math.round(a/b*1000)/10:null;
 return {
  total:n,matrix,byTruth,
  accuracy:ratio(matrix.tp+matrix.tn,n),
  precision:ratio(matrix.tp,matrix.tp+matrix.fp),
  recall:ratio(matrix.tp,matrix.tp+matrix.fn),
  falsePositiveRate:ratio(matrix.fp,matrix.fp+matrix.tn),
  insufficient:n<30
 };
}
