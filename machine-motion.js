import {classifyMotion} from "./motion-classifier.js";
// Puantör hareket pilotu v2 — ivmeölçer + jiroskop. Çalışma kanıtı değildir.
// Veriler yalnızca cihazda işlenir; uygulama sunucusuna sensör akışı gönderilmez.
export class MachineMotionDetector {
 constructor(onUpdate,onDetected){
  this.onUpdate=onUpdate;this.onDetected=onDetected;
  this.mode="machine";this.running=false;this.samples=[];this.baseline=[];this.detectedAt=0;
  this.lastTrigger=-Infinity;this.lastSample=0;this.lastReport=0;this.lastEvent=0;
  this.motionListener=e=>this.handleMotion(e);
  this.visibilityListener=()=>{if(document.hidden){this.detectedAt=0;this.report("Ekran arka planda: ölçüm güvenilir değil; algılama duraklatıldı");}};
  this.watchdog=null;
 }
 setMode(mode){if(this.running)throw Error("Sensör çalışırken mod değiştirilemez");this.mode=mode==="wrist"?"wrist":"machine";}
 report(message,extra={}){this.onUpdate({message,...extra});}
 async start(){
  if(this.running)return true;
  if(!window.isSecureContext||!("DeviceMotionEvent" in window)){
   this.report("HTTPS veya hareket sensörü desteği bulunamadı.");return false;
  }
  try{
   if(typeof DeviceMotionEvent.requestPermission==="function" &&
      await DeviceMotionEvent.requestPermission()!=="granted"){
    this.report("Sensör izni reddedildi.");return false;
   }
   this.samples=[];this.baseline=[];this.detectedAt=0;this.lastEvent=performance.now();
   this.lastTrigger=-Infinity;this.lastSample=0;this.running=true;
   window.addEventListener("devicemotion",this.motionListener,{passive:true});
   document.addEventListener("visibilitychange",this.visibilityListener);
   this.watchdog=setInterval(()=>{
    if(!this.running)return;
    if(document.hidden)return;
    if(performance.now()-this.lastEvent>3500){
     this.detectedAt=0;this.samples=[];
     this.report("Sensör verisi kesildi: otomatik tespit devre dışı.",{stale:true});
    }
   },2000);
   this.report("Kalibrasyon başlıyor: cihazı yerinden oynatmayın.");
   return true;
  }catch(e){this.report("Sensör izni alınamadı: "+e.message);return false;}
 }
 stop(){
  this.running=false;this.detectedAt=0;this.samples=[];this.baseline=[];
  window.removeEventListener("devicemotion",this.motionListener);
  document.removeEventListener("visibilitychange",this.visibilityListener);
  if(this.watchdog!==null)clearInterval(this.watchdog);
  this.watchdog=null;this.report("Sensör ölçümü kapalı.");
 }
 handleMotion(e){
  if(!this.running||document.hidden)return;
  const now=performance.now();
  const a=e.acceleration||e.accelerationIncludingGravity;
  if(!a||![a.x,a.y,a.z].every(Number.isFinite))return;
  this.lastEvent=now;
  if(now-this.lastSample<90)return;
  this.lastSample=now;
  const accel=Math.hypot(a.x,a.y,a.z);
  const r=e.rotationRate;
  const gyro=r&&[r.alpha,r.beta,r.gamma].every(Number.isFinite)
   ?Math.hypot(r.alpha,r.beta,r.gamma):null;
  this.samples.push({t:now,accel,gyro});
  this.samples=this.samples.filter(x=>now-x.t<=1500);
  if(this.samples.length<8)return;
  const mean=this.samples.reduce((s,x)=>s+x.accel,0)/this.samples.length;
  const rms=Math.sqrt(this.samples.reduce((s,x)=>s+(x.accel-mean)**2,0)/this.samples.length);
  const rot=this.samples.filter(x=>x.gyro!==null);
  const gyroMean=rot.length?rot.reduce((s,x)=>s+x.gyro,0)/rot.length:null;
  // İlk 80 geçerli örnek: cihaz/makineye göre sessiz ortam referansı.
  if(this.baseline.length<80){
   this.baseline.push({rms,gyro:gyroMean});
   if(now-this.lastReport>1000){
    this.report("Kalibrasyon "+Math.round(this.baseline.length/80*100)+"%",{calibrating:true,rms,gyro:gyroMean});
    this.lastReport=now;
   }
   return;
  }
  const median=values=>{const s=values.sort((a,b)=>a-b);return s[Math.floor(s.length/2)]||0;};
  const noise=median(this.baseline.map(x=>x.rms));
  const rotNoise=median(this.baseline.map(x=>x.gyro).filter(Number.isFinite));
  const accelThreshold=Math.max(0.15,noise*3.5);
  const gyroThreshold=Math.max(4,rotNoise*3);
  const accelActive=rms>accelThreshold;
  const gyroActive=gyroMean!==null&&gyroMean>gyroThreshold;
  // Gyro tek başına, operatörün telefonu elle çevirmesinden de tetiklenebilir.
  // Pilot yalnızca aday sinyal üretir: muhasebe/başlatma için onaylanmamıştır.
  const candidate=accelActive||gyroActive;
  if(candidate){if(!this.detectedAt)this.detectedAt=now;}
  else this.detectedAt=0;
  const seconds=this.detectedAt?Math.floor((now-this.detectedAt)/1000):0;
  const classification=classifyMotion({rms,gyro:gyroMean,accelThreshold,gyroThreshold,seconds,mode:this.mode});
  if(now-this.lastReport>=1100){
   this.report(classification.label,
    {rms:+rms.toFixed(3),gyro:gyroMean===null?null:+gyroMean.toFixed(2),
     threshold:+accelThreshold.toFixed(3),gyroThreshold:+gyroThreshold.toFixed(2),
     accelActive,gyroActive,seconds,candidate,confidenceScore:classification.score,motionState:classification.state});
   this.lastReport=now;
  }
  if(seconds>=12&&now-this.lastTrigger>=60000){
   this.lastTrigger=now;this.detectedAt=0;
   this.onDetected({rms,gyro:gyroMean,accelActive,gyroActive,confidenceScore:classification.score,motionState:classification.state});
  }
 }
}
