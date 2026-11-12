// Lightweight display-only pilot dashboard: no machine state or Firebase writes.
const fmt=n=>Number.isFinite(n)?Number(n).toFixed(2):"—";
export function createMotionTestPanel(root){
 if(!root)throw Error("Panel elementi bulunamadı");
 const $=selector=>root.querySelector(selector);
 let startedAt=0, active=false, timer=null;
 function drawMeter(selector,value,max){
  const element=$(selector);
  if(!element)return;
  element.style.width=(Number.isFinite(value)?Math.min(100,Math.max(0,value/max*100)):0)+"%";
 }
 function render(data={}){
  const score=Number.isFinite(data.confidenceScore)?data.confidenceScore:0;
  $('[data-role="classification"]').textContent=data.message||"Ölçüm bekleniyor";
  $('[data-role="score"]').textContent=Number.isFinite(data.confidenceScore)?score+"/100":"—";
  $('[data-role="accel"]').textContent=fmt(data.rms)+" m/s²";
  $('[data-role="gyro"]').textContent=fmt(data.gyro)+" °/sn";
  $('[data-role="threshold"]').textContent=fmt(data.threshold)+" m/s²";
  $('[data-role="sustained"]').textContent=(data.seconds||0)+" sn";
  drawMeter('[data-role="scorebar"]',score,100);
  drawMeter('[data-role="accelbar"]',data.rms,3);
  drawMeter('[data-role="gyrobar"]',data.gyro,90);
  const state=data.stale?"Bağlantı kesildi":data.calibrating?"Kalibrasyon":active?"Ölçüm açık":"Beklemede";
  $('[data-role="connection"]').textContent=state;
  $('[data-role="connection"]').style.color=data.stale?"#b91c1c":data.calibrating?"#92400e":"#166534";
 }
 function showElapsed(){
  const sec=active?Math.floor((Date.now()-startedAt)/1000):0;
  $('[data-role="elapsed"]').textContent=String(Math.floor(sec/60)).padStart(2,"0")+":"+String(sec%60).padStart(2,"0");
 }
 function start(){
  if(active)return;active=true;startedAt=Date.now();
  if(timer!==null)clearInterval(timer);
  timer=setInterval(showElapsed,1000);showElapsed();render({message:"Kalibrasyon bekleniyor",calibrating:true});
 }
 function stop(){
  active=false;if(timer!==null)clearInterval(timer);timer=null;
  showElapsed();render({message:"Ölçüm kapalı"});
 }
 return {render,start,stop,isActive:()=>active};
}
